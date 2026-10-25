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

// FavoriteEntityTypePage is stored in user_favorites.entity_type for project pages.
const FavoriteEntityTypePage = "page"

// Entity types for cycle/module favorites and for folders that group favorites.
const (
	FavoriteEntityTypeCycle  = "cycle"
	FavoriteEntityTypeModule = "module"
	FavoriteEntityTypeFolder = "folder"
)

// ListByUserAndWorkspace returns all of a user's favorites (entities and
// folders) in a workspace, ordered for display.
func (s *UserFavoriteStore) ListByUserAndWorkspace(ctx context.Context, userID, workspaceID uuid.UUID) ([]model.UserFavorite, error) {
	var list []model.UserFavorite
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND workspace_id = ?", userID, workspaceID).
		Order("sort_order ASC, created_at ASC").
		Find(&list).Error
	return list, err
}

// GetOwnedByID returns the user's favorite by id, or nil when it doesn't exist
// or belongs to someone else.
func (s *UserFavoriteStore) GetOwnedByID(ctx context.Context, userID, id uuid.UUID) (*model.UserFavorite, error) {
	var f model.UserFavorite
	err := s.db.WithContext(ctx).Where("id = ? AND user_id = ?", id, userID).First(&f).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &f, nil
}

// AddEntity favorites an entity (cycle/module/…) idempotently: an insert that
// races another request for the same (user, entity_type, entity_identifier) is
// a no-op, and the caller always gets the persisted row back.
func (s *UserFavoriteStore) AddEntity(ctx context.Context, f *model.UserFavorite) (*model.UserFavorite, error) {
	if err := s.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}, {Name: "entity_type"}, {Name: "entity_identifier"}},
			DoNothing: true,
		}).
		Create(f).Error; err != nil {
		return nil, err
	}
	var row model.UserFavorite
	if err := s.db.WithContext(ctx).
		Where("user_id = ? AND entity_type = ? AND entity_identifier = ?", f.UserID, f.EntityType, f.EntityIdentifier).
		First(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

// CreateFolder inserts a folder favorite. Folders carry a synthetic
// entity_identifier so they satisfy the (user, entity_type, entity_identifier)
// unique index.
func (s *UserFavoriteStore) CreateFolder(ctx context.Context, f *model.UserFavorite) error {
	f.IsFolder = true
	f.EntityType = FavoriteEntityTypeFolder
	f.Type = FavoriteEntityTypeFolder
	f.EntityIdentifier = uuid.New()
	return s.db.WithContext(ctx).Create(f).Error
}

// RemoveEntity unfavorites an entity for the user.
func (s *UserFavoriteStore) RemoveEntity(ctx context.Context, userID uuid.UUID, entityType string, entityID uuid.UUID) error {
	return s.db.WithContext(ctx).
		Where("user_id = ? AND entity_type = ? AND entity_identifier = ?", userID, entityType, entityID).
		Delete(&model.UserFavorite{}).Error
}

// UpdateOwned writes the given columns (name / parent_id / sort_order) for the
// user's favorite.
func (s *UserFavoriteStore) UpdateOwned(ctx context.Context, userID, id uuid.UUID, fields map[string]any) error {
	if len(fields) == 0 {
		return nil
	}
	return s.db.WithContext(ctx).
		Model(&model.UserFavorite{}).
		Where("id = ? AND user_id = ?", id, userID).
		Updates(fields).Error
}

// DeleteOwned removes the user's favorite. When it's a folder, its children are
// first moved to the top level so the entities inside aren't unfavorited.
func (s *UserFavoriteStore) DeleteOwned(ctx context.Context, userID, id uuid.UUID) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&model.UserFavorite{}).
			Where("user_id = ? AND parent_id = ?", userID, id).
			Update("parent_id", nil).Error; err != nil {
			return err
		}
		return tx.Where("id = ? AND user_id = ?", id, userID).Delete(&model.UserFavorite{}).Error
	})
}

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

// ListPageIDsByUserAndWorkspace returns page IDs the user has favorited in a workspace.
func (s *UserFavoriteStore) ListPageIDsByUserAndWorkspace(ctx context.Context, userID, workspaceID uuid.UUID) ([]uuid.UUID, error) {
	var ids []uuid.UUID
	err := s.db.WithContext(ctx).Model(&model.UserFavorite{}).
		Where("user_id = ? AND entity_type = ? AND workspace_id = ?", userID, FavoriteEntityTypePage, workspaceID).
		Pluck("entity_identifier", &ids).Error
	return ids, err
}

// AddPage favorites a page for the user. Idempotent on conflict.
func (s *UserFavoriteStore) AddPage(ctx context.Context, userID, workspaceID uuid.UUID, projectID *uuid.UUID, pageID uuid.UUID) error {
	fav := &model.UserFavorite{
		Name:             "page",
		Type:             "page",
		EntityType:       FavoriteEntityTypePage,
		EntityIdentifier: pageID,
		WorkspaceID:      workspaceID,
		ProjectID:        projectID,
		UserID:           userID,
	}
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}, {Name: "entity_type"}, {Name: "entity_identifier"}},
		DoNothing: true,
	}).Create(fav).Error
}

// RemovePage removes a page from the user's favorites.
func (s *UserFavoriteStore) RemovePage(ctx context.Context, userID, pageID uuid.UUID) error {
	return s.db.WithContext(ctx).
		Where("user_id = ? AND entity_type = ? AND entity_identifier = ?", userID, FavoriteEntityTypePage, pageID).
		Delete(&model.UserFavorite{}).Error
}

// IsPageFavorited reports whether the user has favorited the given page.
func (s *UserFavoriteStore) IsPageFavorited(ctx context.Context, userID, pageID uuid.UUID) (bool, error) {
	var count int64
	err := s.db.WithContext(ctx).Model(&model.UserFavorite{}).
		Where("user_id = ? AND entity_type = ? AND entity_identifier = ?", userID, FavoriteEntityTypePage, pageID).
		Count(&count).Error
	return count > 0, err
}
