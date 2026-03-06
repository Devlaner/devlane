package service

import (
	"context"
	"errors"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
)

var ErrStateNotFound = errors.New("state not found")

// StateService handles state (workflow) business logic.
type StateService struct {
	ss *store.StateStore
	ps *store.ProjectStore
	ws *store.WorkspaceStore
}

func NewStateService(ss *store.StateStore, ps *store.ProjectStore, ws *store.WorkspaceStore) *StateService {
	return &StateService{ss: ss, ps: ps, ws: ws}
}

func (s *StateService) ensureProjectAccess(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID) error {
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

func (s *StateService) List(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID) ([]model.State, error) {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return nil, err
	}
	return s.ss.ListByProjectID(ctx, projectID)
}

func (s *StateService) Create(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID, name, color, group string) (*model.State, error) {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return nil, err
	}
	wrk, _ := s.ws.GetBySlug(ctx, workspaceSlug)
	if color == "" {
		color = "#0d0d0d"
	}
	if group == "" {
		group = "backlog"
	}
	st := &model.State{
		Name:        name,
		Color:       color,
		Group:       group,
		ProjectID:   projectID,
		WorkspaceID: wrk.ID,
	}
	if err := s.ss.Create(ctx, st); err != nil {
		return nil, err
	}
	return st, nil
}

func (s *StateService) GetByID(ctx context.Context, workspaceSlug string, projectID, stateID uuid.UUID, userID uuid.UUID) (*model.State, error) {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return nil, err
	}
	st, err := s.ss.GetByID(ctx, stateID)
	if err != nil {
		return nil, ErrStateNotFound
	}
	if st.ProjectID != projectID {
		return nil, ErrStateNotFound
	}
	return st, nil
}

func (s *StateService) Update(ctx context.Context, workspaceSlug string, projectID, stateID uuid.UUID, userID uuid.UUID, name, color *string) (*model.State, error) {
	st, err := s.GetByID(ctx, workspaceSlug, projectID, stateID, userID)
	if err != nil {
		return nil, err
	}
	if name != nil {
		st.Name = *name
	}
	if color != nil {
		st.Color = *color
	}
	if err := s.ss.Update(ctx, st); err != nil {
		return nil, err
	}
	return st, nil
}

func (s *StateService) Delete(ctx context.Context, workspaceSlug string, projectID, stateID uuid.UUID, userID uuid.UUID) error {
	_, err := s.GetByID(ctx, workspaceSlug, projectID, stateID, userID)
	if err != nil {
		return err
	}
	return s.ss.Delete(ctx, stateID)
}
