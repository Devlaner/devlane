package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Issue matches migration table "issues".
type Issue struct {
	ID              uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name            string         `gorm:"type:varchar(255);not null" json:"name"`
	Description     JSONMap        `gorm:"type:jsonb;serializer:json" json:"description,omitempty"`
	DescriptionHTML string         `gorm:"column:description_html;type:text" json:"description_html,omitempty"`
	Priority        string         `gorm:"type:varchar(30)" json:"priority,omitempty"`
	StartDate       *time.Time     `gorm:"type:date" json:"start_date,omitempty"`
	TargetDate      *time.Time     `gorm:"type:date" json:"target_date,omitempty"`
	SequenceID      int            `gorm:"column:sequence_id;default:1" json:"sequence_id"`
	ProjectID       uuid.UUID      `gorm:"type:uuid;not null" json:"project_id"`
	WorkspaceID     uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	StateID         *uuid.UUID     `gorm:"type:uuid" json:"state_id,omitempty"`
	ParentID        *uuid.UUID     `gorm:"type:uuid" json:"parent_id,omitempty"`
	AssigneeIDs     []uuid.UUID    `gorm:"-" json:"assignee_ids,omitempty"`
	LabelIDs        []uuid.UUID    `gorm:"-" json:"label_ids,omitempty"`
	CycleIDs        []uuid.UUID    `gorm:"-" json:"cycle_ids,omitempty"`
	ModuleIDs       []uuid.UUID    `gorm:"-" json:"module_ids,omitempty"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
	CreatedByID     *uuid.UUID     `gorm:"type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID     *uuid.UUID     `gorm:"type:uuid" json:"updated_by_id,omitempty"`
	SortOrder       float64        `gorm:"column:sort_order;default:65535" json:"sort_order"`
	ArchivedAt      *time.Time     `gorm:"type:timestamptz" json:"archived_at,omitempty"`
	IsDraft         bool           `gorm:"column:is_draft;default:false" json:"is_draft"`
}

func (Issue) TableName() string { return "issues" }

func (i *Issue) BeforeCreate(tx *gorm.DB) error {
	if i.ID == uuid.Nil {
		i.ID = uuid.New()
	}
	return nil
}

// IssueAssignee matches migration table "issue_assignees".
type IssueAssignee struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	IssueID     uuid.UUID `gorm:"type:uuid;not null" json:"issue_id"`
	AssigneeID  uuid.UUID `gorm:"type:uuid;not null" json:"assignee_id"`
	ProjectID   uuid.UUID `gorm:"type:uuid;not null" json:"project_id"`
	WorkspaceID uuid.UUID `gorm:"type:uuid;not null" json:"workspace_id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (IssueAssignee) TableName() string { return "issue_assignees" }

func (a *IssueAssignee) BeforeCreate(tx *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return nil
}

// IssueLabel (join) matches migration table "issue_labels".
type IssueLabel struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	IssueID     uuid.UUID `gorm:"type:uuid;not null" json:"issue_id"`
	LabelID     uuid.UUID `gorm:"type:uuid;not null" json:"label_id"`
	ProjectID   uuid.UUID `gorm:"type:uuid;not null" json:"project_id"`
	WorkspaceID uuid.UUID `gorm:"type:uuid;not null" json:"workspace_id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (IssueLabel) TableName() string { return "issue_labels" }

func (l *IssueLabel) BeforeCreate(tx *gorm.DB) error {
	if l.ID == uuid.Nil {
		l.ID = uuid.New()
	}
	return nil
}
