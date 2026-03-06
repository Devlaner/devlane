package service

import (
	"context"
	"fmt"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
)

// RecentVisitItem is a recent visit with optional display fields for the home page.
type RecentVisitItem struct {
	model.UserRecentVisit
	DisplayTitle      string `json:"display_title,omitempty"`
	DisplayIdentifier string `json:"display_identifier,omitempty"` // e.g. "PROJ-42"
}

// RecentVisitService handles user recent visits.
type RecentVisitService struct {
	visitStore   *store.UserRecentVisitStore
	ws           *store.WorkspaceStore
	issueStore   *store.IssueStore
	projectStore *store.ProjectStore
	pageStore    *store.PageStore
}

func NewRecentVisitService(
	visitStore *store.UserRecentVisitStore,
	ws *store.WorkspaceStore,
	issueStore *store.IssueStore,
	projectStore *store.ProjectStore,
	pageStore *store.PageStore,
) *RecentVisitService {
	return &RecentVisitService{
		visitStore:   visitStore,
		ws:           ws,
		issueStore:   issueStore,
		projectStore: projectStore,
		pageStore:    pageStore,
	}
}

func (s *RecentVisitService) ensureWorkspaceAccess(ctx context.Context, workspaceSlug string, userID uuid.UUID) (uuid.UUID, error) {
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

func (s *RecentVisitService) List(ctx context.Context, workspaceSlug string, userID uuid.UUID, limit int) ([]model.UserRecentVisit, error) {
	workspaceID, err := s.ensureWorkspaceAccess(ctx, workspaceSlug, userID)
	if err != nil {
		return nil, err
	}
	return s.visitStore.ListByWorkspaceAndUser(ctx, workspaceID, userID, limit)
}

// ListWithDetails returns recent visits with display_title and display_identifier populated for issues, projects, and pages.
func (s *RecentVisitService) ListWithDetails(ctx context.Context, workspaceSlug string, userID uuid.UUID, limit int) ([]RecentVisitItem, error) {
	visits, err := s.List(ctx, workspaceSlug, userID, limit)
	if err != nil {
		return nil, err
	}
	result := make([]RecentVisitItem, 0, len(visits))
	for _, v := range visits {
		item := RecentVisitItem{UserRecentVisit: v}
		switch v.EntityName {
		case "issue":
			if v.EntityIdentifier != nil {
				issue, err := s.issueStore.GetByID(ctx, *v.EntityIdentifier)
				if err == nil {
					item.DisplayTitle = issue.Name
					proj, _ := s.projectStore.GetByID(ctx, issue.ProjectID)
					if proj != nil {
						item.DisplayIdentifier = fmt.Sprintf("%s-%d", proj.Identifier, issue.SequenceID)
					}
				}
			}
		case "project":
			if v.EntityIdentifier != nil {
				proj, err := s.projectStore.GetByID(ctx, *v.EntityIdentifier)
				if err == nil {
					item.DisplayTitle = proj.Name
					if proj.Identifier != "" {
						item.DisplayIdentifier = proj.Identifier
					}
				}
			}
		case "page":
			if v.EntityIdentifier != nil {
				page, err := s.pageStore.GetByID(ctx, *v.EntityIdentifier)
				if err == nil {
					item.DisplayTitle = page.Name
				}
			}
		}
		result = append(result, item)
	}
	return result, nil
}

// RecordVisit upserts a recent visit for the given entity (e.g. issue, project, page).
func (s *RecentVisitService) RecordVisit(ctx context.Context, workspaceSlug string, userID uuid.UUID, entityName string, entityIdentifier, projectID *uuid.UUID) error {
	workspaceID, err := s.ensureWorkspaceAccess(ctx, workspaceSlug, userID)
	if err != nil {
		return err
	}
	return s.visitStore.Upsert(ctx, workspaceID, userID, entityName, entityIdentifier, projectID)
}
