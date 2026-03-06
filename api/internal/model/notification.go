package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Notification matches notifications.
type Notification struct {
	ID               uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Title            string     `gorm:"type:text;not null" json:"title"`
	Message          JSONMap    `gorm:"type:jsonb;serializer:json" json:"message,omitempty"`
	ReceiverID       uuid.UUID  `gorm:"type:uuid;not null" json:"receiver_id"`
	WorkspaceID      uuid.UUID  `gorm:"type:uuid;not null" json:"workspace_id"`
	ProjectID        *uuid.UUID `gorm:"type:uuid" json:"project_id,omitempty"`
	TriggeredByID    *uuid.UUID `gorm:"type:uuid" json:"triggered_by_id,omitempty"`
	EntityIdentifier *uuid.UUID `gorm:"type:uuid" json:"entity_identifier,omitempty"`
	EntityName       string     `gorm:"type:varchar(255)" json:"entity_name,omitempty"`
	ReadAt           *time.Time `gorm:"type:timestamptz" json:"read_at,omitempty"`
	ArchivedAt       *time.Time `gorm:"type:timestamptz" json:"archived_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

func (Notification) TableName() string { return "notifications" }

func (n *Notification) BeforeCreate(tx *gorm.DB) error {
	if n == nil {
		return nil
	}
	if n.ID == uuid.Nil {
		n.ID = uuid.New()
	}
	return nil
}
