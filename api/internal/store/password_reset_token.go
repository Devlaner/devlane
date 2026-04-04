package store

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"time"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

const resetTokenExpireMinutes = 30

type PasswordResetTokenStore struct{ db *gorm.DB }

func NewPasswordResetTokenStore(db *gorm.DB) *PasswordResetTokenStore {
	return &PasswordResetTokenStore{db: db}
}

// Create generates a cryptographically random token, stores it, and returns the plain token.
func (s *PasswordResetTokenStore) Create(ctx context.Context, userID uuid.UUID) (string, error) {
	// Invalidate any existing unused tokens for this user.
	s.db.WithContext(ctx).
		Where("user_id = ? AND used_at IS NULL", userID).
		Delete(&model.PasswordResetToken{})

	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	token := hex.EncodeToString(b)
	rec := &model.PasswordResetToken{
		ID:        uuid.New(),
		UserID:    userID,
		Token:     token,
		ExpiresAt: time.Now().UTC().Add(time.Duration(resetTokenExpireMinutes) * time.Minute),
	}
	if err := s.db.WithContext(ctx).Create(rec).Error; err != nil {
		return "", err
	}
	return token, nil
}

// GetValid returns the token record if it exists, has not expired, and has not been used.
func (s *PasswordResetTokenStore) GetValid(ctx context.Context, token string) (*model.PasswordResetToken, error) {
	var rec model.PasswordResetToken
	err := s.db.WithContext(ctx).
		Where("token = ? AND expires_at > ? AND used_at IS NULL", token, time.Now().UTC()).
		First(&rec).Error
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

// MarkUsed sets used_at so the token cannot be reused.
func (s *PasswordResetTokenStore) MarkUsed(ctx context.Context, id uuid.UUID) error {
	now := time.Now().UTC()
	return s.db.WithContext(ctx).
		Model(&model.PasswordResetToken{}).
		Where("id = ?", id).
		Update("used_at", now).Error
}
