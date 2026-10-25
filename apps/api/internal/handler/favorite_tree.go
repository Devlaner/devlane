package handler

import (
	"net/http"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ListFavorites returns the user's full favorites tree (entities + folders) for
// a workspace.
// GET /api/workspaces/:slug/favorites/
func (h *FavoriteHandler) ListFavorites(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	if h.Fav == nil {
		c.JSON(http.StatusOK, []any{})
		return
	}
	list, err := h.Fav.List(c.Request.Context(), c.Param("slug"), user.ID)
	if err != nil {
		h.favError(c, err)
		return
	}
	c.JSON(http.StatusOK, list)
}

// CreateFavorite favorites a cycle/module, or creates a folder when is_folder is
// true.
// POST /api/workspaces/:slug/favorites/
func (h *FavoriteHandler) CreateFavorite(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	if h.Fav == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Favorites not available"})
		return
	}
	var body struct {
		IsFolder   bool   `json:"is_folder"`
		Name       string `json:"name"`
		EntityType string `json:"entity_type"`
		EntityID   string `json:"entity_id"`
		ProjectID  string `json:"project_id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	ctx := c.Request.Context()
	slug := c.Param("slug")
	if body.IsFolder {
		fav, err := h.Fav.CreateFolder(ctx, slug, user.ID, body.Name)
		if err != nil {
			h.favError(c, err)
			return
		}
		c.JSON(http.StatusCreated, fav)
		return
	}
	entityID, err := uuid.Parse(body.EntityID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid entity_id"})
		return
	}
	projectID, err := uuid.Parse(body.ProjectID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project_id"})
		return
	}
	fav, err := h.Fav.AddEntity(ctx, slug, user.ID, body.EntityType, entityID, projectID, body.Name)
	if err != nil {
		h.favError(c, err)
		return
	}
	c.JSON(http.StatusCreated, fav)
}

// UpdateFavorite renames, moves, and/or reorders a favorite.
// PATCH /api/workspaces/:slug/favorites/:favId/
func (h *FavoriteHandler) UpdateFavorite(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	if h.Fav == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Favorites not available"})
		return
	}
	id, err := uuid.Parse(c.Param("favId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid favorite ID"})
		return
	}
	var body struct {
		Name      *string  `json:"name"`
		ParentID  *string  `json:"parent_id"`
		SortOrder *float64 `json:"sort_order"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	// parent_id present (even as null/"") means "move"; a non-empty string must parse.
	var parentID *uuid.UUID
	parentSet := body.ParentID != nil
	if parentSet && *body.ParentID != "" {
		pid, perr := uuid.Parse(*body.ParentID)
		if perr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parent_id"})
			return
		}
		parentID = &pid
	}
	fav, err := h.Fav.Update(c.Request.Context(), c.Param("slug"), user.ID, id, body.Name, parentSet, parentID, body.SortOrder)
	if err != nil {
		h.favError(c, err)
		return
	}
	c.JSON(http.StatusOK, fav)
}

// DeleteFavorite removes a favorite or folder.
// DELETE /api/workspaces/:slug/favorites/:favId/
func (h *FavoriteHandler) DeleteFavorite(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	if h.Fav == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Favorites not available"})
		return
	}
	id, err := uuid.Parse(c.Param("favId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid favorite ID"})
		return
	}
	if err := h.Fav.Delete(c.Request.Context(), c.Param("slug"), user.ID, id); err != nil {
		h.favError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *FavoriteHandler) favError(c *gin.Context, err error) {
	switch err {
	case service.ErrFavoriteWorkspace, service.ErrFavoriteForbidden, service.ErrFavoriteNotFound:
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
	case service.ErrFavoriteBadEntity, service.ErrFavoriteBadParent, service.ErrFavoriteBadName:
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Favorites request failed"})
	}
}
