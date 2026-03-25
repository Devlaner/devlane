package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// IssueHandler serves work items (issues) for a project.
type IssueHandler struct {
	Issue *service.IssueService
}

func issueID(c *gin.Context) (uuid.UUID, bool) {
	idStr := c.Param("pk")
	if idStr == "" {
		idStr = c.Param("issueId")
	}
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid issue ID"})
		return uuid.Nil, false
	}
	return id, true
}

// ListWorkspaceDrafts returns draft work items for the workspace (all projects).
// GET /api/workspaces/:slug/draft-issues/
func (h *IssueHandler) ListWorkspaceDrafts(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	list, err := h.Issue.ListDraftsForWorkspace(c.Request.Context(), slug, user.ID, limit, offset)
	if err != nil {
		if err == service.ErrWorkspaceForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list draft issues"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// List returns issues for the project.
// GET /api/workspaces/:slug/projects/:projectId/issues/
func (h *IssueHandler) List(c *gin.Context) {
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
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	list, err := h.Issue.List(c.Request.Context(), slug, projectID, user.ID, limit, offset)
	if err != nil {
		if err == service.ErrProjectForbidden || err == service.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list issues"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// Get returns an issue by id.
// GET /api/workspaces/:slug/projects/:projectId/issues/:pk/
func (h *IssueHandler) Get(c *gin.Context) {
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
	issueID, ok := issueID(c)
	if !ok {
		return
	}
	issue, err := h.Issue.GetByID(c.Request.Context(), slug, projectID, issueID, user.ID)
	if err != nil {
		if err == service.ErrIssueNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Issue not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get issue"})
		return
	}
	c.JSON(http.StatusOK, issue)
}

// Create creates a work item (issue) in the project.
// POST /api/workspaces/:slug/projects/:projectId/issues/
func (h *IssueHandler) Create(c *gin.Context) {
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
		ParentID    *uuid.UUID  `json:"parent_id"`
		StartDate   *string     `json:"start_date"`
		TargetDate  *string     `json:"target_date"`
		AssigneeIDs []uuid.UUID `json:"assignee_ids"`
		LabelIDs    []uuid.UUID `json:"label_ids"`
		IsDraft     bool        `json:"is_draft"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	var startDate, targetDate *time.Time
	if body.StartDate != nil && *body.StartDate != "" {
		if t, err := time.Parse("2006-01-02", *body.StartDate); err == nil {
			startDate = &t
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid start_date"})
			return
		}
	}
	if body.TargetDate != nil && *body.TargetDate != "" {
		if t, err := time.Parse("2006-01-02", *body.TargetDate); err == nil {
			targetDate = &t
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid target_date"})
			return
		}
	}

	issue, err := h.Issue.Create(c.Request.Context(), slug, projectID, user.ID, body.Name, body.Description, body.Priority, body.StateID, body.AssigneeIDs, body.LabelIDs, startDate, targetDate, body.ParentID, body.IsDraft)
	if err != nil {
		if err == service.ErrProjectForbidden || err == service.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create issue"})
		return
	}
	c.JSON(http.StatusCreated, issue)
}

// Update updates an issue.
// PATCH /api/workspaces/:slug/projects/:projectId/issues/:pk/
func (h *IssueHandler) Update(c *gin.Context) {
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
	issueID, ok := issueID(c)
	if !ok {
		return
	}
	var body struct {
		Name        string      `json:"name"`
		Description string      `json:"description"`
		Priority    string      `json:"priority"`
		StateID     *uuid.UUID  `json:"state_id"`
		ParentID    *uuid.UUID  `json:"parent_id"`
		StartDate   *string     `json:"start_date"`
		TargetDate  *string     `json:"target_date"`
		AssigneeIDs []uuid.UUID `json:"assignee_ids"`
		LabelIDs    []uuid.UUID `json:"label_ids"`
		IsDraft     *bool       `json:"is_draft"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	var name, priority *string
	if body.Name != "" {
		name = &body.Name
	}
	if body.Priority != "" {
		priority = &body.Priority
	}
	var description *string
	if body.Description != "" {
		description = &body.Description
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

	var startDate, targetDate *time.Time
	if body.StartDate != nil && *body.StartDate != "" {
		if t, err := time.Parse("2006-01-02", *body.StartDate); err == nil {
			startDate = &t
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid start_date"})
			return
		}
	}
	if body.TargetDate != nil && *body.TargetDate != "" {
		if t, err := time.Parse("2006-01-02", *body.TargetDate); err == nil {
			targetDate = &t
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid target_date"})
			return
		}
	}

	issue, err := h.Issue.Update(c.Request.Context(), slug, projectID, issueID, user.ID, name, priority, description, body.StateID, assigneeIDs, labelIDs, startDate, targetDate, body.ParentID, body.IsDraft)
	if err != nil {
		if err == service.ErrIssueNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Issue not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update issue"})
		return
	}
	c.JSON(http.StatusOK, issue)
}

// ListAssignees returns assignee IDs for the issue.
// GET /api/workspaces/:slug/projects/:projectId/issues/:pk/assignees/
func (h *IssueHandler) ListAssignees(c *gin.Context) {
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
	issueID, ok := issueID(c)
	if !ok {
		return
	}
	ids, err := h.Issue.ListAssignees(c.Request.Context(), slug, projectID, issueID, user.ID)
	if err != nil {
		if err == service.ErrIssueNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Issue not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list assignees"})
		return
	}
	c.JSON(http.StatusOK, ids)
}

// AddAssignee adds an assignee to the issue.
// POST /api/workspaces/:slug/projects/:projectId/issues/:pk/assignees/
func (h *IssueHandler) AddAssignee(c *gin.Context) {
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
	issueID, ok := issueID(c)
	if !ok {
		return
	}
	var body struct {
		AssigneeID uuid.UUID `json:"assignee_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	if err := h.Issue.AddAssignee(c.Request.Context(), slug, projectID, issueID, user.ID, body.AssigneeID); err != nil {
		if err == service.ErrIssueNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Issue not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add assignee"})
		return
	}
	c.Status(http.StatusNoContent)
}

// ReplaceAssignees replaces the assignee list for an issue.
// PUT /api/workspaces/:slug/projects/:projectId/issues/:pk/assignees/
func (h *IssueHandler) ReplaceAssignees(c *gin.Context) {
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
	issueID, ok := issueID(c)
	if !ok {
		return
	}
	var body struct {
		AssigneeIDs []uuid.UUID `json:"assignee_ids"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	if err := h.Issue.ReplaceAssignees(c.Request.Context(), slug, projectID, issueID, user.ID, body.AssigneeIDs); err != nil {
		if err == service.ErrIssueNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Issue not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update assignees"})
		return
	}
	c.Status(http.StatusNoContent)
}

// RemoveAssignee removes a single assignee from the issue.
// DELETE /api/workspaces/:slug/projects/:projectId/issues/:pk/assignees/:assigneeId/
func (h *IssueHandler) RemoveAssignee(c *gin.Context) {
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
	issueID, ok := issueID(c)
	if !ok {
		return
	}
	assigneeID, err := uuid.Parse(c.Param("assigneeId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid assignee ID"})
		return
	}
	if err := h.Issue.RemoveAssignee(c.Request.Context(), slug, projectID, issueID, user.ID, assigneeID); err != nil {
		if err == service.ErrIssueNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Issue not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove assignee"})
		return
	}
	c.Status(http.StatusNoContent)
}

// Delete deletes the issue.
// DELETE /api/workspaces/:slug/projects/:projectId/issues/:pk/
func (h *IssueHandler) Delete(c *gin.Context) {
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
	issueID, ok := issueID(c)
	if !ok {
		return
	}
	if err := h.Issue.Delete(c.Request.Context(), slug, projectID, issueID, user.ID); err != nil {
		if err == service.ErrIssueNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Issue not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete issue"})
		return
	}
	c.Status(http.StatusNoContent)
}
