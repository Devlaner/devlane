package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// UserRecentVisit matches user_recent_visits.
type UserRecentVisit struct {
	ID               uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	WorkspaceID      uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	ProjectID        *uuid.UUID     `gorm:"type:uuid" json:"project_id,omitempty"`
	UserID           uuid.UUID      `gorm:"type:uuid;not null" json:"user_id"`
	EntityIdentifier *uuid.UUID     `gorm:"type:uuid" json:"entity_identifier,omitempty"`
	EntityName       string         `gorm:"type:varchar(30);default:''" json:"entity_name"`
	LastVisitedAt    time.Time      `gorm:"column:last_visited_at;not null" json:"last_visited_at"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
	CreatedByID      *uuid.UUID     `gorm:"type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID      *uuid.UUID     `gorm:"type:uuid" json:"updated_by_id,omitempty"`
}

func (UserRecentVisit) TableName() string { return "user_recent_visits" }

func (u *UserRecentVisit) BeforeCreate(tx *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}
