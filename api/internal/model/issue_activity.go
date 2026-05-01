package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// IssueActivity matches table "issue_activities". Stores field-change events
// (verb=updated, field=state_id, old_value=..., new_value=...) plus generic
// "created" / "deleted" verbs.
type IssueActivity struct {
	ID             uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	IssueID        *uuid.UUID     `gorm:"column:issue_id;type:uuid" json:"issue_id,omitempty"`
	ProjectID      uuid.UUID      `gorm:"column:project_id;type:uuid;not null" json:"project_id"`
	WorkspaceID    uuid.UUID      `gorm:"column:workspace_id;type:uuid;not null" json:"workspace_id"`
	Verb           string         `gorm:"type:varchar(255);not null;default:'created'" json:"verb"`
	Field          *string        `gorm:"type:varchar(255)" json:"field,omitempty"`
	OldValue       *string        `gorm:"column:old_value;type:text" json:"old_value,omitempty"`
	NewValue       *string        `gorm:"column:new_value;type:text" json:"new_value,omitempty"`
	Comment        *string        `gorm:"type:text" json:"comment,omitempty"`
	IssueCommentID *uuid.UUID     `gorm:"column:issue_comment_id;type:uuid" json:"issue_comment_id,omitempty"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
	CreatedByID    *uuid.UUID     `gorm:"column:created_by_id;type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID    *uuid.UUID     `gorm:"column:updated_by_id;type:uuid" json:"updated_by_id,omitempty"`
	ActorID        *uuid.UUID     `gorm:"column:actor_id;type:uuid" json:"actor_id,omitempty"`
	OldIdentifier  *uuid.UUID     `gorm:"column:old_identifier;type:uuid" json:"old_identifier,omitempty"`
	NewIdentifier  *uuid.UUID     `gorm:"column:new_identifier;type:uuid" json:"new_identifier,omitempty"`
	Epoch          *float64       `gorm:"column:epoch" json:"epoch,omitempty"`
}

func (IssueActivity) TableName() string { return "issue_activities" }

func (a *IssueActivity) BeforeCreate(tx *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return nil
}
