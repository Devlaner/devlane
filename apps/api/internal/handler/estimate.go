package handler

import (
	"net/http"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// EstimateHandler serves estimate systems (and their points) for a project.
type EstimateHandler struct {
	Estimate *service.EstimateService
}

type estimatePointBody struct {
	Key         int    `json:"key"`
	Value       string `json:"value"`
	Description string `json:"description"`
}

func toPointInputs(in []estimatePointBody) []service.EstimatePointInput {
	out := make([]service.EstimatePointInput, 0, len(in))
	for _, p := range in {
		out = append(out, service.EstimatePointInput{Key: p.Key, Value: p.Value, Description: p.Description})
	}
	return out
}

func estimateNotFound(err error) bool {
	return err == service.ErrEstimateNotFound || err == service.ErrProjectForbidden || err == service.ErrProjectNotFound
}

// estimateCtx parses slug + projectId + authenticated user.
func (h *EstimateHandler) estimateCtx(c *gin.Context) (slug string, projectID, userID uuid.UUID, ok bool) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug = c.Param("slug")
	pid, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}
	return slug, pid, user.ID, true
}

func estimatePK(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("pk"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid estimate ID"})
		return uuid.Nil, false
	}
	return id, true
}

// List returns the project's estimate systems with their points.
// GET /api/workspaces/:slug/projects/:projectId/estimates/
func (h *EstimateHandler) List(c *gin.Context) {
	slug, projectID, userID, ok := h.estimateCtx(c)
	if !ok {
		return
	}
	list, err := h.Estimate.ListByProject(c.Request.Context(), slug, projectID, userID)
	if err != nil {
		if estimateNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list estimates"})
		return
	}
	if list == nil {
		c.JSON(http.StatusOK, []interface{}{})
		return
	}
	c.JSON(http.StatusOK, list)
}

// Get returns a single estimate system with its points.
// GET /api/workspaces/:slug/projects/:projectId/estimates/:pk/
func (h *EstimateHandler) Get(c *gin.Context) {
	slug, projectID, userID, ok := h.estimateCtx(c)
	if !ok {
		return
	}
	id, ok := estimatePK(c)
	if !ok {
		return
	}
	e, err := h.Estimate.Get(c.Request.Context(), slug, projectID, id, userID)
	if err != nil {
		if estimateNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load estimate"})
		return
	}
	c.JSON(http.StatusOK, e)
}

// Create adds an estimate system.
// POST /api/workspaces/:slug/projects/:projectId/estimates/
func (h *EstimateHandler) Create(c *gin.Context) {
	slug, projectID, userID, ok := h.estimateCtx(c)
	if !ok {
		return
	}
	var body struct {
		Name        string              `json:"name" binding:"required"`
		Description string              `json:"description"`
		Type        string              `json:"type"`
		LastUsed    bool                `json:"last_used"`
		Points      []estimatePointBody `json:"points"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	e, err := h.Estimate.Create(c.Request.Context(), slug, projectID, userID, body.Name, body.Description, body.Type, body.LastUsed, toPointInputs(body.Points))
	if err != nil {
		if estimateNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create estimate"})
		return
	}
	c.JSON(http.StatusCreated, e)
}

// Update edits an estimate system; when "points" is present it replaces them.
// PATCH /api/workspaces/:slug/projects/:projectId/estimates/:pk/
func (h *EstimateHandler) Update(c *gin.Context) {
	slug, projectID, userID, ok := h.estimateCtx(c)
	if !ok {
		return
	}
	id, ok := estimatePK(c)
	if !ok {
		return
	}
	var body struct {
		Name        *string              `json:"name"`
		Description *string              `json:"description"`
		Type        *string              `json:"type"`
		LastUsed    *bool                `json:"last_used"`
		Points      *[]estimatePointBody `json:"points"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	var points *[]service.EstimatePointInput
	if body.Points != nil {
		p := toPointInputs(*body.Points)
		points = &p
	}
	e, err := h.Estimate.Update(c.Request.Context(), slug, projectID, id, userID, body.Name, body.Description, body.Type, body.LastUsed, points)
	if err != nil {
		if estimateNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update estimate"})
		return
	}
	c.JSON(http.StatusOK, e)
}

// Delete removes an estimate system and its points.
// DELETE /api/workspaces/:slug/projects/:projectId/estimates/:pk/
func (h *EstimateHandler) Delete(c *gin.Context) {
	slug, projectID, userID, ok := h.estimateCtx(c)
	if !ok {
		return
	}
	id, ok := estimatePK(c)
	if !ok {
		return
	}
	if err := h.Estimate.Delete(c.Request.Context(), slug, projectID, id, userID); err != nil {
		if estimateNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete estimate"})
		return
	}
	c.Status(http.StatusNoContent)
}
