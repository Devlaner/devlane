package store

import (
	"context"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// StickyStore handles stickies.
type StickyStore struct{ db *gorm.DB }

func NewStickyStore(db *gorm.DB) *StickyStore { return &StickyStore{db: db} }

func (s *StickyStore) Create(ctx context.Context, st *model.Sticky) error {
	return s.db.WithContext(ctx).Create(st).Error
}

func (s *StickyStore) GetByID(ctx context.Context, id uuid.UUID) (*model.Sticky, error) {
	var st model.Sticky
	err := s.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&st).Error
	if err != nil {
		return nil, err
	}
	return &st, nil
}

func (s *StickyStore) ListByWorkspaceAndOwner(ctx context.Context, workspaceID, ownerID uuid.UUID) ([]model.Sticky, error) {
	var list []model.Sticky
	err := s.db.WithContext(ctx).
		Where("workspace_id = ? AND owner_id = ? AND deleted_at IS NULL", workspaceID, ownerID).
		Order("sort_order ASC, created_at ASC").
		Find(&list).Error
	return list, err
}

func (s *StickyStore) Update(ctx context.Context, st *model.Sticky) error {
	return s.db.WithContext(ctx).Save(st).Error
}

func (s *StickyStore) Delete(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&model.Sticky{}).Error
}
