package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	AgentAutonomySuggest        = "suggest"
	AgentAutonomyComment        = "comment"
	AgentAutonomyModifyIssue    = "modify_issue"
	AgentAutonomyGithubDraft    = "github_draft"
	AgentAutonomyGithubReviewed = "github_reviewed"

	AgentAssignmentActive    = "active"
	AgentAssignmentCancelled = "cancelled"
	AgentAssignmentCompleted = "completed"

	AgentRunQueued      = "queued"
	AgentRunRunning     = "running"
	AgentRunNeedsReview = "needs_review"
	AgentRunCompleted   = "completed"
	AgentRunFailed      = "failed"
	AgentRunCancelled   = "cancelled"
)

type Agent struct {
	ID              uuid.UUID             `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	WorkspaceID     uuid.UUID             `gorm:"type:uuid;not null" json:"workspace_id"`
	ProjectID       *uuid.UUID            `gorm:"type:uuid" json:"project_id,omitempty"`
	Name            string                `gorm:"type:varchar(255);not null" json:"name"`
	Description     string                `gorm:"type:text" json:"description"`
	Avatar          string                `gorm:"type:text" json:"avatar"`
	Instructions    string                `gorm:"type:text" json:"instructions"`
	Model           string                `gorm:"type:varchar(100)" json:"model"`
	Enabled         bool                  `gorm:"default:true" json:"enabled"`
	AutonomyLevel   string                `gorm:"type:varchar(50);default:suggest" json:"autonomy_level"`
	ToolPermissions []AgentToolPermission `gorm:"foreignKey:AgentID" json:"tool_permissions,omitempty"`
	CreatedAt       time.Time             `json:"created_at"`
	UpdatedAt       time.Time             `json:"updated_at"`
	DeletedAt       gorm.DeletedAt        `gorm:"index" json:"-"`
	CreatedByID     *uuid.UUID            `gorm:"type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID     *uuid.UUID            `gorm:"type:uuid" json:"updated_by_id,omitempty"`
}

func (Agent) TableName() string { return "agents" }

func (a *Agent) BeforeCreate(tx *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	if a.AutonomyLevel == "" {
		a.AutonomyLevel = AgentAutonomySuggest
	}
	return nil
}

type AgentToolPermission struct {
	ID        uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	AgentID   uuid.UUID      `gorm:"type:uuid;not null" json:"agent_id"`
	Tool      string         `gorm:"type:varchar(100);not null" json:"tool"`
	Scope     string         `gorm:"type:varchar(100);default:workspace" json:"scope"`
	Config    JSONMap        `gorm:"type:jsonb;serializer:json;not null;default:'{}'" json:"config,omitempty"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (AgentToolPermission) TableName() string { return "agent_tool_permissions" }

func (p *AgentToolPermission) BeforeCreate(tx *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	if p.Scope == "" {
		p.Scope = "workspace"
	}
	if p.Config == nil {
		p.Config = JSONMap{}
	}
	return nil
}

type AgentIssueAssignment struct {
	ID           uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	IssueID      uuid.UUID      `gorm:"type:uuid;not null" json:"issue_id"`
	AgentID      uuid.UUID      `gorm:"type:uuid;not null" json:"agent_id"`
	ProjectID    uuid.UUID      `gorm:"type:uuid;not null" json:"project_id"`
	WorkspaceID  uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	AssignedByID *uuid.UUID     `gorm:"type:uuid" json:"assigned_by_id,omitempty"`
	Reason       string         `gorm:"type:text" json:"reason"`
	Status       string         `gorm:"type:varchar(50);default:active" json:"status"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

func (AgentIssueAssignment) TableName() string { return "agent_issue_assignments" }

func (a *AgentIssueAssignment) BeforeCreate(tx *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	if a.Status == "" {
		a.Status = AgentAssignmentActive
	}
	return nil
}

type AgentRun struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	AgentID     uuid.UUID      `gorm:"type:uuid;not null" json:"agent_id"`
	IssueID     *uuid.UUID     `gorm:"type:uuid" json:"issue_id,omitempty"`
	ProjectID   uuid.UUID      `gorm:"type:uuid;not null" json:"project_id"`
	WorkspaceID uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	Trigger     string         `gorm:"type:varchar(100);default:manual" json:"trigger"`
	Status      string         `gorm:"type:varchar(50);default:queued" json:"status"`
	Input       JSONMap        `gorm:"type:jsonb;serializer:json;not null;default:'{}'" json:"input,omitempty"`
	Output      JSONMap        `gorm:"type:jsonb;serializer:json;not null;default:'{}'" json:"output,omitempty"`
	Error       string         `gorm:"type:text" json:"error"`
	QueuedAt    time.Time      `gorm:"type:timestamptz" json:"queued_at"`
	StartedAt   *time.Time     `gorm:"type:timestamptz" json:"started_at,omitempty"`
	CompletedAt *time.Time     `gorm:"type:timestamptz" json:"completed_at,omitempty"`
	CancelledAt *time.Time     `gorm:"type:timestamptz" json:"cancelled_at,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	CreatedByID *uuid.UUID     `gorm:"type:uuid" json:"created_by_id,omitempty"`
}

func (AgentRun) TableName() string { return "agent_runs" }

func (r *AgentRun) BeforeCreate(tx *gorm.DB) error {
	if r.ID == uuid.Nil {
		r.ID = uuid.New()
	}
	if r.Trigger == "" {
		r.Trigger = "manual"
	}
	if r.Status == "" {
		r.Status = AgentRunQueued
	}
	if r.Input == nil {
		r.Input = JSONMap{}
	}
	if r.Output == nil {
		r.Output = JSONMap{}
	}
	if r.QueuedAt.IsZero() {
		r.QueuedAt = time.Now()
	}
	return nil
}
