package handler

import (
	"net/http"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// EpicHandler serves epic (is_epic=true issue) endpoints.
type EpicHandler struct {
	Issue *service.IssueService
}

func epicID(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("epicId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid epic ID"})
		return uuid.Nil, false
	}
	return id, true
}

// ListEpics returns all epics for the project.
// GET /api/workspaces/:slug/projects/:projectId/epics/
func (h *EpicHandler) ListEpics(c *gin.Context) {
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
	list, err := h.Issue.ListEpics(c.Request.Context(), slug, projectID, user.ID)
	if err != nil {
		if err == service.ErrProjectForbidden || err == service.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list epics"})
		return
	}
	if list == nil {
		c.JSON(http.StatusOK, []interface{}{})
		return
	}
	c.JSON(http.StatusOK, list)
}

// CreateEpic creates a new epic.
// POST /api/workspaces/:slug/projects/:projectId/epics/
func (h *EpicHandler) CreateEpic(c *gin.Context) {
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
		Name        string      `json:"name" binding:"required"`
		Description string      `json:"description"`
		Priority    string      `json:"priority"`
		StateID     *uuid.UUID  `json:"state_id"`
		AssigneeIDs []uuid.UUID `json:"assignee_ids"`
		LabelIDs    []uuid.UUID `json:"label_ids"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	epic, err := h.Issue.CreateEpic(c.Request.Context(), slug, projectID, user.ID, body.Name, body.Description, body.Priority, body.StateID, body.AssigneeIDs, body.LabelIDs)
	if err != nil {
		if err == service.ErrProjectForbidden || err == service.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create epic"})
		return
	}
	c.JSON(http.StatusCreated, epic)
}

// GetEpic returns a single epic.
// GET /api/workspaces/:slug/projects/:projectId/epics/:epicId/
func (h *EpicHandler) GetEpic(c *gin.Context) {
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
	eID, ok := epicID(c)
	if !ok {
		return
	}
	epic, err := h.Issue.GetEpic(c.Request.Context(), slug, projectID, eID, user.ID)
	if err != nil {
		if err == service.ErrIssueNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get epic"})
		return
	}
	c.JSON(http.StatusOK, epic)
}

// UpdateEpic patches an epic.
// PATCH /api/workspaces/:slug/projects/:projectId/epics/:epicId/
func (h *EpicHandler) UpdateEpic(c *gin.Context) {
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
	eID, ok := epicID(c)
	if !ok {
		return
	}
	// Reuse IssueHandler.Update — verify it's an epic first.
	if _, err := h.Issue.GetEpic(c.Request.Context(), slug, projectID, eID, user.ID); err != nil {
		if err == service.ErrIssueNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get epic"})
		return
	}
	var body struct {
		Name        string      `json:"name"`
		Description *string     `json:"description"`
		Priority    string      `json:"priority"`
		StateID     *uuid.UUID  `json:"state_id"`
		AssigneeIDs []uuid.UUID `json:"assignee_ids"`
		LabelIDs    []uuid.UUID `json:"label_ids"`
	}
	_ = c.ShouldBindJSON(&body)
	var name, priority *string
	if body.Name != "" {
		name = &body.Name
	}
	if body.Priority != "" {
		priority = &body.Priority
	}
	var assigneeIDs *[]uuid.UUID
	if body.AssigneeIDs != nil {
		tmp := body.AssigneeIDs
		assigneeIDs = &tmp
	}
	var labelIDs *[]uuid.UUID
	if body.LabelIDs != nil {
		tmp := body.LabelIDs
		labelIDs = &tmp
	}
	epic, err := h.Issue.Update(c.Request.Context(), slug, projectID, eID, user.ID, name, priority, body.Description, body.StateID, assigneeIDs, labelIDs, nil, nil, nil, nil, nil)
	if err != nil {
		if err == service.ErrIssueNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update epic"})
		return
	}
	c.JSON(http.StatusOK, epic)
}

// DeleteEpic deletes an epic.
// DELETE /api/workspaces/:slug/projects/:projectId/epics/:epicId/
func (h *EpicHandler) DeleteEpic(c *gin.Context) {
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
	eID, ok := epicID(c)
	if !ok {
		return
	}
	if _, err := h.Issue.GetEpic(c.Request.Context(), slug, projectID, eID, user.ID); err != nil {
		if err == service.ErrIssueNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get epic"})
		return
	}
	if err := h.Issue.Delete(c.Request.Context(), slug, projectID, eID, user.ID); err != nil {
		if err == service.ErrIssueNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete epic"})
		return
	}
	c.Status(http.StatusNoContent)
}

// ListEpicIssues returns child issues of an epic.
// GET /api/workspaces/:slug/projects/:projectId/epics/:epicId/issues/
func (h *EpicHandler) ListEpicIssues(c *gin.Context) {
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
	eID, ok := epicID(c)
	if !ok {
		return
	}
	list, err := h.Issue.ListEpicIssues(c.Request.Context(), slug, projectID, eID, user.ID)
	if err != nil {
		if err == service.ErrIssueNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list epic issues"})
		return
	}
	if list == nil {
		c.JSON(http.StatusOK, []interface{}{})
		return
	}
	c.JSON(http.StatusOK, list)
}

// AddIssueToEpic links an issue to an epic by setting its parent.
// POST /api/workspaces/:slug/projects/:projectId/epics/:epicId/issues/
func (h *EpicHandler) AddIssueToEpic(c *gin.Context) {
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
	eID, ok := epicID(c)
	if !ok {
		return
	}
	var body struct {
		IssueID uuid.UUID `json:"issue_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	if err := h.Issue.AddIssueToEpic(c.Request.Context(), slug, projectID, eID, body.IssueID, user.ID); err != nil {
		if err == service.ErrIssueNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add issue to epic"})
		return
	}
	c.Status(http.StatusNoContent)
}
