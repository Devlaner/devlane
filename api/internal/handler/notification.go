package handler

import (
	"net/http"
	"time"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// NotificationHandler serves workspace notifications for the current user.
type NotificationHandler struct {
	Notification *service.NotificationService
}

// List returns notifications for the current user in the workspace.
// GET /api/workspaces/:slug/notifications/?unread_only=true|false&mentions=true|false
func (h *NotificationHandler) List(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	opts := store.ListOpts{
		UnreadOnly:   c.Query("unread_only") == "true",
		MentionsOnly: c.Query("mentions") == "true",
	}
	switch c.Query("archived") {
	case "true":
		t := true
		opts.Archived = &t
		// Archived view should also surface snoozed rows so users can manage
		// them — otherwise a row that was both archived and snoozed becomes
		// invisible until the snooze expires.
		opts.IncludeSnoozed = true
	case "all":
		opts.IncludeArchived = true
		opts.IncludeSnoozed = true
	}
	list, err := h.Notification.List(c.Request.Context(), slug, user.ID, opts)
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

// UnreadCount returns the number of unread notifications for the current user
// in the workspace, with the mentions count broken out for the bell badge.
// GET /api/workspaces/:slug/notifications/unread-count/
func (h *NotificationHandler) UnreadCount(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	total, mentions, err := h.Notification.UnreadCount(c.Request.Context(), slug, user.ID)
	if err != nil {
		if err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count notifications"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"total": total, "mentions": mentions})
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

// SnoozeRequest is the body for the Snooze endpoint.
type SnoozeRequest struct {
	Until time.Time `json:"until"`
}

// Snooze hides a notification until the given timestamp.
// POST /api/workspaces/:slug/notifications/:id/snooze/   body: {"until": "2026-05-06T09:00:00Z"}
func (h *NotificationHandler) Snooze(c *gin.Context) {
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
	var req SnoozeRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.Until.IsZero() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	if err := h.Notification.Snooze(c.Request.Context(), id, user.ID, req.Until); err != nil {
		switch err {
		case service.ErrProjectForbidden:
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		case service.ErrInvalidSnooze:
			c.JSON(http.StatusBadRequest, gin.H{"error": "Snooze time must be in the future"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to snooze"})
		}
		return
	}
	c.Status(http.StatusNoContent)
}

// Unsnooze clears a notification's snooze.
// DELETE /api/workspaces/:slug/notifications/:id/snooze/
func (h *NotificationHandler) Unsnooze(c *gin.Context) {
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
	if err := h.Notification.Unsnooze(c.Request.Context(), id, user.ID); err != nil {
		if err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to unsnooze"})
		return
	}
	c.Status(http.StatusNoContent)
}

// Archive flags a notification as archived for the receiver.
// POST /api/workspaces/:slug/notifications/:id/archive/
func (h *NotificationHandler) Archive(c *gin.Context) {
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
	if err := h.Notification.Archive(c.Request.Context(), id, user.ID); err != nil {
		if err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to archive"})
		return
	}
	c.Status(http.StatusNoContent)
}

// Unarchive restores an archived notification.
// DELETE /api/workspaces/:slug/notifications/:id/archive/
func (h *NotificationHandler) Unarchive(c *gin.Context) {
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
	if err := h.Notification.Unarchive(c.Request.Context(), id, user.ID); err != nil {
		if err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to unarchive"})
		return
	}
	c.Status(http.StatusNoContent)
}

// MarkUnread re-flags a previously-read notification.
// DELETE /api/workspaces/:slug/notifications/:id/read/
func (h *NotificationHandler) MarkUnread(c *gin.Context) {
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
	if err := h.Notification.MarkUnread(c.Request.Context(), id, user.ID); err != nil {
		if err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark unread"})
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
