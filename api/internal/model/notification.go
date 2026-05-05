package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Notification matches notifications.
//
// Sender values used by the in-app notification service:
//   - "assigned"      — receiver was assigned to the issue
//   - "mentioned"     — receiver was @-mentioned in description or comment
//   - "commented"     — comment added on an issue the receiver follows
//   - "state_changed" — issue state moved
//   - "subscribed"    — generic field change on an issue the receiver follows
//
// EntityName is "issue" for all issue-related rows. Reserve other values for future entities.
type Notification struct {
	ID               uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Title            string     `gorm:"type:text;not null" json:"title"`
	Message          JSONMap    `gorm:"type:jsonb;serializer:json" json:"message,omitempty"`
	Sender           string     `gorm:"type:varchar(255);default:'system'" json:"sender,omitempty"`
	ReceiverID       uuid.UUID  `gorm:"type:uuid;not null" json:"receiver_id"`
	WorkspaceID      uuid.UUID  `gorm:"type:uuid;not null" json:"workspace_id"`
	ProjectID        *uuid.UUID `gorm:"type:uuid" json:"project_id,omitempty"`
	TriggeredByID    *uuid.UUID `gorm:"type:uuid" json:"triggered_by_id,omitempty"`
	EntityIdentifier *uuid.UUID `gorm:"type:uuid" json:"entity_identifier,omitempty"`
	EntityName       string     `gorm:"type:varchar(255)" json:"entity_name,omitempty"`
	ReadAt           *time.Time `gorm:"type:timestamptz" json:"read_at,omitempty"`
	SnoozedTill      *time.Time `gorm:"type:timestamptz" json:"snoozed_till,omitempty"`
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

// Sender values for in-app notifications.
const (
	NotificationSenderAssigned     = "assigned"
	NotificationSenderMentioned    = "mentioned"
	NotificationSenderCommented    = "commented"
	NotificationSenderStateChanged = "state_changed"
	NotificationSenderSubscribed   = "subscribed"

	NotificationEntityIssue = "issue"
)
