package store

import (
	"context"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// PageStore handles page and project_page persistence.
type PageStore struct{ db *gorm.DB }

func NewPageStore(db *gorm.DB) *PageStore { return &PageStore{db: db} }

func (s *PageStore) Create(ctx context.Context, p *model.Page) error {
	return s.db.WithContext(ctx).Create(p).Error
}

func (s *PageStore) GetByID(ctx context.Context, id uuid.UUID) (*model.Page, error) {
	var page model.Page
	err := s.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&page).Error
	if err != nil {
		return nil, err
	}
	return &page, nil
}

func (s *PageStore) ListByWorkspaceID(ctx context.Context, workspaceID uuid.UUID) ([]model.Page, error) {
	var list []model.Page
	err := s.db.WithContext(ctx).Where("workspace_id = ? AND deleted_at IS NULL", workspaceID).
		Order("sort_order ASC, created_at ASC").Find(&list).Error
	return list, err
}

func (s *PageStore) ListByProjectID(ctx context.Context, projectID uuid.UUID) ([]model.Page, error) {
	var list []model.Page
	err := s.db.WithContext(ctx).Model(&model.Page{}).
		Joins("INNER JOIN project_pages ON project_pages.page_id = pages.id AND project_pages.deleted_at IS NULL").
		Where("project_pages.project_id = ? AND pages.deleted_at IS NULL", projectID).
		Order("pages.sort_order ASC, pages.created_at ASC").Find(&list).Error
	return list, err
}

func (s *PageStore) Update(ctx context.Context, p *model.Page) error {
	return s.db.WithContext(ctx).Save(p).Error
}

func (s *PageStore) Delete(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&model.Page{}).Error
}

func (s *PageStore) AddProjectPage(ctx context.Context, pp *model.ProjectPage) error {
	return s.db.WithContext(ctx).Create(pp).Error
}

func (s *PageStore) RemoveProjectPage(ctx context.Context, projectID, pageID uuid.UUID) error {
	return s.db.WithContext(ctx).Where("project_id = ? AND page_id = ?", projectID, pageID).
		Delete(&model.ProjectPage{}).Error
}
