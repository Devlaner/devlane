package handler

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/minio"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// UploadHandler handles file uploads to MinIO.
type UploadHandler struct {
	Minio *minio.Client
	// Attachments authorizes downloads of attachment objects. Optional: when
	// nil, attachment paths are refused (they can't be safely served).
	Attachments *service.AttachmentService
}

var allowedImageTypes = map[string]bool{
	"image/jpeg": true,
	"image/jpg":  true,
	"image/png":  true,
	"image/webp": true,
}

// maxUploadSize caps generic uploads (avatars/covers/logos) to a sane size
// for profile-type images; the larger issue-attachment flow has its own cap.
const maxUploadSize = 5 << 20 // 5 MiB

// Upload accepts a multipart file and uploads it to MinIO.
// POST /api/upload
// Form: file (required). Returns { "url": "/api/files/uploads/..." }.
func (h *UploadHandler) Upload(c *gin.Context) {
	if h.Minio == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "File upload is not configured"})
		return
	}
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file provided", "detail": err.Error()})
		return
	}
	if file.Size > maxUploadSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File too large. Maximum size is 5MB."})
		return
	}

	f, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file"})
		return
	}
	defer f.Close()

	// Detect MIME from file bytes instead of trusting client Content-Type
	buf := make([]byte, 512)
	n, _ := io.ReadFull(f, buf)
	buf = buf[:n]
	contentType := http.DetectContentType(buf)
	// Go's DetectContentType may not recognize WebP; check magic bytes (RIFF....WEBP)
	if contentType == "application/octet-stream" && n >= 12 && string(buf[0:4]) == "RIFF" && string(buf[8:12]) == "WEBP" {
		contentType = "image/webp"
	}
	if !allowedImageTypes[contentType] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file type. Supported: .jpeg, .jpg, .png, .webp"})
		return
	}

	// Recombine read bytes with remainder for upload
	body := io.MultiReader(bytes.NewReader(buf), f)

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext == "" {
		ext = ".jpg"
	}
	if ext != ".jpeg" && ext != ".jpg" && ext != ".png" && ext != ".webp" {
		ext = ".jpg"
	}

	now := time.Now().UTC()
	objectName := fmt.Sprintf("uploads/%d/%02d/%s%s", now.Year(), now.Month(), uuid.New().String(), ext)

	if err := h.Minio.PutObject(c.Request.Context(), objectName, body, file.Size, contentType); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upload file"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"url": "/api/files/" + objectName})
}

// ServeFile streams a file from MinIO by path.
// GET /api/files/*path
// isServableObjectPath allows only the object prefixes we intend to serve —
// generic uploads (avatars/covers/logos) and issue attachments — and rejects
// empty paths and path traversal. Attachments live under
// "attachments/<issueId>/<assetId>", so serving only "uploads/" made every
// attachment download fail with 400.
func isServableObjectPath(path string) bool {
	if path == "" || strings.Contains(path, "..") {
		return false
	}
	return strings.HasPrefix(path, "uploads/") || strings.HasPrefix(path, "attachments/")
}

// parseAttachmentPath extracts the issue and asset ids from an object path of the
// form "attachments/<issueID>/<assetID>".
func parseAttachmentPath(path string) (issueID, assetID uuid.UUID, ok bool) {
	parts := strings.Split(path, "/")
	if len(parts) != 3 || parts[0] != "attachments" {
		return uuid.Nil, uuid.Nil, false
	}
	iid, err1 := uuid.Parse(parts[1])
	aid, err2 := uuid.Parse(parts[2])
	if err1 != nil || err2 != nil {
		return uuid.Nil, uuid.Nil, false
	}
	return iid, aid, true
}

func (h *UploadHandler) ServeFile(c *gin.Context) {
	if h.Minio == nil {
		c.Status(http.StatusServiceUnavailable)
		return
	}
	path := strings.TrimPrefix(c.Param("path"), "/")
	if !isServableObjectPath(path) {
		c.Status(http.StatusBadRequest)
		return
	}

	// Attachment objects are per-issue, so authorize the caller against the
	// attachment's workspace before streaming — otherwise a leaked object URL
	// would be fetchable by anyone signed in. A 404 is returned for both missing
	// and forbidden so we don't reveal which attachments exist.
	if strings.HasPrefix(path, "attachments/") {
		if h.Attachments == nil {
			c.Status(http.StatusServiceUnavailable)
			return
		}
		user := middleware.GetUser(c)
		if user == nil {
			c.Status(http.StatusUnauthorized)
			return
		}
		issueID, assetID, ok := parseAttachmentPath(path)
		if !ok {
			c.Status(http.StatusBadRequest)
			return
		}
		if err := h.Attachments.AuthorizeDownload(c.Request.Context(), issueID, assetID, user.ID); err != nil {
			if errors.Is(err, service.ErrAttachmentNotFound) || errors.Is(err, service.ErrProjectForbidden) {
				c.Status(http.StatusNotFound)
			} else {
				c.Status(http.StatusInternalServerError)
			}
			return
		}
	}

	obj, err := h.Minio.GetObject(c.Request.Context(), path)
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}
	defer obj.Close()

	info, err := obj.Stat()
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}

	c.Header("Content-Type", info.ContentType)
	c.Header("X-Content-Type-Options", "nosniff")
	// Attachments are arbitrary user files with an unvalidated content-type, so
	// force a download instead of rendering them inline: an uploaded .html or
	// SVG would otherwise execute on the API origin when opened. The uploads/
	// prefix (avatars, covers, logos) is validated as images and stays inline.
	disposition := "inline"
	if strings.HasPrefix(path, "attachments/") {
		disposition = "attachment"
	}
	c.Header("Content-Disposition", disposition)
	c.DataFromReader(http.StatusOK, info.Size, info.ContentType, obj, nil)
}
