package store

import (
	"context"
	"errors"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// IssueSubscriberStore handles issue_subscribers persistence.
type IssueSubscriberStore struct{ db *gorm.DB }

func NewIssueSubscriberStore(db *gorm.DB) *IssueSubscriberStore {
	return &IssueSubscriberStore{db: db}
}

// Subscribe is idempotent — re-subscribing an already-subscribed user is a
// no-op. The DB enforces UNIQUE(issue_id, subscriber_id); ON CONFLICT DO NOTHING
// keeps us from raising on duplicates.
func (s *IssueSubscriberStore) Subscribe(ctx context.Context, sub *model.IssueSubscriber) error {
	if sub == nil || sub.IssueID == uuid.Nil || sub.SubscriberID == uuid.Nil {
		return errors.New("subscribe: missing issue or subscriber")
	}
	return s.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "issue_id"}, {Name: "subscriber_id"}},
			DoNothing: true,
		}).
		Create(sub).Error
}

// Unsubscribe hard-deletes the subscriber row. The table has no soft-delete
// column, so this is a true DELETE.
func (s *IssueSubscriberStore) Unsubscribe(ctx context.Context, issueID, subscriberID uuid.UUID) error {
	return s.db.WithContext(ctx).
		Where("issue_id = ? AND subscriber_id = ?", issueID, subscriberID).
		Delete(&model.IssueSubscriber{}).Error
}

// ListByIssue returns the subscriber user IDs for an issue.
func (s *IssueSubscriberStore) ListByIssue(ctx context.Context, issueID uuid.UUID) ([]uuid.UUID, error) {
	var ids []uuid.UUID
	err := s.db.WithContext(ctx).
		Model(&model.IssueSubscriber{}).
		Where("issue_id = ?", issueID).
		Pluck("subscriber_id", &ids).Error
	return ids, err
}

func (s *IssueSubscriberStore) IsSubscribed(ctx context.Context, issueID, subscriberID uuid.UUID) (bool, error) {
	var n int64
	err := s.db.WithContext(ctx).
		Model(&model.IssueSubscriber{}).
		Where("issue_id = ? AND subscriber_id = ?", issueID, subscriberID).
		Count(&n).Error
	return n > 0, err
}
