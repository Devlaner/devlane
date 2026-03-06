package service

import (
	"context"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
)

// StickyService handles stickies.
type StickyService struct {
	stickyStore *store.StickyStore
	ws          *store.WorkspaceStore
}

func NewStickyService(stickyStore *store.StickyStore, ws *store.WorkspaceStore) *StickyService {
	return &StickyService{stickyStore: stickyStore, ws: ws}
}

func (s *StickyService) ensureWorkspaceAccess(ctx context.Context, workspaceSlug string, userID uuid.UUID) (uuid.UUID, error) {
	w, err := s.ws.GetBySlug(ctx, workspaceSlug)
	if err != nil {
		return uuid.Nil, ErrWorkspaceNotFound
	}
	ok, _ := s.ws.IsMember(ctx, w.ID, userID)
	if !ok {
		return uuid.Nil, ErrWorkspaceForbidden
	}
	return w.ID, nil
}

func (s *StickyService) List(ctx context.Context, workspaceSlug string, userID uuid.UUID) ([]model.Sticky, error) {
	workspaceID, err := s.ensureWorkspaceAccess(ctx, workspaceSlug, userID)
	if err != nil {
		return nil, err
	}
	return s.stickyStore.ListByWorkspaceAndOwner(ctx, workspaceID, userID)
}

func (s *StickyService) Create(ctx context.Context, workspaceSlug string, userID uuid.UUID, name, description, color string) (*model.Sticky, error) {
	workspaceID, err := s.ensureWorkspaceAccess(ctx, workspaceSlug, userID)
	if err != nil {
		return nil, err
	}
	if name == "" {
		name = "Untitled"
	}
	if color == "" {
		color = "#0d0d0d"
	}
	st := &model.Sticky{
		Name:        name,
		Description: description,
		Color:       color,
		WorkspaceID: workspaceID,
		OwnerID:     userID,
	}
	if err := s.stickyStore.Create(ctx, st); err != nil {
		return nil, err
	}
	return st, nil
}

func (s *StickyService) Update(ctx context.Context, workspaceSlug string, stickyID uuid.UUID, userID uuid.UUID, name, description, color string) (*model.Sticky, error) {
	_, err := s.ensureWorkspaceAccess(ctx, workspaceSlug, userID)
	if err != nil {
		return nil, err
	}
	st, err := s.stickyStore.GetByID(ctx, stickyID)
	if err != nil {
		return nil, err
	}
	if st.OwnerID != userID {
		return nil, ErrWorkspaceForbidden
	}
	if name != "" {
		st.Name = name
	}
	if description != "" {
		st.Description = description
	}
	if color != "" {
		st.Color = color
	}
	if err := s.stickyStore.Update(ctx, st); err != nil {
		return nil, err
	}
	return st, nil
}

func (s *StickyService) Delete(ctx context.Context, workspaceSlug string, stickyID uuid.UUID, userID uuid.UUID) error {
	_, err := s.ensureWorkspaceAccess(ctx, workspaceSlug, userID)
	if err != nil {
		return err
	}
	st, err := s.stickyStore.GetByID(ctx, stickyID)
	if err != nil {
		return err
	}
	if st.OwnerID != userID {
		return ErrWorkspaceForbidden
	}
	return s.stickyStore.Delete(ctx, stickyID)
}
