package store

import (
	"context"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// WorkspaceInviteStore handles workspace_member_invites.
type WorkspaceInviteStore struct{ db *gorm.DB }

func NewWorkspaceInviteStore(db *gorm.DB) *WorkspaceInviteStore { return &WorkspaceInviteStore{db: db} }

func (s *WorkspaceInviteStore) Create(ctx context.Context, inv *model.WorkspaceMemberInvite) error {
	return s.db.WithContext(ctx).Create(inv).Error
}

func (s *WorkspaceInviteStore) GetByID(ctx context.Context, id uuid.UUID) (*model.WorkspaceMemberInvite, error) {
	var inv model.WorkspaceMemberInvite
	err := s.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&inv).Error
	if err != nil {
		return nil, err
	}
	return &inv, nil
}

func (s *WorkspaceInviteStore) GetByToken(ctx context.Context, token string) (*model.WorkspaceMemberInvite, error) {
	var inv model.WorkspaceMemberInvite
	err := s.db.WithContext(ctx).Where("token = ? AND deleted_at IS NULL AND accepted = false", token).First(&inv).Error
	if err != nil {
		return nil, err
	}
	return &inv, nil
}

func (s *WorkspaceInviteStore) ListByWorkspaceID(ctx context.Context, workspaceID uuid.UUID) ([]model.WorkspaceMemberInvite, error) {
	var list []model.WorkspaceMemberInvite
	err := s.db.WithContext(ctx).Where("workspace_id = ? AND deleted_at IS NULL", workspaceID).Find(&list).Error
	return list, err
}

func (s *WorkspaceInviteStore) ListPendingByEmail(ctx context.Context, email string) ([]model.WorkspaceMemberInvite, error) {
	var list []model.WorkspaceMemberInvite
	err := s.db.WithContext(ctx).Where("email = ? AND accepted = false AND deleted_at IS NULL", email).Find(&list).Error
	return list, err
}

func (s *WorkspaceInviteStore) Update(ctx context.Context, inv *model.WorkspaceMemberInvite) error {
	return s.db.WithContext(ctx).Save(inv).Error
}

func (s *WorkspaceInviteStore) Delete(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&model.WorkspaceMemberInvite{}).Error
}
