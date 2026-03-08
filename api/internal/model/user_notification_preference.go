package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// UserNotificationPreference matches user_notification_preferences (account-level when workspace_id and project_id are null).
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
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

func (UserNotificationPreference) TableName() string { return "user_notification_preferences" }

func (u *UserNotificationPreference) BeforeCreate(tx *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}
