package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// IssueSubscriber matches issue_subscribers — users following an issue's
// activity stream. Assignees, commenters, and mention targets are auto-subscribed
// on action; users may also subscribe/unsubscribe manually.
//
// The DB has a UNIQUE(issue_id, subscriber_id) constraint, so re-subscribing
// the same user must use ON CONFLICT DO NOTHING (or be guarded by a SELECT).
type IssueSubscriber struct {
	ID           uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	IssueID      uuid.UUID  `gorm:"type:uuid;not null" json:"issue_id"`
	SubscriberID uuid.UUID  `gorm:"type:uuid;not null" json:"subscriber_id"`
	ProjectID    uuid.UUID  `gorm:"type:uuid;not null" json:"project_id"`
	WorkspaceID  uuid.UUID  `gorm:"type:uuid;not null" json:"workspace_id"`
	CreatedByID  *uuid.UUID `gorm:"type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID  *uuid.UUID `gorm:"type:uuid" json:"updated_by_id,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

func (IssueSubscriber) TableName() string { return "issue_subscribers" }

func (s *IssueSubscriber) BeforeCreate(tx *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return nil
}
