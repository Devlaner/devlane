package handler

import (
	"net/http"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// NotifPrefBody is the request/patch shape for notification preferences. Every
// field is optional; only the provided ones are changed. The bare names gate
// the in-app channel, the email_* names gate the email channel.
type NotifPrefBody struct {
	PropertyChange      *bool `json:"property_change"`
	StateChange         *bool `json:"state_change"`
	Comment             *bool `json:"comment"`
	Mention             *bool `json:"mention"`
	IssueCompleted      *bool `json:"issue_completed"`
	EmailPropertyChange *bool `json:"email_property_change"`
	EmailStateChange    *bool `json:"email_state_change"`
	EmailComment        *bool `json:"email_comment"`
	EmailMention        *bool `json:"email_mention"`
	EmailIssueCompleted *bool `json:"email_issue_completed"`
}

// notifPrefResponse renders every channel/type toggle for a preference.
func notifPrefResponse(p model.UserNotificationPreference) gin.H {
	return gin.H{
		"property_change":       p.PropertyChange,
		"state_change":          p.StateChange,
		"comment":               p.Comment,
		"mention":               p.Mention,
		"issue_completed":       p.IssueCompleted,
		"email_property_change": p.EmailPropertyChange,
		"email_state_change":    p.EmailStateChange,
		"email_comment":         p.EmailComment,
		"email_mention":         p.EmailMention,
		"email_issue_completed": p.EmailIssueCompleted,
	}
}

// applyNotifPrefBody overlays the provided fields onto p.
func applyNotifPrefBody(p *model.UserNotificationPreference, b NotifPrefBody) {
	if b.PropertyChange != nil {
		p.PropertyChange = *b.PropertyChange
	}
	if b.StateChange != nil {
		p.StateChange = *b.StateChange
	}
	if b.Comment != nil {
		p.Comment = *b.Comment
	}
	if b.Mention != nil {
		p.Mention = *b.Mention
	}
	if b.IssueCompleted != nil {
		p.IssueCompleted = *b.IssueCompleted
	}
	if b.EmailPropertyChange != nil {
		p.EmailPropertyChange = *b.EmailPropertyChange
	}
	if b.EmailStateChange != nil {
		p.EmailStateChange = *b.EmailStateChange
	}
	if b.EmailComment != nil {
		p.EmailComment = *b.EmailComment
	}
	if b.EmailMention != nil {
		p.EmailMention = *b.EmailMention
	}
	if b.EmailIssueCompleted != nil {
		p.EmailIssueCompleted = *b.EmailIssueCompleted
	}
}

// NotificationPreferenceHandler serves workspace- and project-scoped
// notification preferences. Account-level ones live on AuthHandler.
type NotificationPreferenceHandler struct {
	Prefs    *store.UserNotificationPreferenceStore
	Ws       *store.WorkspaceStore
	Projects *service.ProjectService
}

// baseForScope is the starting preference for a scoped save: the effective
// (resolved) preference so unspecified fields inherit from the parent scope,
// or the all-enabled default when nothing is stored. The ID is cleared so the
// upsert writes a fresh row at the target scope rather than reusing a parent's.
// A Resolve error is returned rather than swallowed, so a transient failure
// can't silently reset inherited (disabled) fields to the all-true default.
func (h *NotificationPreferenceHandler) baseForScope(c *gin.Context, userID uuid.UUID, workspaceID, projectID *uuid.UUID) (model.UserNotificationPreference, error) {
	p, err := h.Prefs.Resolve(c.Request.Context(), userID, workspaceID, projectID)
	if err != nil {
		return model.UserNotificationPreference{}, err
	}
	if p != nil {
		b := *p
		b.ID = uuid.Nil
		return b, nil
	}
	return model.DefaultNotificationPreference(), nil
}

// GetWorkspace returns the effective notification preferences for the caller in
// a workspace.
// GET /api/workspaces/:slug/notification-preferences/
func (h *NotificationPreferenceHandler) GetWorkspace(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	wrk, ok := h.workspaceForMember(c, user.ID)
	if !ok {
		return
	}
	h.respondResolved(c, user.ID, &wrk.ID, nil)
}

// UpdateWorkspace writes the caller's workspace-scoped notification preferences.
// PUT /api/workspaces/:slug/notification-preferences/
func (h *NotificationPreferenceHandler) UpdateWorkspace(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	wrk, ok := h.workspaceForMember(c, user.ID)
	if !ok {
		return
	}
	var body NotifPrefBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	p, err := h.baseForScope(c, user.ID, &wrk.ID, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load preferences"})
		return
	}
	p.UserID = user.ID
	p.WorkspaceID = &wrk.ID
	p.ProjectID = nil
	applyNotifPrefBody(&p, body)
	if err := h.Prefs.UpsertScoped(c.Request.Context(), &p); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save preferences"})
		return
	}
	c.JSON(http.StatusOK, notifPrefResponse(p))
}

// GetProject returns the effective notification preferences for the caller in a
// project (project → workspace → account).
// GET /api/workspaces/:slug/projects/:projectId/notification-preferences/
func (h *NotificationPreferenceHandler) GetProject(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	proj, ok := h.projectForMember(c, user.ID)
	if !ok {
		return
	}
	h.respondResolved(c, user.ID, &proj.WorkspaceID, &proj.ID)
}

// UpdateProject writes the caller's project-scoped notification preferences.
// PUT /api/workspaces/:slug/projects/:projectId/notification-preferences/
func (h *NotificationPreferenceHandler) UpdateProject(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	proj, ok := h.projectForMember(c, user.ID)
	if !ok {
		return
	}
	var body NotifPrefBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	p, err := h.baseForScope(c, user.ID, &proj.WorkspaceID, &proj.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load preferences"})
		return
	}
	p.UserID = user.ID
	p.WorkspaceID = &proj.WorkspaceID
	p.ProjectID = &proj.ID
	applyNotifPrefBody(&p, body)
	if err := h.Prefs.UpsertScoped(c.Request.Context(), &p); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save preferences"})
		return
	}
	c.JSON(http.StatusOK, notifPrefResponse(p))
}

func (h *NotificationPreferenceHandler) respondResolved(c *gin.Context, userID uuid.UUID, workspaceID, projectID *uuid.UUID) {
	p, err := h.Prefs.Resolve(c.Request.Context(), userID, workspaceID, projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load preferences"})
		return
	}
	if p == nil {
		def := model.DefaultNotificationPreference()
		p = &def
	}
	c.JSON(http.StatusOK, notifPrefResponse(*p))
}

// workspaceForMember resolves the :slug workspace and confirms the caller is a
// member; it writes the error response and returns false otherwise.
func (h *NotificationPreferenceHandler) workspaceForMember(c *gin.Context, userID uuid.UUID) (*model.Workspace, bool) {
	wrk, err := h.Ws.GetBySlug(c.Request.Context(), c.Param("slug"))
	if err != nil || wrk == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
		return nil, false
	}
	if ok, _ := h.Ws.IsMember(c.Request.Context(), wrk.ID, userID); !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
		return nil, false
	}
	return wrk, true
}

// projectForMember resolves the :projectId project and confirms the caller can
// access it; it writes the error response and returns false otherwise.
func (h *NotificationPreferenceHandler) projectForMember(c *gin.Context, userID uuid.UUID) (*model.Project, bool) {
	pid, ok := projectID(c)
	if !ok {
		return nil, false
	}
	proj, err := h.Projects.GetByID(c.Request.Context(), c.Param("slug"), pid, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return nil, false
	}
	return proj, true
}
