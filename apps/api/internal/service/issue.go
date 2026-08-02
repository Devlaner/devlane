package service

import (
	"context"
	"errors"
	"time"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/Devlaner/devlane/api/internal/text"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrIssueNotFound = errors.New("issue not found")
	// ErrReactionExists is returned when a user adds an emoji they have already
	// reacted with (the issue_reactions unique constraint).
	ErrReactionExists = errors.New("reaction already exists")
	// ErrInvalidPriority / ErrInvalidState are returned by bulk update when the
	// requested value is not an accepted priority or a state of the project.
	ErrInvalidPriority = errors.New("invalid priority")
	ErrInvalidState    = errors.New("invalid state for project")
	// ErrEpicHasChildren blocks demoting an epic that still has child work items.
	ErrEpicHasChildren = errors.New("epic has child work items")
	// ErrMoveSameProject is returned when a move targets the issue's current project.
	ErrMoveSameProject = errors.New("issue already in target project")
	// ErrInvalidLabel / ErrInvalidParent / ErrInvalidAssignee are returned when a
	// related id supplied on create/update doesn't belong to the allowed scope.
	ErrInvalidLabel    = errors.New("invalid label for project")
	ErrInvalidParent   = errors.New("invalid parent for project")
	ErrInvalidAssignee = errors.New("assignee is not a workspace member")
)

// validPriorities is the accepted set of work-item priority values.
var validPriorities = map[string]bool{
	"urgent": true, "high": true, "medium": true, "low": true, "none": true,
}

// IssueService handles issue business logic.
type IssueService struct {
	is        *store.IssueStore
	ps        *store.ProjectStore
	ws        *store.WorkspaceStore
	activity  *store.IssueActivityStore   // optional — may be nil
	notify    *NotificationService        // optional — may be nil
	subs      *store.IssueSubscriberStore // optional — auto-subscribe assignees/mentions
	reactions *store.IssueReactionStore   // optional — per-issue emoji reactions
	states    *store.StateStore           // optional — validates state ownership
	labels    *store.LabelStore           // optional — validates label ownership
	webhooks  *WebhookService             // optional — dispatches issue events to webhooks
}

func NewIssueService(is *store.IssueStore, ps *store.ProjectStore, ws *store.WorkspaceStore) *IssueService {
	return &IssueService{is: is, ps: ps, ws: ws}
}

// SetActivityStore injects the activity store so Update can record field changes.
// Optional — left as a setter so existing callers don't need to change.
func (s *IssueService) SetActivityStore(a *store.IssueActivityStore) { s.activity = a }

// SetNotificationService injects the notification fan-out service. Optional —
// when nil, no notifications are emitted from issue operations.
func (s *IssueService) SetNotificationService(n *NotificationService) { s.notify = n }

// SetSubscriberStore injects the issue-subscriber store so assignees and mention
// targets are auto-subscribed when they're added to an issue. Optional.
func (s *IssueService) SetSubscriberStore(subs *store.IssueSubscriberStore) { s.subs = subs }

// SetReactionStore wires per-issue emoji reactions support. Optional.
func (s *IssueService) SetReactionStore(r *store.IssueReactionStore) { s.reactions = r }

// SetStateStore wires state-ownership validation. Optional.
func (s *IssueService) SetStateStore(st *store.StateStore) { s.states = st }

// SetLabelStore wires label-ownership validation. Optional.
func (s *IssueService) SetLabelStore(l *store.LabelStore) { s.labels = l }

// SetWebhookService wires outbound webhook dispatch for issue events. Optional.
func (s *IssueService) SetWebhookService(w *WebhookService) { s.webhooks = w }

// dispatchIssueWebhook fires an "issue" webhook event (best-effort).
func (s *IssueService) dispatchIssueWebhook(ctx context.Context, issue *model.Issue, action string) {
	if s.webhooks == nil || issue == nil || issue.IsDraft {
		return
	}
	s.webhooks.Dispatch(ctx, issue.WorkspaceID, "issue", map[string]interface{}{
		"action":       action,
		"event":        "issue",
		"workspace_id": issue.WorkspaceID.String(),
		"project_id":   issue.ProjectID.String(),
		"data":         issue,
	})
}

// validateRelations rejects related ids that fall outside the allowed scope:
// state and labels must belong to the same project, a parent must be another
// issue in the same project (and never the issue itself — pass selfID on
// update; uuid.Nil on create), and assignees must be members of the workspace.
// Only the provided (non-nil / non-empty) fields are checked. Ownership stores
// are optional; when one isn't wired the corresponding check is skipped. A
// genuine "not found" maps to the invalid-* sentinel, but any other datastore
// error is returned so query failures surface as 5xx, not 400.
func (s *IssueService) validateRelations(ctx context.Context, projectID, workspaceID, selfID uuid.UUID, stateID *uuid.UUID, labelIDs []uuid.UUID, assigneeIDs []uuid.UUID, parentID *uuid.UUID) error {
	if stateID != nil && s.states != nil {
		st, err := s.states.GetByID(ctx, *stateID)
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrInvalidState
		}
		if err != nil {
			return err
		}
		if st == nil || st.ProjectID != projectID {
			return ErrInvalidState
		}
	}
	if len(labelIDs) > 0 && s.labels != nil {
		for _, id := range labelIDs {
			l, err := s.labels.GetByID(ctx, id)
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrInvalidLabel
			}
			if err != nil {
				return err
			}
			if l == nil || l.ProjectID == nil || *l.ProjectID != projectID {
				return ErrInvalidLabel
			}
		}
	}
	if parentID != nil {
		if *parentID == selfID {
			return ErrInvalidParent // an issue can't be its own parent
		}
		parent, err := s.is.GetByID(ctx, *parentID)
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrInvalidParent
		}
		if err != nil {
			return err
		}
		if parent == nil || parent.ProjectID != projectID {
			return ErrInvalidParent
		}
	}
	for _, id := range assigneeIDs {
		ok, err := s.ws.IsMember(ctx, workspaceID, id)
		if err != nil {
			return err
		}
		if !ok {
			return ErrInvalidAssignee
		}
	}
	return nil
}

// autoSubscribe is a fire-and-forget helper used by the assignee and mention
// hooks. Errors are logged-and-ignored — the user's primary action must not
// fail because of a subscription bookkeeping issue.
func (s *IssueService) autoSubscribe(ctx context.Context, issue *model.Issue, userIDs []uuid.UUID) {
	if s.subs == nil || issue == nil {
		return
	}
	for _, uid := range userIDs {
		if uid == uuid.Nil {
			continue
		}
		_ = s.subs.Subscribe(ctx, &model.IssueSubscriber{
			IssueID:      issue.ID,
			SubscriberID: uid,
			ProjectID:    issue.ProjectID,
			WorkspaceID:  issue.WorkspaceID,
		})
	}
}

// recordActivity inserts one issue_activities row. Errors are logged-and-ignored
// — we never fail an issue update because the activity write fails.
func (s *IssueService) recordActivity(ctx context.Context, issue *model.Issue, userID uuid.UUID, field string, oldVal, newVal string) {
	recordIssueActivity(ctx, s.activity, issue, userID, field, oldVal, newVal)
}

// recordIssueActivity writes one issue_activities row. It is a package-level
// helper so services that own their own data (attachments, comments) can log
// against an issue without depending on IssueService. Errors are
// logged-and-ignored, and a nil store or issue is a no-op, so activity
// bookkeeping never fails the user's primary action.
func recordIssueActivity(ctx context.Context, activity *store.IssueActivityStore, issue *model.Issue, userID uuid.UUID, field, oldVal, newVal string) {
	if activity == nil || issue == nil {
		return
	}
	f := field
	row := &model.IssueActivity{
		IssueID:     &issue.ID,
		ProjectID:   issue.ProjectID,
		WorkspaceID: issue.WorkspaceID,
		Verb:        "updated",
		Field:       &f,
		OldValue:    nullableStr(oldVal),
		NewValue:    nullableStr(newVal),
		ActorID:     &userID,
		CreatedByID: &userID,
	}
	_ = activity.Create(ctx, row)
}

func nullableStr(s string) *string {
	if s == "" {
		return nil
	}
	out := s
	return &out
}

func (s *IssueService) ensureProjectAccess(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID) error {
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

func (s *IssueService) ensureWorkspaceAccess(ctx context.Context, workspaceSlug string, userID uuid.UUID) (*model.Workspace, error) {
	wrk, err := s.ws.GetBySlug(ctx, workspaceSlug)
	if err != nil {
		return nil, ErrWorkspaceForbidden
	}
	ok, _ := s.ws.IsMember(ctx, wrk.ID, userID)
	if !ok {
		return nil, ErrWorkspaceForbidden
	}
	return wrk, nil
}

// issueForAccess auth-checks the caller and returns the issue, ensuring it
// belongs to the project in the URL.
func (s *IssueService) issueForAccess(ctx context.Context, workspaceSlug string, projectID, issueID, userID uuid.UUID) (*model.Issue, error) {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return nil, err
	}
	issue, err := s.is.GetByID(ctx, issueID)
	if err != nil || issue.ProjectID != projectID {
		return nil, ErrIssueNotFound
	}
	return issue, nil
}

// ListReactions returns all emoji reactions on an issue after auth-checking.
func (s *IssueService) ListReactions(ctx context.Context, workspaceSlug string, projectID, issueID, userID uuid.UUID) ([]model.IssueReaction, error) {
	if s.reactions == nil {
		return []model.IssueReaction{}, nil
	}
	if _, err := s.issueForAccess(ctx, workspaceSlug, projectID, issueID, userID); err != nil {
		return nil, err
	}
	return s.reactions.ListByIssueID(ctx, issueID)
}

// AddReaction adds a user's emoji reaction to an issue. Duplicates are rejected
// by the DB unique constraint.
func (s *IssueService) AddReaction(ctx context.Context, workspaceSlug string, projectID, issueID, userID uuid.UUID, emoji string) (*model.IssueReaction, error) {
	if s.reactions == nil {
		return nil, errors.New("reactions store is not configured")
	}
	issue, err := s.issueForAccess(ctx, workspaceSlug, projectID, issueID, userID)
	if err != nil {
		return nil, err
	}
	r := &model.IssueReaction{
		IssueID:     issue.ID,
		Reaction:    emoji,
		ActorID:     userID,
		ProjectID:   issue.ProjectID,
		WorkspaceID: issue.WorkspaceID,
	}
	if err := s.reactions.Add(ctx, r); err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			return nil, ErrReactionExists
		}
		return nil, err
	}
	return r, nil
}

// RemoveReaction deletes a user's emoji reaction from an issue.
func (s *IssueService) RemoveReaction(ctx context.Context, workspaceSlug string, projectID, issueID, userID uuid.UUID, emoji string) error {
	if s.reactions == nil {
		return errors.New("reactions store is not configured")
	}
	if _, err := s.issueForAccess(ctx, workspaceSlug, projectID, issueID, userID); err != nil {
		return err
	}
	return s.reactions.Remove(ctx, issueID, userID, emoji)
}

// Archive marks an issue as archived (hidden from active lists, kept for the
// archived view). Restore reverses it.
func (s *IssueService) Archive(ctx context.Context, workspaceSlug string, projectID, issueID, userID uuid.UUID) error {
	if _, err := s.issueForAccess(ctx, workspaceSlug, projectID, issueID, userID); err != nil {
		return err
	}
	return s.is.SetArchived(ctx, issueID, true)
}

// Restore un-archives an issue.
func (s *IssueService) Restore(ctx context.Context, workspaceSlug string, projectID, issueID, userID uuid.UUID) error {
	if _, err := s.issueForAccess(ctx, workspaceSlug, projectID, issueID, userID); err != nil {
		return err
	}
	return s.is.SetArchived(ctx, issueID, false)
}

// Convert promotes a work item to an epic (clearing its parent) or demotes an
// epic back to a work item (rejected while it still has child work items).
func (s *IssueService) Convert(ctx context.Context, workspaceSlug string, projectID, issueID, userID uuid.UUID, toEpic bool) (*model.Issue, error) {
	issue, err := s.issueForAccess(ctx, workspaceSlug, projectID, issueID, userID)
	if err != nil {
		return nil, err
	}
	if issue.IsEpic == toEpic {
		return issue, nil
	}
	// The demotion guard (no child work items) and the flip happen in one atomic
	// UPDATE so a concurrent "add child" can't orphan children under a demoted
	// epic; 0 rows affected on a demote means children still exist.
	affected, err := s.is.SetIsEpic(ctx, issue.ID, userID, toEpic)
	if err != nil {
		return nil, err
	}
	if affected == 0 {
		return nil, ErrEpicHasChildren
	}
	updated, err := s.is.GetByID(ctx, issue.ID)
	if err != nil {
		return nil, err
	}
	s.recordActivity(ctx, updated, userID, "is_epic", boolStr(!toEpic), boolStr(toEpic))
	return updated, nil
}

func boolStr(b bool) string {
	if b {
		return "true"
	}
	return "false"
}

// Move rehomes an issue into another project in the same workspace. The target
// must differ from the current project and be reachable by the caller.
// Project-scoped fields (state, parent, estimate) and associations (labels,
// cycle/module membership, relations) are reset because they don't carry across
// projects; the issue gets a fresh per-project sequence id.
func (s *IssueService) Move(ctx context.Context, workspaceSlug string, projectID, issueID, userID, targetProjectID uuid.UUID) (*model.Issue, error) {
	issue, err := s.issueForAccess(ctx, workspaceSlug, projectID, issueID, userID)
	if err != nil {
		return nil, err
	}
	if targetProjectID == projectID {
		return nil, ErrMoveSameProject
	}
	// The target must be a project the caller can access in the same workspace;
	// ensureProjectAccess returns ErrProjectNotFound for projects outside it.
	if err := s.ensureProjectAccess(ctx, workspaceSlug, targetProjectID, userID); err != nil {
		return nil, err
	}
	if _, err := s.is.MoveToProject(ctx, issue.ID, targetProjectID, userID); err != nil {
		return nil, err
	}
	updated, err := s.is.GetByID(ctx, issue.ID)
	if err != nil {
		return nil, err
	}
	s.recordActivity(ctx, updated, userID, "project_id", projectID.String(), targetProjectID.String())
	return updated, nil
}

// ListArchived returns archived issues for a project.
func (s *IssueService) ListArchived(ctx context.Context, workspaceSlug string, projectID, userID uuid.UUID, limit, offset int) ([]model.Issue, error) {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return nil, err
	}
	return s.is.ListArchivedByProjectID(ctx, projectID, limit, offset)
}

// ListArchivedForWorkspace lists archived issues across all projects in a
// workspace (for the workspace Archives page).
func (s *IssueService) ListArchivedForWorkspace(ctx context.Context, workspaceSlug string, userID uuid.UUID, limit, offset int) ([]model.Issue, error) {
	wrk, err := s.ensureWorkspaceAccess(ctx, workspaceSlug, userID)
	if err != nil {
		return nil, err
	}
	return s.is.ListArchivedByWorkspaceID(ctx, wrk.ID, limit, offset)
}

// Reorder renumbers the given issues' sort_order to match the order of ids
// (manual drag-to-reorder).
func (s *IssueService) Reorder(ctx context.Context, workspaceSlug string, projectID, userID uuid.UUID, ids []uuid.UUID) error {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return err
	}
	return s.is.ReorderIssues(ctx, projectID, ids)
}

// BulkUpdate applies priority/state changes to many issues in a project. It
// validates the inputs, then routes each issue through the single-issue Update
// so activity logging and notifications fire exactly as they do individually.
// Returns the number of issues updated.
func (s *IssueService) BulkUpdate(ctx context.Context, workspaceSlug string, projectID, userID uuid.UUID, issueIDs []uuid.UUID, priority *string, stateID *uuid.UUID) (int, error) {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return 0, err
	}
	if priority != nil && !validPriorities[*priority] {
		return 0, ErrInvalidPriority
	}
	if stateID != nil {
		if s.states == nil {
			return 0, ErrInvalidState
		}
		st, err := s.states.GetByID(ctx, *stateID)
		if err != nil || st.ProjectID != projectID {
			return 0, ErrInvalidState
		}
	}
	n := 0
	var firstErr error
	for _, id := range issueIDs {
		if _, err := s.Update(ctx, workspaceSlug, projectID, id, userID, nil, priority, nil, stateID, nil, nil, false, nil, false, nil, nil, nil, nil, false, nil, nil); err != nil {
			if firstErr == nil {
				firstErr = err
			}
			continue
		}
		n++
	}
	// If nothing changed despite being asked to, surface the failure so the
	// caller doesn't report a no-op as success.
	if n == 0 && len(issueIDs) > 0 {
		return 0, firstErr
	}
	return n, nil
}

// BulkArchive archives or restores many issues in a project at once. Archiving
// has no per-issue side effects beyond setting archived_at, so it runs as a
// single scoped statement.
func (s *IssueService) BulkArchive(ctx context.Context, workspaceSlug string, projectID, userID uuid.UUID, issueIDs []uuid.UUID, archived bool) (int, error) {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return 0, err
	}
	n, err := s.is.BulkSetArchived(ctx, projectID, issueIDs, archived)
	return int(n), err
}

// BulkDelete soft-deletes many issues, routing each through the single-issue
// Delete so deletion notifications fire as they do individually.
func (s *IssueService) BulkDelete(ctx context.Context, workspaceSlug string, projectID, userID uuid.UUID, issueIDs []uuid.UUID) (int, error) {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return 0, err
	}
	n := 0
	var firstErr error
	for _, id := range issueIDs {
		if err := s.Delete(ctx, workspaceSlug, projectID, id, userID); err != nil {
			if firstErr == nil {
				firstErr = err
			}
			continue
		}
		n++
	}
	if n == 0 && len(issueIDs) > 0 {
		return 0, firstErr
	}
	return n, nil
}

// ListDraftsForWorkspace returns draft issues for all projects in the workspace the user can access.
func (s *IssueService) ListDraftsForWorkspace(ctx context.Context, workspaceSlug string, userID uuid.UUID, limit, offset int) ([]model.Issue, error) {
	wrk, err := s.ensureWorkspaceAccess(ctx, workspaceSlug, userID)
	if err != nil {
		return nil, err
	}
	list, err := s.is.ListDraftsByWorkspaceID(ctx, wrk.ID, limit, offset)
	if err != nil {
		return nil, err
	}
	for i := range list {
		issueID := list[i].ID
		if ids, err := s.is.ListAssigneesForIssue(ctx, issueID); err == nil {
			list[i].AssigneeIDs = ids
		}
		if ids, err := s.is.ListLabelsForIssue(ctx, issueID); err == nil {
			list[i].LabelIDs = ids
		}
		if ids, err := s.is.ListCycleIDsForIssue(ctx, issueID); err == nil {
			list[i].CycleIDs = ids
		}
		if ids, err := s.is.ListModuleIDsForIssue(ctx, issueID); err == nil {
			list[i].ModuleIDs = ids
		}
	}
	return list, nil
}

func (s *IssueService) List(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID, limit, offset int) ([]model.Issue, error) {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return nil, err
	}
	list, err := s.is.ListByProjectID(ctx, projectID, limit, offset)
	if err != nil {
		return nil, err
	}
	for i := range list {
		issueID := list[i].ID
		if ids, err := s.is.ListAssigneesForIssue(ctx, issueID); err == nil {
			list[i].AssigneeIDs = ids
		}
		if ids, err := s.is.ListLabelsForIssue(ctx, issueID); err == nil {
			list[i].LabelIDs = ids
		}
		if ids, err := s.is.ListCycleIDsForIssue(ctx, issueID); err == nil {
			list[i].CycleIDs = ids
		}
		if ids, err := s.is.ListModuleIDsForIssue(ctx, issueID); err == nil {
			list[i].ModuleIDs = ids
		}
	}
	return list, nil
}

func (s *IssueService) GetByID(ctx context.Context, workspaceSlug string, projectID, issueID uuid.UUID, userID uuid.UUID) (*model.Issue, error) {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return nil, err
	}
	issue, err := s.is.GetByID(ctx, issueID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrIssueNotFound
		}
		return nil, err
	}
	if issue.ProjectID != projectID {
		return nil, ErrIssueNotFound
	}
	if ids, err := s.is.ListAssigneesForIssue(ctx, issue.ID); err == nil {
		issue.AssigneeIDs = ids
	}
	if ids, err := s.is.ListLabelsForIssue(ctx, issue.ID); err == nil {
		issue.LabelIDs = ids
	}
	if ids, err := s.is.ListCycleIDsForIssue(ctx, issue.ID); err == nil {
		issue.CycleIDs = ids
	}
	if ids, err := s.is.ListModuleIDsForIssue(ctx, issue.ID); err == nil {
		issue.ModuleIDs = ids
	}
	return issue, nil
}

func (s *IssueService) Create(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID, name, description, priority string, stateID *uuid.UUID, assigneeIDs []uuid.UUID, labelIDs []uuid.UUID, startDate, targetDate *time.Time, parentID *uuid.UUID, isDraft bool) (*model.Issue, error) {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return nil, err
	}
	wrk, _ := s.ws.GetBySlug(ctx, workspaceSlug)
	if err := s.validateRelations(ctx, projectID, wrk.ID, uuid.Nil, stateID, labelIDs, assigneeIDs, parentID); err != nil {
		return nil, err
	}
	issue := &model.Issue{
		Name:        name,
		ProjectID:   projectID,
		WorkspaceID: wrk.ID,
		CreatedByID: &userID,
		IsDraft:     isDraft,
	}
	if description != "" {
		issue.DescriptionHTML = description
	}
	if priority != "" {
		issue.Priority = priority
	}
	if stateID != nil {
		issue.StateID = stateID
	} else if s.states != nil {
		// No state chosen: fall back to the project's default state so new work
		// items land in the configured starting state instead of no state.
		if def, derr := s.states.GetDefaultByProjectID(ctx, projectID); derr == nil && def != nil {
			issue.StateID = &def.ID
		}
	}
	if startDate != nil {
		issue.StartDate = startDate
	}
	if targetDate != nil {
		issue.TargetDate = targetDate
	}
	if parentID != nil {
		issue.ParentID = parentID
	}
	if err := s.is.Transaction(ctx, func(tx *gorm.DB) error {
		seq, err := s.is.NextSequenceID(ctx, tx, projectID)
		if err != nil {
			return err
		}
		issue.SequenceID = seq
		return tx.WithContext(ctx).Create(issue).Error
	}); err != nil {
		return nil, err
	}
	if len(assigneeIDs) > 0 {
		_ = s.ReplaceAssignees(ctx, workspaceSlug, projectID, issue.ID, userID, assigneeIDs)
	}
	if len(labelIDs) > 0 {
		_ = s.ReplaceLabels(ctx, workspaceSlug, projectID, issue.ID, userID, labelIDs)
	}
	// Record the synthetic "created" activity row so the activity feed has a
	// defined start. We don't snapshot fields here — the create call captures
	// them; future updates emit field-change activity rows.
	if s.activity != nil {
		row := &model.IssueActivity{
			IssueID:     &issue.ID,
			ProjectID:   issue.ProjectID,
			WorkspaceID: issue.WorkspaceID,
			Verb:        "created",
			ActorID:     &userID,
			CreatedByID: &userID,
		}
		_ = s.activity.Create(ctx, row)
	}
	// Description mention notifications (assignment notifications are emitted
	// by ReplaceAssignees above — not here, to prevent double-fire).
	if issue.DescriptionHTML != "" {
		mentioned := text.ParseMentionUserIDs(issue.DescriptionHTML)
		if len(mentioned) > 0 {
			s.autoSubscribe(ctx, issue, mentioned)
			if s.notify != nil {
				s.notify.IssueMentioned(ctx, issue, userID, mentioned, "description")
			}
		}
	}
	if s.notify != nil {
		s.notify.IssueCreated(ctx, issue, userID)
	}
	s.dispatchIssueWebhook(ctx, issue, "created")
	return issue, nil
}

func (s *IssueService) Update(ctx context.Context, workspaceSlug string, projectID, issueID uuid.UUID, userID uuid.UUID, name, priority, description *string, stateID *uuid.UUID, assigneeIDs, labelIDs *[]uuid.UUID, startDateSet bool, startDate *time.Time, targetDateSet bool, targetDate *time.Time, parentID *uuid.UUID, isDraft *bool, issueType *string, estimatePointIDSet bool, estimatePointID *uuid.UUID, sortOrder *float64) (*model.Issue, error) {
	issue, err := s.GetByID(ctx, workspaceSlug, projectID, issueID, userID)
	if err != nil {
		return nil, err
	}

	// Reject related ids outside the allowed scope before touching anything.
	var wantAssignees, wantLabels []uuid.UUID
	if assigneeIDs != nil {
		wantAssignees = *assigneeIDs
	}
	if labelIDs != nil {
		wantLabels = *labelIDs
	}
	if err := s.validateRelations(ctx, issue.ProjectID, issue.WorkspaceID, issue.ID, stateID, wantLabels, wantAssignees, parentID); err != nil {
		return nil, err
	}

	// Snapshot values before mutation so we can diff them for the activity log.
	prevName := issue.Name
	prevPriority := issue.Priority
	prevStateID := issue.StateID
	prevState := uuidString(issue.StateID)
	prevStart := dateString(issue.StartDate)
	prevTarget := dateString(issue.TargetDate)
	prevParent := uuidString(issue.ParentID)
	prevDescription := issue.DescriptionHTML

	// Write only the columns this PATCH actually changed. A full-row Save would
	// re-write every column from the in-memory snapshot, so a concurrent PATCH to
	// a different field would be silently reverted (lost update).
	changed := map[string]any{"updated_by_id": &userID}
	if name != nil {
		issue.Name = *name
		changed["name"] = *name
	}
	if priority != nil {
		issue.Priority = *priority
		changed["priority"] = *priority
	}
	if description != nil {
		issue.DescriptionHTML = *description
		changed["description_html"] = *description
	}
	if stateID != nil {
		issue.StateID = stateID
		changed["state_id"] = stateID
	}
	if startDateSet {
		issue.StartDate = startDate // nil clears the date
		changed["start_date"] = startDate
	}
	if targetDateSet {
		issue.TargetDate = targetDate
		changed["target_date"] = targetDate
	}
	if parentID != nil {
		issue.ParentID = parentID
		changed["parent_id"] = parentID
	}
	if isDraft != nil {
		issue.IsDraft = *isDraft
		changed["is_draft"] = *isDraft
	}
	if issueType != nil && *issueType != "" {
		issue.Type = *issueType
		changed["type"] = *issueType
	}
	if estimatePointIDSet {
		issue.EstimatePointID = estimatePointID
		changed["estimate_point_id"] = estimatePointID
	}
	if sortOrder != nil {
		issue.SortOrder = *sortOrder
		changed["sort_order"] = *sortOrder
	}
	// Snapshot the previous description before it's overwritten, so the history
	// is complete and recoverable. Done before the save so a snapshot failure
	// aborts the edit rather than silently losing the prior text.
	if description != nil && prevDescription != issue.DescriptionHTML {
		if err := s.is.CreateDescriptionVersion(ctx, &model.IssueDescriptionVersion{
			IssueID:         issue.ID,
			DescriptionHTML: prevDescription,
			CreatedByID:     &userID,
			OwnedByID:       &userID,
		}); err != nil {
			return nil, err
		}
	}
	issue.UpdatedByID = &userID
	if err := s.is.UpdateFields(ctx, issue.ID, changed); err != nil {
		// The issue was deleted between the load above and this write.
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrIssueNotFound
		}
		return nil, err
	}

	// Activity log — record what changed. Description is intentionally not logged
	// (it's noisy and the change history is rebuildable from issue versions).
	if name != nil && prevName != issue.Name {
		s.recordActivity(ctx, issue, userID, "name", prevName, issue.Name)
		if s.notify != nil {
			s.notify.IssueFieldChanged(ctx, issue, userID, "name", prevName, issue.Name)
		}
	}
	if priority != nil && prevPriority != issue.Priority {
		s.recordActivity(ctx, issue, userID, "priority", prevPriority, issue.Priority)
		if s.notify != nil {
			s.notify.IssueFieldChanged(ctx, issue, userID, "priority", prevPriority, issue.Priority)
		}
	}
	if stateID != nil && prevState != uuidString(issue.StateID) {
		s.recordActivity(ctx, issue, userID, "state", prevState, uuidString(issue.StateID))
		if s.notify != nil {
			s.notify.IssueStateChanged(ctx, issue, userID, prevStateID, issue.StateID)
		}
	}
	if startDateSet && prevStart != dateString(issue.StartDate) {
		s.recordActivity(ctx, issue, userID, "start_date", prevStart, dateString(issue.StartDate))
		if s.notify != nil {
			s.notify.IssueFieldChanged(ctx, issue, userID, "start_date", prevStart, dateString(issue.StartDate))
		}
	}
	if targetDateSet && prevTarget != dateString(issue.TargetDate) {
		s.recordActivity(ctx, issue, userID, "target_date", prevTarget, dateString(issue.TargetDate))
		if s.notify != nil {
			s.notify.IssueFieldChanged(ctx, issue, userID, "target_date", prevTarget, dateString(issue.TargetDate))
		}
	}
	if parentID != nil && prevParent != uuidString(issue.ParentID) {
		s.recordActivity(ctx, issue, userID, "parent", prevParent, uuidString(issue.ParentID))
		if s.notify != nil {
			s.notify.IssueFieldChanged(ctx, issue, userID, "parent", prevParent, uuidString(issue.ParentID))
		}
	}

	// New mentions added in the description: notify only the *newly* added IDs
	// so editing a description twice doesn't repeatedly ping the same users.
	if description != nil && prevDescription != issue.DescriptionHTML {
		prevSet := uuidSet(text.ParseMentionUserIDs(prevDescription))
		newIDs := text.ParseMentionUserIDs(issue.DescriptionHTML)
		added := make([]uuid.UUID, 0, len(newIDs))
		for _, id := range newIDs {
			if !prevSet[id] {
				added = append(added, id)
			}
		}
		if len(added) > 0 {
			s.autoSubscribe(ctx, issue, added)
			if s.notify != nil {
				s.notify.IssueMentioned(ctx, issue, userID, added, "description")
			}
		}
	}

	if assigneeIDs != nil {
		prevAssignees, _ := s.is.ListAssigneesForIssue(ctx, issue.ID)
		_ = s.ReplaceAssignees(ctx, workspaceSlug, projectID, issue.ID, userID, *assigneeIDs)
		// Diff added vs removed for nicer activity entries.
		prevSet := uuidSet(prevAssignees)
		newSet := uuidSet(*assigneeIDs)
		for id := range newSet {
			if !prevSet[id] {
				s.recordActivity(ctx, issue, userID, "assignees_added", "", id.String())
			}
		}
		for id := range prevSet {
			if !newSet[id] {
				s.recordActivity(ctx, issue, userID, "assignees_removed", id.String(), "")
			}
		}
	}
	if labelIDs != nil {
		prevLabels, _ := s.is.ListLabelsForIssue(ctx, issue.ID)
		_ = s.ReplaceLabels(ctx, workspaceSlug, projectID, issue.ID, userID, *labelIDs)
		prevSet := uuidSet(prevLabels)
		newSet := uuidSet(*labelIDs)
		for id := range newSet {
			if !prevSet[id] {
				s.recordActivity(ctx, issue, userID, "labels_added", "", id.String())
			}
		}
		for id := range prevSet {
			if !newSet[id] {
				s.recordActivity(ctx, issue, userID, "labels_removed", id.String(), "")
			}
		}
	}
	s.dispatchIssueWebhook(ctx, issue, "updated")
	return issue, nil
}

func uuidString(id *uuid.UUID) string {
	if id == nil || *id == uuid.Nil {
		return ""
	}
	return id.String()
}

func dateString(t *time.Time) string {
	if t == nil {
		return ""
	}
	return t.Format("2006-01-02")
}

func uuidSet(ids []uuid.UUID) map[uuid.UUID]bool {
	out := make(map[uuid.UUID]bool, len(ids))
	for _, id := range ids {
		out[id] = true
	}
	return out
}

func (s *IssueService) Delete(ctx context.Context, workspaceSlug string, projectID, issueID uuid.UUID, userID uuid.UUID) error {
	issue, err := s.GetByID(ctx, workspaceSlug, projectID, issueID, userID)
	if err != nil {
		return err
	}
	if err := s.is.Delete(ctx, issueID); err != nil {
		return err
	}
	if s.notify != nil {
		s.notify.IssueDeleted(ctx, issueID)
	}
	s.dispatchIssueWebhook(ctx, issue, "deleted")
	return nil
}

func (s *IssueService) ListAssignees(ctx context.Context, workspaceSlug string, projectID, issueID uuid.UUID, userID uuid.UUID) ([]uuid.UUID, error) {
	_, err := s.GetByID(ctx, workspaceSlug, projectID, issueID, userID)
	if err != nil {
		return nil, err
	}
	return s.is.ListAssigneesForIssue(ctx, issueID)
}

// ListDescriptionVersions returns the issue's description history (newest first).
func (s *IssueService) ListDescriptionVersions(ctx context.Context, workspaceSlug string, projectID, issueID uuid.UUID, userID uuid.UUID) ([]model.IssueDescriptionVersion, error) {
	if _, err := s.GetByID(ctx, workspaceSlug, projectID, issueID, userID); err != nil {
		return nil, err
	}
	return s.is.ListDescriptionVersions(ctx, issueID)
}

// RestoreDescriptionVersion sets the issue's description back to a past version.
// The current description is snapshotted first so a restore is itself undoable.
func (s *IssueService) RestoreDescriptionVersion(ctx context.Context, workspaceSlug string, projectID, issueID, versionID uuid.UUID, userID uuid.UUID) (*model.Issue, error) {
	issue, err := s.GetByID(ctx, workspaceSlug, projectID, issueID, userID)
	if err != nil {
		return nil, err
	}
	version, err := s.is.GetDescriptionVersion(ctx, versionID)
	if err != nil || version.IssueID != issue.ID {
		return nil, ErrIssueNotFound
	}
	if version.DescriptionHTML == issue.DescriptionHTML {
		return issue, nil // nothing to restore
	}
	// Snapshot the current description before overwriting it. Abort on failure so
	// a restore never destroys the current text without recording it first.
	if err := s.is.CreateDescriptionVersion(ctx, &model.IssueDescriptionVersion{
		IssueID:         issue.ID,
		DescriptionHTML: issue.DescriptionHTML,
		CreatedByID:     &userID,
		OwnedByID:       &userID,
	}); err != nil {
		return nil, err
	}
	issue.DescriptionHTML = version.DescriptionHTML
	issue.UpdatedByID = &userID
	if err := s.is.Update(ctx, issue); err != nil {
		return nil, err
	}
	return issue, nil
}

func (s *IssueService) AddAssignee(ctx context.Context, workspaceSlug string, projectID, issueID uuid.UUID, userID uuid.UUID, assigneeID uuid.UUID) error {
	issue, err := s.GetByID(ctx, workspaceSlug, projectID, issueID, userID)
	if err != nil {
		return err
	}
	a := &model.IssueAssignee{
		IssueID:     issue.ID,
		AssigneeID:  assigneeID,
		ProjectID:   issue.ProjectID,
		WorkspaceID: issue.WorkspaceID,
	}
	if err := s.is.AddAssignee(ctx, a); err != nil {
		return err
	}
	s.autoSubscribe(ctx, issue, []uuid.UUID{assigneeID})
	if s.notify != nil {
		s.notify.IssueAssigned(ctx, issue, userID, []uuid.UUID{assigneeID})
	}
	return nil
}

func (s *IssueService) RemoveAssignee(ctx context.Context, workspaceSlug string, projectID, issueID uuid.UUID, userID uuid.UUID, assigneeID uuid.UUID) error {
	_, err := s.GetByID(ctx, workspaceSlug, projectID, issueID, userID)
	if err != nil {
		return err
	}
	return s.is.RemoveAssignee(ctx, issueID, assigneeID)
}

func (s *IssueService) ReplaceAssignees(ctx context.Context, workspaceSlug string, projectID, issueID uuid.UUID, userID uuid.UUID, assigneeIDs []uuid.UUID) error {
	issue, err := s.GetByID(ctx, workspaceSlug, projectID, issueID, userID)
	if err != nil {
		return err
	}
	prevAssignees, _ := s.is.ListAssigneesForIssue(ctx, issueID)
	if err := s.is.ClearAssigneesForIssue(ctx, issueID); err != nil {
		return err
	}
	for _, assigneeID := range assigneeIDs {
		a := &model.IssueAssignee{
			IssueID:     issue.ID,
			AssigneeID:  assigneeID,
			ProjectID:   issue.ProjectID,
			WorkspaceID: issue.WorkspaceID,
		}
		if err := s.is.AddAssignee(ctx, a); err != nil {
			return err
		}
	}
	prevSet := uuidSet(prevAssignees)
	added := make([]uuid.UUID, 0, len(assigneeIDs))
	for _, id := range assigneeIDs {
		if !prevSet[id] {
			added = append(added, id)
		}
	}
	if len(added) > 0 {
		s.autoSubscribe(ctx, issue, added)
		if s.notify != nil {
			s.notify.IssueAssigned(ctx, issue, userID, added)
		}
	}
	return nil
}

func (s *IssueService) ReplaceLabels(ctx context.Context, workspaceSlug string, projectID, issueID uuid.UUID, userID uuid.UUID, labelIDs []uuid.UUID) error {
	issue, err := s.GetByID(ctx, workspaceSlug, projectID, issueID, userID)
	if err != nil {
		return err
	}
	if err := s.is.ClearLabelsForIssue(ctx, issueID); err != nil {
		return err
	}
	for _, labelID := range labelIDs {
		l := &model.IssueLabel{
			IssueID:     issue.ID,
			LabelID:     labelID,
			ProjectID:   issue.ProjectID,
			WorkspaceID: issue.WorkspaceID,
		}
		if err := s.is.AddLabel(ctx, l); err != nil {
			return err
		}
	}
	return nil
}

// IsSubscribed reports whether the current user is subscribed to the issue.
func (s *IssueService) IsSubscribed(ctx context.Context, workspaceSlug string, projectID, issueID, userID uuid.UUID) (bool, error) {
	if _, err := s.GetByID(ctx, workspaceSlug, projectID, issueID, userID); err != nil {
		return false, err
	}
	if s.subs == nil {
		return false, nil
	}
	return s.subs.IsSubscribed(ctx, issueID, userID)
}

// Subscribe explicitly subscribes the current user to the issue.
func (s *IssueService) Subscribe(ctx context.Context, workspaceSlug string, projectID, issueID, userID uuid.UUID) error {
	issue, err := s.GetByID(ctx, workspaceSlug, projectID, issueID, userID)
	if err != nil {
		return err
	}
	if s.subs == nil {
		return nil
	}
	return s.subs.Subscribe(ctx, &model.IssueSubscriber{
		IssueID:      issue.ID,
		SubscriberID: userID,
		ProjectID:    issue.ProjectID,
		WorkspaceID:  issue.WorkspaceID,
	})
}

// Unsubscribe removes the current user's subscription to the issue.
func (s *IssueService) Unsubscribe(ctx context.Context, workspaceSlug string, projectID, issueID, userID uuid.UUID) error {
	if _, err := s.GetByID(ctx, workspaceSlug, projectID, issueID, userID); err != nil {
		return err
	}
	if s.subs == nil {
		return nil
	}
	return s.subs.Unsubscribe(ctx, issueID, userID)
}

// ListActivities returns the chronological activity log for an issue.
// Returns an empty slice when the activity store isn't wired (defensive).
func (s *IssueService) ListActivities(ctx context.Context, workspaceSlug string, projectID, issueID uuid.UUID, userID uuid.UUID) ([]model.IssueActivity, error) {
	if _, err := s.GetByID(ctx, workspaceSlug, projectID, issueID, userID); err != nil {
		return nil, err
	}
	if s.activity == nil {
		return []model.IssueActivity{}, nil
	}
	return s.activity.ListByIssueID(ctx, issueID)
}

// ListRelations returns the issue's relations grouped by type.
// The frontend expects { blocking: Issue[], blocked_by: Issue[], duplicate: Issue[], relates_to: Issue[] }.
func (s *IssueService) ListRelations(ctx context.Context, workspaceSlug string, projectID, issueID uuid.UUID, userID uuid.UUID) (map[string][]model.Issue, error) {
	// GetByID also verifies that issueID belongs to projectID and that the user has project access.
	if _, err := s.GetByID(ctx, workspaceSlug, projectID, issueID, userID); err != nil {
		return nil, err
	}
	rows, err := s.is.ListRelationsForIssue(ctx, issueID)
	if err != nil {
		return nil, err
	}
	result := map[string][]model.Issue{
		"blocking":   {},
		"blocked_by": {},
		"duplicate":  {},
		"relates_to": {},
	}
	for _, row := range rows {
		related, err := s.is.GetByID(ctx, row.RelatedIssueID)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				continue // related issue was deleted; skip the stale relation row
			}
			return nil, err
		}
		if ids, err := s.is.ListAssigneesForIssue(ctx, related.ID); err == nil {
			related.AssigneeIDs = ids
		}
		if ids, err := s.is.ListLabelsForIssue(ctx, related.ID); err == nil {
			related.LabelIDs = ids
		}
		if ids, err := s.is.ListCycleIDsForIssue(ctx, related.ID); err == nil {
			related.CycleIDs = ids
		}
		if ids, err := s.is.ListModuleIDsForIssue(ctx, related.ID); err == nil {
			related.ModuleIDs = ids
		}
		result[row.RelationType] = append(result[row.RelationType], *related)
	}
	return result, nil
}

// CreateRelations adds one or more relations from issueID toward each issue in relatedIssueIDs.
// Both the forward and reverse rows are inserted atomically (skipping pairs that already exist).
// Returns the newly related issues (forward direction only, for the frontend response).
func (s *IssueService) CreateRelations(ctx context.Context, workspaceSlug string, projectID, issueID uuid.UUID, userID uuid.UUID, relationType string, relatedIssueIDs []uuid.UUID) ([]model.Issue, error) {
	issue, err := s.GetByID(ctx, workspaceSlug, projectID, issueID, userID)
	if err != nil {
		return nil, err
	}
	reverseType := model.ReverseRelationType(relationType)
	var added []model.Issue
	for _, relID := range relatedIssueIDs {
		// Validate that the related issue exists and belongs to the same workspace.
		relIssue, err := s.is.GetByID(ctx, relID)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				continue // skip non-existent issues silently
			}
			return nil, err
		}
		if relIssue.WorkspaceID != issue.WorkspaceID {
			continue // cross-workspace relations are not supported
		}
		exists, err := s.is.RelationExists(ctx, issueID, relID, relationType)
		if err != nil {
			return nil, err
		}
		if exists {
			continue
		}
		// Insert both directions atomically so neither issue ends up with a one-sided view.
		forward := &model.IssueRelation{
			IssueID:        issueID,
			RelatedIssueID: relID,
			RelationType:   relationType,
			ProjectID:      issue.ProjectID,
			WorkspaceID:    issue.WorkspaceID,
			CreatedByID:    &userID,
		}
		reverse := &model.IssueRelation{
			IssueID:        relID,
			RelatedIssueID: issueID,
			RelationType:   reverseType,
			ProjectID:      relIssue.ProjectID,
			WorkspaceID:    relIssue.WorkspaceID,
			CreatedByID:    &userID,
		}
		if txErr := s.is.Transaction(ctx, func(tx *gorm.DB) error {
			if err := tx.Create(forward).Error; err != nil {
				return err
			}
			return tx.Create(reverse).Error
		}); txErr != nil {
			return nil, txErr
		}
		if ids, err := s.is.ListAssigneesForIssue(ctx, relIssue.ID); err == nil {
			relIssue.AssigneeIDs = ids
		}
		if ids, err := s.is.ListLabelsForIssue(ctx, relIssue.ID); err == nil {
			relIssue.LabelIDs = ids
		}
		if ids, err := s.is.ListCycleIDsForIssue(ctx, relIssue.ID); err == nil {
			relIssue.CycleIDs = ids
		}
		if ids, err := s.is.ListModuleIDsForIssue(ctx, relIssue.ID); err == nil {
			relIssue.ModuleIDs = ids
		}
		added = append(added, *relIssue)
		s.recordActivity(ctx, issue, userID, "relation_added", "", relationType+":"+relID.String())
	}
	return added, nil
}

// RemoveRelation deletes both the forward and reverse relation rows.
func (s *IssueService) RemoveRelation(ctx context.Context, workspaceSlug string, projectID, issueID uuid.UUID, userID uuid.UUID, relationType string, relatedIssueID uuid.UUID) error {
	// Verify the issue belongs to the given project and the user has access.
	issue, err := s.GetByID(ctx, workspaceSlug, projectID, issueID, userID)
	if err != nil {
		return err
	}
	if err := s.is.DeleteRelation(ctx, issueID, relatedIssueID, relationType); err != nil {
		return err
	}
	reverseType := model.ReverseRelationType(relationType)
	// Best-effort for the reverse: the related issue may be in a different project,
	// and a missing reverse row (already cleaned up) is not an error.
	_ = s.is.DeleteRelation(ctx, relatedIssueID, issueID, reverseType)
	s.recordActivity(ctx, issue, userID, "relation_removed", relationType+":"+relatedIssueID.String(), "")
	return nil
}

// --- Issue Links ---

// ListLinks returns all external links attached to the issue.
func (s *IssueService) ListLinks(ctx context.Context, workspaceSlug string, projectID, issueID uuid.UUID, userID uuid.UUID) ([]model.IssueLink, error) {
	if _, err := s.GetByID(ctx, workspaceSlug, projectID, issueID, userID); err != nil {
		return nil, err
	}
	return s.is.ListLinksForIssue(ctx, issueID)
}

// CreateLink attaches an external URL to the issue.
func (s *IssueService) CreateLink(ctx context.Context, workspaceSlug string, projectID, issueID uuid.UUID, userID uuid.UUID, title, rawURL string) (*model.IssueLink, error) {
	issue, err := s.GetByID(ctx, workspaceSlug, projectID, issueID, userID)
	if err != nil {
		return nil, err
	}
	l := &model.IssueLink{
		Title:       title,
		URL:         rawURL,
		IssueID:     issue.ID,
		ProjectID:   issue.ProjectID,
		WorkspaceID: issue.WorkspaceID,
		CreatedByID: &userID,
	}
	if err := s.is.CreateLink(ctx, l); err != nil {
		return nil, err
	}
	s.recordActivity(ctx, issue, userID, "link_added", "", linkLabel(l))
	return l, nil
}

// linkLabel is the human-readable identity of a link for the activity feed:
// its title when set, otherwise its URL.
func linkLabel(l *model.IssueLink) string {
	if l.Title != "" {
		return l.Title
	}
	return l.URL
}

// UpdateLink edits a link's title or URL.
func (s *IssueService) UpdateLink(ctx context.Context, workspaceSlug string, projectID, issueID, linkID uuid.UUID, userID uuid.UUID, title, rawURL string) (*model.IssueLink, error) {
	if _, err := s.GetByID(ctx, workspaceSlug, projectID, issueID, userID); err != nil {
		return nil, err
	}
	l, err := s.is.GetLinkByID(ctx, linkID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrIssueNotFound
		}
		return nil, err
	}
	if l.IssueID != issueID {
		return nil, ErrIssueNotFound
	}
	if title != "" {
		l.Title = title
	}
	if rawURL != "" {
		l.URL = rawURL
	}
	if err := s.is.UpdateLink(ctx, l); err != nil {
		return nil, err
	}
	if issue, err := s.is.GetByID(ctx, issueID); err == nil {
		s.recordActivity(ctx, issue, userID, "link_updated", "", linkLabel(l))
	}
	return l, nil
}

// DeleteLink removes a link from the issue.
func (s *IssueService) DeleteLink(ctx context.Context, workspaceSlug string, projectID, issueID, linkID uuid.UUID, userID uuid.UUID) error {
	if _, err := s.GetByID(ctx, workspaceSlug, projectID, issueID, userID); err != nil {
		return err
	}
	l, err := s.is.GetLinkByID(ctx, linkID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrIssueNotFound
		}
		return err
	}
	if l.IssueID != issueID {
		return ErrIssueNotFound
	}
	if err := s.is.DeleteLink(ctx, linkID); err != nil {
		return err
	}
	if issue, err := s.is.GetByID(ctx, issueID); err == nil {
		s.recordActivity(ctx, issue, userID, "link_removed", linkLabel(l), "")
	}
	return nil
}

// --- Epics ---

// ListEpics returns all epics (is_epic=true) for the project.
func (s *IssueService) ListEpics(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID) ([]model.Issue, error) {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return nil, err
	}
	list, err := s.is.ListEpicsByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	for i := range list {
		if ids, err := s.is.ListAssigneesForIssue(ctx, list[i].ID); err == nil {
			list[i].AssigneeIDs = ids
		}
		if ids, err := s.is.ListLabelsForIssue(ctx, list[i].ID); err == nil {
			list[i].LabelIDs = ids
		}
	}
	return list, nil
}

// EpicProgressBulk returns child-issue state-group counts (plus a total) for
// every epic in the project, keyed by epic id. Used to render epic progress.
func (s *IssueService) EpicProgressBulk(ctx context.Context, workspaceSlug string, projectID, userID uuid.UUID) (map[uuid.UUID]map[string]int, error) {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return nil, err
	}
	dist, err := s.is.EpicStateDistributionBulk(ctx, projectID)
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

// CreateEpic creates a new epic in the project.
func (s *IssueService) CreateEpic(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID, name, description, priority string, stateID *uuid.UUID, assigneeIDs, labelIDs []uuid.UUID) (*model.Issue, error) {
	epic, err := s.Create(ctx, workspaceSlug, projectID, userID, name, description, priority, stateID, assigneeIDs, labelIDs, nil, nil, nil, false)
	if err != nil {
		return nil, err
	}
	epic.IsEpic = true
	if err := s.is.Update(ctx, epic); err != nil {
		return nil, err
	}
	return epic, nil
}

// GetEpic returns a single epic, verifying it belongs to the project and is_epic=true.
func (s *IssueService) GetEpic(ctx context.Context, workspaceSlug string, projectID, epicID uuid.UUID, userID uuid.UUID) (*model.Issue, error) {
	epic, err := s.GetByID(ctx, workspaceSlug, projectID, epicID, userID)
	if err != nil {
		return nil, err
	}
	if !epic.IsEpic {
		return nil, ErrIssueNotFound
	}
	return epic, nil
}

// ListEpicIssues returns child issues of an epic.
func (s *IssueService) ListEpicIssues(ctx context.Context, workspaceSlug string, projectID, epicID uuid.UUID, userID uuid.UUID) ([]model.Issue, error) {
	if _, err := s.GetEpic(ctx, workspaceSlug, projectID, epicID, userID); err != nil {
		return nil, err
	}
	list, err := s.is.ListIssuesByEpicID(ctx, epicID)
	if err != nil {
		return nil, err
	}
	for i := range list {
		if ids, err := s.is.ListAssigneesForIssue(ctx, list[i].ID); err == nil {
			list[i].AssigneeIDs = ids
		}
		if ids, err := s.is.ListLabelsForIssue(ctx, list[i].ID); err == nil {
			list[i].LabelIDs = ids
		}
	}
	return list, nil
}

// AddIssueToEpic sets the parent of an existing issue to the epic.
func (s *IssueService) AddIssueToEpic(ctx context.Context, workspaceSlug string, projectID, epicID, issueID uuid.UUID, userID uuid.UUID) error {
	if _, err := s.GetEpic(ctx, workspaceSlug, projectID, epicID, userID); err != nil {
		return err
	}
	issue, err := s.GetByID(ctx, workspaceSlug, projectID, issueID, userID)
	if err != nil {
		return err
	}
	issue.ParentID = &epicID
	return s.is.Update(ctx, issue)
}

// RemoveIssueFromEpic detaches a child issue from an epic by clearing its
// parent. It verifies the epic is reachable and that the issue is actually a
// child of this epic before clearing, so removing an issue that belongs to a
// different epic (or none) returns a not-found rather than silently succeeding.
func (s *IssueService) RemoveIssueFromEpic(ctx context.Context, workspaceSlug string, projectID, epicID, issueID uuid.UUID, userID uuid.UUID) error {
	if _, err := s.GetEpic(ctx, workspaceSlug, projectID, epicID, userID); err != nil {
		return err
	}
	issue, err := s.GetByID(ctx, workspaceSlug, projectID, issueID, userID)
	if err != nil {
		return err
	}
	if issue.ParentID == nil || *issue.ParentID != epicID {
		return ErrIssueNotFound
	}
	issue.ParentID = nil
	return s.is.Update(ctx, issue)
}
