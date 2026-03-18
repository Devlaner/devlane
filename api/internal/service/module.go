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
}

func NewModuleService(ms *store.ModuleStore, ps *store.ProjectStore, ws *store.WorkspaceStore) *ModuleService {
	return &ModuleService{ms: ms, ps: ps, ws: ws}
}

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
	return list, nil
}

func (s *ModuleService) Create(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID, name, description, status string, startDate, targetDate *time.Time) (*model.Module, error) {
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
	}
	if err := s.ms.Create(ctx, mod); err != nil {
		return nil, err
	}
	return mod, nil
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
	return mod, nil
}

func (s *ModuleService) Update(ctx context.Context, workspaceSlug string, projectID, moduleID uuid.UUID, userID uuid.UUID, name, description, status string, startDate, targetDate *time.Time, leadIDSet bool, leadID *uuid.UUID) (*model.Module, error) {
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
	if err := s.ms.Update(ctx, mod); err != nil {
		return nil, err
	}
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
