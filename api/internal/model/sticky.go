package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Sticky matches stickies table.
type Sticky struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name        string         `gorm:"type:varchar(255);not null" json:"name"`
	Color       string         `gorm:"type:varchar(50);default:#0d0d0d" json:"color"`
	Description string         `gorm:"type:text" json:"description,omitempty"`
	SortOrder   float64        `gorm:"column:sort_order;default:65535" json:"sort_order"`
	WorkspaceID uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	OwnerID     uuid.UUID      `gorm:"type:uuid;not null" json:"owner_id"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	CreatedByID *uuid.UUID     `gorm:"type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID *uuid.UUID     `gorm:"type:uuid" json:"updated_by_id,omitempty"`
}

func (Sticky) TableName() string { return "stickies" }

func (s *Sticky) BeforeCreate(tx *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return nil
}
