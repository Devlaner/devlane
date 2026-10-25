package service

import (
	"context"
	"errors"
	"time"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
)

// computeCycleStatus derives status from start/end dates.
// draft: no dates; current: now in range; upcoming: start > now; completed: end < now.
func computeCycleStatus(start, end *time.Time) string {
	now := time.Now()
	if start == nil && end == nil {
		return "draft"
	}
	if end != nil && end.Before(now) {
		return "completed"
	}
	if start != nil && end != nil {
		if !now.Before(*start) && !now.After(*end) {
			return "current"
		}
		if start.After(now) {
			return "upcoming"
		}
	}
	if start != nil && start.After(now) {
		return "upcoming"
	}
	if start != nil && !start.After(now) && (end == nil || !end.Before(now)) {
		return "current"
	}
	return "upcoming"
}

var ErrCycleNotFound = errors.New("cycle not found")

// ErrInvalidTargetCycle is returned when a complete-cycle transfer names a target
// that is missing, in another project, or the cycle being completed itself.
var ErrInvalidTargetCycle = errors.New("invalid target cycle")

// effectiveCycleStatus reports "completed" for a cycle that was explicitly
// completed (it carries a progress snapshot), and otherwise falls back to the
// date-derived status. This keeps a user-completed cycle completed even when its
// end date is still in the future.
func effectiveCycleStatus(cy *model.Cycle) string {
	if len(cy.ProgressSnapshot) > 0 {
		return "completed"
	}
	return computeCycleStatus(cy.StartDate, cy.EndDate)
}

// ErrInvalidCycleDates is returned when a cycle's start date falls after its
// end date.
var ErrInvalidCycleDates = errors.New("cycle start date must be on or before the end date")

// validateCycleDates rejects a start that falls after the end. Either date may
// be nil (a draft or open-ended cycle); the check only applies when both are
// set.
func validateCycleDates(start, end *time.Time) error {
	if start != nil && end != nil && end.Before(*start) {
		return ErrInvalidCycleDates
	}
	return nil
}

// CycleService handles cycle business logic.
type CycleService struct {
	cs *store.CycleStore
	ps *store.ProjectStore
	ws *store.WorkspaceStore
	is *store.IssueStore // optional: validates issues added to a cycle belong to the project
}

func NewCycleService(cs *store.CycleStore, ps *store.ProjectStore, ws *store.WorkspaceStore) *CycleService {
	return &CycleService{cs: cs, ps: ps, ws: ws}
}

// SetIssueStore enables validation that an issue added to a cycle belongs to the
// same project.
func (s *CycleService) SetIssueStore(is *store.IssueStore) { s.is = is }

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
	if err := enforceProjectVisibility(ctx, s.ps, s.ws, wrk.ID, projectID, userID); err != nil {
		return err
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
	for i := range list {
		ids = append(ids, list[i].ID)
		list[i].Status = effectiveCycleStatus(&list[i])
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
	if err := validateCycleDates(startDate, endDate); err != nil {
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
	cy.Status = effectiveCycleStatus(cy)
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
	cy.Status = effectiveCycleStatus(cy)
	if counts, err := s.cs.CountIssuesByCycleIDs(ctx, []uuid.UUID{cy.ID}); err == nil {
		cy.IssueCount = counts[cy.ID]
	}
	return cy, nil
}

func (s *CycleService) Update(ctx context.Context, workspaceSlug string, projectID, cycleID uuid.UUID, userID uuid.UUID, name, description, status string, startDateSet bool, startDate *time.Time, endDateSet bool, endDate *time.Time) (*model.Cycle, error) {
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
	if startDateSet {
		cy.StartDate = startDate // nil clears the date
	}
	if endDateSet {
		cy.EndDate = endDate
	}
	if err := validateCycleDates(cy.StartDate, cy.EndDate); err != nil {
		return nil, err
	}
	if err := s.cs.Update(ctx, cy); err != nil {
		return nil, err
	}
	cy.Status = effectiveCycleStatus(cy)
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
	// The issue must belong to the same project — otherwise a member could attach
	// an issue from another project/workspace into this cycle.
	if s.is != nil {
		issue, err := s.is.GetByID(ctx, issueID)
		if err != nil || issue == nil || issue.ProjectID != projectID {
			return ErrIssueNotFound
		}
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

// CycleProgressSnapshot holds counts by state group + the completion chart.
type CycleProgressSnapshot struct {
	TotalIssues     int                `json:"total_issues"`
	CompletedIssues int                `json:"completed_issues"`
	BacklogIssues   int                `json:"backlog_issues"`
	StartedIssues   int                `json:"started_issues"`
	UnstartedIssues int                `json:"unstarted_issues"`
	CancelledIssues int                `json:"cancelled_issues"`
	Distribution    *CycleDistribution `json:"distribution,omitempty"`
}

// CycleDistribution contains the per-day completion chart and per-assignee/label breakdowns.
type CycleDistribution struct {
	CompletionChart map[string]interface{} `json:"completion_chart"`
	Assignees       []interface{}          `json:"assignees"`
	Labels          []interface{}          `json:"labels"`
}

// CompleteCycle marks a cycle completed and, when a target cycle is given,
// transfers its incomplete work items (backlog/unstarted/started) into that
// target. The cycle's state-group distribution is snapshotted first so its
// completion numbers stay fixed even after the transfer. Returns the updated
// cycle and how many work items were moved.
func (s *CycleService) CompleteCycle(ctx context.Context, workspaceSlug string, projectID, cycleID uuid.UUID, targetCycleID *uuid.UUID, userID uuid.UUID) (*model.Cycle, int, error) {
	cy, err := s.Get(ctx, workspaceSlug, projectID, cycleID, userID)
	if err != nil {
		return nil, 0, err
	}

	var target *model.Cycle
	if targetCycleID != nil {
		if *targetCycleID == cycleID {
			return nil, 0, ErrInvalidTargetCycle
		}
		t, err := s.cs.GetByID(ctx, *targetCycleID)
		if err != nil || t.ProjectID != projectID {
			return nil, 0, ErrInvalidTargetCycle
		}
		target = t
	}

	// Snapshot the distribution before any transfer so a completed cycle keeps the
	// numbers it had at completion.
	dist, err := s.cs.CycleStateDistribution(ctx, cycleID)
	if err != nil {
		return nil, 0, err
	}
	total := 0
	for _, v := range dist {
		total += v
	}
	cy.ProgressSnapshot = model.JSONMap{
		"total":        total,
		"backlog":      dist["backlog"],
		"unstarted":    dist["unstarted"],
		"started":      dist["started"],
		"completed":    dist["completed"],
		"cancelled":    dist["cancelled"],
		"completed_at": time.Now().UTC().Format(time.RFC3339),
	}
	cy.Status = "completed"
	if err := s.cs.Update(ctx, cy); err != nil {
		return nil, 0, err
	}

	moved := 0
	if target != nil {
		moved, err = s.cs.TransferIncompleteIssues(ctx, cycleID, target, userID)
		if err != nil {
			return nil, 0, err
		}
	}

	cy.Status = effectiveCycleStatus(cy)
	if counts, err := s.cs.CountIssuesByCycleIDs(ctx, []uuid.UUID{cy.ID}); err == nil {
		cy.IssueCount = counts[cy.ID]
	}
	return cy, moved, nil
}

// GetProgress computes a TProgressSnapshot-compatible response for the cycle.
func (s *CycleService) GetProgress(ctx context.Context, workspaceSlug string, projectID, cycleID uuid.UUID, userID uuid.UUID) (*CycleProgressSnapshot, error) {
	cy, err := s.Get(ctx, workspaceSlug, projectID, cycleID, userID)
	if err != nil {
		return nil, err
	}
	dist, err := s.cs.CycleStateDistribution(ctx, cycleID)
	if err != nil {
		return nil, err
	}
	total := 0
	for _, v := range dist {
		total += v
	}
	chart, err := s.cs.CycleCompletionChart(ctx, cycleID, cy.StartDate, cy.EndDate)
	if err != nil {
		return nil, err
	}
	// Convert int map to interface{} map so JSON null is avoided for missing dates.
	chartOut := make(map[string]interface{}, len(chart))
	for k, v := range chart {
		chartOut[k] = v
	}
	return &CycleProgressSnapshot{
		TotalIssues:     total,
		CompletedIssues: dist["completed"],
		BacklogIssues:   dist["backlog"],
		StartedIssues:   dist["started"],
		UnstartedIssues: dist["unstarted"],
		CancelledIssues: dist["cancelled"],
		Distribution: &CycleDistribution{
			CompletionChart: chartOut,
			Assignees:       []interface{}{},
			Labels:          []interface{}{},
		},
	}, nil
}

// ProgressBulk returns, per cycle in the project, issue counts grouped by state
// group plus a "total", so the cycles list can render real completion progress.
func (s *CycleService) ProgressBulk(ctx context.Context, workspaceSlug string, projectID, userID uuid.UUID) (map[uuid.UUID]map[string]int, error) {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return nil, err
	}
	dist, err := s.cs.StateDistributionByProject(ctx, projectID)
	if err != nil {
		return nil, err
	}
	for _, m := range dist {
		total := 0
		for _, c := range m {
			total += c
		}
		m["total"] = total
	}
	return dist, nil
}
