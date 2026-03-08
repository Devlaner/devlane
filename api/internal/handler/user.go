package handler

import (
	"net/http"
	"strings"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// UserHandler handles user-scoped endpoints (activity, etc.).
type UserHandler struct {
	Comments *store.CommentStore
	Issues   *store.IssueStore
}

// GetActivity returns the current user's activity feed (comments for now).
// GET /api/users/me/activity/
func (h *UserHandler) GetActivity(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	if h.Comments == nil || h.Issues == nil {
		c.JSON(http.StatusOK, gin.H{"activities": []gin.H{}})
		return
	}
	ctx := c.Request.Context()
	comments, err := h.Comments.ListByCreatedByID(ctx, user.ID, 50)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load activity"})
		return
	}
	if len(comments) == 0 {
		c.JSON(http.StatusOK, gin.H{"activities": []gin.H{}})
		return
	}
	issueIDSet := make(map[uuid.UUID]bool)
	for _, co := range comments {
		issueIDSet[co.IssueID] = true
	}
	issueIDs := make([]uuid.UUID, 0, len(issueIDSet))
	for id := range issueIDSet {
		issueIDs = append(issueIDs, id)
	}
	issues, err := h.Issues.ListByIDs(ctx, issueIDs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load activity"})
		return
	}
	issueMap := make(map[string]string) // issue_id -> name
	for _, i := range issues {
		issueMap[i.ID.String()] = i.Name
	}
	// Build activity list (comments only for now)
	activities := make([]gin.H, 0, len(comments))
	for _, co := range comments {
		desc := "Commented"
		if co.Comment != "" {
			snippet := strings.TrimSpace(co.Comment)
			if len(snippet) > 200 {
				snippet = snippet[:200] + "..."
			}
			desc = snippet
		}
		issueName := issueMap[co.IssueID.String()]
		activities = append(activities, gin.H{
			"id":           co.ID.String(),
			"type":         "comment",
			"created_at":   co.CreatedAt,
			"description":  desc,
			"issue_id":     co.IssueID.String(),
			"issue_name":   issueName,
			"workspace_id": co.WorkspaceID.String(),
			"project_id":   co.ProjectID.String(),
		})
	}
	c.JSON(http.StatusOK, gin.H{"activities": activities})
}
