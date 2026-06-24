package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// InstanceAdmin matches the instance_admins table — the set of users authorized
// to manage instance-level settings. Devlane is single-instance, so the row keys
// on user_id only (no instance FK). Role uses the shared Role* levels; the gate
// allows role >= RoleAdmin.
type InstanceAdmin struct {
	ID         uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID     uuid.UUID      `gorm:"type:uuid;not null" json:"user_id"`
	Role       int16          `gorm:"not null;default:20" json:"role"`
	IsVerified bool           `gorm:"column:is_verified;default:false" json:"is_verified"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`

	// Read-only join fields for list responses (populated via SELECT, not stored).
	UserEmail       *string `gorm:"->" json:"user_email,omitempty"`
	UserDisplayName string  `gorm:"->" json:"user_display_name,omitempty"`
}

func (InstanceAdmin) TableName() string { return "instance_admins" }

func (a *InstanceAdmin) BeforeCreate(tx *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return nil
}
