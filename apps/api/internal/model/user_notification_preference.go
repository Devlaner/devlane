package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// UserNotificationPreference matches user_notification_preferences. A row is
// account-level when workspace_id and project_id are null, workspace-scoped when
// only workspace_id is set, and project-scoped when project_id is set. The
// PropertyChange/StateChange/Comment/Mention/IssueCompleted booleans gate the
// in-app channel; the Email* booleans gate the email channel for the same types.
type UserNotificationPreference struct {
	ID             uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID         uuid.UUID  `gorm:"type:uuid;not null" json:"user_id"`
	WorkspaceID    *uuid.UUID `gorm:"type:uuid" json:"workspace_id,omitempty"`
	ProjectID      *uuid.UUID `gorm:"type:uuid" json:"project_id,omitempty"`
	PropertyChange bool       `gorm:"column:property_change;default:true" json:"property_change"`
	StateChange    bool       `gorm:"column:state_change;default:true" json:"state_change"`
	Comment        bool       `gorm:"column:comment;default:true" json:"comment"`
	Mention        bool       `gorm:"column:mention;default:true" json:"mention"`
	IssueCompleted bool       `gorm:"column:issue_completed;default:true" json:"issue_completed"`

	EmailPropertyChange bool `gorm:"column:email_property_change;default:true" json:"email_property_change"`
	EmailStateChange    bool `gorm:"column:email_state_change;default:true" json:"email_state_change"`
	EmailComment        bool `gorm:"column:email_comment;default:true" json:"email_comment"`
	EmailMention        bool `gorm:"column:email_mention;default:true" json:"email_mention"`
	EmailIssueCompleted bool `gorm:"column:email_issue_completed;default:true" json:"email_issue_completed"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// DefaultNotificationPreference returns the effective preference used when a
// user has no stored row: every channel and type enabled.
func DefaultNotificationPreference() UserNotificationPreference {
	return UserNotificationPreference{
		PropertyChange: true, StateChange: true, Comment: true, Mention: true, IssueCompleted: true,
		EmailPropertyChange: true, EmailStateChange: true, EmailComment: true, EmailMention: true, EmailIssueCompleted: true,
	}
}

func (UserNotificationPreference) TableName() string { return "user_notification_preferences" }

func (u *UserNotificationPreference) BeforeCreate(tx *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}
