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

// GetGlobal gets the account-level (global) notification preferences for a user.
// Uses workspace_id IS NULL AND project_id IS NULL.
func (s *UserNotificationPreferenceStore) GetGlobal(ctx context.Context, userID uuid.UUID) (*model.UserNotificationPreference, error) {
	var p model.UserNotificationPreference
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND workspace_id IS NULL AND project_id IS NULL", userID).
		First(&p).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &p, nil
}

// UpsertGlobal creates or updates account-level notification preferences.
func (s *UserNotificationPreferenceStore) UpsertGlobal(ctx context.Context, p *model.UserNotificationPreference) error {
	if p.WorkspaceID != nil || p.ProjectID != nil {
		p.WorkspaceID = nil
		p.ProjectID = nil
	}
	existing, err := s.GetGlobal(ctx, p.UserID)
	if err != nil {
		return err
	}
	if existing != nil {
		existing.PropertyChange = p.PropertyChange
		existing.StateChange = p.StateChange
		existing.Comment = p.Comment
		existing.Mention = p.Mention
		existing.IssueCompleted = p.IssueCompleted
		return s.db.WithContext(ctx).Save(existing).Error
	}
	return s.db.WithContext(ctx).Create(p).Error
}
