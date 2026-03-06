package store

import (
	"context"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// LabelStore handles label persistence.
type LabelStore struct{ db *gorm.DB }

func NewLabelStore(db *gorm.DB) *LabelStore { return &LabelStore{db: db} }

func (s *LabelStore) Create(ctx context.Context, l *model.Label) error {
	return s.db.WithContext(ctx).Create(l).Error
}

func (s *LabelStore) GetByID(ctx context.Context, id uuid.UUID) (*model.Label, error) {
	var l model.Label
	err := s.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&l).Error
	if err != nil {
		return nil, err
	}
	return &l, nil
}

func (s *LabelStore) ListByProjectID(ctx context.Context, projectID uuid.UUID) ([]model.Label, error) {
	var list []model.Label
	err := s.db.WithContext(ctx).Where("project_id = ? AND deleted_at IS NULL", projectID).Order("sort_order ASC, created_at ASC").Find(&list).Error
	return list, err
}

func (s *LabelStore) ListByWorkspaceID(ctx context.Context, workspaceID uuid.UUID) ([]model.Label, error) {
	var list []model.Label
	err := s.db.WithContext(ctx).Where("workspace_id = ? AND project_id IS NULL AND deleted_at IS NULL", workspaceID).Find(&list).Error
	return list, err
}

func (s *LabelStore) Update(ctx context.Context, l *model.Label) error {
	return s.db.WithContext(ctx).Save(l).Error
}

func (s *LabelStore) Delete(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&model.Label{}).Error
}
