package service

import (
	"context"
	"errors"
	"time"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
)

var (
	ErrIntakeNotFound     = errors.New("intake item not found")
	ErrIntakeNeedSnooze   = errors.New("snooze requires a future date")
	ErrIntakeNeedDup      = errors.New("duplicate requires a target work item")
	ErrIntakeBadDuplicate = errors.New("duplicate target must be a work item in this project")
)

// IntakeItem is an intake_issues row plus the summary of its work item, as
// returned to the client.
type IntakeItem struct {
	model.IntakeIssue
	Issue IntakeIssueSummary `json:"issue"`
}

// IntakeIssueSummary is the minimal work-item data the intake list renders.
type IntakeIssueSummary struct {
	ID         uuid.UUID `json:"id"`
	Name       string    `json:"name"`
	SequenceID int       `json:"sequence_id"`
	Priority   string    `json:"priority"`
	CreatedAt  time.Time `json:"created_at"`
}

// IntakeService wires the intake_issues triage lifecycle on top of draft issues.
type IntakeService struct {
	intake *store.IntakeStore
	issues *store.IssueStore
	ps     *store.ProjectStore
	ws     *store.WorkspaceStore
}

func NewIntakeService(intake *store.IntakeStore, issues *store.IssueStore, ps *store.ProjectStore, ws *store.WorkspaceStore) *IntakeService {
	return &IntakeService{intake: intake, issues: issues, ps: ps, ws: ws}
}

func (s *IntakeService) ensureProjectAccess(ctx context.Context, workspaceSlug string, projectID, userID uuid.UUID) (*model.Workspace, error) {
	wrk, err := s.ws.GetBySlug(ctx, workspaceSlug)
	if err != nil {
		return nil, ErrProjectForbidden
	}
	ok, _ := s.ws.IsMember(ctx, wrk.ID, userID)
	if !ok {
		return nil, ErrProjectForbidden
	}
	inWorkspace, _ := s.ps.IsInWorkspace(ctx, projectID, wrk.ID)
	if !inWorkspace {
		return nil, ErrProjectNotFound
	}
	if err := enforceProjectVisibility(ctx, s.ps, s.ws, wrk.ID, projectID, userID); err != nil {
		return nil, err
	}
	return wrk, nil
}

// prepare resolves access, ensures the default intake exists, backfills draft
// issues, and wakes any due snoozed items. It returns the intake id.
func (s *IntakeService) prepare(ctx context.Context, workspaceSlug string, projectID, userID uuid.UUID) (uuid.UUID, error) {
	wrk, err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID)
	if err != nil {
		return uuid.Nil, err
	}
	in, err := s.intake.GetOrCreateDefault(ctx, projectID, wrk.ID, &userID)
	if err != nil {
		return uuid.Nil, err
	}
	if err := s.intake.BackfillDraftIssues(ctx, in.ID, projectID, wrk.ID); err != nil {
		return uuid.Nil, err
	}
	if err := s.intake.WakeSnoozed(ctx, projectID); err != nil {
		return uuid.Nil, err
	}
	return in.ID, nil
}

// List returns the project's intake items (optionally filtered by status),
// each joined with its work-item summary.
func (s *IntakeService) List(ctx context.Context, workspaceSlug string, projectID, userID uuid.UUID, statuses []int) ([]IntakeItem, error) {
	if _, err := s.prepare(ctx, workspaceSlug, projectID, userID); err != nil {
		return nil, err
	}
	rows, err := s.intake.ListByProject(ctx, projectID, statuses)
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return []IntakeItem{}, nil
	}
	ids := make([]uuid.UUID, 0, len(rows))
	for i := range rows {
		ids = append(ids, rows[i].IssueID)
	}
	issues, err := s.issues.ListByIDs(ctx, ids)
	if err != nil {
		return nil, err
	}
	byID := make(map[uuid.UUID]model.Issue, len(issues))
	for i := range issues {
		byID[issues[i].ID] = issues[i]
	}
	out := make([]IntakeItem, 0, len(rows))
	for i := range rows {
		iss, ok := byID[rows[i].IssueID]
		if !ok {
			continue // issue was hard-deleted out from under the row
		}
		out = append(out, IntakeItem{
			IntakeIssue: rows[i],
			Issue: IntakeIssueSummary{
				ID:         iss.ID,
				Name:       iss.Name,
				SequenceID: iss.SequenceID,
				Priority:   iss.Priority,
				CreatedAt:  iss.CreatedAt,
			},
		})
	}
	return out, nil
}

// PendingCount returns how many items still await triage.
func (s *IntakeService) PendingCount(ctx context.Context, workspaceSlug string, projectID, userID uuid.UUID) (int64, error) {
	if _, err := s.prepare(ctx, workspaceSlug, projectID, userID); err != nil {
		return 0, err
	}
	return s.intake.CountPending(ctx, projectID)
}

// Accept promotes an intake item into an active work item: it clears the draft
// flag and marks the item accepted, atomically so the two tables can't disagree.
func (s *IntakeService) Accept(ctx context.Context, workspaceSlug string, projectID, itemID, userID uuid.UUID) error {
	if _, err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return err
	}
	it, err := s.intake.GetByID(ctx, itemID)
	if err != nil {
		return err
	}
	if it == nil || it.ProjectID != projectID {
		return ErrIntakeNotFound
	}
	return s.intake.AcceptTx(ctx, it.ID, it.IssueID, userID)
}

// Decline removes an item from the queue without deleting the work item; it
// stays a draft (out of the active lists) but marked declined.
func (s *IntakeService) Decline(ctx context.Context, workspaceSlug string, projectID, itemID, userID uuid.UUID) error {
	return s.transition(ctx, workspaceSlug, projectID, itemID, userID, func(it *model.IntakeIssue) (map[string]any, error) {
		return map[string]any{"status": model.IntakeStatusDeclined, "snoozed_till": nil, "updated_by_id": userID}, nil
	})
}

// Snooze hides an item until snoozedTill, after which it returns to pending.
func (s *IntakeService) Snooze(ctx context.Context, workspaceSlug string, projectID, itemID, userID uuid.UUID, snoozedTill time.Time) error {
	if !snoozedTill.After(time.Now()) {
		return ErrIntakeNeedSnooze
	}
	return s.transition(ctx, workspaceSlug, projectID, itemID, userID, func(it *model.IntakeIssue) (map[string]any, error) {
		return map[string]any{"status": model.IntakeStatusSnoozed, "snoozed_till": snoozedTill, "updated_by_id": userID}, nil
	})
}

// MarkDuplicate marks an item as a duplicate of another work item in the same
// project. The target is validated so duplicate_to_id can't point at a missing
// or cross-project issue.
func (s *IntakeService) MarkDuplicate(ctx context.Context, workspaceSlug string, projectID, itemID, userID, duplicateOf uuid.UUID) error {
	if duplicateOf == uuid.Nil {
		return ErrIntakeNeedDup
	}
	target, err := s.issues.GetByID(ctx, duplicateOf)
	if err != nil || target == nil || target.ProjectID != projectID {
		return ErrIntakeBadDuplicate
	}
	return s.transition(ctx, workspaceSlug, projectID, itemID, userID, func(it *model.IntakeIssue) (map[string]any, error) {
		return map[string]any{"status": model.IntakeStatusDuplicate, "duplicate_to_id": duplicateOf, "snoozed_till": nil, "updated_by_id": userID}, nil
	})
}

// transition validates access + ownership of the item, then applies the fields
// returned by build.
func (s *IntakeService) transition(ctx context.Context, workspaceSlug string, projectID, itemID, userID uuid.UUID, build func(*model.IntakeIssue) (map[string]any, error)) error {
	if _, err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return err
	}
	it, err := s.intake.GetByID(ctx, itemID)
	if err != nil {
		return err
	}
	if it == nil || it.ProjectID != projectID {
		return ErrIntakeNotFound
	}
	fields, err := build(it)
	if err != nil {
		return err
	}
	return s.intake.Update(ctx, itemID, fields)
}
