package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Webhook matches webhooks.
type Webhook struct {
	ID          uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	URL         string     `gorm:"type:text;not null" json:"url"`
	SecretKey   string     `gorm:"type:varchar(255)" json:"secret_key,omitempty"`
	IsActive    bool       `gorm:"column:is_active;default:true" json:"is_active"`
	WorkspaceID uuid.UUID  `gorm:"type:uuid;not null" json:"workspace_id"`
	ProjectID   *uuid.UUID `gorm:"type:uuid" json:"project_id,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	CreatedByID *uuid.UUID `gorm:"type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID *uuid.UUID `gorm:"type:uuid" json:"updated_by_id,omitempty"`
}

func (Webhook) TableName() string { return "webhooks" }

func (w *Webhook) BeforeCreate(tx *gorm.DB) error {
	if w.ID == uuid.Nil {
		w.ID = uuid.New()
	}
	return nil
}
