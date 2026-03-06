package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// WorkspaceUserLink matches workspace_user_links (quick links).
type WorkspaceUserLink struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Title       string         `gorm:"type:varchar(255)" json:"title,omitempty"`
	URL         string         `gorm:"type:text;not null" json:"url"`
	Metadata    JSONMap        `gorm:"type:jsonb;default:{};serializer:json" json:"metadata,omitempty"`
	OwnerID     uuid.UUID      `gorm:"type:uuid;not null" json:"owner_id"`
	WorkspaceID uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	ProjectID   *uuid.UUID     `gorm:"type:uuid" json:"project_id,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	CreatedByID *uuid.UUID     `gorm:"type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID *uuid.UUID     `gorm:"type:uuid" json:"updated_by_id,omitempty"`
}

func (WorkspaceUserLink) TableName() string { return "workspace_user_links" }

func (w *WorkspaceUserLink) BeforeCreate(tx *gorm.DB) error {
	if w.ID == uuid.Nil {
		w.ID = uuid.New()
	}
	return nil
}
