package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Importer statuses.
const (
	ImportStatusQueued     = "queued"
	ImportStatusProcessing = "processing"
	ImportStatusCompleted  = "completed"
	ImportStatusPartial    = "completed_with_errors"
	ImportStatusFailed     = "failed"
)

// Importer services.
const (
	ImportServiceCSV = "csv"
)

// ImportRow is one parsed source record to be turned into an issue.
type ImportRow struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Priority    string `json:"priority,omitempty"`
	State       string `json:"state,omitempty"`
}

// ImporterData holds the parsed source rows, persisted in the data JSONB column
// so the async worker can process them without re-reading the upload.
type ImporterData struct {
	Rows []ImportRow `json:"rows,omitempty"`
}

// Importer matches importers: one bulk-import job for a project.
type Importer struct {
	ID             uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Service        string         `gorm:"type:varchar(50);not null" json:"service"`
	Status         string         `gorm:"type:varchar(50);not null;default:queued" json:"status"`
	Metadata       JSONMap        `gorm:"type:jsonb;default:'{}';serializer:json" json:"metadata,omitempty"`
	Config         JSONMap        `gorm:"type:jsonb;default:'{}';serializer:json" json:"config,omitempty"`
	Data           ImporterData   `gorm:"column:data;type:jsonb;serializer:json" json:"-"`
	TotalCount     int            `gorm:"column:total_count;not null;default:0" json:"total_count"`
	ProcessedCount int            `gorm:"column:processed_count;not null;default:0" json:"processed_count"`
	ErrorCount     int            `gorm:"column:error_count;not null;default:0" json:"error_count"`
	ErrorMessage   string         `gorm:"column:error_message;type:text" json:"error_message,omitempty"`
	SourceFilename string         `gorm:"column:source_filename;type:varchar(512)" json:"source_filename,omitempty"`
	ProjectID      *uuid.UUID     `gorm:"type:uuid" json:"project_id,omitempty"`
	WorkspaceID    uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	InitiatedByID  uuid.UUID      `gorm:"column:initiated_by_id;type:uuid;not null" json:"initiated_by_id"`
	TokenID        *uuid.UUID     `gorm:"column:token_id;type:uuid" json:"-"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
	CreatedByID    *uuid.UUID     `gorm:"type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID    *uuid.UUID     `gorm:"type:uuid" json:"updated_by_id,omitempty"`
}

func (Importer) TableName() string { return "importers" }

func (i *Importer) BeforeCreate(tx *gorm.DB) error {
	if i.ID == uuid.Nil {
		i.ID = uuid.New()
	}
	return nil
}
