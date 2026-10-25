package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Exporter matches the exporters table: one row per issue-export request, kept
// as the export history. project_ids are recorded inside Filters so we avoid the
// UUID[] column's array-driver quirks.
type Exporter struct {
	ID            uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name          string    `gorm:"type:varchar(255)" json:"name,omitempty"`
	Type          string    `gorm:"type:varchar(50);default:issue_exports" json:"type"`
	Provider      string    `gorm:"type:varchar(50);not null" json:"provider"`
	Status        string    `gorm:"type:varchar(50);not null;default:queued" json:"status"`
	Reason        string    `gorm:"type:text;default:''" json:"reason,omitempty"`
	Filters       JSONMap   `gorm:"type:jsonb;serializer:json" json:"filters,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	WorkspaceID   uuid.UUID `gorm:"type:uuid;not null" json:"workspace_id"`
	InitiatedByID uuid.UUID `gorm:"type:uuid;not null" json:"initiated_by_id"`
}

func (Exporter) TableName() string { return "exporters" }

func (e *Exporter) BeforeCreate(tx *gorm.DB) error {
	if e.ID == uuid.Nil {
		e.ID = uuid.New()
	}
	return nil
}
