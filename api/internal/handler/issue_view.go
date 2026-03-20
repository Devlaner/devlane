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

// ListFavorites returns issue views favorited by the current user in this workspace.
// GET /api/workspaces/:slug/views/favorites/
func (h *IssueViewHandler) ListFavorites(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	list, err := h.IssueView.ListFavorites(c.Request.Context(), slug, user.ID)
	if err != nil {
		if err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list favorite views"})
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

// FavoriteWrongMethod handles GET (and any unsupported verb) on the favorite URL.
// Browsers open links with GET, so users who paste the API path see a clear message
// instead of a generic 404 — the real actions are POST (favorite) and DELETE (unfavorite).
func (h *IssueViewHandler) FavoriteWrongMethod(c *gin.Context) {
	c.Header("Allow", "POST, DELETE")
	c.JSON(http.StatusMethodNotAllowed, gin.H{
		"error": "Method not allowed",
		"detail": "Use POST (while signed in) to favorite this view or DELETE to unfavorite it. " +
			"Opening this URL in a tab sends GET, which does not change favorites.",
	})
}

// AddFavorite favorites a saved view for the current user.
// POST /api/workspaces/:slug/views/:viewId/favorite
func (h *IssueViewHandler) AddFavorite(c *gin.Context) {
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
	if err := h.IssueView.AddFavorite(c.Request.Context(), slug, viewID, user.ID); err != nil {
		if err == service.ErrIssueViewNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to favorite view"})
		return
	}
	c.Status(http.StatusNoContent)
}

// RemoveFavorite removes the current user's favorite on a saved view.
// DELETE /api/workspaces/:slug/views/:viewId/favorite
func (h *IssueViewHandler) RemoveFavorite(c *gin.Context) {
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
	if err := h.IssueView.RemoveFavorite(c.Request.Context(), slug, viewID, user.ID); err != nil {
		if err == service.ErrIssueViewNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove favorite"})
		return
	}
	c.Status(http.StatusNoContent)
}
