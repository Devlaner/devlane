package store

import (
	"context"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// CommentStore handles issue_comments persistence.
type CommentStore struct{ db *gorm.DB }

func NewCommentStore(db *gorm.DB) *CommentStore { return &CommentStore{db: db} }

func (s *CommentStore) Create(ctx context.Context, c *model.IssueComment) error {
	return s.db.WithContext(ctx).Create(c).Error
}

func (s *CommentStore) GetByID(ctx context.Context, id uuid.UUID) (*model.IssueComment, error) {
	var comment model.IssueComment
	err := s.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&comment).Error
	if err != nil {
		return nil, err
	}
	return &comment, nil
}

func (s *CommentStore) ListByIssueID(ctx context.Context, issueID uuid.UUID) ([]model.IssueComment, error) {
	var list []model.IssueComment
	err := s.db.WithContext(ctx).Where("issue_id = ? AND deleted_at IS NULL", issueID).
		Order("created_at ASC").Find(&list).Error
	return list, err
}

// ListByCreatedByID returns comments by the given user, newest first (for activity feed).
func (s *CommentStore) ListByCreatedByID(ctx context.Context, createdByID uuid.UUID, limit int) ([]model.IssueComment, error) {
	if limit <= 0 {
		limit = 50
	}
	var list []model.IssueComment
	err := s.db.WithContext(ctx).
		Where("created_by_id = ? AND deleted_at IS NULL", createdByID).
		Order("created_at DESC").
		Limit(limit).
		Find(&list).Error
	return list, err
}

func (s *CommentStore) Update(ctx context.Context, c *model.IssueComment) error {
	return s.db.WithContext(ctx).Save(c).Error
}

func (s *CommentStore) Delete(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&model.IssueComment{}).Error
}
