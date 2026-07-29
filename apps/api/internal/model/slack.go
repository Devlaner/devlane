package model

import (
	"github.com/google/uuid"
	"gorm.io/gorm"
	"time"
)

/*
SlackChannelLink is the per-project channel configuration for Slack notification
Matches table: "slack_channel_links"
*/

type SlackChannelLink struct {
	ID                     uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	WorkspaceIntegrationID uuid.UUID      `gorm:"column:workspace_integration_id;type:uuid;not null" json:"workspace_integration_id"`
	ProjectID              uuid.UUID      `gorm:"column:project_id;type:uuid;not null" json:"project_id"`
	WorkspaceID            uuid.UUID      `gorm:"column:workspace_id;type:uuid;not null" json:"workspace_id"`
	ChannelID              string         `gorm:"column:channel_id;type:varchar(64);not null" json:"channel_id"`
	ChannelName            string         `gorm:"column:channel_name;type:varchar(255);not null" json:"channel_name"`
	Events                 JSONMap        `gorm:"type:jsonb; default:'{}';serializer:json" json:"events"`
	ActorID                uuid.UUID      `gorm:"column:actor_id;type:uuid;not null" json:"actor_id"`
	CreatedAt              time.Time      `json:"created_at"`
	UpdatedAt              time.Time      `json:"updated_at"`
	DeletedAt              gorm.DeletedAt `gorm:"index" json:"-"`
	CreatedByID            *uuid.UUID     `gorm:"type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID            *uuid.UUID     `gorm:"type:uuid" json:"updated_by_id,omitempty"`
}

/*
TableName tells Gorm the exact name of the table in Postgres
*/
func (SlackChannelLink) TableName() string {
	return "slack_channel_links"
}

/*
BeforeCreate is a Gorm hook that aut-generates a UUID if one wasn't provided
*/
func (s *SlackChannelLink) BeforeCreate(tx *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}

	return nil
}
