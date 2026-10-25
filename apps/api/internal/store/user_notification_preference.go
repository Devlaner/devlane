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

// scopeWhere narrows a query to the exact (user, workspace, project) scope,
// matching NULLs so account/workspace/project rows never collide.
func scopeWhere(q *gorm.DB, userID uuid.UUID, workspaceID, projectID *uuid.UUID) *gorm.DB {
	q = q.Where("user_id = ?", userID)
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
	return q
}

// GetScoped returns the preference row for an exact scope, or nil when none
// exists. Pass nils for the account-level (global) row, a workspace id for the
// workspace row, or a project id (with its workspace) for the project row.
func (s *UserNotificationPreferenceStore) GetScoped(ctx context.Context, userID uuid.UUID, workspaceID, projectID *uuid.UUID) (*model.UserNotificationPreference, error) {
	var p model.UserNotificationPreference
	err := scopeWhere(s.db.WithContext(ctx), userID, workspaceID, projectID).First(&p).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &p, nil
}

// GetGlobal gets the account-level (global) notification preferences for a user.
func (s *UserNotificationPreferenceStore) GetGlobal(ctx context.Context, userID uuid.UUID) (*model.UserNotificationPreference, error) {
	return s.GetScoped(ctx, userID, nil, nil)
}

// Resolve returns the most specific preference row that applies to a
// notification in the given project/workspace: the project row if it exists,
// otherwise the workspace row, otherwise the account-level row. Returns nil when
// the user has no stored preferences at any level, so callers fall back to the
// all-enabled default.
func (s *UserNotificationPreferenceStore) Resolve(ctx context.Context, userID uuid.UUID, workspaceID, projectID *uuid.UUID) (*model.UserNotificationPreference, error) {
	if projectID != nil {
		if p, err := s.GetScoped(ctx, userID, workspaceID, projectID); err != nil || p != nil {
			return p, err
		}
	}
	if workspaceID != nil {
		if p, err := s.GetScoped(ctx, userID, workspaceID, nil); err != nil || p != nil {
			return p, err
		}
	}
	return s.GetScoped(ctx, userID, nil, nil)
}

// UpsertScoped creates or updates the preference row for the scope encoded on p
// (its UserID plus WorkspaceID/ProjectID). All ten channel/type booleans are
// written.
func (s *UserNotificationPreferenceStore) UpsertScoped(ctx context.Context, p *model.UserNotificationPreference) error {
	existing, err := s.GetScoped(ctx, p.UserID, p.WorkspaceID, p.ProjectID)
	if err != nil {
		return err
	}
	if existing == nil {
		// Ensure a row exists at this scope. The toggle columns are DEFAULT TRUE
		// and are corrected by the map update below, so their values here don't
		// matter.
		existing = &model.UserNotificationPreference{
			UserID: p.UserID, WorkspaceID: p.WorkspaceID, ProjectID: p.ProjectID,
		}
		if err := s.db.WithContext(ctx).Create(existing).Error; err != nil {
			return err
		}
	}
	// Write every toggle via a map so disabled (false) ones are persisted rather
	// than dropped as zero values.
	return s.db.WithContext(ctx).Model(existing).Updates(map[string]any{
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
	}).Error
}

// UpsertGlobal creates or updates account-level notification preferences.
func (s *UserNotificationPreferenceStore) UpsertGlobal(ctx context.Context, p *model.UserNotificationPreference) error {
	p.WorkspaceID = nil
	p.ProjectID = nil
	return s.UpsertScoped(ctx, p)
}
