package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Webhook matches webhooks: a workspace-scoped outbound webhook. The per-entity
// booleans select which event types are delivered.
type Webhook struct {
	ID           uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	URL          string         `gorm:"type:varchar(1024);not null" json:"url"`
	SecretKey    string         `gorm:"column:secret_key;type:varchar(255)" json:"-"`
	IsActive     bool           `gorm:"column:is_active;not null;default:true" json:"is_active"`
	Project      bool           `gorm:"column:project;not null;default:false" json:"project"`
	Issue        bool           `gorm:"column:issue;not null;default:false" json:"issue"`
	Module       bool           `gorm:"column:module;not null;default:false" json:"module"`
	Cycle        bool           `gorm:"column:cycle;not null;default:false" json:"cycle"`
	IssueComment bool           `gorm:"column:issue_comment;not null;default:false" json:"issue_comment"`
	IsInternal   bool           `gorm:"column:is_internal;not null;default:false" json:"is_internal"`
	Version      string         `gorm:"column:version;type:varchar(50);not null;default:v1" json:"version"`
	WorkspaceID  uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
	CreatedByID  *uuid.UUID     `gorm:"type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID  *uuid.UUID     `gorm:"type:uuid" json:"updated_by_id,omitempty"`
}

func (Webhook) TableName() string { return "webhooks" }

func (w *Webhook) BeforeCreate(tx *gorm.DB) error {
	if w.ID == uuid.Nil {
		w.ID = uuid.New()
	}
	return nil
}

// WebhookLog matches webhook_logs: one attempted delivery of an event to a
// webhook, capturing request and response for debugging.
type WebhookLog struct {
	ID              uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	WebhookID       uuid.UUID `gorm:"column:webhook_id;type:uuid;not null" json:"webhook_id"`
	WorkspaceID     uuid.UUID `gorm:"type:uuid;not null" json:"workspace_id"`
	EventType       string    `gorm:"column:event_type;type:varchar(255)" json:"event_type"`
	RequestMethod   string    `gorm:"column:request_method;type:varchar(10)" json:"request_method"`
	RequestHeaders  string    `gorm:"column:request_headers;type:text" json:"request_headers,omitempty"`
	RequestBody     string    `gorm:"column:request_body;type:text" json:"request_body,omitempty"`
	ResponseStatus  string    `gorm:"column:response_status;type:text" json:"response_status"`
	ResponseHeaders string    `gorm:"column:response_headers;type:text" json:"response_headers,omitempty"`
	ResponseBody    string    `gorm:"column:response_body;type:text" json:"response_body,omitempty"`
	RetryCount      int       `gorm:"column:retry_count;not null;default:0" json:"retry_count"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

func (WebhookLog) TableName() string { return "webhook_logs" }

func (l *WebhookLog) BeforeCreate(tx *gorm.DB) error {
	if l.ID == uuid.Nil {
		l.ID = uuid.New()
	}
	return nil
}
