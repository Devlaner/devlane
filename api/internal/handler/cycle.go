package handler

import (
	"net/http"
	"time"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// CycleHandler serves cycles (sprints) for a project.
type CycleHandler struct {
	Cycle *service.CycleService
}

func parseOptionalTime(s string) *time.Time {
	if s == "" {
		return nil
	}
	// Try RFC3339 first (full timestamp), then date-only YYYY-MM-DD
	t, err := time.Parse(time.RFC3339, s)
	if err == nil {
		return &t
	}
	t, err = time.Parse("2006-01-02", s)
	if err != nil {
		return nil
	}
	return &t
}

// List returns cycles for the project.
// GET /api/workspaces/:slug/projects/:projectId/cycles/
func (h *CycleHandler) List(c *gin.Context) {
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
	list, err := h.Cycle.List(c.Request.Context(), slug, projectID, user.ID)
	if err != nil {
		if err == service.ErrProjectForbidden || err == service.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list cycles"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// Create creates a cycle.
// POST /api/workspaces/:slug/projects/:projectId/cycles/
func (h *CycleHandler) Create(c *gin.Context) {
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
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
		StartDate   string `json:"start_date"`
		EndDate     string `json:"end_date"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	cy, err := h.Cycle.Create(c.Request.Context(), slug, projectID, user.ID, body.Name, body.Description, parseOptionalTime(body.StartDate), parseOptionalTime(body.EndDate))
	if err != nil {
		if err == service.ErrProjectForbidden || err == service.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create cycle"})
		return
	}
	c.JSON(http.StatusCreated, cy)
}

// Get returns a cycle by id.
// GET /api/workspaces/:slug/projects/:projectId/cycles/:cycleId/
func (h *CycleHandler) Get(c *gin.Context) {
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
	cycleID, err := uuid.Parse(c.Param("cycleId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid cycle ID"})
		return
	}
	cy, err := h.Cycle.Get(c.Request.Context(), slug, projectID, cycleID, user.ID)
	if err != nil {
		if err == service.ErrCycleNotFound || err == service.ErrProjectForbidden || err == service.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get cycle"})
		return
	}
	c.JSON(http.StatusOK, cy)
}

// Update updates a cycle.
// PATCH /api/workspaces/:slug/projects/:projectId/cycles/:cycleId/
func (h *CycleHandler) Update(c *gin.Context) {
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
	cycleID, err := uuid.Parse(c.Param("cycleId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid cycle ID"})
		return
	}
	var body struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Status      string `json:"status"`
		StartDate   string `json:"start_date"`
		EndDate     string `json:"end_date"`
	}
	_ = c.ShouldBindJSON(&body)
	cy, err := h.Cycle.Update(c.Request.Context(), slug, projectID, cycleID, user.ID, body.Name, body.Description, body.Status, parseOptionalTime(body.StartDate), parseOptionalTime(body.EndDate))
	if err != nil {
		if err == service.ErrCycleNotFound || err == service.ErrProjectForbidden || err == service.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update cycle"})
		return
	}
	c.JSON(http.StatusOK, cy)
}

// Delete deletes a cycle.
// DELETE /api/workspaces/:slug/projects/:projectId/cycles/:cycleId/
func (h *CycleHandler) Delete(c *gin.Context) {
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
	cycleID, err := uuid.Parse(c.Param("cycleId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid cycle ID"})
		return
	}
	if err := h.Cycle.Delete(c.Request.Context(), slug, projectID, cycleID, user.ID); err != nil {
		if err == service.ErrCycleNotFound || err == service.ErrProjectForbidden || err == service.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete cycle"})
		return
	}
	c.Status(http.StatusNoContent)
}

// ListIssues returns issue IDs linked to the cycle.
// GET /api/workspaces/:slug/projects/:projectId/cycles/:cycleId/issues/
func (h *CycleHandler) ListIssues(c *gin.Context) {
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
	cycleID, err := uuid.Parse(c.Param("cycleId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid cycle ID"})
		return
	}
	ids, err := h.Cycle.ListCycleIssueIDs(c.Request.Context(), slug, projectID, cycleID, user.ID)
	if err != nil {
		if err == service.ErrCycleNotFound || err == service.ErrProjectForbidden || err == service.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list cycle issues"})
		return
	}
	c.JSON(http.StatusOK, ids)
}

// AddIssue links an issue to the cycle.
// POST /api/workspaces/:slug/projects/:projectId/cycles/:cycleId/issues/
func (h *CycleHandler) AddIssue(c *gin.Context) {
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
	cycleID, err := uuid.Parse(c.Param("cycleId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid cycle ID"})
		return
	}
	var body struct {
		IssueID uuid.UUID `json:"issue_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	if err := h.Cycle.AddCycleIssue(c.Request.Context(), slug, projectID, cycleID, body.IssueID, user.ID); err != nil {
		if err == service.ErrCycleNotFound || err == service.ErrProjectForbidden || err == service.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to link cycle issue"})
		return
	}
	c.Status(http.StatusNoContent)
}

// RemoveIssue unlinks an issue from the cycle.
// DELETE /api/workspaces/:slug/projects/:projectId/cycles/:cycleId/issues/:issueId/
func (h *CycleHandler) RemoveIssue(c *gin.Context) {
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
	cycleID, err := uuid.Parse(c.Param("cycleId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid cycle ID"})
		return
	}
	issueID, err := uuid.Parse(c.Param("issueId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid issue ID"})
		return
	}
	if err := h.Cycle.RemoveCycleIssue(c.Request.Context(), slug, projectID, cycleID, issueID, user.ID); err != nil {
		if err == service.ErrCycleNotFound || err == service.ErrProjectForbidden || err == service.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to unlink cycle issue"})
		return
	}
	c.Status(http.StatusNoContent)
}
