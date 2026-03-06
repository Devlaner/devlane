package store

import (
	"context"
	"time"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// NotificationStore handles notification persistence.
type NotificationStore struct{ db *gorm.DB }

func NewNotificationStore(db *gorm.DB) *NotificationStore { return &NotificationStore{db: db} }

func (s *NotificationStore) ListByReceiverID(ctx context.Context, receiverID uuid.UUID, workspaceID *uuid.UUID, unreadOnly bool) ([]model.Notification, error) {
	var list []model.Notification
	q := s.db.WithContext(ctx).Where("receiver_id = ?", receiverID)
	if workspaceID != nil {
		q = q.Where("workspace_id = ?", *workspaceID)
	}
	if unreadOnly {
		q = q.Where("read_at IS NULL")
	}
	err := q.Order("created_at DESC").Limit(100).Find(&list).Error
	return list, err
}

func (s *NotificationStore) GetByID(ctx context.Context, id uuid.UUID) (*model.Notification, error) {
	var n model.Notification
	err := s.db.WithContext(ctx).Where("id = ?", id).First(&n).Error
	if err != nil {
		return nil, err
	}
	return &n, nil
}

func (s *NotificationStore) MarkRead(ctx context.Context, id uuid.UUID, receiverID uuid.UUID) error {
	now := time.Now()
	return s.db.WithContext(ctx).Model(&model.Notification{}).
		Where("id = ? AND receiver_id = ?", id, receiverID).
		Update("read_at", now).Error
}

func (s *NotificationStore) MarkAllRead(ctx context.Context, receiverID uuid.UUID, workspaceID *uuid.UUID) error {
	now := time.Now()
	q := s.db.WithContext(ctx).Model(&model.Notification{}).Where("receiver_id = ? AND read_at IS NULL", receiverID)
	if workspaceID != nil {
		q = q.Where("workspace_id = ?", *workspaceID)
	}
	return q.Update("read_at", now).Error
}
