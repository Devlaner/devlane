package store

import (
	"context"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type AccountStore struct{ db *gorm.DB }

func NewAccountStore(db *gorm.DB) *AccountStore {
	return &AccountStore{db: db}
}

func (s *AccountStore) Upsert(ctx context.Context, a *model.Account) error {
	return s.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "provider"}, {Name: "provider_account_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"access_token", "access_token_expired_at", "refresh_token", "refresh_token_expired_at", "id_token", "last_connected_at", "updated_at"}),
		}).
		Create(a).Error
}

func (s *AccountStore) GetByProvider(ctx context.Context, userID uuid.UUID, provider string) (*model.Account, error) {
	var a model.Account
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND provider = ?", userID, provider).
		First(&a).Error
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (s *AccountStore) ListByUser(ctx context.Context, userID uuid.UUID) ([]model.Account, error) {
	var accounts []model.Account
	err := s.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at").
		Find(&accounts).Error
	return accounts, err
}

func (s *AccountStore) FindByProviderID(ctx context.Context, provider, providerAccountID string) (*model.Account, error) {
	var a model.Account
	err := s.db.WithContext(ctx).
		Where("provider = ? AND provider_account_id = ?", provider, providerAccountID).
		First(&a).Error
	if err != nil {
		return nil, err
	}
	return &a, nil
}
