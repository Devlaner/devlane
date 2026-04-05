package store

import (
	"context"
	"time"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

const resetTokenExpiry = 30 * time.Minute

type PasswordResetTokenStore struct{ db *gorm.DB }

func NewPasswordResetTokenStore(db *gorm.DB) *PasswordResetTokenStore {
	return &PasswordResetTokenStore{db: db}
}

func (s *PasswordResetTokenStore) Create(ctx context.Context, userID uuid.UUID, token string) error {
	s.db.WithContext(ctx).
		Where("user_id = ? AND used_at IS NULL", userID).
		Delete(&model.PasswordResetToken{})

	return s.db.WithContext(ctx).Create(&model.PasswordResetToken{
		UserID:    userID,
		Token:     token,
		ExpiresAt: time.Now().UTC().Add(resetTokenExpiry),
	}).Error
}

func (s *PasswordResetTokenStore) GetValid(ctx context.Context, token string) (*model.PasswordResetToken, error) {
	var t model.PasswordResetToken
	err := s.db.WithContext(ctx).
		Where("token = ? AND used_at IS NULL AND expires_at > ?", token, time.Now().UTC()).
		First(&t).Error
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (s *PasswordResetTokenStore) MarkUsed(ctx context.Context, id uuid.UUID) error {
	now := time.Now().UTC()
	return s.db.WithContext(ctx).
		Model(&model.PasswordResetToken{}).
		Where("id = ?", id).
		Update("used_at", now).Error
}
