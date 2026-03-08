package handler

import (
	"net/http"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/gin-gonic/gin"
)

// FavoriteHandler serves user favorite project endpoints.
type FavoriteHandler struct {
	Project   *service.ProjectService
	Favorites *store.UserFavoriteStore
}

// ListFavoriteProjects returns the list of favorited project IDs for the current user.
// GET /api/users/me/favorite-projects/
func (h *FavoriteHandler) ListFavoriteProjects(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	if h.Favorites == nil {
		c.JSON(http.StatusOK, gin.H{"project_ids": []string{}})
		return
	}
	ids, err := h.Favorites.ListProjectIDsByUser(c.Request.Context(), user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load favorites"})
		return
	}
	strIds := make([]string, 0, len(ids))
	for _, id := range ids {
		strIds = append(strIds, id.String())
	}
	c.JSON(http.StatusOK, gin.H{"project_ids": strIds})
}

// AddFavoriteProject adds a project to the current user's favorites.
// POST /api/workspaces/:slug/projects/:projectId/favorite
func (h *FavoriteHandler) AddFavoriteProject(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	projectID, ok := projectID(c)
	if !ok {
		return
	}
	if h.Favorites == nil || h.Project == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Favorites not available"})
		return
	}
	project, err := h.Project.GetByID(c.Request.Context(), slug, projectID, user.ID)
	if err != nil {
		if err == service.ErrProjectNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add favorite"})
		return
	}
	if err := h.Favorites.AddProject(c.Request.Context(), user.ID, project.WorkspaceID, projectID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add favorite"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"project_id": projectID.String()})
}

// RemoveFavoriteProject removes a project from the current user's favorites.
// DELETE /api/workspaces/:slug/projects/:projectId/favorite
func (h *FavoriteHandler) RemoveFavoriteProject(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	projectID, ok := projectID(c)
	if !ok {
		return
	}
	if h.Favorites == nil {
		c.JSON(http.StatusOK, gin.H{"message": "ok"})
		return
	}
	// Verify user has access by resolving workspace + project
	slug := c.Param("slug")
	if _, err := h.Project.GetByID(c.Request.Context(), slug, projectID, user.ID); err != nil {
		if err == service.ErrProjectNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove favorite"})
		return
	}
	if err := h.Favorites.RemoveProject(c.Request.Context(), user.ID, projectID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove favorite"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}
