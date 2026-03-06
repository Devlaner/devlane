package handler

import (
	"net/http"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// StateHandler serves workflow states for a project.
type StateHandler struct {
	State *service.StateService
}

func stateID(c *gin.Context) (uuid.UUID, bool) {
	idStr := c.Param("pk")
	if idStr == "" {
		idStr = c.Param("stateId")
	}
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid state ID"})
		return uuid.Nil, false
	}
	return id, true
}

// List returns workflow states for the project.
// GET /api/workspaces/:slug/projects/:projectId/states/
func (h *StateHandler) List(c *gin.Context) {
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
	list, err := h.State.List(c.Request.Context(), slug, projectID, user.ID)
	if err != nil {
		if err == service.ErrProjectForbidden || err == service.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list states"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// Create creates a workflow state.
// POST /api/workspaces/:slug/projects/:projectId/states/
func (h *StateHandler) Create(c *gin.Context) {
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
		Group string `json:"group"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	st, err := h.State.Create(c.Request.Context(), slug, projectID, user.ID, body.Name, body.Color, body.Group)
	if err != nil {
		if err == service.ErrProjectForbidden || err == service.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create state"})
		return
	}
	c.JSON(http.StatusCreated, st)
}

// Update updates a workflow state.
// PATCH /api/workspaces/:slug/projects/:projectId/states/:pk/
func (h *StateHandler) Update(c *gin.Context) {
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
	stateID, ok := stateID(c)
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
	st, err := h.State.Update(c.Request.Context(), slug, projectID, stateID, user.ID, name, color)
	if err != nil {
		if err == service.ErrStateNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "State not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update state"})
		return
	}
	c.JSON(http.StatusOK, st)
}

// Delete deletes a workflow state.
// DELETE /api/workspaces/:slug/projects/:projectId/states/:pk/
func (h *StateHandler) Delete(c *gin.Context) {
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
	stateID, ok := stateID(c)
	if !ok {
		return
	}
	if err := h.State.Delete(c.Request.Context(), slug, projectID, stateID, user.ID); err != nil {
		if err == service.ErrStateNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "State not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete state"})
		return
	}
	c.Status(http.StatusNoContent)
}
