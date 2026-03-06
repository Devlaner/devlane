package store

import (
	"context"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// WorkspaceStore handles workspace persistence.
type WorkspaceStore struct{ db *gorm.DB }

func NewWorkspaceStore(db *gorm.DB) *WorkspaceStore { return &WorkspaceStore{db: db} }

func (s *WorkspaceStore) Create(ctx context.Context, w *model.Workspace) error {
	return s.db.WithContext(ctx).Create(w).Error
}

func (s *WorkspaceStore) GetByID(ctx context.Context, id uuid.UUID) (*model.Workspace, error) {
	var w model.Workspace
	err := s.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&w).Error
	if err != nil {
		return nil, err
	}
	return &w, nil
}

func (s *WorkspaceStore) GetBySlug(ctx context.Context, slug string) (*model.Workspace, error) {
	var w model.Workspace
	err := s.db.WithContext(ctx).Where("slug = ? AND deleted_at IS NULL", slug).First(&w).Error
	if err != nil {
		return nil, err
	}
	return &w, nil
}

func (s *WorkspaceStore) ListByMemberID(ctx context.Context, memberID uuid.UUID) ([]model.Workspace, error) {
	var list []model.Workspace
	err := s.db.WithContext(ctx).Table("workspaces").
		Joins("INNER JOIN workspace_members ON workspace_members.workspace_id = workspaces.id AND workspace_members.deleted_at IS NULL").
		Where("workspace_members.member_id = ? AND workspaces.deleted_at IS NULL", memberID).
		Find(&list).Error
	return list, err
}

func (s *WorkspaceStore) Update(ctx context.Context, w *model.Workspace) error {
	return s.db.WithContext(ctx).Save(w).Error
}

func (s *WorkspaceStore) Delete(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&model.Workspace{}).Error
}

func (s *WorkspaceStore) SlugExists(ctx context.Context, slug string, excludeID uuid.UUID) (bool, error) {
	var count int64
	q := s.db.WithContext(ctx).Model(&model.Workspace{}).Where("slug = ? AND deleted_at IS NULL", slug)
	if excludeID != uuid.Nil {
		q = q.Where("id != ?", excludeID)
	}
	err := q.Count(&count).Error
	return count > 0, err
}

// AddMember adds a workspace member.
func (s *WorkspaceStore) AddMember(ctx context.Context, m *model.WorkspaceMember) error {
	return s.db.WithContext(ctx).Create(m).Error
}

func (s *WorkspaceStore) IsMember(ctx context.Context, workspaceID, userID uuid.UUID) (bool, error) {
	var count int64
	err := s.db.WithContext(ctx).Model(&model.WorkspaceMember{}).
		Where("workspace_id = ? AND member_id = ? AND deleted_at IS NULL", workspaceID, userID).
		Count(&count).Error
	return count > 0, err
}

func (s *WorkspaceStore) ListMembers(ctx context.Context, workspaceID uuid.UUID) ([]model.WorkspaceMember, error) {
	var list []model.WorkspaceMember
	err := s.db.WithContext(ctx).
		Table("workspace_members").
		Select("workspace_members.*, users.display_name as member_display_name, users.email as member_email, users.avatar as member_avatar").
		Joins("INNER JOIN users ON users.id = workspace_members.member_id AND users.deleted_at IS NULL").
		Where("workspace_members.workspace_id = ? AND workspace_members.deleted_at IS NULL", workspaceID).
		Find(&list).Error
	return list, err
}

func (s *WorkspaceStore) GetMember(ctx context.Context, workspaceID, memberID uuid.UUID) (*model.WorkspaceMember, error) {
	var m model.WorkspaceMember
	err := s.db.WithContext(ctx).Where("workspace_id = ? AND member_id = ? AND deleted_at IS NULL", workspaceID, memberID).First(&m).Error
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (s *WorkspaceStore) GetMemberByPK(ctx context.Context, id uuid.UUID) (*model.WorkspaceMember, error) {
	var m model.WorkspaceMember
	err := s.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&m).Error
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (s *WorkspaceStore) UpdateMember(ctx context.Context, m *model.WorkspaceMember) error {
	return s.db.WithContext(ctx).Save(m).Error
}

func (s *WorkspaceStore) DeleteMember(ctx context.Context, workspaceID, memberID uuid.UUID) error {
	return s.db.WithContext(ctx).Where("workspace_id = ? AND member_id = ?", workspaceID, memberID).Delete(&model.WorkspaceMember{}).Error
}

func (s *WorkspaceStore) Leave(ctx context.Context, workspaceID, userID uuid.UUID) error {
	return s.DeleteMember(ctx, workspaceID, userID)
}
