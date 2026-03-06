package handler

import (
	"net/http"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// LabelHandler serves issue labels for a project.
type LabelHandler struct {
	Label *service.LabelService
}

func labelID(c *gin.Context) (uuid.UUID, bool) {
	idStr := c.Param("pk")
	if idStr == "" {
		idStr = c.Param("labelId")
	}
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid label ID"})
		return uuid.Nil, false
	}
	return id, true
}

// List returns issue labels for the project.
// GET /api/workspaces/:slug/projects/:projectId/issue-labels/
func (h *LabelHandler) List(c *gin.Context) {
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
	list, err := h.Label.ListByProject(c.Request.Context(), slug, projectID, user.ID)
	if err != nil {
		if err == service.ErrProjectForbidden || err == service.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list labels"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// Create creates an issue label.
// POST /api/workspaces/:slug/projects/:projectId/issue-labels/
func (h *LabelHandler) Create(c *gin.Context) {
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
	var body struct {
		Name  string `json:"name" binding:"required"`
		Color string `json:"color"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	l, err := h.Label.Create(c.Request.Context(), slug, projectID, user.ID, body.Name, body.Color)
	if err != nil {
		if err == service.ErrProjectForbidden || err == service.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create label"})
		return
	}
	c.JSON(http.StatusCreated, l)
}

// Update updates an issue label.
// PATCH /api/workspaces/:slug/projects/:projectId/issue-labels/:pk/
func (h *LabelHandler) Update(c *gin.Context) {
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
	labelID, ok := labelID(c)
	if !ok {
		return
	}
	var body struct {
		Name  string `json:"name"`
		Color string `json:"color"`
	}
	_ = c.ShouldBindJSON(&body)
	var name, color *string
	if body.Name != "" {
		name = &body.Name
	}
	if body.Color != "" {
		color = &body.Color
	}
	l, err := h.Label.Update(c.Request.Context(), slug, projectID, labelID, user.ID, name, color)
	if err != nil {
		if err == service.ErrLabelNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Label not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update label"})
		return
	}
	c.JSON(http.StatusOK, l)
}

// Delete deletes an issue label.
// DELETE /api/workspaces/:slug/projects/:projectId/issue-labels/:pk/
func (h *LabelHandler) Delete(c *gin.Context) {
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
	labelID, ok := labelID(c)
	if !ok {
		return
	}
	if err := h.Label.Delete(c.Request.Context(), slug, projectID, labelID, user.ID); err != nil {
		if err == service.ErrLabelNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Label not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete label"})
		return
	}
	c.Status(http.StatusNoContent)
}
