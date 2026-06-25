package handler

import (
	"net/http"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func moduleLinkNotFound(err error) bool {
	return err == service.ErrModuleNotFound || err == service.ErrProjectForbidden || err == service.ErrProjectNotFound
}

// moduleCtx parses slug + projectId + moduleId + authenticated user.
func (h *ModuleHandler) moduleCtx(c *gin.Context) (slug string, projectID, moduleID, userID uuid.UUID, ok bool) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug = c.Param("slug")
	var err error
	if projectID, err = uuid.Parse(c.Param("projectId")); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}
	if moduleID, err = uuid.Parse(c.Param("moduleId")); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid module ID"})
		return
	}
	return slug, projectID, moduleID, user.ID, true
}

// ListLinks returns a module's external links.
// GET /api/workspaces/:slug/projects/:projectId/modules/:moduleId/links/
func (h *ModuleHandler) ListLinks(c *gin.Context) {
	slug, projectID, moduleID, userID, ok := h.moduleCtx(c)
	if !ok {
		return
	}
	links, err := h.Module.ListLinks(c.Request.Context(), slug, projectID, moduleID, userID)
	if err != nil {
		if moduleLinkNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list links"})
		return
	}
	if links == nil {
		c.JSON(http.StatusOK, []interface{}{})
		return
	}
	c.JSON(http.StatusOK, links)
}

// CreateLink adds an external link to a module.
// POST /api/workspaces/:slug/projects/:projectId/modules/:moduleId/links/
func (h *ModuleHandler) CreateLink(c *gin.Context) {
	slug, projectID, moduleID, userID, ok := h.moduleCtx(c)
	if !ok {
		return
	}
	var body struct {
		Title string `json:"title"`
		URL   string `json:"url" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	l, err := h.Module.CreateLink(c.Request.Context(), slug, projectID, moduleID, userID, body.Title, body.URL)
	if err != nil {
		if moduleLinkNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create link"})
		return
	}
	c.JSON(http.StatusCreated, l)
}

// UpdateLink edits a module link's title or URL.
// PATCH /api/workspaces/:slug/projects/:projectId/modules/:moduleId/links/:linkId/
func (h *ModuleHandler) UpdateLink(c *gin.Context) {
	slug, projectID, moduleID, userID, ok := h.moduleCtx(c)
	if !ok {
		return
	}
	linkID, err := uuid.Parse(c.Param("linkId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid link ID"})
		return
	}
	var body struct {
		Title string `json:"title"`
		URL   string `json:"url"`
	}
	_ = c.ShouldBindJSON(&body)
	l, err := h.Module.UpdateLink(c.Request.Context(), slug, projectID, moduleID, linkID, userID, body.Title, body.URL)
	if err != nil {
		if moduleLinkNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update link"})
		return
	}
	c.JSON(http.StatusOK, l)
}

// DeleteLink removes a module link.
// DELETE /api/workspaces/:slug/projects/:projectId/modules/:moduleId/links/:linkId/
func (h *ModuleHandler) DeleteLink(c *gin.Context) {
	slug, projectID, moduleID, userID, ok := h.moduleCtx(c)
	if !ok {
		return
	}
	linkID, err := uuid.Parse(c.Param("linkId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid link ID"})
		return
	}
	if err := h.Module.DeleteLink(c.Request.Context(), slug, projectID, moduleID, linkID, userID); err != nil {
		if moduleLinkNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete link"})
		return
	}
	c.Status(http.StatusNoContent)
}
