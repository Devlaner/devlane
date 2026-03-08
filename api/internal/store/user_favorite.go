package store

import (
	"context"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const FavoriteEntityTypeProject = "project"

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
