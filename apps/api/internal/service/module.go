package service

import (
	"context"
	"errors"
	"time"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
)

var ErrModuleNotFound = errors.New("module not found")

// ModuleService handles module business logic.
type ModuleService struct {
	ms *store.ModuleStore
	ps *store.ProjectStore
	ws *store.WorkspaceStore
	is *store.IssueStore // optional: validates issues added to a module belong to the project
}

func NewModuleService(ms *store.ModuleStore, ps *store.ProjectStore, ws *store.WorkspaceStore) *ModuleService {
	return &ModuleService{ms: ms, ps: ps, ws: ws}
}

// SetIssueStore enables validation that an issue added to a module belongs to the
// same project.
func (s *ModuleService) SetIssueStore(is *store.IssueStore) { s.is = is }

func (s *ModuleService) ensureProjectAccess(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID) error {
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

func (s *ModuleService) List(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID) ([]model.Module, error) {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return nil, err
	}
	list, err := s.ms.ListByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	ids := make([]uuid.UUID, 0, len(list))
	for _, m := range list {
		ids = append(ids, m.ID)
	}
	counts, err := s.ms.CountIssuesByModuleIDs(ctx, ids)
	if err == nil {
		for i := range list {
			list[i].IssueCount = counts[list[i].ID]
		}
	}
	members, err := s.ms.ListMemberIDsByModuleIDs(ctx, ids)
	if err != nil {
		return nil, err
	}
	for i := range list {
		if m := members[list[i].ID]; m != nil {
			list[i].MemberIDs = m
		} else {
			list[i].MemberIDs = []uuid.UUID{}
		}
	}
	return list, nil
}

func (s *ModuleService) Create(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID, name, description, status string, startDate, targetDate *time.Time, leadID *uuid.UUID, memberIDs []uuid.UUID) (*model.Module, error) {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return nil, err
	}
	wrk, _ := s.ws.GetBySlug(ctx, workspaceSlug)
	if status == "" {
		status = "backlog"
	}
	mod := &model.Module{
		Name:        name,
		Description: description,
		Status:      status,
		StartDate:   startDate,
		TargetDate:  targetDate,
		ProjectID:   projectID,
		WorkspaceID: wrk.ID,
		LeadID:      leadID,
	}
	// Keep the module insert and its member set atomic.
	if err := s.ms.Tx(ctx, func(tx *store.ModuleStore) error {
		if err := tx.Create(ctx, mod); err != nil {
			return err
		}
		if len(memberIDs) > 0 {
			return tx.SetMembers(ctx, mod.ID, memberIDs, userID)
		}
		return nil
	}); err != nil {
		return nil, err
	}
	ids, err := s.memberIDs(ctx, mod.ID)
	if err != nil {
		return nil, err
	}
	mod.MemberIDs = ids
	return mod, nil
}

// memberIDs returns a module's member ids as a non-nil slice (so JSON renders
// []), surfacing read errors rather than masking them as an empty team.
func (s *ModuleService) memberIDs(ctx context.Context, moduleID uuid.UUID) ([]uuid.UUID, error) {
	ids, err := s.ms.ListMemberIDs(ctx, moduleID)
	if err != nil {
		return nil, err
	}
	if ids == nil {
		return []uuid.UUID{}, nil
	}
	return ids, nil
}

func (s *ModuleService) Get(ctx context.Context, workspaceSlug string, projectID, moduleID uuid.UUID, userID uuid.UUID) (*model.Module, error) {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return nil, err
	}
	mod, err := s.ms.GetByID(ctx, moduleID)
	if err != nil {
		return nil, ErrModuleNotFound
	}
	if mod.ProjectID != projectID {
		return nil, ErrModuleNotFound
	}
	if counts, err := s.ms.CountIssuesByModuleIDs(ctx, []uuid.UUID{mod.ID}); err == nil {
		mod.IssueCount = counts[mod.ID]
	}
	ids, err := s.memberIDs(ctx, mod.ID)
	if err != nil {
		return nil, err
	}
	mod.MemberIDs = ids
	return mod, nil
}

func (s *ModuleService) Update(ctx context.Context, workspaceSlug string, projectID, moduleID uuid.UUID, userID uuid.UUID, name, description, status string, startDate, targetDate *time.Time, leadIDSet bool, leadID *uuid.UUID, memberIDsSet bool, memberIDs []uuid.UUID) (*model.Module, error) {
	mod, err := s.Get(ctx, workspaceSlug, projectID, moduleID, userID)
	if err != nil {
		return nil, err
	}
	if name != "" {
		mod.Name = name
	}
	if description != "" {
		mod.Description = description
	}
	if status != "" {
		mod.Status = status
	}
	if startDate != nil {
		mod.StartDate = startDate
	}
	if targetDate != nil {
		mod.TargetDate = targetDate
	}
	if leadIDSet {
		mod.LeadID = leadID
	}
	if err := s.ms.Tx(ctx, func(tx *store.ModuleStore) error {
		if err := tx.Update(ctx, mod); err != nil {
			return err
		}
		if memberIDsSet {
			return tx.SetMembers(ctx, mod.ID, memberIDs, userID)
		}
		return nil
	}); err != nil {
		return nil, err
	}
	ids, err := s.memberIDs(ctx, mod.ID)
	if err != nil {
		return nil, err
	}
	mod.MemberIDs = ids
	return mod, nil
}

func (s *ModuleService) Delete(ctx context.Context, workspaceSlug string, projectID, moduleID uuid.UUID, userID uuid.UUID) error {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return err
	}
	mod, err := s.ms.GetByID(ctx, moduleID)
	if err != nil || mod.ProjectID != projectID {
		return ErrModuleNotFound
	}
	return s.ms.Delete(ctx, moduleID)
}

// ListLinks returns the module's external links after auth-checking.
func (s *ModuleService) ListLinks(ctx context.Context, workspaceSlug string, projectID, moduleID, userID uuid.UUID) ([]model.ModuleLink, error) {
	mod, err := s.Get(ctx, workspaceSlug, projectID, moduleID, userID)
	if err != nil {
		return nil, err
	}
	return s.ms.ListLinksForModule(ctx, mod.ID)
}

// CreateLink attaches an external link to the module.
func (s *ModuleService) CreateLink(ctx context.Context, workspaceSlug string, projectID, moduleID, userID uuid.UUID, title, url string) (*model.ModuleLink, error) {
	mod, err := s.Get(ctx, workspaceSlug, projectID, moduleID, userID)
	if err != nil {
		return nil, err
	}
	if title == "" {
		title = url
	}
	l := &model.ModuleLink{
		Title:       title,
		URL:         url,
		ModuleID:    mod.ID,
		ProjectID:   mod.ProjectID,
		WorkspaceID: mod.WorkspaceID,
		CreatedByID: &userID,
		UpdatedByID: &userID,
	}
	if err := s.ms.CreateLink(ctx, l); err != nil {
		return nil, err
	}
	return l, nil
}

// UpdateLink edits a module link's title/URL.
func (s *ModuleService) UpdateLink(ctx context.Context, workspaceSlug string, projectID, moduleID, linkID, userID uuid.UUID, title, url string) (*model.ModuleLink, error) {
	mod, err := s.Get(ctx, workspaceSlug, projectID, moduleID, userID)
	if err != nil {
		return nil, err
	}
	l, err := s.ms.GetLinkByID(ctx, linkID)
	if err != nil || l.ModuleID != mod.ID {
		return nil, ErrModuleNotFound
	}
	if title != "" {
		l.Title = title
	}
	if url != "" {
		l.URL = url
	}
	l.UpdatedByID = &userID
	if err := s.ms.UpdateLink(ctx, l); err != nil {
		return nil, err
	}
	return l, nil
}

// DeleteLink removes a module link.
func (s *ModuleService) DeleteLink(ctx context.Context, workspaceSlug string, projectID, moduleID, linkID, userID uuid.UUID) error {
	mod, err := s.Get(ctx, workspaceSlug, projectID, moduleID, userID)
	if err != nil {
		return err
	}
	l, err := s.ms.GetLinkByID(ctx, linkID)
	if err != nil || l.ModuleID != mod.ID {
		return ErrModuleNotFound
	}
	return s.ms.DeleteLink(ctx, linkID)
}

func (s *ModuleService) ListModuleIssueIDs(ctx context.Context, workspaceSlug string, projectID, moduleID uuid.UUID, userID uuid.UUID) ([]uuid.UUID, error) {
	_, err := s.Get(ctx, workspaceSlug, projectID, moduleID, userID)
	if err != nil {
		return nil, err
	}
	return s.ms.ListModuleIssueIDs(ctx, moduleID)
}

func (s *ModuleService) AddModuleIssue(ctx context.Context, workspaceSlug string, projectID, moduleID, issueID uuid.UUID, userID uuid.UUID) error {
	mod, err := s.Get(ctx, workspaceSlug, projectID, moduleID, userID)
	if err != nil {
		return err
	}
	// The issue must belong to the same project.
	if s.is != nil {
		issue, err := s.is.GetByID(ctx, issueID)
		if err != nil || issue == nil || issue.ProjectID != projectID {
			return ErrIssueNotFound
		}
	}
	mi := &model.ModuleIssue{
		ModuleID:    mod.ID,
		IssueID:     issueID,
		ProjectID:   mod.ProjectID,
		WorkspaceID: mod.WorkspaceID,
		CreatedByID: &userID,
	}
	return s.ms.AddModuleIssue(ctx, mi)
}

func (s *ModuleService) RemoveModuleIssue(ctx context.Context, workspaceSlug string, projectID, moduleID, issueID uuid.UUID, userID uuid.UUID) error {
	_, err := s.Get(ctx, workspaceSlug, projectID, moduleID, userID)
	if err != nil {
		return err
	}
	return s.ms.RemoveModuleIssue(ctx, moduleID, issueID)
}
