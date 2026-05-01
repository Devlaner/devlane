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
	cs        *store.CommentStore
	is        *store.IssueStore
	ps        *store.ProjectStore
	ws        *store.WorkspaceStore
	reactions *store.CommentReactionStore // optional — set via SetReactionStore
}

func NewCommentService(cs *store.CommentStore, is *store.IssueStore, ps *store.ProjectStore, ws *store.WorkspaceStore) *CommentService {
	return &CommentService{cs: cs, is: is, ps: ps, ws: ws}
}

// SetReactionStore wires per-comment reactions support. Optional.
func (s *CommentService) SetReactionStore(r *store.CommentReactionStore) { s.reactions = r }

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

func (s *CommentService) Create(ctx context.Context, workspaceSlug string, projectID, issueID uuid.UUID, userID uuid.UUID, comment, access string) (*model.IssueComment, error) {
	if err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return nil, err
	}
	wrk, _ := s.ws.GetBySlug(ctx, workspaceSlug)
	issue, err := s.is.GetByID(ctx, issueID)
	if err != nil || issue.ProjectID != projectID {
		return nil, ErrCommentNotFound
	}
	if access == "" {
		access = "INTERNAL"
	}
	if access != "INTERNAL" && access != "EXTERNAL" {
		access = "INTERNAL"
	}
	c := &model.IssueComment{
		IssueID:     issueID,
		ProjectID:   projectID,
		WorkspaceID: wrk.ID,
		Comment:     comment,
		Access:      access,
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

// ListReactions returns all reactions on a comment after auth-checking.
func (s *CommentService) ListReactions(ctx context.Context, workspaceSlug string, projectID, commentID uuid.UUID, userID uuid.UUID) ([]model.CommentReaction, error) {
	if s.reactions == nil {
		return []model.CommentReaction{}, nil
	}
	if _, err := s.Get(ctx, workspaceSlug, projectID, commentID, userID); err != nil {
		return nil, err
	}
	return s.reactions.ListByCommentID(ctx, commentID)
}

// AddReaction toggles a user's reaction on (idempotent — duplicates rejected
// by the DB unique constraint, treated as no-op).
func (s *CommentService) AddReaction(ctx context.Context, workspaceSlug string, projectID, commentID uuid.UUID, userID uuid.UUID, emoji string) (*model.CommentReaction, error) {
	if s.reactions == nil {
		return nil, errors.New("reactions store is not configured")
	}
	c, err := s.Get(ctx, workspaceSlug, projectID, commentID, userID)
	if err != nil {
		return nil, err
	}
	r := &model.CommentReaction{
		CommentID:   c.ID,
		Reaction:    emoji,
		ActorID:     userID,
		ProjectID:   c.ProjectID,
		WorkspaceID: c.WorkspaceID,
	}
	if err := s.reactions.Add(ctx, r); err != nil {
		// Unique-constraint violation = already reacted, return existing row.
		// We don't bother fetching it; caller can refetch the list.
		return nil, err
	}
	return r, nil
}

// RemoveReaction deletes a user's reaction.
func (s *CommentService) RemoveReaction(ctx context.Context, workspaceSlug string, projectID, commentID uuid.UUID, userID uuid.UUID, emoji string) error {
	if s.reactions == nil {
		return errors.New("reactions store is not configured")
	}
	if _, err := s.Get(ctx, workspaceSlug, projectID, commentID, userID); err != nil {
		return err
	}
	return s.reactions.Remove(ctx, commentID, userID, emoji)
}
