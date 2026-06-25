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
	states    *store.StateStore           // optional — validates state ownership on bulk update
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

// SetStateStore wires state-ownership validation for bulk updates. Optional.
func (s *IssueService) SetStateStore(st *store.StateStore) { s.states = st }

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
	if s.activity == nil {
		return
	}
	verb := "updated"
	f := field
	row := &model.IssueActivity{
		IssueID:     &issue.ID,
		ProjectID:   issue.ProjectID,
		WorkspaceID: issue.WorkspaceID,
		Verb:        verb,
		Field:       &f,
		OldValue:    nullableStr(oldVal),
		NewValue:    nullableStr(newVal),
		ActorID:     &userID,
		CreatedByID: &userID,
	}
	_ = s.activity.Create(ctx, row)
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

// ListArchived returns archived issues for a project.
func (s *IssueService) ListArchived(ctx context.Context, workspaceSlug string, projectID, userID uuid.UUID, limit, offset int) ([]model.Issue, error) {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return nil, err
	}
	return s.is.ListArchivedByProjectID(ctx, projectID, limit, offset)
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
		if _, err := s.Update(ctx, workspaceSlug, projectID, id, userID, nil, priority, nil, stateID, nil, nil, nil, nil, nil, nil, nil); err != nil {
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
	return issue, nil
}

func (s *IssueService) Update(ctx context.Context, workspaceSlug string, projectID, issueID uuid.UUID, userID uuid.UUID, name, priority, description *string, stateID *uuid.UUID, assigneeIDs, labelIDs *[]uuid.UUID, startDate, targetDate *time.Time, parentID *uuid.UUID, isDraft *bool, issueType *string) (*model.Issue, error) {
	issue, err := s.GetByID(ctx, workspaceSlug, projectID, issueID, userID)
	if err != nil {
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

	if name != nil {
		issue.Name = *name
	}
	if priority != nil {
		issue.Priority = *priority
	}
	if description != nil {
		issue.DescriptionHTML = *description
	}
	if stateID != nil {
		issue.StateID = stateID
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
	if isDraft != nil {
		issue.IsDraft = *isDraft
	}
	if issueType != nil && *issueType != "" {
		issue.Type = *issueType
	}
	issue.UpdatedByID = &userID
	if err := s.is.Update(ctx, issue); err != nil {
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
	if startDate != nil && prevStart != dateString(issue.StartDate) {
		s.recordActivity(ctx, issue, userID, "start_date", prevStart, dateString(issue.StartDate))
		if s.notify != nil {
			s.notify.IssueFieldChanged(ctx, issue, userID, "start_date", prevStart, dateString(issue.StartDate))
		}
	}
	if targetDate != nil && prevTarget != dateString(issue.TargetDate) {
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
	_, err := s.GetByID(ctx, workspaceSlug, projectID, issueID, userID)
	if err != nil {
		return err
	}
	if err := s.is.Delete(ctx, issueID); err != nil {
		return err
	}
	if s.notify != nil {
		s.notify.IssueDeleted(ctx, issueID)
	}
	return nil
}

func (s *IssueService) ListAssignees(ctx context.Context, workspaceSlug string, projectID, issueID uuid.UUID, userID uuid.UUID) ([]uuid.UUID, error) {
	_, err := s.GetByID(ctx, workspaceSlug, projectID, issueID, userID)
	if err != nil {
		return nil, err
	}
	return s.is.ListAssigneesForIssue(ctx, issueID)
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
	if _, err := s.GetByID(ctx, workspaceSlug, projectID, issueID, userID); err != nil {
		return err
	}
	if err := s.is.DeleteRelation(ctx, issueID, relatedIssueID, relationType); err != nil {
		return err
	}
	reverseType := model.ReverseRelationType(relationType)
	// Best-effort for the reverse: the related issue may be in a different project,
	// and a missing reverse row (already cleaned up) is not an error.
	_ = s.is.DeleteRelation(ctx, relatedIssueID, issueID, reverseType)
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
	return l, nil
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
	return s.is.DeleteLink(ctx, linkID)
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
