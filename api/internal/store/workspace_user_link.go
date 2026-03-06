package store

import (
	"context"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// WorkspaceUserLinkStore handles workspace_user_links (quick links).
type WorkspaceUserLinkStore struct{ db *gorm.DB }

func NewWorkspaceUserLinkStore(db *gorm.DB) *WorkspaceUserLinkStore {
	return &WorkspaceUserLinkStore{db: db}
}

func (s *WorkspaceUserLinkStore) Create(ctx context.Context, l *model.WorkspaceUserLink) error {
	return s.db.WithContext(ctx).Create(l).Error
}

func (s *WorkspaceUserLinkStore) GetByID(ctx context.Context, id uuid.UUID) (*model.WorkspaceUserLink, error) {
	var l model.WorkspaceUserLink
	err := s.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&l).Error
	if err != nil {
		return nil, err
	}
	return &l, nil
}

func (s *WorkspaceUserLinkStore) ListByWorkspaceAndOwner(ctx context.Context, workspaceID, ownerID uuid.UUID) ([]model.WorkspaceUserLink, error) {
	var list []model.WorkspaceUserLink
	err := s.db.WithContext(ctx).
		Where("workspace_id = ? AND owner_id = ? AND deleted_at IS NULL", workspaceID, ownerID).
		Order("created_at DESC").
		Find(&list).Error
	return list, err
}

func (s *WorkspaceUserLinkStore) Update(ctx context.Context, l *model.WorkspaceUserLink) error {
	return s.db.WithContext(ctx).Save(l).Error
}

func (s *WorkspaceUserLinkStore) Delete(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&model.WorkspaceUserLink{}).Error
}
