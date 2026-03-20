package store

import (
	"context"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// IssueViewStore handles issue_views persistence.
type IssueViewStore struct{ db *gorm.DB }

func NewIssueViewStore(db *gorm.DB) *IssueViewStore { return &IssueViewStore{db: db} }

func (s *IssueViewStore) Create(ctx context.Context, v *model.IssueView) error {
	return s.db.WithContext(ctx).Create(v).Error
}

func (s *IssueViewStore) GetByID(ctx context.Context, id uuid.UUID) (*model.IssueView, error) {
	var iv model.IssueView
	err := s.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&iv).Error
	if err != nil {
		return nil, err
	}
	return &iv, nil
}

func (s *IssueViewStore) ListByWorkspaceID(ctx context.Context, workspaceID uuid.UUID, projectID *uuid.UUID) ([]model.IssueView, error) {
	var list []model.IssueView
	q := s.db.WithContext(ctx).Where("workspace_id = ? AND deleted_at IS NULL", workspaceID)
	if projectID == nil {
		q = q.Where("project_id IS NULL")
	} else {
		q = q.Where("project_id = ?", *projectID)
	}
	err := q.Order("sort_order ASC, created_at ASC").Find(&list).Error
	return list, err
}

// ListFavoritedByUserInWorkspace returns issue views the user favorited in this workspace (project or workspace-scoped).
func (s *IssueViewStore) ListFavoritedByUserInWorkspace(ctx context.Context, workspaceID, userID uuid.UUID) ([]model.IssueView, error) {
	var list []model.IssueView
	err := s.db.WithContext(ctx).
		Table("issue_views").
		Joins(`INNER JOIN user_favorites ON user_favorites.entity_identifier = issue_views.id AND user_favorites.entity_type = ?`, FavoriteEntityTypeIssueView).
		Where("issue_views.workspace_id = ? AND user_favorites.user_id = ? AND issue_views.deleted_at IS NULL", workspaceID, userID).
		Order("issue_views.name ASC").
		Find(&list).Error
	return list, err
}

func (s *IssueViewStore) Update(ctx context.Context, v *model.IssueView) error {
	return s.db.WithContext(ctx).Save(v).Error
}

func (s *IssueViewStore) Delete(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&model.IssueView{}).Error
}
