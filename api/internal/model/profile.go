package model

import (
	"time"

	"github.com/google/uuid"
)

// Profile matches profiles.
type Profile struct {
	ID              uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID          uuid.UUID  `gorm:"type:uuid;not null;uniqueIndex" json:"user_id"`
	Role            string     `gorm:"type:varchar(300)" json:"role,omitempty"`
	LastWorkspaceID *uuid.UUID `gorm:"type:uuid" json:"last_workspace_id,omitempty"`
	Language        string     `gorm:"type:varchar(255);default:en" json:"language"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

func (Profile) TableName() string { return "profiles" }
