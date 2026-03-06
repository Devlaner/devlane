package service

import (
	"context"
	"errors"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
)

var ErrLabelNotFound = errors.New("label not found")

// LabelService handles label business logic.
type LabelService struct {
	ls *store.LabelStore
	ps *store.ProjectStore
	ws *store.WorkspaceStore
}

func NewLabelService(ls *store.LabelStore, ps *store.ProjectStore, ws *store.WorkspaceStore) *LabelService {
	return &LabelService{ls: ls, ps: ps, ws: ws}
}

func (s *LabelService) ensureProjectAccess(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID) error {
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

func (s *LabelService) ListByProject(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID) ([]model.Label, error) {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return nil, err
	}
	return s.ls.ListByProjectID(ctx, projectID)
}

func (s *LabelService) Create(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID, name, color string) (*model.Label, error) {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return nil, err
	}
	wrk, _ := s.ws.GetBySlug(ctx, workspaceSlug)
	l := &model.Label{
		Name:        name,
		Color:       color,
		ProjectID:   &projectID,
		WorkspaceID: wrk.ID,
	}
	if err := s.ls.Create(ctx, l); err != nil {
		return nil, err
	}
	return l, nil
}

func (s *LabelService) GetByID(ctx context.Context, workspaceSlug string, projectID, labelID uuid.UUID, userID uuid.UUID) (*model.Label, error) {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return nil, err
	}
	l, err := s.ls.GetByID(ctx, labelID)
	if err != nil {
		return nil, ErrLabelNotFound
	}
	if l.ProjectID != nil && *l.ProjectID != projectID {
		return nil, ErrLabelNotFound
	}
	return l, nil
}

func (s *LabelService) Update(ctx context.Context, workspaceSlug string, projectID, labelID uuid.UUID, userID uuid.UUID, name, color *string) (*model.Label, error) {
	l, err := s.GetByID(ctx, workspaceSlug, projectID, labelID, userID)
	if err != nil {
		return nil, err
	}
	if name != nil {
		l.Name = *name
	}
	if color != nil {
		l.Color = *color
	}
	if err := s.ls.Update(ctx, l); err != nil {
		return nil, err
	}
	return l, nil
}

func (s *LabelService) Delete(ctx context.Context, workspaceSlug string, projectID, labelID uuid.UUID, userID uuid.UUID) error {
	_, err := s.GetByID(ctx, workspaceSlug, projectID, labelID, userID)
	if err != nil {
		return err
	}
	return s.ls.Delete(ctx, labelID)
}
