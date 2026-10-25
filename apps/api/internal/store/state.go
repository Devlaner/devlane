package store

import (
	"context"
	"errors"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// StateStore handles state persistence.
type StateStore struct{ db *gorm.DB }

func NewStateStore(db *gorm.DB) *StateStore { return &StateStore{db: db} }

func (s *StateStore) Create(ctx context.Context, st *model.State) error {
	return s.db.WithContext(ctx).Create(st).Error
}

// RestoreOrCreateByNameAndProject inserts a default state, restoring a soft-deleted row
// with the same (name, project_id) when present so UNIQUE constraints do not block reseeding.
func (s *StateStore) RestoreOrCreateByNameAndProject(ctx context.Context, st *model.State) error {
	var existing model.State
	err := s.db.WithContext(ctx).Unscoped().
		Where("name = ? AND project_id = ?", st.Name, st.ProjectID).
		First(&existing).Error
	if err == nil {
		if !existing.DeletedAt.Valid {
			return nil
		}
		existing.Color = st.Color
		existing.Sequence = st.Sequence
		existing.Group = st.Group
		existing.Default = st.Default
		existing.WorkspaceID = st.WorkspaceID
		existing.DeletedAt = gorm.DeletedAt{}
		return s.db.WithContext(ctx).Unscoped().Save(&existing).Error
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "name"}, {Name: "project_id"}},
		DoNothing: true,
	}).Create(st).Error
}

func (s *StateStore) GetByID(ctx context.Context, id uuid.UUID) (*model.State, error) {
	var st model.State
	err := s.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&st).Error
	if err != nil {
		return nil, err
	}
	return &st, nil
}

func (s *StateStore) ListByProjectID(ctx context.Context, projectID uuid.UUID) ([]model.State, error) {
	var list []model.State
	err := s.db.WithContext(ctx).Where("project_id = ? AND deleted_at IS NULL", projectID).Order("sequence ASC, created_at ASC").Find(&list).Error
	return list, err
}

// GetDefaultByProjectID returns the project's default state (the one marked
// default), or nil when none is set. When several are somehow marked, the
// lowest-sequence one wins for determinism.
func (s *StateStore) GetDefaultByProjectID(ctx context.Context, projectID uuid.UUID) (*model.State, error) {
	var st model.State
	err := s.db.WithContext(ctx).
		Where(`project_id = ? AND deleted_at IS NULL AND "default" = TRUE`, projectID).
		Order("sequence ASC, created_at ASC").
		First(&st).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &st, nil
}

func (s *StateStore) Update(ctx context.Context, st *model.State) error {
	return s.db.WithContext(ctx).Save(st).Error
}

// UpdateFields writes only the given columns for one state, so a concurrent
// change to another column (notably the default flag) isn't clobbered by a
// full-row save.
func (s *StateStore) UpdateFields(ctx context.Context, stateID uuid.UUID, fields map[string]any) error {
	if len(fields) == 0 {
		return nil
	}
	return s.db.WithContext(ctx).
		Model(&model.State{}).
		Where("id = ? AND deleted_at IS NULL", stateID).
		Updates(fields).Error
}

// StateSequence pairs a state with its new order value for a reorder.
type StateSequence struct {
	ID       uuid.UUID
	Sequence float64
}

// ReorderSequences assigns new sequence values to several states in one
// transaction, so a partial failure can't leave the order half-applied. Each
// update is scoped to projectID so a caller can't touch another project's states.
func (s *StateStore) ReorderSequences(ctx context.Context, projectID uuid.UUID, items []StateSequence) error {
	if len(items) == 0 {
		return nil
	}
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, it := range items {
			if err := tx.Model(&model.State{}).
				Where("id = ? AND project_id = ? AND deleted_at IS NULL", it.ID, projectID).
				Update("sequence", it.Sequence).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// SetDefault makes stateID the project's only default state, clearing the flag
// on every other state in the project in one transaction.
func (s *StateStore) SetDefault(ctx context.Context, projectID, stateID uuid.UUID) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&model.State{}).
			Where("project_id = ? AND deleted_at IS NULL", projectID).
			Updates(map[string]any{"default": false}).Error; err != nil {
			return err
		}
		return tx.Model(&model.State{}).
			Where("id = ? AND deleted_at IS NULL", stateID).
			Updates(map[string]any{"default": true}).Error
	})
}

func (s *StateStore) Delete(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&model.State{}).Error
}
