package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Account struct {
	ID                    uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID                uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`
	Provider              string     `gorm:"type:varchar(50);not null" json:"provider"`
	ProviderAccountID     string     `gorm:"column:provider_account_id;type:varchar(255);not null" json:"provider_account_id"`
	AccessToken           string     `gorm:"type:text;not null" json:"-"`
	AccessTokenExpiredAt  *time.Time `gorm:"column:access_token_expired_at" json:"-"`
	RefreshToken          string     `gorm:"type:text" json:"-"`
	RefreshTokenExpiredAt *time.Time `gorm:"column:refresh_token_expired_at" json:"-"`
	IDToken               string     `gorm:"column:id_token;type:text" json:"-"`
	LastConnectedAt       *time.Time `gorm:"column:last_connected_at" json:"last_connected_at"`
	Metadata              JSONMap    `gorm:"type:jsonb;default:'{}'" json:"metadata,omitempty"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
}

func (Account) TableName() string { return "accounts" }

func (a *Account) BeforeCreate(tx *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return nil
}
