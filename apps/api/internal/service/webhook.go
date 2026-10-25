package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/queue"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrWebhookNotFound  = errors.New("webhook not found")
	ErrWebhookBadURL    = errors.New("webhook url must be a public http(s) URL")
	ErrWebhookWorkspace = errors.New("workspace not found")
	ErrWebhookForbidden = errors.New("only workspace admins can manage webhooks")
)

// WebhookInput carries the mutable fields of a webhook.
type WebhookInput struct {
	URL          string
	IsActive     *bool
	Project      *bool
	Issue        *bool
	Module       *bool
	Cycle        *bool
	IssueComment *bool
}

// WebhookService manages outbound webhooks and dispatches events to them.
type WebhookService struct {
	webhooks *store.WebhookStore
	ws       *store.WorkspaceStore
	queue    *queue.Publisher // optional; when nil, dispatch is a no-op
}

func NewWebhookService(webhooks *store.WebhookStore, ws *store.WorkspaceStore, q *queue.Publisher) *WebhookService {
	return &WebhookService{webhooks: webhooks, ws: ws, queue: q}
}

// requireAdmin resolves the workspace and confirms the caller is an admin/owner.
func (s *WebhookService) requireAdmin(ctx context.Context, slug string, userID uuid.UUID) (*model.Workspace, error) {
	wrk, err := s.ws.GetBySlug(ctx, slug)
	if err != nil {
		return nil, ErrWebhookWorkspace
	}
	m, err := s.ws.GetMember(ctx, wrk.ID, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrWebhookForbidden // not a member
		}
		return nil, err
	}
	if m == nil || m.Role < model.RoleAdmin {
		return nil, ErrWebhookForbidden
	}
	return wrk, nil
}

func (s *WebhookService) List(ctx context.Context, slug string, userID uuid.UUID) ([]model.Webhook, error) {
	wrk, err := s.requireAdmin(ctx, slug, userID)
	if err != nil {
		return nil, err
	}
	return s.webhooks.ListByWorkspace(ctx, wrk.ID)
}

func (s *WebhookService) Create(ctx context.Context, slug string, userID uuid.UUID, in WebhookInput) (*model.Webhook, error) {
	wrk, err := s.requireAdmin(ctx, slug, userID)
	if err != nil {
		return nil, err
	}
	if !validWebhookURL(in.URL) {
		return nil, ErrWebhookBadURL
	}
	secret, err := randomSecret()
	if err != nil {
		return nil, err
	}
	w := &model.Webhook{
		URL:          strings.TrimSpace(in.URL),
		SecretKey:    secret,
		IsActive:     boolOr(in.IsActive, true),
		Project:      boolOr(in.Project, false),
		Issue:        boolOr(in.Issue, true),
		Module:       boolOr(in.Module, false),
		Cycle:        boolOr(in.Cycle, false),
		IssueComment: boolOr(in.IssueComment, false),
		Version:      "v1",
		WorkspaceID:  wrk.ID,
		CreatedByID:  &userID,
		UpdatedByID:  &userID,
	}
	if err := s.webhooks.Create(ctx, w); err != nil {
		return nil, err
	}
	return w, nil
}

func (s *WebhookService) Update(ctx context.Context, slug string, userID, id uuid.UUID, in WebhookInput) (*model.Webhook, error) {
	wrk, err := s.requireAdmin(ctx, slug, userID)
	if err != nil {
		return nil, err
	}
	w, err := s.webhooks.GetByID(ctx, wrk.ID, id)
	if err != nil {
		return nil, err
	}
	if w == nil {
		return nil, ErrWebhookNotFound
	}
	if strings.TrimSpace(in.URL) != "" {
		if !validWebhookURL(in.URL) {
			return nil, ErrWebhookBadURL
		}
		w.URL = strings.TrimSpace(in.URL)
	}
	if in.IsActive != nil {
		w.IsActive = *in.IsActive
	}
	if in.Project != nil {
		w.Project = *in.Project
	}
	if in.Issue != nil {
		w.Issue = *in.Issue
	}
	if in.Module != nil {
		w.Module = *in.Module
	}
	if in.Cycle != nil {
		w.Cycle = *in.Cycle
	}
	if in.IssueComment != nil {
		w.IssueComment = *in.IssueComment
	}
	w.UpdatedByID = &userID
	if err := s.webhooks.Update(ctx, w); err != nil {
		return nil, err
	}
	return w, nil
}

func (s *WebhookService) Delete(ctx context.Context, slug string, userID, id uuid.UUID) error {
	wrk, err := s.requireAdmin(ctx, slug, userID)
	if err != nil {
		return err
	}
	w, err := s.webhooks.GetByID(ctx, wrk.ID, id)
	if err != nil {
		return err
	}
	if w == nil {
		return ErrWebhookNotFound
	}
	return s.webhooks.Delete(ctx, wrk.ID, id)
}

// ListLogs returns recent delivery logs for a webhook the caller can manage.
func (s *WebhookService) ListLogs(ctx context.Context, slug string, userID, id uuid.UUID) ([]model.WebhookLog, error) {
	wrk, err := s.requireAdmin(ctx, slug, userID)
	if err != nil {
		return nil, err
	}
	w, err := s.webhooks.GetByID(ctx, wrk.ID, id)
	if err != nil {
		return nil, err
	}
	if w == nil {
		return nil, ErrWebhookNotFound
	}
	return s.webhooks.ListLogs(ctx, id, 50)
}

// Dispatch enqueues an event to every active webhook in the workspace that
// subscribes to it. Best-effort: a nil queue or lookup error just skips
// delivery without failing the caller's action.
func (s *WebhookService) Dispatch(ctx context.Context, workspaceID uuid.UUID, event string, payload map[string]interface{}) {
	if s == nil || s.queue == nil || !store.IsValidWebhookEvent(event) {
		return
	}
	hooks, err := s.webhooks.ListActiveByWorkspaceAndEvent(ctx, workspaceID, event)
	if err != nil {
		return
	}
	for i := range hooks {
		_ = s.queue.PublishWebhook(ctx, queue.WebhookPayload{
			WebhookID:   hooks[i].ID.String(),
			WorkspaceID: workspaceID.String(),
			URL:         hooks[i].URL,
			Secret:      hooks[i].SecretKey,
			Event:       event,
			Payload:     payload,
		})
	}
}

func boolOr(p *bool, def bool) bool {
	if p != nil {
		return *p
	}
	return def
}

func randomSecret() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
