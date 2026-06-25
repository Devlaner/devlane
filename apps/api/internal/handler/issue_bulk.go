package handler

import (
	"errors"
	"net/http"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// bulkContext parses the common slug + projectId + authenticated user. It
// writes the appropriate error response and returns ok=false on failure.
func bulkContext(c *gin.Context) (slug string, projectID uuid.UUID, userID uuid.UUID, ok bool) {
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

func bulkRespond(c *gin.Context, n int, err error, failMsg string) {
	if err != nil {
		if issueAccessNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": failMsg})
		return
	}
	c.JSON(http.StatusOK, gin.H{"affected": n})
}

// BulkUpdate applies priority/state changes to many work items at once.
// POST /api/workspaces/:slug/projects/:projectId/issues/bulk-update/
func (h *IssueHandler) BulkUpdate(c *gin.Context) {
	slug, projectID, userID, ok := bulkContext(c)
	if !ok {
		return
	}
	var body struct {
		IssueIDs []uuid.UUID `json:"issue_ids"`
		Priority *string     `json:"priority"`
		StateID  *uuid.UUID  `json:"state_id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || len(body.IssueIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "issue_ids is required"})
		return
	}
	n, err := h.Issue.BulkUpdate(c.Request.Context(), slug, projectID, userID, body.IssueIDs, body.Priority, body.StateID)
	if errors.Is(err, service.ErrInvalidPriority) || errors.Is(err, service.ErrInvalidState) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid priority or state for this project"})
		return
	}
	bulkRespond(c, n, err, "Failed to update work items")
}

// BulkArchive archives or restores many work items at once.
// POST /api/workspaces/:slug/projects/:projectId/issues/bulk-archive/
func (h *IssueHandler) BulkArchive(c *gin.Context) {
	slug, projectID, userID, ok := bulkContext(c)
	if !ok {
		return
	}
	var body struct {
		IssueIDs []uuid.UUID `json:"issue_ids"`
		Archived *bool       `json:"archived"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || len(body.IssueIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "issue_ids is required"})
		return
	}
	archived := true
	if body.Archived != nil {
		archived = *body.Archived
	}
	n, err := h.Issue.BulkArchive(c.Request.Context(), slug, projectID, userID, body.IssueIDs, archived)
	bulkRespond(c, n, err, "Failed to archive work items")
}

// BulkDelete soft-deletes many work items at once.
// POST /api/workspaces/:slug/projects/:projectId/issues/bulk-delete/
func (h *IssueHandler) BulkDelete(c *gin.Context) {
	slug, projectID, userID, ok := bulkContext(c)
	if !ok {
		return
	}
	var body struct {
		IssueIDs []uuid.UUID `json:"issue_ids"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || len(body.IssueIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "issue_ids is required"})
		return
	}
	n, err := h.Issue.BulkDelete(c.Request.Context(), slug, projectID, userID, body.IssueIDs)
	bulkRespond(c, n, err, "Failed to delete work items")
}
