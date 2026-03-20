package store

import (
	"context"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const FavoriteEntityTypeProject = "project"

// FavoriteEntityTypeIssueView is stored in user_favorites.entity_type for saved issue views.
const FavoriteEntityTypeIssueView = "issue_view"

// UserFavoriteStore handles user_favorites persistence.
type UserFavoriteStore struct{ db *gorm.DB }

func NewUserFavoriteStore(db *gorm.DB) *UserFavoriteStore {
	return &UserFavoriteStore{db: db}
}

// ListProjectIDsByUser returns project IDs the user has favorited.
func (s *UserFavoriteStore) ListProjectIDsByUser(ctx context.Context, userID uuid.UUID) ([]uuid.UUID, error) {
	var ids []uuid.UUID
	err := s.db.WithContext(ctx).Model(&model.UserFavorite{}).
		Where("user_id = ? AND entity_type = ?", userID, FavoriteEntityTypeProject).
		Pluck("entity_identifier", &ids).Error
	return ids, err
}

// AddProject adds a project to the user's favorites. workspaceID is stored for the favorite record.
// Idempotent: uses ON CONFLICT DO NOTHING so duplicate inserts are ignored.
func (s *UserFavoriteStore) AddProject(ctx context.Context, userID, workspaceID, projectID uuid.UUID) error {
	fav := &model.UserFavorite{
		Name:             "project",
		Type:             "project",
		EntityType:       FavoriteEntityTypeProject,
		EntityIdentifier: projectID,
		WorkspaceID:      workspaceID,
		ProjectID:        &projectID,
		UserID:           userID,
	}
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}, {Name: "entity_type"}, {Name: "entity_identifier"}},
		DoNothing: true,
	}).Create(fav).Error
}

// RemoveProject removes a project from the user's favorites.
func (s *UserFavoriteStore) RemoveProject(ctx context.Context, userID uuid.UUID, projectID uuid.UUID) error {
	return s.db.WithContext(ctx).
		Where("user_id = ? AND entity_type = ? AND entity_identifier = ?", userID, FavoriteEntityTypeProject, projectID).
		Delete(&model.UserFavorite{}).Error
}

// ListIssueViewIDsByUserAndWorkspace returns issue view IDs the user favorited in a workspace.
func (s *UserFavoriteStore) ListIssueViewIDsByUserAndWorkspace(ctx context.Context, userID, workspaceID uuid.UUID) ([]uuid.UUID, error) {
	var ids []uuid.UUID
	err := s.db.WithContext(ctx).Model(&model.UserFavorite{}).
		Where("user_id = ? AND entity_type = ? AND workspace_id = ?", userID, FavoriteEntityTypeIssueView, workspaceID).
		Pluck("entity_identifier", &ids).Error
	return ids, err
}

// AddIssueView favorites a saved issue view for the user. Idempotent on conflict.
func (s *UserFavoriteStore) AddIssueView(ctx context.Context, userID, workspaceID uuid.UUID, projectID *uuid.UUID, viewID uuid.UUID) error {
	fav := &model.UserFavorite{
		Name:             "issue_view",
		Type:             "issue_view",
		EntityType:       FavoriteEntityTypeIssueView,
		EntityIdentifier: viewID,
		WorkspaceID:      workspaceID,
		ProjectID:        projectID,
		UserID:           userID,
	}
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}, {Name: "entity_type"}, {Name: "entity_identifier"}},
		DoNothing: true,
	}).Create(fav).Error
}

// RemoveIssueView removes a saved issue view from the user's favorites.
func (s *UserFavoriteStore) RemoveIssueView(ctx context.Context, userID, viewID uuid.UUID) error {
	return s.db.WithContext(ctx).
		Where("user_id = ? AND entity_type = ? AND entity_identifier = ?", userID, FavoriteEntityTypeIssueView, viewID).
		Delete(&model.UserFavorite{}).Error
}

// IsIssueViewFavorited reports whether the user has favorited the given issue view.
func (s *UserFavoriteStore) IsIssueViewFavorited(ctx context.Context, userID, viewID uuid.UUID) (bool, error) {
	var count int64
	err := s.db.WithContext(ctx).Model(&model.UserFavorite{}).
		Where("user_id = ? AND entity_type = ? AND entity_identifier = ?", userID, FavoriteEntityTypeIssueView, viewID).
		Count(&count).Error
	return count > 0, err
}
