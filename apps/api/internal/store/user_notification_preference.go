package store

import (
	"context"
	"errors"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// UserNotificationPreferenceStore handles user notification preference persistence.
type UserNotificationPreferenceStore struct{ db *gorm.DB }

func NewUserNotificationPreferenceStore(db *gorm.DB) *UserNotificationPreferenceStore {
	return &UserNotificationPreferenceStore{db: db}
}

// GetGlobal gets the account-level notification preferences for a user.
// Uses workspace_id IS NULL AND project_id IS NULL.
func (s *UserNotificationPreferenceStore) GetGlobal(ctx context.Context, userID uuid.UUID) (*model.UserNotificationPreference, error) {
	return s.GetScoped(ctx, userID, nil, nil)
}

// GetScoped gets an exact preference row. Nil workspace/project means the
// column must be NULL, so callers can distinguish global/workspace/project rows.
func (s *UserNotificationPreferenceStore) GetScoped(ctx context.Context, userID uuid.UUID, workspaceID, projectID *uuid.UUID) (*model.UserNotificationPreference, error) {
	var p model.UserNotificationPreference
	q := s.db.WithContext(ctx).Where("user_id = ?", userID)
	if workspaceID == nil {
		q = q.Where("workspace_id IS NULL")
	} else {
		q = q.Where("workspace_id = ?", *workspaceID)
	}
	if projectID == nil {
		q = q.Where("project_id IS NULL")
	} else {
		q = q.Where("project_id = ?", *projectID)
	}
	err := q.First(&p).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &p, nil
}

// ResolveForIssue returns the effective preferences for an issue notification:
// project override, then workspace override, then global, then default-allow.
func (s *UserNotificationPreferenceStore) ResolveForIssue(ctx context.Context, userID, workspaceID, projectID uuid.UUID) (*model.UserNotificationPreference, string, error) {
	if p, err := s.GetScoped(ctx, userID, &workspaceID, &projectID); err != nil || p != nil {
		return p, "project", err
	}
	if p, err := s.GetScoped(ctx, userID, &workspaceID, nil); err != nil || p != nil {
		return p, "workspace", err
	}
	if p, err := s.GetGlobal(ctx, userID); err != nil || p != nil {
		return p, "global", err
	}
	return DefaultNotificationPreference(userID, nil, nil), "default", nil
}

// UpsertGlobal creates or updates account-level notification preferences.
func (s *UserNotificationPreferenceStore) UpsertGlobal(ctx context.Context, p *model.UserNotificationPreference) error {
	p.WorkspaceID = nil
	p.ProjectID = nil
	return s.UpsertScoped(ctx, p)
}

// UpsertScoped creates or updates a scoped notification preference row.
func (s *UserNotificationPreferenceStore) UpsertScoped(ctx context.Context, p *model.UserNotificationPreference) error {
	if p.WorkspaceID == nil && p.ProjectID != nil {
		return errors.New("project-scoped notification preference requires workspace_id")
	}
	s.NormalizeChannels(p)
	existing, err := s.GetScoped(ctx, p.UserID, p.WorkspaceID, p.ProjectID)
	if err != nil {
		return err
	}
	updates := notificationPreferenceUpdates(p)
	if existing != nil {
		return s.db.WithContext(ctx).Model(existing).Updates(updates).Error
	}
	create := notificationPreferenceUpdates(p)
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	create["id"] = p.ID
	create["user_id"] = p.UserID
	create["workspace_id"] = p.WorkspaceID
	create["project_id"] = p.ProjectID
	return s.db.WithContext(ctx).Model(&model.UserNotificationPreference{}).Create(create).Error
}

// NormalizeChannels mirrors legacy category booleans to enabled when either
// delivery channel is enabled. This keeps older clients meaningful while newer
// clients use the per-channel fields directly.
func (s *UserNotificationPreferenceStore) NormalizeChannels(p *model.UserNotificationPreference) {
	p.PropertyChange = p.PropertyChangeInApp || p.PropertyChangeEmail
	p.StateChange = p.StateChangeInApp || p.StateChangeEmail
	p.Comment = p.CommentInApp || p.CommentEmail
	p.Mention = p.MentionInApp || p.MentionEmail
	p.IssueCompleted = p.IssueCompletedInApp || p.IssueCompletedEmail
}

func DefaultNotificationPreference(userID uuid.UUID, workspaceID, projectID *uuid.UUID) *model.UserNotificationPreference {
	return &model.UserNotificationPreference{
		UserID:              userID,
		WorkspaceID:         workspaceID,
		ProjectID:           projectID,
		PropertyChange:      true,
		PropertyChangeInApp: true,
		PropertyChangeEmail: true,
		StateChange:         true,
		StateChangeInApp:    true,
		StateChangeEmail:    true,
		Comment:             true,
		CommentInApp:        true,
		CommentEmail:        true,
		Mention:             true,
		MentionInApp:        true,
		MentionEmail:        true,
		IssueCompleted:      true,
		IssueCompletedInApp: true,
		IssueCompletedEmail: true,
	}
}

func notificationPreferenceUpdates(p *model.UserNotificationPreference) map[string]any {
	return map[string]any{
		"property_change":        p.PropertyChange,
		"property_change_in_app": p.PropertyChangeInApp,
		"property_change_email":  p.PropertyChangeEmail,
		"state_change":           p.StateChange,
		"state_change_in_app":    p.StateChangeInApp,
		"state_change_email":     p.StateChangeEmail,
		"comment":                p.Comment,
		"comment_in_app":         p.CommentInApp,
		"comment_email":          p.CommentEmail,
		"mention":                p.Mention,
		"mention_in_app":         p.MentionInApp,
		"mention_email":          p.MentionEmail,
		"issue_completed":        p.IssueCompleted,
		"issue_completed_in_app": p.IssueCompletedInApp,
		"issue_completed_email":  p.IssueCompletedEmail,
	}
}
