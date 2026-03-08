package handler

import (
	"net/http"
	"strconv"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// RecentVisitHandler serves recent visits for the workspace.
type RecentVisitHandler struct {
	Recent *service.RecentVisitService
}

// List returns the current user's recent visits with display details.
// GET /api/workspaces/:slug/recent-visits/
func (h *RecentVisitHandler) List(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	limit := 20
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 100 {
			limit = n
		}
	}
	list, err := h.Recent.ListWithDetails(c.Request.Context(), slug, user.ID, limit)
	if err != nil {
		if err == service.ErrWorkspaceNotFound || err == service.ErrWorkspaceForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list recent visits"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// Record records or updates a recent visit for an entity (issue, project, page).
// POST /api/workspaces/:slug/recent-visits/
func (h *RecentVisitHandler) Record(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	var body struct {
		EntityName       string     `json:"entity_name" binding:"required"` // "issue", "project", "page"
		EntityIdentifier *uuid.UUID `json:"entity_identifier"`
		ProjectID        *uuid.UUID `json:"project_id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	if err := h.Recent.RecordVisit(c.Request.Context(), slug, user.ID, body.EntityName, body.EntityIdentifier, body.ProjectID); err != nil {
		if err == service.ErrWorkspaceNotFound || err == service.ErrWorkspaceForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record visit"})
		return
	}
	c.Status(http.StatusNoContent)
}
