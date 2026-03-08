package handler

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/minio"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// UploadHandler handles file uploads to MinIO.
type UploadHandler struct {
	Minio *minio.Client
}

var allowedImageTypes = map[string]bool{
	"image/jpeg": true,
	"image/jpg":  true,
	"image/png":  true,
	"image/webp": true,
}

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
func (h *UploadHandler) ServeFile(c *gin.Context) {
	if h.Minio == nil {
		c.Status(http.StatusServiceUnavailable)
		return
	}
	path := strings.TrimPrefix(c.Param("path"), "/")
	if path == "" || strings.Contains(path, "..") || !strings.HasPrefix(path, "uploads/") {
		c.Status(http.StatusBadRequest)
		return
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
	c.DataFromReader(http.StatusOK, info.Size, info.ContentType, obj, nil)
}
