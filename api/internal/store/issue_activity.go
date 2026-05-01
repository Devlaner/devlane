package store

import (
	"context"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// IssueActivityStore handles issue_activities persistence.
type IssueActivityStore struct{ db *gorm.DB }

func NewIssueActivityStore(db *gorm.DB) *IssueActivityStore { return &IssueActivityStore{db: db} }

func (s *IssueActivityStore) Create(ctx context.Context, a *model.IssueActivity) error {
	return s.db.WithContext(ctx).Create(a).Error
}

// ListByIssueID returns activities for an issue ordered chronologically.
func (s *IssueActivityStore) ListByIssueID(ctx context.Context, issueID uuid.UUID) ([]model.IssueActivity, error) {
	var list []model.IssueActivity
	err := s.db.WithContext(ctx).
		Where("issue_id = ? AND deleted_at IS NULL", issueID).
		Order("created_at ASC").
		Find(&list).Error
	return list, err
}
