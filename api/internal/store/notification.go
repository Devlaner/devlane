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

// ListOpts controls notification list filtering.
//
// Archived: nil means hide archived (default Inbox view); &false same as nil; &true shows
// only archived rows (the dedicated Archived tab).
//
// IncludeArchived overrides Archived — when true, both archived and active rows are returned.
//
// IncludeSnoozed, when false (default), hides rows whose snoozed_till is still in
// the future. The Archived tab passes true so users can manage snoozed-then-archived
// items there.
type ListOpts struct {
	UnreadOnly      bool
	MentionsOnly    bool
	Archived        *bool
	IncludeArchived bool
	IncludeSnoozed  bool
}

// Create inserts a single notification.
func (s *NotificationStore) Create(ctx context.Context, n *model.Notification) error {
	return s.db.WithContext(ctx).Create(n).Error
}

// CreateMany inserts a slice of notifications in one statement. No-op on empty input.
func (s *NotificationStore) CreateMany(ctx context.Context, ns []model.Notification) error {
	if len(ns) == 0 {
		return nil
	}
	return s.db.WithContext(ctx).Create(&ns).Error
}

func (s *NotificationStore) ListByReceiverID(ctx context.Context, receiverID uuid.UUID, workspaceID *uuid.UUID, opts ListOpts) ([]model.Notification, error) {
	var list []model.Notification
	q := s.db.WithContext(ctx).Where("receiver_id = ?", receiverID)
	if workspaceID != nil {
		q = q.Where("workspace_id = ?", *workspaceID)
	}
	if opts.UnreadOnly {
		q = q.Where("read_at IS NULL")
	}
	if opts.MentionsOnly {
		q = q.Where("sender = ?", model.NotificationSenderMentioned)
	}
	if !opts.IncludeArchived {
		switch {
		case opts.Archived == nil:
			q = q.Where("archived_at IS NULL")
		case *opts.Archived:
			q = q.Where("archived_at IS NOT NULL")
		default:
			q = q.Where("archived_at IS NULL")
		}
	}
	if !opts.IncludeSnoozed {
		q = q.Where("(snoozed_till IS NULL OR snoozed_till <= ?)", time.Now())
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

func (s *NotificationStore) MarkUnread(ctx context.Context, id uuid.UUID, receiverID uuid.UUID) error {
	return s.db.WithContext(ctx).Model(&model.Notification{}).
		Where("id = ? AND receiver_id = ?", id, receiverID).
		Update("read_at", nil).Error
}

// MarkAllRead marks every unread notification in the receiver's active inbox
// as read. "Active" mirrors List/CountUnread: not archived, not still-snoozed.
// Otherwise the user clears notifications they never saw, and snoozed rows
// would re-emerge already-read after the snooze expires.
func (s *NotificationStore) MarkAllRead(ctx context.Context, receiverID uuid.UUID, workspaceID *uuid.UUID) error {
	now := time.Now()
	q := s.db.WithContext(ctx).Model(&model.Notification{}).
		Where("receiver_id = ? AND read_at IS NULL AND archived_at IS NULL AND (snoozed_till IS NULL OR snoozed_till <= ?)",
			receiverID, now)
	if workspaceID != nil {
		q = q.Where("workspace_id = ?", *workspaceID)
	}
	return q.Update("read_at", now).Error
}

// CountUnread returns (total, mentions) — both counts cover the active inbox
// (not archived, not still-snoozed).
//
// Postgres path uses a single query with FILTER. Other dialects (sqlite in
// tests) fall back to two queries — FILTER is Postgres-specific.
func (s *NotificationStore) CountUnread(ctx context.Context, receiverID uuid.UUID, workspaceID *uuid.UUID) (total, mentions int64, err error) {
	now := time.Now()
	if s.db.Dialector.Name() == "postgres" {
		type row struct {
			Total    int64
			Mentions int64
		}
		var r row
		q := s.db.WithContext(ctx).
			Table("notifications").
			Select("COUNT(*) AS total, COUNT(*) FILTER (WHERE sender = ?) AS mentions", model.NotificationSenderMentioned).
			Where("receiver_id = ? AND read_at IS NULL AND archived_at IS NULL AND (snoozed_till IS NULL OR snoozed_till <= ?)",
				receiverID, now)
		if workspaceID != nil {
			q = q.Where("workspace_id = ?", *workspaceID)
		}
		if err = q.Scan(&r).Error; err != nil {
			return 0, 0, err
		}
		return r.Total, r.Mentions, nil
	}
	// Portable fallback: two COUNT(*) queries.
	base := s.db.WithContext(ctx).Model(&model.Notification{}).
		Where("receiver_id = ? AND read_at IS NULL AND archived_at IS NULL AND (snoozed_till IS NULL OR snoozed_till <= ?)",
			receiverID, now)
	if workspaceID != nil {
		base = base.Where("workspace_id = ?", *workspaceID)
	}
	if err = base.Count(&total).Error; err != nil {
		return 0, 0, err
	}
	if err = base.Where("sender = ?", model.NotificationSenderMentioned).Count(&mentions).Error; err != nil {
		return 0, 0, err
	}
	return total, mentions, nil
}

// Snooze hides a notification from the active inbox until `until`.
func (s *NotificationStore) Snooze(ctx context.Context, id, receiverID uuid.UUID, until time.Time) error {
	return s.db.WithContext(ctx).Model(&model.Notification{}).
		Where("id = ? AND receiver_id = ?", id, receiverID).
		Update("snoozed_till", until).Error
}

// Unsnooze clears the snoozed_till timestamp.
func (s *NotificationStore) Unsnooze(ctx context.Context, id, receiverID uuid.UUID) error {
	return s.db.WithContext(ctx).Model(&model.Notification{}).
		Where("id = ? AND receiver_id = ?", id, receiverID).
		Update("snoozed_till", nil).Error
}

// Archive flags a notification as archived for the receiver.
func (s *NotificationStore) Archive(ctx context.Context, id, receiverID uuid.UUID) error {
	now := time.Now()
	return s.db.WithContext(ctx).Model(&model.Notification{}).
		Where("id = ? AND receiver_id = ?", id, receiverID).
		Update("archived_at", now).Error
}

// Unarchive clears archived_at.
func (s *NotificationStore) Unarchive(ctx context.Context, id, receiverID uuid.UUID) error {
	return s.db.WithContext(ctx).Model(&model.Notification{}).
		Where("id = ? AND receiver_id = ?", id, receiverID).
		Update("archived_at", nil).Error
}

// DeleteByEntity hard-deletes every notification referencing entityID.
// Used to garbage-collect rows when the underlying issue is deleted, so users
// don't click an Inbox row that lands on a 404.
func (s *NotificationStore) DeleteByEntity(ctx context.Context, entityID uuid.UUID) error {
	return s.db.WithContext(ctx).
		Where("entity_identifier = ?", entityID).
		Delete(&model.Notification{}).Error
}
