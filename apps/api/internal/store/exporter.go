package store

import (
	"context"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ExporterStore persists export-history records.
type ExporterStore struct{ db *gorm.DB }

func NewExporterStore(db *gorm.DB) *ExporterStore { return &ExporterStore{db: db} }

// Create records an export request.
func (s *ExporterStore) Create(ctx context.Context, e *model.Exporter) error {
	return s.db.WithContext(ctx).Create(e).Error
}

// ListByWorkspaceID returns a workspace's export history, newest first.
func (s *ExporterStore) ListByWorkspaceID(ctx context.Context, workspaceID uuid.UUID) ([]model.Exporter, error) {
	var list []model.Exporter
	err := s.db.WithContext(ctx).
		Where("workspace_id = ?", workspaceID).
		Order("created_at DESC").
		Find(&list).Error
	if err != nil {
		return nil, err
	}
	return list, nil
}
