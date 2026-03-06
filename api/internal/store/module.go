package store

import (
	"context"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ModuleStore handles module persistence.
type ModuleStore struct{ db *gorm.DB }

func NewModuleStore(db *gorm.DB) *ModuleStore { return &ModuleStore{db: db} }

func (s *ModuleStore) Create(ctx context.Context, m *model.Module) error {
	return s.db.WithContext(ctx).Create(m).Error
}

func (s *ModuleStore) GetByID(ctx context.Context, id uuid.UUID) (*model.Module, error) {
	var mod model.Module
	err := s.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&mod).Error
	if err != nil {
		return nil, err
	}
	return &mod, nil
}

func (s *ModuleStore) ListByProjectID(ctx context.Context, projectID uuid.UUID) ([]model.Module, error) {
	var list []model.Module
	err := s.db.WithContext(ctx).Where("project_id = ? AND deleted_at IS NULL", projectID).
		Order("sort_order ASC, created_at ASC").Find(&list).Error
	return list, err
}

func (s *ModuleStore) Update(ctx context.Context, m *model.Module) error {
	return s.db.WithContext(ctx).Save(m).Error
}

func (s *ModuleStore) Delete(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&model.Module{}).Error
}

func (s *ModuleStore) AddModuleIssue(ctx context.Context, mi *model.ModuleIssue) error {
	return s.db.WithContext(ctx).Create(mi).Error
}

func (s *ModuleStore) RemoveModuleIssue(ctx context.Context, moduleID, issueID uuid.UUID) error {
	return s.db.WithContext(ctx).Where("module_id = ? AND issue_id = ?", moduleID, issueID).
		Delete(&model.ModuleIssue{}).Error
}

func (s *ModuleStore) ListModuleIssueIDs(ctx context.Context, moduleID uuid.UUID) ([]uuid.UUID, error) {
	var rows []struct{ IssueID uuid.UUID }
	err := s.db.WithContext(ctx).Model(&model.ModuleIssue{}).
		Where("module_id = ?", moduleID).Select("issue_id").Find(&rows).Error
	if err != nil {
		return nil, err
	}
	ids := make([]uuid.UUID, 0, len(rows))
	for _, r := range rows {
		ids = append(ids, r.IssueID)
	}
	return ids, nil
}

func (s *ModuleStore) CountIssuesByModuleIDs(ctx context.Context, moduleIDs []uuid.UUID) (map[uuid.UUID]int, error) {
	out := make(map[uuid.UUID]int)
	if len(moduleIDs) == 0 {
		return out, nil
	}
	var rows []struct {
		ModuleID uuid.UUID `gorm:"column:module_id"`
		Count    int       `gorm:"column:count"`
	}
	err := s.db.WithContext(ctx).
		Model(&model.ModuleIssue{}).
		Select("module_id, COUNT(*) as count").
		Where("module_id IN ?", moduleIDs).
		Group("module_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		out[r.ModuleID] = r.Count
	}
	return out, nil
}
