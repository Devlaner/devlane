package store

import (
	"context"
	"errors"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// WebhookStore handles outbound webhook + delivery-log persistence.
type WebhookStore struct{ db *gorm.DB }

func NewWebhookStore(db *gorm.DB) *WebhookStore { return &WebhookStore{db: db} }

// webhookEventColumns are the per-event boolean columns; keeping this whitelist
// here keeps the dynamic column name in ListActiveByWorkspaceAndEvent safe.
var webhookEventColumns = map[string]string{
	"project":       "project",
	"issue":         "issue",
	"module":        "module",
	"cycle":         "cycle",
	"issue_comment": "issue_comment",
}

// IsValidWebhookEvent reports whether event is a known webhook event type.
func IsValidWebhookEvent(event string) bool {
	_, ok := webhookEventColumns[event]
	return ok
}

func (s *WebhookStore) Create(ctx context.Context, w *model.Webhook) error {
	return s.db.WithContext(ctx).Create(w).Error
}

func (s *WebhookStore) ListByWorkspace(ctx context.Context, workspaceID uuid.UUID) ([]model.Webhook, error) {
	var list []model.Webhook
	err := s.db.WithContext(ctx).
		Where("workspace_id = ? AND deleted_at IS NULL", workspaceID).
		Order("created_at DESC").Find(&list).Error
	return list, err
}

// GetByID returns a webhook by id in the workspace, or nil when absent.
func (s *WebhookStore) GetByID(ctx context.Context, workspaceID, id uuid.UUID) (*model.Webhook, error) {
	var w model.Webhook
	err := s.db.WithContext(ctx).
		Where("id = ? AND workspace_id = ? AND deleted_at IS NULL", id, workspaceID).
		First(&w).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &w, nil
}

func (s *WebhookStore) Update(ctx context.Context, w *model.Webhook) error {
	return s.db.WithContext(ctx).Save(w).Error
}

func (s *WebhookStore) Delete(ctx context.Context, workspaceID, id uuid.UUID) error {
	return s.db.WithContext(ctx).
		Where("id = ? AND workspace_id = ?", id, workspaceID).
		Delete(&model.Webhook{}).Error
}

// ListActiveByWorkspaceAndEvent returns the workspace's active webhooks that
// subscribe to the given event type.
func (s *WebhookStore) ListActiveByWorkspaceAndEvent(ctx context.Context, workspaceID uuid.UUID, event string) ([]model.Webhook, error) {
	col, ok := webhookEventColumns[event]
	if !ok {
		return nil, nil
	}
	var list []model.Webhook
	err := s.db.WithContext(ctx).
		Where("workspace_id = ? AND deleted_at IS NULL AND is_active = TRUE AND "+col+" = TRUE", workspaceID).
		Find(&list).Error
	return list, err
}

// CreateLog records one delivery attempt.
func (s *WebhookStore) CreateLog(ctx context.Context, l *model.WebhookLog) error {
	return s.db.WithContext(ctx).Create(l).Error
}

// ListLogs returns recent delivery logs for a webhook, newest first.
func (s *WebhookStore) ListLogs(ctx context.Context, webhookID uuid.UUID, limit int) ([]model.WebhookLog, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	var list []model.WebhookLog
	err := s.db.WithContext(ctx).
		Where("webhook_id = ?", webhookID).
		Order("created_at DESC").Limit(limit).Find(&list).Error
	return list, err
}
