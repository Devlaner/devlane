package service

import (
	"context"
	"errors"
	"time"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrIssueNotFound = errors.New("issue not found")
)

// IssueService handles issue business logic.
type IssueService struct {
	is        *store.IssueStore
	ps        *store.ProjectStore
	ws        *store.WorkspaceStore
	activity  *store.IssueActivityStore // optional — may be nil
}

func NewIssueService(is *store.IssueStore, ps *store.ProjectStore, ws *store.WorkspaceStore) *IssueService {
	return &IssueService{is: is, ps: ps, ws: ws}
}

// SetActivityStore injects the activity store so Update can record field changes.
// Optional — left as a setter so existing callers don't need to change.
func (s *IssueService) SetActivityStore(a *store.IssueActivityStore) { s.activity = a }

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
	return issue, nil
}

func (s *IssueService) Update(ctx context.Context, workspaceSlug string, projectID, issueID uuid.UUID, userID uuid.UUID, name, priority, description *string, stateID *uuid.UUID, assigneeIDs, labelIDs *[]uuid.UUID, startDate, targetDate *time.Time, parentID *uuid.UUID, isDraft *bool) (*model.Issue, error) {
	issue, err := s.GetByID(ctx, workspaceSlug, projectID, issueID, userID)
	if err != nil {
		return nil, err
	}

	// Snapshot values before mutation so we can diff them for the activity log.
	prevName := issue.Name
	prevPriority := issue.Priority
	prevState := uuidString(issue.StateID)
	prevStart := dateString(issue.StartDate)
	prevTarget := dateString(issue.TargetDate)
	prevParent := uuidString(issue.ParentID)

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
	issue.UpdatedByID = &userID
	if err := s.is.Update(ctx, issue); err != nil {
		return nil, err
	}

	// Activity log — record what changed. Description is intentionally not logged
	// (it's noisy and the change history is rebuildable from issue versions).
	if name != nil && prevName != issue.Name {
		s.recordActivity(ctx, issue, userID, "name", prevName, issue.Name)
	}
	if priority != nil && prevPriority != issue.Priority {
		s.recordActivity(ctx, issue, userID, "priority", prevPriority, issue.Priority)
	}
	if stateID != nil && prevState != uuidString(issue.StateID) {
		s.recordActivity(ctx, issue, userID, "state", prevState, uuidString(issue.StateID))
	}
	if startDate != nil && prevStart != dateString(issue.StartDate) {
		s.recordActivity(ctx, issue, userID, "start_date", prevStart, dateString(issue.StartDate))
	}
	if targetDate != nil && prevTarget != dateString(issue.TargetDate) {
		s.recordActivity(ctx, issue, userID, "target_date", prevTarget, dateString(issue.TargetDate))
	}
	if parentID != nil && prevParent != uuidString(issue.ParentID) {
		s.recordActivity(ctx, issue, userID, "parent", prevParent, uuidString(issue.ParentID))
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
	return s.is.Delete(ctx, issueID)
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
	return s.is.AddAssignee(ctx, a)
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
