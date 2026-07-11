package handler

import (
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// UserHandler handles user-scoped endpoints (activity, etc.).
type UserHandler struct {
	Comments   *store.CommentStore
	Issues     *store.IssueStore
	Activities *store.IssueActivityStore
}

// GetActivity returns the current user's recent activity feed.
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
	var issueActivities []model.IssueActivity
	if h.Activities != nil {
		issueActivities, err = h.Activities.ListByActorID(ctx, user.ID, 50)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load activity"})
			return
		}
	}
	issueIDSet := make(map[uuid.UUID]bool)
	for _, co := range comments {
		issueIDSet[co.IssueID] = true
	}
	for _, a := range issueActivities {
		if a.IssueID != nil {
			issueIDSet[*a.IssueID] = true
		}
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
	activities := make([]userActivityItem, 0, len(comments)+len(issueActivities))
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
		activities = append(activities, userActivityItem{
			createdAt: co.CreatedAt,
			body: gin.H{
				"id":           co.ID.String(),
				"type":         "comment",
				"created_at":   co.CreatedAt,
				"description":  desc,
				"issue_id":     co.IssueID.String(),
				"issue_name":   issueName,
				"workspace_id": co.WorkspaceID.String(),
				"project_id":   co.ProjectID.String(),
			},
		})
	}
	for _, a := range issueActivities {
		// Comment rows already carry the comment body in this feed; skip the
		// lower-fidelity activity bookkeeping rows to avoid duplicate entries.
		if isCommentActivity(a) {
			continue
		}
		issueID := ""
		issueName := ""
		if a.IssueID != nil {
			issueID = a.IssueID.String()
			issueName = issueMap[issueID]
		}
		activities = append(activities, userActivityItem{
			createdAt: a.CreatedAt,
			body: gin.H{
				"id":           a.ID.String(),
				"type":         "issue_activity",
				"created_at":   a.CreatedAt,
				"description":  issueActivityDescription(a),
				"issue_id":     issueID,
				"issue_name":   issueName,
				"workspace_id": a.WorkspaceID.String(),
				"project_id":   a.ProjectID.String(),
			},
		})
	}
	sort.SliceStable(activities, func(i, j int) bool {
		return activities[i].createdAt.After(activities[j].createdAt)
	})
	if len(activities) > 50 {
		activities = activities[:50]
	}
	out := make([]gin.H, 0, len(activities))
	for _, activity := range activities {
		out = append(out, activity.body)
	}
	c.JSON(http.StatusOK, gin.H{"activities": out})
}

type userActivityItem struct {
	createdAt time.Time
	body      gin.H
}

func isCommentActivity(a model.IssueActivity) bool {
	if a.Field == nil {
		return false
	}
	return *a.Field == "comment_added" || *a.Field == "comment_updated" || *a.Field == "comment_removed"
}

func issueActivityDescription(a model.IssueActivity) string {
	if a.Comment != nil && strings.TrimSpace(*a.Comment) != "" {
		return strings.TrimSpace(*a.Comment)
	}
	if a.Verb == "created" {
		return "Created issue"
	}
	if a.Verb == "deleted" {
		return "Deleted issue"
	}
	if a.Field == nil || *a.Field == "" {
		return titleWord(a.Verb)
	}
	field := strings.ReplaceAll(*a.Field, "_", " ")
	if a.OldValue != nil && a.NewValue != nil {
		return "Updated " + field + " from " + *a.OldValue + " to " + *a.NewValue
	}
	if a.NewValue != nil {
		return "Updated " + field + " to " + *a.NewValue
	}
	if a.OldValue != nil {
		return "Updated " + field + " from " + *a.OldValue
	}
	return "Updated " + field
}

func titleWord(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
}
