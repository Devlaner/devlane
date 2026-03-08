package handler

import (
	"net/http"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// PageHandler serves pages (workspace or project scoped).
type PageHandler struct {
	Page *service.PageService
}

// List returns pages; optional project_id filters by project.
// GET /api/workspaces/:slug/pages/
func (h *PageHandler) List(c *gin.Context) {
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
	list, err := h.Page.List(c.Request.Context(), slug, projectID, user.ID)
	if err != nil {
		if err == service.ErrProjectForbidden || err == service.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list pages"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// Create creates a page.
// POST /api/workspaces/:slug/pages/
func (h *PageHandler) Create(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	var body struct {
		Name            string     `json:"name" binding:"required"`
		DescriptionHTML string     `json:"description_html"`
		ProjectID       *uuid.UUID `json:"project_id"`
		Access          int16      `json:"access"` // 0 public, 1 private
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	page, err := h.Page.Create(c.Request.Context(), slug, body.ProjectID, user.ID, body.Name, body.DescriptionHTML, body.Access)
	if err != nil {
		if err == service.ErrProjectForbidden || err == service.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create page"})
		return
	}
	c.JSON(http.StatusCreated, page)
}

// Get returns a page by id.
// GET /api/workspaces/:slug/pages/:pageId/
func (h *PageHandler) Get(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	pageID, err := uuid.Parse(c.Param("pageId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid page ID"})
		return
	}
	page, err := h.Page.Get(c.Request.Context(), slug, pageID, user.ID)
	if err != nil {
		if err == service.ErrPageNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get page"})
		return
	}
	c.JSON(http.StatusOK, page)
}

// Update updates a page.
// PATCH /api/workspaces/:slug/pages/:pageId/
func (h *PageHandler) Update(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	pageID, err := uuid.Parse(c.Param("pageId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid page ID"})
		return
	}
	var body struct {
		Name            string `json:"name"`
		DescriptionHTML string `json:"description_html"`
		Access          *int16 `json:"access"`
	}
	_ = c.ShouldBindJSON(&body)
	page, err := h.Page.Update(c.Request.Context(), slug, pageID, user.ID, body.Name, body.DescriptionHTML, body.Access)
	if err != nil {
		if err == service.ErrPageNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update page"})
		return
	}
	c.JSON(http.StatusOK, page)
}

// Delete deletes a page.
// DELETE /api/workspaces/:slug/pages/:pageId/
func (h *PageHandler) Delete(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	pageID, err := uuid.Parse(c.Param("pageId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid page ID"})
		return
	}
	if err := h.Page.Delete(c.Request.Context(), slug, pageID, user.ID); err != nil {
		if err == service.ErrPageNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete page"})
		return
	}
	c.Status(http.StatusNoContent)
}
