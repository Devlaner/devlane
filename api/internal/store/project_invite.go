package store

import (
	"context"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ProjectInviteStore handles project_member_invites.
type ProjectInviteStore struct{ db *gorm.DB }

func NewProjectInviteStore(db *gorm.DB) *ProjectInviteStore { return &ProjectInviteStore{db: db} }

func (s *ProjectInviteStore) Create(ctx context.Context, inv *model.ProjectMemberInvite) error {
	return s.db.WithContext(ctx).Create(inv).Error
}

func (s *ProjectInviteStore) GetByID(ctx context.Context, id uuid.UUID) (*model.ProjectMemberInvite, error) {
	var inv model.ProjectMemberInvite
	err := s.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&inv).Error
	if err != nil {
		return nil, err
	}
	return &inv, nil
}

func (s *ProjectInviteStore) GetByToken(ctx context.Context, token string) (*model.ProjectMemberInvite, error) {
	var inv model.ProjectMemberInvite
	err := s.db.WithContext(ctx).Where("token = ? AND deleted_at IS NULL AND accepted = false", token).First(&inv).Error
	if err != nil {
		return nil, err
	}
	return &inv, nil
}

func (s *ProjectInviteStore) ListByProjectID(ctx context.Context, projectID uuid.UUID) ([]model.ProjectMemberInvite, error) {
	var list []model.ProjectMemberInvite
	err := s.db.WithContext(ctx).Where("project_id = ? AND deleted_at IS NULL", projectID).Find(&list).Error
	return list, err
}

func (s *ProjectInviteStore) ListPendingByEmail(ctx context.Context, email string) ([]model.ProjectMemberInvite, error) {
	var list []model.ProjectMemberInvite
	err := s.db.WithContext(ctx).Where("email = ? AND accepted = false AND deleted_at IS NULL", email).Find(&list).Error
	return list, err
}

func (s *ProjectInviteStore) Update(ctx context.Context, inv *model.ProjectMemberInvite) error {
	return s.db.WithContext(ctx).Save(inv).Error
}

func (s *ProjectInviteStore) Delete(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&model.ProjectMemberInvite{}).Error
}
