package service

import (
	"context"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
)

// WorkspaceLinkService handles quick links (workspace_user_links).
type WorkspaceLinkService struct {
	linkStore *store.WorkspaceUserLinkStore
	ws        *store.WorkspaceStore
}

func NewWorkspaceLinkService(linkStore *store.WorkspaceUserLinkStore, ws *store.WorkspaceStore) *WorkspaceLinkService {
	return &WorkspaceLinkService{linkStore: linkStore, ws: ws}
}

func (s *WorkspaceLinkService) ensureWorkspaceAccess(ctx context.Context, workspaceSlug string, userID uuid.UUID) (uuid.UUID, error) {
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

func (s *WorkspaceLinkService) List(ctx context.Context, workspaceSlug string, userID uuid.UUID) ([]model.WorkspaceUserLink, error) {
	workspaceID, err := s.ensureWorkspaceAccess(ctx, workspaceSlug, userID)
	if err != nil {
		return nil, err
	}
	return s.linkStore.ListByWorkspaceAndOwner(ctx, workspaceID, userID)
}

func (s *WorkspaceLinkService) Create(ctx context.Context, workspaceSlug string, userID uuid.UUID, title, url string, projectID *uuid.UUID) (*model.WorkspaceUserLink, error) {
	workspaceID, err := s.ensureWorkspaceAccess(ctx, workspaceSlug, userID)
	if err != nil {
		return nil, err
	}
	l := &model.WorkspaceUserLink{
		Title:       title,
		URL:         url,
		OwnerID:     userID,
		WorkspaceID: workspaceID,
		ProjectID:   projectID,
	}
	if err := s.linkStore.Create(ctx, l); err != nil {
		return nil, err
	}
	return l, nil
}

func (s *WorkspaceLinkService) Update(ctx context.Context, workspaceSlug string, linkID uuid.UUID, userID uuid.UUID, title, url string) (*model.WorkspaceUserLink, error) {
	_, err := s.ensureWorkspaceAccess(ctx, workspaceSlug, userID)
	if err != nil {
		return nil, err
	}
	l, err := s.linkStore.GetByID(ctx, linkID)
	if err != nil {
		return nil, err
	}
	if l.OwnerID != userID {
		return nil, ErrWorkspaceForbidden
	}
	if title != "" {
		l.Title = title
	}
	if url != "" {
		l.URL = url
	}
	if err := s.linkStore.Update(ctx, l); err != nil {
		return nil, err
	}
	return l, nil
}

func (s *WorkspaceLinkService) Delete(ctx context.Context, workspaceSlug string, linkID uuid.UUID, userID uuid.UUID) error {
	_, err := s.ensureWorkspaceAccess(ctx, workspaceSlug, userID)
	if err != nil {
		return err
	}
	l, err := s.linkStore.GetByID(ctx, linkID)
	if err != nil {
		return err
	}
	if l.OwnerID != userID {
		return ErrWorkspaceForbidden
	}
	return s.linkStore.Delete(ctx, linkID)
}
