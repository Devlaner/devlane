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

// HashToken hashes a plain-text API token for lookup (auth middleware never
// stores or compares the plain value).
func HashToken(plain string) string { return hashToken(plain) }

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

// CreateForWorkspace creates a workspace-scoped service token owned by the
// creating user but tagged with the workspace, and returns the plain secret once.
func (s *ApiTokenStore) CreateForWorkspace(ctx context.Context, userID, workspaceID uuid.UUID, label, description string, expiredAt *time.Time) (plainToken string, err error) {
	plain, err := generateToken()
	if err != nil {
		return "", err
	}
	wid := workspaceID
	t := &model.ApiToken{
		Label:       label,
		Description: description,
		Token:       hashToken(plain),
		UserID:      userID,
		WorkspaceID: &wid,
		IsActive:    true,
		ExpiredAt:   expiredAt,
		CreatedByID: &userID,
	}
	if err := s.db.WithContext(ctx).Create(t).Error; err != nil {
		return "", err
	}
	return plain, nil
}

// ListByWorkspaceID returns a workspace's service tokens (without the secret).
func (s *ApiTokenStore) ListByWorkspaceID(ctx context.Context, workspaceID uuid.UUID) ([]model.ApiToken, error) {
	var list []model.ApiToken
	err := s.db.WithContext(ctx).Where("workspace_id = ?", workspaceID).Order("created_at DESC").Find(&list).Error
	if err != nil {
		return nil, err
	}
	for i := range list {
		list[i].Token = ""
	}
	return list, nil
}

// DeleteByWorkspace revokes a token scoped to a workspace.
func (s *ApiTokenStore) DeleteByWorkspace(ctx context.Context, tokenID, workspaceID uuid.UUID) error {
	res := s.db.WithContext(ctx).Where("id = ? AND workspace_id = ?", tokenID, workspaceID).Delete(&model.ApiToken{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// GetActiveByHash returns the token matching hash if it is active and not
// expired, for use by the auth middleware.
func (s *ApiTokenStore) GetActiveByHash(ctx context.Context, hash string) (*model.ApiToken, error) {
	var t model.ApiToken
	err := s.db.WithContext(ctx).
		Where("token = ? AND is_active = true AND (expired_at IS NULL OR expired_at > ?)", hash, time.Now().UTC()).
		First(&t).Error
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// UpdateLastUsed stamps the token's last_used time.
func (s *ApiTokenStore) UpdateLastUsed(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).Model(&model.ApiToken{}).Where("id = ?", id).Update("last_used", time.Now().UTC()).Error
}
