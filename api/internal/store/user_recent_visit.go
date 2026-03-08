package store

import (
	"context"
	"time"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// UserRecentVisitStore handles user_recent_visits.
type UserRecentVisitStore struct{ db *gorm.DB }

func NewUserRecentVisitStore(db *gorm.DB) *UserRecentVisitStore {
	return &UserRecentVisitStore{db: db}
}

func (s *UserRecentVisitStore) Create(ctx context.Context, v *model.UserRecentVisit) error {
	return s.db.WithContext(ctx).Create(v).Error
}

func (s *UserRecentVisitStore) ListByWorkspaceAndUser(ctx context.Context, workspaceID, userID uuid.UUID, limit int) ([]model.UserRecentVisit, error) {
	if limit <= 0 {
		limit = 20
	}
	var list []model.UserRecentVisit
	err := s.db.WithContext(ctx).
		Where("workspace_id = ? AND user_id = ? AND deleted_at IS NULL", workspaceID, userID).
		Order("last_visited_at DESC").
		Limit(limit).
		Find(&list).Error
	return list, err
}

// Upsert updates last_visited_at for a matching visit (same workspace, user, entity_name, entity_identifier) or creates one.
func (s *UserRecentVisitStore) Upsert(ctx context.Context, workspaceID, userID uuid.UUID, entityName string, entityIdentifier, projectID *uuid.UUID) error {
	now := time.Now()
	q := s.db.WithContext(ctx).
		Where("workspace_id = ? AND user_id = ? AND entity_name = ? AND deleted_at IS NULL", workspaceID, userID, entityName)
	if entityIdentifier != nil {
		q = q.Where("entity_identifier = ?", *entityIdentifier)
	} else {
		q = q.Where("entity_identifier IS NULL")
	}
	var existing model.UserRecentVisit
	err := q.First(&existing).Error
	if err == nil {
		existing.LastVisitedAt = now
		existing.ProjectID = projectID
		return s.db.WithContext(ctx).Save(&existing).Error
	}
	if err == gorm.ErrRecordNotFound {
		v := &model.UserRecentVisit{
			WorkspaceID:      workspaceID,
			UserID:           userID,
			EntityName:       entityName,
			EntityIdentifier: entityIdentifier,
			ProjectID:        projectID,
			LastVisitedAt:    now,
		}
		return s.db.WithContext(ctx).Create(v).Error
	}
	return err
}

func (s *UserRecentVisitStore) Delete(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&model.UserRecentVisit{}).Error
}
