package handler

import (
	"net/http"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// IssueViewHandler serves saved issue views (workspace or project scoped).
type IssueViewHandler struct {
	IssueView *service.IssueViewService
}

// List returns issue views; optional project_id filters by project.
// GET /api/workspaces/:slug/views/
func (h *IssueViewHandler) List(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	var projectID *uuid.UUID
	if p := c.Query("project_id"); p != "" {
		id, err := uuid.Parse(p)
		if err == nil {
			projectID = &id
		}
	}
	list, err := h.IssueView.List(c.Request.Context(), slug, projectID, user.ID)
	if err != nil {
		if err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list views"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// Create creates a saved issue view.
// POST /api/workspaces/:slug/views/
func (h *IssueViewHandler) Create(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	var body struct {
		Name              string        `json:"name" binding:"required"`
		Description       string        `json:"description"`
		ProjectID         *uuid.UUID    `json:"project_id"`
		Query             model.JSONMap `json:"query"`
		Filters           model.JSONMap `json:"filters"`
		DisplayFilters    model.JSONMap `json:"display_filters"`
		DisplayProperties model.JSONMap `json:"display_properties"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	iv, err := h.IssueView.Create(c.Request.Context(), slug, body.ProjectID, user.ID, body.Name, body.Description, body.Query, body.Filters, body.DisplayFilters, body.DisplayProperties)
	if err != nil {
		if err == service.ErrProjectForbidden || err == service.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create view"})
		return
	}
	c.JSON(http.StatusCreated, iv)
}

// Get returns an issue view by id.
// GET /api/workspaces/:slug/views/:viewId/
func (h *IssueViewHandler) Get(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	viewID, err := uuid.Parse(c.Param("viewId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid view ID"})
		return
	}
	iv, err := h.IssueView.Get(c.Request.Context(), slug, viewID, user.ID)
	if err != nil {
		if err == service.ErrIssueViewNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get view"})
		return
	}
	c.JSON(http.StatusOK, iv)
}

// Update updates an issue view.
// PATCH /api/workspaces/:slug/views/:viewId/
func (h *IssueViewHandler) Update(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	viewID, err := uuid.Parse(c.Param("viewId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid view ID"})
		return
	}
	var body struct {
		Name              string        `json:"name"`
		Description       string        `json:"description"`
		Query             model.JSONMap `json:"query"`
		Filters           model.JSONMap `json:"filters"`
		DisplayFilters    model.JSONMap `json:"display_filters"`
		DisplayProperties model.JSONMap `json:"display_properties"`
	}
	_ = c.ShouldBindJSON(&body)
	iv, err := h.IssueView.Update(c.Request.Context(), slug, viewID, user.ID, body.Name, body.Description, body.Query, body.Filters, body.DisplayFilters, body.DisplayProperties)
	if err != nil {
		if err == service.ErrIssueViewNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update view"})
		return
	}
	c.JSON(http.StatusOK, iv)
}

// Delete deletes an issue view.
// DELETE /api/workspaces/:slug/views/:viewId/
func (h *IssueViewHandler) Delete(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	viewID, err := uuid.Parse(c.Param("viewId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid view ID"})
		return
	}
	if err := h.IssueView.Delete(c.Request.Context(), slug, viewID, user.ID); err != nil {
		if err == service.ErrIssueViewNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete view"})
		return
	}
	c.Status(http.StatusNoContent)
}
