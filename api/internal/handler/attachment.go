package handler

import (
	"net/http"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AttachmentHandler serves file attachment endpoints for issues.
type AttachmentHandler struct {
	Attachment *service.AttachmentService
}

// InitiateUpload creates the asset/attachment records and returns a presigned upload URL.
// POST /api/assets/v2/workspaces/:slug/projects/:projectId/issues/:issueId/attachments/
func (h *AttachmentHandler) InitiateUpload(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	projectID, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}
	issueID, err := uuid.Parse(c.Param("issueId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid issue ID"})
		return
	}
	var body struct {
		Name string  `json:"name" binding:"required"`
		Size float64 `json:"size"`
		Type string  `json:"type"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	resp, err := h.Attachment.InitiateUpload(c.Request.Context(), slug, projectID, issueID, user.ID, body.Name, body.Size, body.Type)
	if err != nil {
		if err == service.ErrProjectForbidden || err == service.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		if err.Error() == "file storage is not configured" {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "File storage is not configured"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initiate upload"})
		return
	}
	c.JSON(http.StatusCreated, resp)
}

// ConfirmUpload marks the upload as complete.
// PATCH /api/assets/v2/workspaces/:slug/projects/:projectId/issues/:issueId/attachments/:assetId/
func (h *AttachmentHandler) ConfirmUpload(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	projectID, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}
	issueID, err := uuid.Parse(c.Param("issueId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid issue ID"})
		return
	}
	assetID, err := uuid.Parse(c.Param("assetId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid asset ID"})
		return
	}
	if err := h.Attachment.ConfirmUpload(c.Request.Context(), slug, projectID, issueID, assetID, user.ID); err != nil {
		if err == service.ErrAttachmentNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to confirm upload"})
		return
	}
	c.Status(http.StatusNoContent)
}

// ListAttachments returns uploaded attachments for an issue.
// GET /api/assets/v2/workspaces/:slug/projects/:projectId/issues/:issueId/attachments/
func (h *AttachmentHandler) ListAttachments(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	projectID, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}
	issueID, err := uuid.Parse(c.Param("issueId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid issue ID"})
		return
	}
	list, err := h.Attachment.ListAttachments(c.Request.Context(), slug, projectID, issueID, user.ID)
	if err != nil {
		if err == service.ErrProjectForbidden || err == service.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list attachments"})
		return
	}
	if list == nil {
		c.JSON(http.StatusOK, []interface{}{})
		return
	}
	c.JSON(http.StatusOK, list)
}

// DeleteAttachment removes an attachment.
// DELETE /api/assets/v2/workspaces/:slug/projects/:projectId/issues/:issueId/attachments/:assetId/
func (h *AttachmentHandler) DeleteAttachment(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	projectID, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}
	issueID, err := uuid.Parse(c.Param("issueId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid issue ID"})
		return
	}
	assetID, err := uuid.Parse(c.Param("assetId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid asset ID"})
		return
	}
	if err := h.Attachment.DeleteAttachment(c.Request.Context(), slug, projectID, issueID, assetID, user.ID); err != nil {
		if err == service.ErrAttachmentNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete attachment"})
		return
	}
	c.Status(http.StatusNoContent)
}
