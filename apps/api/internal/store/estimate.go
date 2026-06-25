package store

import (
	"context"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// EstimateStore handles estimate + estimate-point persistence.
type EstimateStore struct{ db *gorm.DB }

func NewEstimateStore(db *gorm.DB) *EstimateStore { return &EstimateStore{db: db} }

func (s *EstimateStore) Create(ctx context.Context, e *model.Estimate) error {
	return s.db.WithContext(ctx).Create(e).Error
}

func (s *EstimateStore) GetByID(ctx context.Context, id uuid.UUID) (*model.Estimate, error) {
	var e model.Estimate
	if err := s.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&e).Error; err != nil {
		return nil, err
	}
	return &e, nil
}

func (s *EstimateStore) ListByProjectID(ctx context.Context, projectID uuid.UUID) ([]model.Estimate, error) {
	var list []model.Estimate
	err := s.db.WithContext(ctx).
		Where("project_id = ? AND deleted_at IS NULL", projectID).
		Order("created_at ASC").Find(&list).Error
	return list, err
}

func (s *EstimateStore) Update(ctx context.Context, e *model.Estimate) error {
	return s.db.WithContext(ctx).Save(e).Error
}

// Delete soft-deletes the estimate and its points.
func (s *EstimateStore) Delete(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("estimate_id = ?", id).Delete(&model.EstimatePoint{}).Error; err != nil {
			return err
		}
		return tx.Where("id = ?", id).Delete(&model.Estimate{}).Error
	})
}

func (s *EstimateStore) ListPointsByEstimateID(ctx context.Context, estimateID uuid.UUID) ([]model.EstimatePoint, error) {
	var pts []model.EstimatePoint
	err := s.db.WithContext(ctx).
		Where("estimate_id = ? AND deleted_at IS NULL", estimateID).
		Order("key ASC").Find(&pts).Error
	return pts, err
}

func (s *EstimateStore) ListPointsByEstimateIDs(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID][]model.EstimatePoint, error) {
	out := map[uuid.UUID][]model.EstimatePoint{}
	if len(ids) == 0 {
		return out, nil
	}
	var pts []model.EstimatePoint
	if err := s.db.WithContext(ctx).
		Where("estimate_id IN ? AND deleted_at IS NULL", ids).
		Order("key ASC").Find(&pts).Error; err != nil {
		return nil, err
	}
	for _, p := range pts {
		out[p.EstimateID] = append(out[p.EstimateID], p)
	}
	return out, nil
}

// ReplacePoints atomically soft-deletes the estimate's existing points and
// inserts the given ones.
func (s *EstimateStore) ReplacePoints(ctx context.Context, estimateID uuid.UUID, points []model.EstimatePoint) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("estimate_id = ?", estimateID).Delete(&model.EstimatePoint{}).Error; err != nil {
			return err
		}
		if len(points) > 0 {
			if err := tx.Create(&points).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// ClearLastUsedExcept marks every other estimate in the project inactive so at
// most one is the active ("last used") system.
func (s *EstimateStore) ClearLastUsedExcept(ctx context.Context, projectID, keepID uuid.UUID) error {
	return s.db.WithContext(ctx).Model(&model.Estimate{}).
		Where("project_id = ? AND id <> ? AND deleted_at IS NULL", projectID, keepID).
		Update("last_used", false).Error
}
