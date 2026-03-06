package service

import (
	"context"
	"errors"
	"time"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
)

var ErrCycleNotFound = errors.New("cycle not found")

// CycleService handles cycle business logic.
type CycleService struct {
	cs *store.CycleStore
	ps *store.ProjectStore
	ws *store.WorkspaceStore
}

func NewCycleService(cs *store.CycleStore, ps *store.ProjectStore, ws *store.WorkspaceStore) *CycleService {
	return &CycleService{cs: cs, ps: ps, ws: ws}
}

func (s *CycleService) ensureProjectAccess(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID) error {
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

func (s *CycleService) List(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID) ([]model.Cycle, error) {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return nil, err
	}
	list, err := s.cs.ListByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	ids := make([]uuid.UUID, 0, len(list))
	for _, c := range list {
		ids = append(ids, c.ID)
	}
	counts, err := s.cs.CountIssuesByCycleIDs(ctx, ids)
	if err == nil {
		for i := range list {
			list[i].IssueCount = counts[list[i].ID]
		}
	}
	return list, nil
}

func (s *CycleService) Create(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID, name, description string, startDate, endDate *time.Time) (*model.Cycle, error) {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return nil, err
	}
	wrk, _ := s.ws.GetBySlug(ctx, workspaceSlug)
	cy := &model.Cycle{
		Name:        name,
		Description: description,
		StartDate:   startDate,
		EndDate:     endDate,
		Status:      "draft",
		ProjectID:   projectID,
		WorkspaceID: wrk.ID,
		OwnedByID:   userID,
		Timezone:    "UTC",
		Version:     1,
	}
	if err := s.cs.Create(ctx, cy); err != nil {
		return nil, err
	}
	return cy, nil
}

func (s *CycleService) Get(ctx context.Context, workspaceSlug string, projectID, cycleID uuid.UUID, userID uuid.UUID) (*model.Cycle, error) {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return nil, err
	}
	cy, err := s.cs.GetByID(ctx, cycleID)
	if err != nil {
		return nil, ErrCycleNotFound
	}
	if cy.ProjectID != projectID {
		return nil, ErrCycleNotFound
	}
	if counts, err := s.cs.CountIssuesByCycleIDs(ctx, []uuid.UUID{cy.ID}); err == nil {
		cy.IssueCount = counts[cy.ID]
	}
	return cy, nil
}

func (s *CycleService) Update(ctx context.Context, workspaceSlug string, projectID, cycleID uuid.UUID, userID uuid.UUID, name, description, status string, startDate, endDate *time.Time) (*model.Cycle, error) {
	cy, err := s.Get(ctx, workspaceSlug, projectID, cycleID, userID)
	if err != nil {
		return nil, err
	}
	if name != "" {
		cy.Name = name
	}
	if description != "" {
		cy.Description = description
	}
	if status != "" {
		cy.Status = status
	}
	if startDate != nil {
		cy.StartDate = startDate
	}
	if endDate != nil {
		cy.EndDate = endDate
	}
	if err := s.cs.Update(ctx, cy); err != nil {
		return nil, err
	}
	return cy, nil
}

func (s *CycleService) Delete(ctx context.Context, workspaceSlug string, projectID, cycleID uuid.UUID, userID uuid.UUID) error {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return err
	}
	cy, err := s.cs.GetByID(ctx, cycleID)
	if err != nil || cy.ProjectID != projectID {
		return ErrCycleNotFound
	}
	return s.cs.Delete(ctx, cycleID)
}

func (s *CycleService) ListCycleIssueIDs(ctx context.Context, workspaceSlug string, projectID, cycleID uuid.UUID, userID uuid.UUID) ([]uuid.UUID, error) {
	_, err := s.Get(ctx, workspaceSlug, projectID, cycleID, userID)
	if err != nil {
		return nil, err
	}
	return s.cs.ListCycleIssueIDs(ctx, cycleID)
}

func (s *CycleService) AddCycleIssue(ctx context.Context, workspaceSlug string, projectID, cycleID, issueID uuid.UUID, userID uuid.UUID) error {
	cy, err := s.Get(ctx, workspaceSlug, projectID, cycleID, userID)
	if err != nil {
		return err
	}
	ci := &model.CycleIssue{
		CycleID:     cy.ID,
		IssueID:     issueID,
		ProjectID:   cy.ProjectID,
		WorkspaceID: cy.WorkspaceID,
		CreatedByID: &userID,
	}
	return s.cs.AddCycleIssue(ctx, ci)
}

func (s *CycleService) RemoveCycleIssue(ctx context.Context, workspaceSlug string, projectID, cycleID, issueID uuid.UUID, userID uuid.UUID) error {
	_, err := s.Get(ctx, workspaceSlug, projectID, cycleID, userID)
	if err != nil {
		return err
	}
	return s.cs.RemoveCycleIssue(ctx, cycleID, issueID)
}
