package service

import (
	"context"
	"errors"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
)

var ErrIssueViewNotFound = errors.New("issue view not found")

// IssueViewService handles issue view business logic.
type IssueViewService struct {
	ivs *store.IssueViewStore
	ps  *store.ProjectStore
	ws  *store.WorkspaceStore
}

func NewIssueViewService(ivs *store.IssueViewStore, ps *store.ProjectStore, ws *store.WorkspaceStore) *IssueViewService {
	return &IssueViewService{ivs: ivs, ps: ps, ws: ws}
}

func (s *IssueViewService) ensureWorkspaceAccess(ctx context.Context, workspaceSlug string, userID uuid.UUID) (uuid.UUID, error) {
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

func (s *IssueViewService) ensureProjectAccess(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID) error {
	wrk, err := s.ws.GetBySlug(ctx, workspaceSlug)
	if err != nil {
		return ErrProjectForbidden
	}
	ok, _ := s.ws.IsMember(ctx, wrk.ID, userID)
	if !ok {
		return ErrProjectForbidden
	}
	inWorkspace, _ := s.ps.IsInWorkspace(ctx, projectID, wrk.ID)
	if !inWorkspace {
		return ErrProjectNotFound
	}
	return nil
}

// List lists issue views for workspace (projectID nil) or for a project.
func (s *IssueViewService) List(ctx context.Context, workspaceSlug string, projectID *uuid.UUID, userID uuid.UUID) ([]model.IssueView, error) {
	workspaceID, err := s.ensureWorkspaceAccess(ctx, workspaceSlug, userID)
	if err != nil {
		return nil, err
	}
	if projectID != nil {
		if err := s.ensureProjectAccess(ctx, workspaceSlug, *projectID, userID); err != nil {
			return nil, err
		}
	}
	return s.ivs.ListByWorkspaceID(ctx, workspaceID, projectID)
}

func (s *IssueViewService) Create(ctx context.Context, workspaceSlug string, projectID *uuid.UUID, userID uuid.UUID, name, description string, query, filters, displayFilters, displayProperties model.JSONMap) (*model.IssueView, error) {
	workspaceID, err := s.ensureWorkspaceAccess(ctx, workspaceSlug, userID)
	if err != nil {
		return nil, err
	}
	if projectID != nil {
		if err := s.ensureProjectAccess(ctx, workspaceSlug, *projectID, userID); err != nil {
			return nil, err
		}
	}
	if query == nil {
		query = model.JSONMap{}
	}
	if filters == nil {
		filters = model.JSONMap{}
	}
	if displayFilters == nil {
		displayFilters = model.JSONMap{}
	}
	if displayProperties == nil {
		displayProperties = model.JSONMap{}
	}
	iv := &model.IssueView{
		Name:              name,
		Description:       description,
		Query:             query,
		Filters:           filters,
		DisplayFilters:    displayFilters,
		DisplayProperties: displayProperties,
		RichFilters:       model.JSONMap{},
		Access:            1,
		OwnedByID:         userID,
		WorkspaceID:       workspaceID,
		ProjectID:         projectID,
	}
	if err := s.ivs.Create(ctx, iv); err != nil {
		return nil, err
	}
	return iv, nil
}

func (s *IssueViewService) Get(ctx context.Context, workspaceSlug string, viewID uuid.UUID, userID uuid.UUID) (*model.IssueView, error) {
	_, err := s.ensureWorkspaceAccess(ctx, workspaceSlug, userID)
	if err != nil {
		return nil, err
	}
	iv, err := s.ivs.GetByID(ctx, viewID)
	if err != nil {
		return nil, ErrIssueViewNotFound
	}
	return iv, nil
}

func (s *IssueViewService) Update(ctx context.Context, workspaceSlug string, viewID uuid.UUID, userID uuid.UUID, name, description string, query, filters, displayFilters, displayProperties model.JSONMap) (*model.IssueView, error) {
	_, err := s.ensureWorkspaceAccess(ctx, workspaceSlug, userID)
	if err != nil {
		return nil, err
	}
	iv, err := s.ivs.GetByID(ctx, viewID)
	if err != nil {
		return nil, ErrIssueViewNotFound
	}
	if iv.OwnedByID != userID {
		return nil, ErrIssueViewNotFound
	}
	if name != "" {
		iv.Name = name
	}
	if description != "" {
		iv.Description = description
	}
	if query != nil {
		iv.Query = query
	}
	if filters != nil {
		iv.Filters = filters
	}
	if displayFilters != nil {
		iv.DisplayFilters = displayFilters
	}
	if displayProperties != nil {
		iv.DisplayProperties = displayProperties
	}
	if err := s.ivs.Update(ctx, iv); err != nil {
		return nil, err
	}
	return iv, nil
}

func (s *IssueViewService) Delete(ctx context.Context, workspaceSlug string, viewID uuid.UUID, userID uuid.UUID) error {
	_, err := s.ensureWorkspaceAccess(ctx, workspaceSlug, userID)
	if err != nil {
		return err
	}
	iv, err := s.ivs.GetByID(ctx, viewID)
	if err != nil {
		return ErrIssueViewNotFound
	}
	if iv.OwnedByID != userID {
		return ErrIssueViewNotFound
	}
	return s.ivs.Delete(ctx, viewID)
}
