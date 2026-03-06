package service

import (
	"context"
	"errors"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
)

var ErrCommentNotFound = errors.New("comment not found")

// CommentService handles issue comment business logic.
type CommentService struct {
	cs *store.CommentStore
	is *store.IssueStore
	ps *store.ProjectStore
	ws *store.WorkspaceStore
}

func NewCommentService(cs *store.CommentStore, is *store.IssueStore, ps *store.ProjectStore, ws *store.WorkspaceStore) *CommentService {
	return &CommentService{cs: cs, is: is, ps: ps, ws: ws}
}

func (s *CommentService) ensureProjectAccess(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID) error {
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

func (s *CommentService) List(ctx context.Context, workspaceSlug string, projectID, issueID uuid.UUID, userID uuid.UUID) ([]model.IssueComment, error) {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return nil, err
	}
	issue, err := s.is.GetByID(ctx, issueID)
	if err != nil || issue.ProjectID != projectID {
		return nil, ErrCommentNotFound
	}
	return s.cs.ListByIssueID(ctx, issueID)
}

func (s *CommentService) Create(ctx context.Context, workspaceSlug string, projectID, issueID uuid.UUID, userID uuid.UUID, comment string) (*model.IssueComment, error) {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return nil, err
	}
	wrk, _ := s.ws.GetBySlug(ctx, workspaceSlug)
	issue, err := s.is.GetByID(ctx, issueID)
	if err != nil || issue.ProjectID != projectID {
		return nil, ErrCommentNotFound
	}
	c := &model.IssueComment{
		IssueID:     issueID,
		ProjectID:   projectID,
		WorkspaceID: wrk.ID,
		Comment:     comment,
		CreatedByID: &userID,
	}
	if err := s.cs.Create(ctx, c); err != nil {
		return nil, err
	}
	return c, nil
}

func (s *CommentService) Get(ctx context.Context, workspaceSlug string, projectID, commentID uuid.UUID, userID uuid.UUID) (*model.IssueComment, error) {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return nil, err
	}
	c, err := s.cs.GetByID(ctx, commentID)
	if err != nil {
		return nil, ErrCommentNotFound
	}
	if c.ProjectID != projectID {
		return nil, ErrCommentNotFound
	}
	return c, nil
}

func (s *CommentService) Update(ctx context.Context, workspaceSlug string, projectID, commentID uuid.UUID, userID uuid.UUID, comment string) (*model.IssueComment, error) {
	c, err := s.Get(ctx, workspaceSlug, projectID, commentID, userID)
	if err != nil {
		return nil, err
	}
	if c.CreatedByID == nil || *c.CreatedByID != userID {
		return nil, ErrCommentNotFound
	}
	c.Comment = comment
	if err := s.cs.Update(ctx, c); err != nil {
		return nil, err
	}
	return c, nil
}

func (s *CommentService) Delete(ctx context.Context, workspaceSlug string, projectID, commentID uuid.UUID, userID uuid.UUID) error {
	c, err := s.Get(ctx, workspaceSlug, projectID, commentID, userID)
	if err != nil {
		return err
	}
	if c.CreatedByID == nil || *c.CreatedByID != userID {
		return ErrCommentNotFound
	}
	return s.cs.Delete(ctx, commentID)
}
