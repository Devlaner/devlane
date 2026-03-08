package store

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"time"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ApiTokenStore handles api_tokens persistence.
type ApiTokenStore struct{ db *gorm.DB }

func NewApiTokenStore(db *gorm.DB) *ApiTokenStore { return &ApiTokenStore{db: db} }

func generateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func hashToken(plain string) string {
	h := sha256.Sum256([]byte(plain))
	return hex.EncodeToString(h[:])
}

// Create generates a new token, stores its hash, and returns the plain token (caller must show it once).
func (s *ApiTokenStore) Create(ctx context.Context, userID uuid.UUID, label, description string, expiredAt *time.Time) (plainToken string, err error) {
	plain, err := generateToken()
	if err != nil {
		return "", err
	}
	t := &model.ApiToken{
		Label:       label,
		Description: description,
		Token:       hashToken(plain),
		UserID:      userID,
		IsActive:    true,
		ExpiredAt:   expiredAt,
	}
	if err := s.db.WithContext(ctx).Create(t).Error; err != nil {
		return "", err
	}
	return plain, nil
}

// ListByUserID returns all tokens for a user (without the secret).
func (s *ApiTokenStore) ListByUserID(ctx context.Context, userID uuid.UUID) ([]model.ApiToken, error) {
	var list []model.ApiToken
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).Order("created_at DESC").Find(&list).Error
	if err != nil {
		return nil, err
	}
	// Clear token value so it's never sent to client
	for i := range list {
		list[i].Token = ""
	}
	return list, nil
}

// Delete removes a token (revoke). Returns error if not found or not owned by user.
func (s *ApiTokenStore) Delete(ctx context.Context, tokenID, userID uuid.UUID) error {
	res := s.db.WithContext(ctx).Where("id = ? AND user_id = ?", tokenID, userID).Delete(&model.ApiToken{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}
