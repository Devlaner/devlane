package store

import (
	"context"
	"errors"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// EmailChangeRequestStore persists pending email-change verifications.
type EmailChangeRequestStore struct{ db *gorm.DB }

func NewEmailChangeRequestStore(db *gorm.DB) *EmailChangeRequestStore {
	return &EmailChangeRequestStore{db: db}
}

// GetByUserID returns the user's pending email change, or nil when none exists.
func (s *EmailChangeRequestStore) GetByUserID(ctx context.Context, userID uuid.UUID) (*model.EmailChangeRequest, error) {
	var r model.EmailChangeRequest
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).First(&r).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &r, nil
}

// Upsert stores the user's pending email change, replacing any earlier one so
// only the most recent request is ever valid. It is a single atomic upsert on
// the user_id unique key, so concurrent requests for the same user can't race
// into a unique-constraint error.
func (s *EmailChangeRequestStore) Upsert(ctx context.Context, r *model.EmailChangeRequest) error {
	r.Attempts = 0
	return s.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"new_email", "code_hash", "attempts", "expires_at", "updated_at"}),
		}).
		Create(r).Error
}

// IncrementAttempts atomically bumps the failed-attempt counter and returns the
// new value, so callers can invalidate a code after too many wrong guesses.
func (s *EmailChangeRequestStore) IncrementAttempts(ctx context.Context, userID uuid.UUID) (int, error) {
	if err := s.db.WithContext(ctx).
		Model(&model.EmailChangeRequest{}).
		Where("user_id = ?", userID).
		UpdateColumn("attempts", gorm.Expr("attempts + 1")).Error; err != nil {
		return 0, err
	}
	r, err := s.GetByUserID(ctx, userID)
	if err != nil || r == nil {
		return 0, err
	}
	return r.Attempts, nil
}

// DeleteByUserID removes the user's pending email change.
func (s *EmailChangeRequestStore) DeleteByUserID(ctx context.Context, userID uuid.UUID) error {
	return s.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Delete(&model.EmailChangeRequest{}).Error
}
