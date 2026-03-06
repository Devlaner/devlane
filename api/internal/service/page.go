package service

import (
	"context"
	"errors"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
)

var ErrPageNotFound = errors.New("page not found")

// PageService handles page business logic.
type PageService struct {
	pageStore    *store.PageStore
	projectStore *store.ProjectStore
	ws           *store.WorkspaceStore
}

func NewPageService(pageStore *store.PageStore, projectStore *store.ProjectStore, ws *store.WorkspaceStore) *PageService {
	return &PageService{pageStore: pageStore, projectStore: projectStore, ws: ws}
}

func (s *PageService) ensureWorkspaceAccess(ctx context.Context, workspaceSlug string, userID uuid.UUID) (uuid.UUID, error) {
	wrk, err := s.ws.GetBySlug(ctx, workspaceSlug)
	if err != nil {
		return uuid.Nil, ErrProjectForbidden
	}
	ok, _ := s.ws.IsMember(ctx, wrk.ID, userID)
	if !ok {
		return uuid.Nil, ErrProjectForbidden
	}
	return wrk.ID, nil
}

func (s *PageService) ensureProjectAccess(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID) error {
	wrk, err := s.ws.GetBySlug(ctx, workspaceSlug)
	if err != nil {
		return ErrProjectForbidden
	}
	ok, _ := s.ws.IsMember(ctx, wrk.ID, userID)
	if !ok {
		return ErrProjectForbidden
	}
	inWorkspace, _ := s.projectStore.IsInWorkspace(ctx, projectID, wrk.ID)
	if !inWorkspace {
		return ErrProjectNotFound
	}
	return nil
}

// List lists pages for workspace or for a project (projectID optional).
func (s *PageService) List(ctx context.Context, workspaceSlug string, projectID *uuid.UUID, userID uuid.UUID) ([]model.Page, error) {
	workspaceID, err := s.ensureWorkspaceAccess(ctx, workspaceSlug, userID)
	if err != nil {
		return nil, err
	}
	if projectID != nil {
		if err := s.ensureProjectAccess(ctx, workspaceSlug, *projectID, userID); err != nil {
			return nil, err
		}
		return s.pageStore.ListByProjectID(ctx, *projectID)
	}
	return s.pageStore.ListByWorkspaceID(ctx, workspaceID)
}

func (s *PageService) Create(ctx context.Context, workspaceSlug string, projectID *uuid.UUID, userID uuid.UUID, name, descriptionHTML string, access int16) (*model.Page, error) {
	workspaceID, err := s.ensureWorkspaceAccess(ctx, workspaceSlug, userID)
	if err != nil {
		return nil, err
	}
	if projectID != nil {
		if err := s.ensureProjectAccess(ctx, workspaceSlug, *projectID, userID); err != nil {
			return nil, err
		}
	}
	page := &model.Page{
		Name:            name,
		DescriptionHTML: descriptionHTML,
		OwnedByID:       userID,
		WorkspaceID:     workspaceID,
		Access:          access,
	}
	if err := s.pageStore.Create(ctx, page); err != nil {
		return nil, err
	}
	if projectID != nil {
		_ = s.pageStore.AddProjectPage(ctx, &model.ProjectPage{
			ProjectID:   *projectID,
			PageID:      page.ID,
			WorkspaceID: workspaceID,
		})
	}
	return page, nil
}

func (s *PageService) Get(ctx context.Context, workspaceSlug string, pageID uuid.UUID, userID uuid.UUID) (*model.Page, error) {
	_, err := s.ensureWorkspaceAccess(ctx, workspaceSlug, userID)
	if err != nil {
		return nil, err
	}
	page, err := s.pageStore.GetByID(ctx, pageID)
	if err != nil {
		return nil, ErrPageNotFound
	}
	return page, nil
}

func (s *PageService) Update(ctx context.Context, workspaceSlug string, pageID uuid.UUID, userID uuid.UUID, name, descriptionHTML string, access *int16) (*model.Page, error) {
	_, err := s.ensureWorkspaceAccess(ctx, workspaceSlug, userID)
	if err != nil {
		return nil, err
	}
	page, err := s.pageStore.GetByID(ctx, pageID)
	if err != nil {
		return nil, ErrPageNotFound
	}
	if page.OwnedByID != userID {
		return nil, ErrPageNotFound
	}
	if name != "" {
		page.Name = name
	}
	if descriptionHTML != "" {
		page.DescriptionHTML = descriptionHTML
	}
	if access != nil {
		page.Access = *access
	}
	if err := s.pageStore.Update(ctx, page); err != nil {
		return nil, err
	}
	return page, nil
}

func (s *PageService) Delete(ctx context.Context, workspaceSlug string, pageID uuid.UUID, userID uuid.UUID) error {
	_, err := s.ensureWorkspaceAccess(ctx, workspaceSlug, userID)
	if err != nil {
		return err
	}
	page, err := s.pageStore.GetByID(ctx, pageID)
	if err != nil {
		return ErrPageNotFound
	}
	if page.OwnedByID != userID {
		return ErrPageNotFound
	}
	return s.pageStore.Delete(ctx, pageID)
}
