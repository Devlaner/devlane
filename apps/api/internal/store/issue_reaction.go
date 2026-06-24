package store

import (
	"context"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// IssueReactionStore handles issue_reactions persistence.
type IssueReactionStore struct{ db *gorm.DB }

func NewIssueReactionStore(db *gorm.DB) *IssueReactionStore {
	return &IssueReactionStore{db: db}
}

// ListByIssueID returns all reactions for a single issue.
func (s *IssueReactionStore) ListByIssueID(ctx context.Context, issueID uuid.UUID) ([]model.IssueReaction, error) {
	var list []model.IssueReaction
	err := s.db.WithContext(ctx).
		Where("issue_id = ?", issueID).
		Order("created_at ASC").
		Find(&list).Error
	return list, err
}

// ListByIssueIDs returns reactions for many issues at once.
func (s *IssueReactionStore) ListByIssueIDs(ctx context.Context, issueIDs []uuid.UUID) ([]model.IssueReaction, error) {
	if len(issueIDs) == 0 {
		return nil, nil
	}
	var list []model.IssueReaction
	err := s.db.WithContext(ctx).
		Where("issue_id IN ?", issueIDs).
		Order("created_at ASC").
		Find(&list).Error
	return list, err
}

// Add inserts a reaction (the unique index rejects duplicates).
func (s *IssueReactionStore) Add(ctx context.Context, r *model.IssueReaction) error {
	return s.db.WithContext(ctx).Create(r).Error
}

// Remove deletes one user's reaction.
func (s *IssueReactionStore) Remove(ctx context.Context, issueID, actorID uuid.UUID, reaction string) error {
	return s.db.WithContext(ctx).
		Where("issue_id = ? AND actor_id = ? AND reaction = ?", issueID, actorID, reaction).
		Delete(&model.IssueReaction{}).Error
}
