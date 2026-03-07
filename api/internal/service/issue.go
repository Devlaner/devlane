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
	ErrIssueNotFound  = errors.New("issue not found")
)

// IssueService handles issue business logic.
type IssueService struct {
	is *store.IssueStore
	ps *store.ProjectStore
	ws *store.WorkspaceStore
}

func NewIssueService(is *store.IssueStore, ps *store.ProjectStore, ws *store.WorkspaceStore) *IssueService {
	return &IssueService{is: is, ps: ps, ws: ws}
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

func (s *IssueService) Create(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID, name, description, priority string, stateID *uuid.UUID, assigneeIDs []uuid.UUID, labelIDs []uuid.UUID, startDate, targetDate *time.Time, parentID *uuid.UUID) (*model.Issue, error) {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return nil, err
	}
	wrk, _ := s.ws.GetBySlug(ctx, workspaceSlug)
	issue := &model.Issue{
		Name:        name,
		ProjectID:   projectID,
		WorkspaceID: wrk.ID,
		CreatedByID: &userID,
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
	if err := s.is.Create(ctx, issue); err != nil {
		return nil, err
	}
	if len(assigneeIDs) > 0 {
		_ = s.ReplaceAssignees(ctx, workspaceSlug, projectID, issue.ID, userID, assigneeIDs)
	}
	if len(labelIDs) > 0 {
		_ = s.ReplaceLabels(ctx, workspaceSlug, projectID, issue.ID, userID, labelIDs)
	}
	return issue, nil
}

func (s *IssueService) Update(ctx context.Context, workspaceSlug string, projectID, issueID uuid.UUID, userID uuid.UUID, name, priority, description *string, stateID *uuid.UUID, assigneeIDs, labelIDs *[]uuid.UUID, startDate, targetDate *time.Time, parentID *uuid.UUID) (*model.Issue, error) {
	issue, err := s.GetByID(ctx, workspaceSlug, projectID, issueID, userID)
	if err != nil {
		return nil, err
	}
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
	issue.UpdatedByID = &userID
	if err := s.is.Update(ctx, issue); err != nil {
		return nil, err
	}
	if assigneeIDs != nil {
		_ = s.ReplaceAssignees(ctx, workspaceSlug, projectID, issue.ID, userID, *assigneeIDs)
	}
	if labelIDs != nil {
		_ = s.ReplaceLabels(ctx, workspaceSlug, projectID, issue.ID, userID, *labelIDs)
	}
	return issue, nil
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
