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

func (s *StateStore) Update(ctx context.Context, st *model.State) error {
	return s.db.WithContext(ctx).Save(st).Error
}

func (s *StateStore) Delete(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&model.State{}).Error
}
