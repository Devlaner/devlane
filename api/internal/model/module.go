package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Module matches modules.
type Module struct {
	ID            uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name          string         `gorm:"type:varchar(255);not null" json:"name"`
	Description   string         `gorm:"type:text" json:"description,omitempty"`
	StartDate     *time.Time     `gorm:"type:date" json:"start_date,omitempty"`
	TargetDate    *time.Time     `gorm:"type:date" json:"target_date,omitempty"`
	Status        string         `gorm:"type:varchar(50);default:backlog" json:"status"`
	ProjectID     uuid.UUID      `gorm:"type:uuid;not null" json:"project_id"`
	WorkspaceID   uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	IssueCount    int            `gorm:"-" json:"issue_count,omitempty"`
	LeadID        *uuid.UUID     `gorm:"type:uuid" json:"lead_id,omitempty"`
	SortOrder     float64        `gorm:"column:sort_order;default:65535" json:"sort_order"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
	CreatedByID   *uuid.UUID     `gorm:"type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID   *uuid.UUID     `gorm:"type:uuid" json:"updated_by_id,omitempty"`
}

func (Module) TableName() string { return "modules" }

func (m *Module) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	return nil
}

// ModuleIssue matches module_issues (M2M).
type ModuleIssue struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ModuleID    uuid.UUID `gorm:"type:uuid;not null" json:"module_id"`
	IssueID     uuid.UUID `gorm:"type:uuid;not null" json:"issue_id"`
	ProjectID   uuid.UUID `gorm:"type:uuid;not null" json:"project_id"`
	WorkspaceID uuid.UUID `gorm:"type:uuid;not null" json:"workspace_id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	CreatedByID *uuid.UUID `gorm:"type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID *uuid.UUID `gorm:"type:uuid" json:"updated_by_id,omitempty"`
}

func (ModuleIssue) TableName() string { return "module_issues" }

func (m *ModuleIssue) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	return nil
}
