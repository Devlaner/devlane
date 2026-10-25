package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// EmailChangeRequest is a pending, unverified email change for a user. There is
// at most one per user; requesting again replaces the previous one. The
// verification code is stored hashed and the row expires at ExpiresAt.
type EmailChangeRequest struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID    uuid.UUID `gorm:"type:uuid;not null;uniqueIndex" json:"user_id"`
	NewEmail  string    `gorm:"column:new_email;type:varchar(255);not null" json:"new_email"`
	CodeHash  string    `gorm:"column:code_hash;type:varchar(255);not null" json:"-"`
	Attempts  int       `gorm:"column:attempts;not null;default:0" json:"-"`
	ExpiresAt time.Time `gorm:"column:expires_at;not null" json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (EmailChangeRequest) TableName() string { return "email_change_requests" }

func (r *EmailChangeRequest) BeforeCreate(tx *gorm.DB) error {
	if r.ID == uuid.Nil {
		r.ID = uuid.New()
	}
	return nil
}
