package store

import (
	"context"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// CommentReactionStore handles comment_reactions persistence.
type CommentReactionStore struct{ db *gorm.DB }

func NewCommentReactionStore(db *gorm.DB) *CommentReactionStore {
	return &CommentReactionStore{db: db}
}

// ListByCommentID returns all reactions for a single comment.
func (s *CommentReactionStore) ListByCommentID(ctx context.Context, commentID uuid.UUID) ([]model.CommentReaction, error) {
	var list []model.CommentReaction
	err := s.db.WithContext(ctx).
		Where("comment_id = ?", commentID).
		Order("created_at ASC").
		Find(&list).Error
	return list, err
}

// ListByCommentIDs returns reactions for many comments at once (used to hydrate
// the comments thread in a single query).
func (s *CommentReactionStore) ListByCommentIDs(ctx context.Context, commentIDs []uuid.UUID) ([]model.CommentReaction, error) {
	if len(commentIDs) == 0 {
		return nil, nil
	}
	var list []model.CommentReaction
	err := s.db.WithContext(ctx).
		Where("comment_id IN ?", commentIDs).
		Order("created_at ASC").
		Find(&list).Error
	return list, err
}

// Add inserts a reaction (no-op on conflict due to the unique index).
func (s *CommentReactionStore) Add(ctx context.Context, r *model.CommentReaction) error {
	return s.db.WithContext(ctx).Create(r).Error
}

// Remove deletes one user's reaction.
func (s *CommentReactionStore) Remove(ctx context.Context, commentID, actorID uuid.UUID, reaction string) error {
	return s.db.WithContext(ctx).
		Where("comment_id = ? AND actor_id = ? AND reaction = ?", commentID, actorID, reaction).
		Delete(&model.CommentReaction{}).Error
}
