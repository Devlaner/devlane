package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Intake matches intakes.
type Intake struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name        string         `gorm:"type:varchar(255);not null" json:"name"`
	Description string         `gorm:"type:text" json:"description,omitempty"`
	IsDefault   bool           `gorm:"column:is_default;default:false" json:"is_default"`
	ProjectID   uuid.UUID      `gorm:"type:uuid;not null" json:"project_id"`
	WorkspaceID uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	CreatedByID *uuid.UUID     `gorm:"type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID *uuid.UUID     `gorm:"type:uuid" json:"updated_by_id,omitempty"`
}

func (Intake) TableName() string { return "intakes" }

func (i *Intake) BeforeCreate(tx *gorm.DB) error {
	if i.ID == uuid.Nil {
		i.ID = uuid.New()
	}
	return nil
}

// IntakeIssue triage status values (match the intake_issues.status column,
// which defaults to -2). These mirror the standard intake lifecycle.
const (
	IntakeStatusPending   = -2
	IntakeStatusDeclined  = -1
	IntakeStatusSnoozed   = 0
	IntakeStatusAccepted  = 1
	IntakeStatusDuplicate = 2
)

// IntakeIssue matches intake_issues.
type IntakeIssue struct {
	ID             uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	IntakeID       uuid.UUID      `gorm:"type:uuid;not null" json:"intake_id"`
	IssueID        uuid.UUID      `gorm:"type:uuid;not null" json:"issue_id"`
	Status         int            `gorm:"default:-2" json:"status"`
	SnoozedTill    *time.Time     `gorm:"column:snoozed_till" json:"snoozed_till,omitempty"`
	DuplicateToID  *uuid.UUID     `gorm:"column:duplicate_to_id;type:uuid" json:"duplicate_to_id,omitempty"`
	Source         string         `gorm:"column:source;type:varchar(255);default:IN_APP" json:"source"`
	SourceEmail    string         `gorm:"column:source_email;type:text" json:"source_email,omitempty"`
	ExternalSource string         `gorm:"column:external_source;type:varchar(255)" json:"external_source,omitempty"`
	ExternalID     string         `gorm:"column:external_id;type:varchar(255)" json:"external_id,omitempty"`
	Extra          JSONMap        `gorm:"column:extra;type:jsonb;serializer:json" json:"extra,omitempty"`
	ProjectID      uuid.UUID      `gorm:"type:uuid;not null" json:"project_id"`
	WorkspaceID    uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
	CreatedByID    *uuid.UUID     `gorm:"type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID    *uuid.UUID     `gorm:"type:uuid" json:"updated_by_id,omitempty"`
}

func (IntakeIssue) TableName() string { return "intake_issues" }

func (i *IntakeIssue) BeforeCreate(tx *gorm.DB) error {
	if i.ID == uuid.Nil {
		i.ID = uuid.New()
	}
	return nil
}
