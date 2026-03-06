package handler

import (
	"net/http"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// WorkspaceLinkHandler serves quick links for the workspace.
type WorkspaceLinkHandler struct {
	Link *service.WorkspaceLinkService
}

// List returns the current user's quick links in the workspace.
// GET /api/workspaces/:slug/quick-links/
func (h *WorkspaceLinkHandler) List(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	list, err := h.Link.List(c.Request.Context(), slug, user.ID)
	if err != nil {
		if err == service.ErrWorkspaceNotFound || err == service.ErrWorkspaceForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list quick links"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// Create creates a quick link.
// POST /api/workspaces/:slug/quick-links/
func (h *WorkspaceLinkHandler) Create(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	var body struct {
		Title     string      `json:"title"`
		URL       string      `json:"url" binding:"required"`
		ProjectID *uuid.UUID  `json:"project_id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	link, err := h.Link.Create(c.Request.Context(), slug, user.ID, body.Title, body.URL, body.ProjectID)
	if err != nil {
		if err == service.ErrWorkspaceNotFound || err == service.ErrWorkspaceForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create quick link"})
		return
	}
	c.JSON(http.StatusCreated, link)
}

// Update updates a quick link; owner only.
// PATCH /api/workspaces/:slug/quick-links/:id/
func (h *WorkspaceLinkHandler) Update(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid link id"})
		return
	}
	var body struct {
		Title *string `json:"title"`
		URL   *string `json:"url"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	title, url := "", ""
	if body.Title != nil {
		title = *body.Title
	}
	if body.URL != nil {
		url = *body.URL
	}
	link, err := h.Link.Update(c.Request.Context(), slug, id, user.ID, title, url)
	if err != nil {
		if err == service.ErrWorkspaceNotFound || err == service.ErrWorkspaceForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update quick link"})
		return
	}
	c.JSON(http.StatusOK, link)
}

// Delete deletes a quick link; owner only.
// DELETE /api/workspaces/:slug/quick-links/:id/
func (h *WorkspaceLinkHandler) Delete(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid link id"})
		return
	}
	if err := h.Link.Delete(c.Request.Context(), slug, id, user.ID); err != nil {
		if err == service.ErrWorkspaceNotFound || err == service.ErrWorkspaceForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete quick link"})
		return
	}
	c.Status(http.StatusNoContent)
}
