package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Cycle matches cycles.
type Cycle struct {
	ID              uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name            string         `gorm:"type:varchar(255);not null" json:"name"`
	Description     string         `gorm:"type:text" json:"description,omitempty"`
	StartDate       *time.Time     `gorm:"type:timestamptz" json:"start_date,omitempty"`
	EndDate         *time.Time     `gorm:"type:timestamptz" json:"end_date,omitempty"`
	Status          string         `gorm:"type:varchar(255);default:draft" json:"status"`
	ProjectID       uuid.UUID      `gorm:"type:uuid;not null" json:"project_id"`
	WorkspaceID     uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	IssueCount      int            `gorm:"-" json:"issue_count,omitempty"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
	CreatedByID     *uuid.UUID     `gorm:"type:uuid" json:"created_by_id,omitempty"`
	OwnedByID       uuid.UUID      `gorm:"type:uuid;not null" json:"owned_by_id"`
	UpdatedByID     *uuid.UUID     `gorm:"type:uuid" json:"updated_by_id,omitempty"`
	SortOrder       float64        `gorm:"column:sort_order;default:65535" json:"sort_order"`
	ArchivedAt      *time.Time     `gorm:"type:timestamptz" json:"archived_at,omitempty"`
	Timezone        string         `gorm:"default:UTC" json:"timezone"`
	Version         int            `gorm:"default:1" json:"version"`
}

func (Cycle) TableName() string { return "cycles" }

func (c *Cycle) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}

// CycleIssue matches cycle_issues (M2M).
type CycleIssue struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	CycleID      uuid.UUID      `gorm:"type:uuid;not null" json:"cycle_id"`
	IssueID      uuid.UUID      `gorm:"type:uuid;not null" json:"issue_id"`
	ProjectID    uuid.UUID      `gorm:"type:uuid;not null" json:"project_id"`
	WorkspaceID  uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
	CreatedByID  *uuid.UUID     `gorm:"type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID  *uuid.UUID     `gorm:"type:uuid" json:"updated_by_id,omitempty"`
}

func (CycleIssue) TableName() string { return "cycle_issues" }

func (c *CycleIssue) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}
