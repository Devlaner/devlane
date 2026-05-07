package service

import (
	"context"
	"errors"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/Devlaner/devlane/api/internal/text"
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
	notify    *NotificationService        // optional — set via SetNotificationService
	subs      *store.IssueSubscriberStore // optional — auto-subscribe commenter & mentions
}

func NewCommentService(cs *store.CommentStore, is *store.IssueStore, ps *store.ProjectStore, ws *store.WorkspaceStore) *CommentService {
	return &CommentService{cs: cs, is: is, ps: ps, ws: ws}
}

// SetReactionStore wires per-comment reactions support. Optional.
func (s *CommentService) SetReactionStore(r *store.CommentReactionStore) { s.reactions = r }

// SetNotificationService injects the notification fan-out service. Optional —
// when nil, comments do not emit notifications.
func (s *CommentService) SetNotificationService(n *NotificationService) { s.notify = n }

// SetSubscriberStore injects the issue-subscriber store so commenters and
// mention targets are auto-subscribed when a comment is posted. Optional.
func (s *CommentService) SetSubscriberStore(subs *store.IssueSubscriberStore) { s.subs = subs }

func (s *CommentService) autoSubscribe(ctx context.Context, issue *model.Issue, userIDs []uuid.UUID) {
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
	mentioned := text.ParseMentionUserIDs(comment)
	// Auto-subscribe the commenter and any mentioned users so they pick up
	// future activity on the issue.
	subscribers := append([]uuid.UUID{userID}, mentioned...)
	s.autoSubscribe(ctx, issue, subscribers)
	if s.notify != nil {
		s.notify.IssueCommented(ctx, issue, userID, comment, mentioned)
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
