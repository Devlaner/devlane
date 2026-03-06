package store

import (
	"context"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ProjectStore handles project persistence.
type ProjectStore struct{ db *gorm.DB }

func NewProjectStore(db *gorm.DB) *ProjectStore { return &ProjectStore{db: db} }

func (s *ProjectStore) Create(ctx context.Context, p *model.Project) error {
	return s.db.WithContext(ctx).Create(p).Error
}

func (s *ProjectStore) GetByID(ctx context.Context, id uuid.UUID) (*model.Project, error) {
	var p model.Project
	err := s.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&p).Error
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (s *ProjectStore) ListByWorkspaceID(ctx context.Context, workspaceID uuid.UUID) ([]model.Project, error) {
	var list []model.Project
	err := s.db.WithContext(ctx).Where("workspace_id = ? AND deleted_at IS NULL", workspaceID).Order("created_at ASC").Find(&list).Error
	return list, err
}

func (s *ProjectStore) Update(ctx context.Context, p *model.Project) error {
	return s.db.WithContext(ctx).Save(p).Error
}

func (s *ProjectStore) Delete(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&model.Project{}).Error
}

// IsInWorkspace checks that the project belongs to the workspace.
func (s *ProjectStore) IsInWorkspace(ctx context.Context, projectID, workspaceID uuid.UUID) (bool, error) {
	var count int64
	err := s.db.WithContext(ctx).Model(&model.Project{}).
		Where("id = ? AND workspace_id = ? AND deleted_at IS NULL", projectID, workspaceID).
		Count(&count).Error
	return count > 0, err
}

func (s *ProjectStore) ListMembers(ctx context.Context, projectID uuid.UUID) ([]model.ProjectMember, error) {
	var list []model.ProjectMember
	err := s.db.WithContext(ctx).Where("project_id = ? AND deleted_at IS NULL", projectID).Find(&list).Error
	return list, err
}

func (s *ProjectStore) AddProjectMember(ctx context.Context, m *model.ProjectMember) error {
	return s.db.WithContext(ctx).Create(m).Error
}

func (s *ProjectStore) GetProjectMember(ctx context.Context, projectID, memberID uuid.UUID) (*model.ProjectMember, error) {
	var m model.ProjectMember
	err := s.db.WithContext(ctx).Where("project_id = ? AND member_id = ? AND deleted_at IS NULL", projectID, memberID).First(&m).Error
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (s *ProjectStore) GetProjectMemberByPK(ctx context.Context, id uuid.UUID) (*model.ProjectMember, error) {
	var m model.ProjectMember
	err := s.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&m).Error
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (s *ProjectStore) UpdateProjectMember(ctx context.Context, m *model.ProjectMember) error {
	return s.db.WithContext(ctx).Save(m).Error
}

func (s *ProjectStore) DeleteProjectMember(ctx context.Context, projectID, memberID uuid.UUID) error {
	return s.db.WithContext(ctx).Where("project_id = ? AND member_id = ?", projectID, memberID).Delete(&model.ProjectMember{}).Error
}

func (s *ProjectStore) DeleteProjectMemberByPK(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&model.ProjectMember{}).Error
}
