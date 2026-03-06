package handler

import (
	"net/http"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// NotificationHandler serves workspace notifications for the current user.
type NotificationHandler struct {
	Notification *service.NotificationService
}

// List returns notifications for the current user in the workspace.
// GET /api/workspaces/:slug/notifications/
func (h *NotificationHandler) List(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	unreadOnly := c.Query("unread_only") == "true"
	list, err := h.Notification.List(c.Request.Context(), slug, user.ID, unreadOnly)
	if err != nil {
		if err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list notifications"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// MarkRead marks a notification as read.
// POST /api/workspaces/:slug/notifications/:id/read/
func (h *NotificationHandler) MarkRead(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid notification ID"})
		return
	}
	if err := h.Notification.MarkRead(c.Request.Context(), id, user.ID); err != nil {
		if err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark read"})
		return
	}
	c.Status(http.StatusNoContent)
}

// MarkAllRead marks all workspace notifications as read for the current user.
// POST /api/workspaces/:slug/notifications/mark-all-read/
func (h *NotificationHandler) MarkAllRead(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	if err := h.Notification.MarkAllRead(c.Request.Context(), slug, user.ID); err != nil {
		if err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark all read"})
		return
	}
	c.Status(http.StatusNoContent)
}
