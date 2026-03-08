package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ApiToken matches api_tokens.
type ApiToken struct {
	ID          uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Label       string     `gorm:"type:varchar(255);not null" json:"label"`
	Description string     `gorm:"type:text" json:"description,omitempty"`
	Token       string     `gorm:"type:varchar(255);not null;uniqueIndex" json:"token"`
	UserID      uuid.UUID  `gorm:"type:uuid;not null" json:"user_id"`
	WorkspaceID *uuid.UUID `gorm:"type:uuid" json:"workspace_id,omitempty"`
	IsActive    bool       `gorm:"column:is_active;default:true" json:"is_active"`
	LastUsed    *time.Time `gorm:"type:timestamptz" json:"last_used,omitempty"`
	ExpiredAt   *time.Time `gorm:"type:timestamptz" json:"expired_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	CreatedByID *uuid.UUID `gorm:"type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID *uuid.UUID `gorm:"type:uuid" json:"updated_by_id,omitempty"`
}

func (ApiToken) TableName() string { return "api_tokens" }

func (a *ApiToken) BeforeCreate(tx *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return nil
}
