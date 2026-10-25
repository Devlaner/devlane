package store

import (
	"context"
	"errors"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ImporterStore is the data-access layer for bulk-import jobs.
type ImporterStore struct {
	db *gorm.DB
}

func NewImporterStore(db *gorm.DB) *ImporterStore {
	return &ImporterStore{db: db}
}

func (s *ImporterStore) Create(ctx context.Context, im *model.Importer) error {
	return s.db.WithContext(ctx).Create(im).Error
}

// GetByID returns the importer scoped to a project, or (nil, nil) if not found.
func (s *ImporterStore) GetByID(ctx context.Context, projectID, id uuid.UUID) (*model.Importer, error) {
	var im model.Importer
	err := s.db.WithContext(ctx).
		Where("id = ? AND project_id = ?", id, projectID).
		First(&im).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &im, nil
}

// Get returns the importer by id alone (used by the worker), or (nil, nil).
func (s *ImporterStore) Get(ctx context.Context, id uuid.UUID) (*model.Importer, error) {
	var im model.Importer
	err := s.db.WithContext(ctx).Where("id = ?", id).First(&im).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &im, nil
}

// ListByProject returns a project's imports, newest first. Row data is not
// selected, keeping list responses small.
func (s *ImporterStore) ListByProject(ctx context.Context, projectID uuid.UUID) ([]model.Importer, error) {
	var list []model.Importer
	err := s.db.WithContext(ctx).
		Omit("data").
		Where("project_id = ?", projectID).
		Order("created_at DESC").
		Find(&list).Error
	return list, err
}

// UpdateProgress persists the current status and counters.
func (s *ImporterStore) UpdateProgress(ctx context.Context, im *model.Importer) error {
	return s.db.WithContext(ctx).Model(im).
		Select("status", "processed_count", "error_count", "error_message", "updated_at").
		Updates(map[string]interface{}{
			"status":          im.Status,
			"processed_count": im.ProcessedCount,
			"error_count":     im.ErrorCount,
			"error_message":   im.ErrorMessage,
		}).Error
}
