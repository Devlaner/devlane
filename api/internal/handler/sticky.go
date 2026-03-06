package handler

import (
	"net/http"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// StickyHandler serves stickies for the workspace.
type StickyHandler struct {
	Sticky *service.StickyService
}

// List returns the current user's stickies in the workspace.
// GET /api/workspaces/:slug/stickies/
func (h *StickyHandler) List(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	list, err := h.Sticky.List(c.Request.Context(), slug, user.ID)
	if err != nil {
		if err == service.ErrWorkspaceNotFound || err == service.ErrWorkspaceForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list stickies"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// Create creates a sticky.
// POST /api/workspaces/:slug/stickies/
func (h *StickyHandler) Create(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	var body struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Color       string `json:"color"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	sticky, err := h.Sticky.Create(c.Request.Context(), slug, user.ID, body.Name, body.Description, body.Color)
	if err != nil {
		if err == service.ErrWorkspaceNotFound || err == service.ErrWorkspaceForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create sticky"})
		return
	}
	c.JSON(http.StatusCreated, sticky)
}

// Update updates a sticky; owner only.
// PATCH /api/workspaces/:slug/stickies/:id/
func (h *StickyHandler) Update(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid sticky id"})
		return
	}
	var body struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
		Color       *string `json:"color"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	name, desc, color := "", "", ""
	if body.Name != nil {
		name = *body.Name
	}
	if body.Description != nil {
		desc = *body.Description
	}
	if body.Color != nil {
		color = *body.Color
	}
	sticky, err := h.Sticky.Update(c.Request.Context(), slug, id, user.ID, name, desc, color)
	if err != nil {
		if err == service.ErrWorkspaceNotFound || err == service.ErrWorkspaceForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update sticky"})
		return
	}
	c.JSON(http.StatusOK, sticky)
}

// Delete deletes a sticky; owner only.
// DELETE /api/workspaces/:slug/stickies/:id/
func (h *StickyHandler) Delete(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid sticky id"})
		return
	}
	if err := h.Sticky.Delete(c.Request.Context(), slug, id, user.ID); err != nil {
		if err == service.ErrWorkspaceNotFound || err == service.ErrWorkspaceForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete sticky"})
		return
	}
	c.Status(http.StatusNoContent)
}
