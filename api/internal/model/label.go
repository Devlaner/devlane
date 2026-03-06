package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Label matches migration table "labels".
type Label struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name        string         `gorm:"type:varchar(255);not null" json:"name"`
	Description string         `gorm:"type:text" json:"description,omitempty"`
	ProjectID   *uuid.UUID     `gorm:"type:uuid" json:"project_id,omitempty"`
	WorkspaceID uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	ParentID    *uuid.UUID     `gorm:"type:uuid" json:"parent_id,omitempty"`
	Color       string         `gorm:"type:varchar(255)" json:"color,omitempty"`
	SortOrder   float64        `gorm:"column:sort_order;default:65535" json:"sort_order"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (Label) TableName() string { return "labels" }

func (l *Label) BeforeCreate(tx *gorm.DB) error {
	if l.ID == uuid.Nil {
		l.ID = uuid.New()
	}
	return nil
}
