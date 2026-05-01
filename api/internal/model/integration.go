package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Integration is a registered integration provider (github, slack, ...).
// Matches table "integrations".
type Integration struct {
	ID            uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Title         string     `gorm:"type:varchar(400);not null" json:"title"`
	Provider      string     `gorm:"type:varchar(400);uniqueIndex;not null" json:"provider"`
	Network       int        `gorm:"not null;default:1" json:"network"`
	Description   JSONMap    `gorm:"type:jsonb;default:'{}';serializer:json" json:"description,omitempty"`
	Author        string     `gorm:"type:varchar(400)" json:"author,omitempty"`
	WebhookURL    string     `gorm:"column:webhook_url;type:text" json:"webhook_url,omitempty"`
	WebhookSecret string     `gorm:"column:webhook_secret;type:text" json:"-"`
	RedirectURL   string     `gorm:"column:redirect_url;type:text" json:"redirect_url,omitempty"`
	Metadata      JSONMap    `gorm:"type:jsonb;default:'{}';serializer:json" json:"metadata,omitempty"`
	Verified      bool       `gorm:"not null;default:false" json:"verified"`
	AvatarURL     string     `gorm:"column:avatar_url;type:text" json:"avatar_url,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
	CreatedByID   *uuid.UUID `gorm:"type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID   *uuid.UUID `gorm:"type:uuid" json:"updated_by_id,omitempty"`
}

func (Integration) TableName() string { return "integrations" }

func (i *Integration) BeforeCreate(tx *gorm.DB) error {
	if i.ID == uuid.Nil {
		i.ID = uuid.New()
	}
	return nil
}

// WorkspaceIntegration is an integration installed in a workspace.
// Matches table "workspace_integrations".
type WorkspaceIntegration struct {
	ID               uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	WorkspaceID      uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	ActorID          uuid.UUID      `gorm:"type:uuid;not null" json:"actor_id"`
	IntegrationID    uuid.UUID      `gorm:"type:uuid;not null" json:"integration_id"`
	APITokenID       *uuid.UUID     `gorm:"column:api_token_id;type:uuid" json:"api_token_id,omitempty"`
	Metadata         JSONMap        `gorm:"type:jsonb;default:'{}';serializer:json" json:"metadata,omitempty"`
	Config           JSONMap        `gorm:"type:jsonb;default:'{}';serializer:json" json:"config,omitempty"`
	InstallationID   *int64         `gorm:"column:installation_id;type:bigint" json:"installation_id,omitempty"`
	AccountLogin     string         `gorm:"column:account_login;type:varchar(255)" json:"account_login,omitempty"`
	AccountType      string         `gorm:"column:account_type;type:varchar(50)" json:"account_type,omitempty"`
	AccountAvatarURL string         `gorm:"column:account_avatar_url;type:text" json:"account_avatar_url,omitempty"`
	SuspendedAt      *time.Time     `gorm:"column:suspended_at" json:"suspended_at,omitempty"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
	CreatedByID      *uuid.UUID     `gorm:"type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID      *uuid.UUID     `gorm:"type:uuid" json:"updated_by_id,omitempty"`
	// Hydrated from the join with integrations(provider) for list responses.
	// `->` makes it read-only so writes (Create/Save) ignore the column while
	// SELECT aliases (e.g. `integrations.provider AS provider`) still populate it.
	Provider string `gorm:"column:provider;->" json:"provider,omitempty"`
}

func (WorkspaceIntegration) TableName() string { return "workspace_integrations" }

func (w *WorkspaceIntegration) BeforeCreate(tx *gorm.DB) error {
	if w.ID == uuid.Nil {
		w.ID = uuid.New()
	}
	return nil
}

// GithubRepository is a GitHub repository linked to a Devlane project.
// Matches table "github_repositories".
type GithubRepository struct {
	ID           uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name         string         `gorm:"type:varchar(500);not null" json:"name"`
	URL          string         `gorm:"type:text" json:"url,omitempty"`
	Config       JSONMap        `gorm:"type:jsonb;default:'{}';serializer:json" json:"config,omitempty"`
	RepositoryID int64          `gorm:"column:repository_id;type:bigint;not null" json:"repository_id"`
	Owner        string         `gorm:"type:varchar(500);not null" json:"owner"`
	ProjectID    uuid.UUID      `gorm:"type:uuid;not null" json:"project_id"`
	WorkspaceID  uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
	CreatedByID  *uuid.UUID     `gorm:"type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID  *uuid.UUID     `gorm:"type:uuid" json:"updated_by_id,omitempty"`
}

func (GithubRepository) TableName() string { return "github_repositories" }

func (r *GithubRepository) BeforeCreate(tx *gorm.DB) error {
	if r.ID == uuid.Nil {
		r.ID = uuid.New()
	}
	return nil
}

// GithubRepositorySync is the per-project sync configuration for a linked
// GitHub repository. One row per (project, repository).
// Matches table "github_repository_syncs".
type GithubRepositorySync struct {
	ID                     uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	RepositoryID           uuid.UUID      `gorm:"column:repository_id;type:uuid;not null" json:"repository_id"`
	Credentials            JSONMap        `gorm:"type:jsonb;default:'{}';serializer:json" json:"-"`
	ActorID                uuid.UUID      `gorm:"column:actor_id;type:uuid;not null" json:"actor_id"`
	WorkspaceIntegrationID uuid.UUID      `gorm:"column:workspace_integration_id;type:uuid;not null" json:"workspace_integration_id"`
	LabelID                *uuid.UUID     `gorm:"column:label_id;type:uuid" json:"label_id,omitempty"`
	ProjectID              uuid.UUID      `gorm:"column:project_id;type:uuid;not null" json:"project_id"`
	WorkspaceID            uuid.UUID      `gorm:"column:workspace_id;type:uuid;not null" json:"workspace_id"`
	AutoLink               bool           `gorm:"column:auto_link;not null;default:true" json:"auto_link"`
	AutoCloseOnMerge       bool           `gorm:"column:auto_close_on_merge;not null;default:true" json:"auto_close_on_merge"`
	InProgressStateID      *uuid.UUID     `gorm:"column:in_progress_state_id;type:uuid" json:"in_progress_state_id,omitempty"`
	DoneStateID            *uuid.UUID     `gorm:"column:done_state_id;type:uuid" json:"done_state_id,omitempty"`
	CreatedAt              time.Time      `json:"created_at"`
	UpdatedAt              time.Time      `json:"updated_at"`
	DeletedAt              gorm.DeletedAt `gorm:"index" json:"-"`
	CreatedByID            *uuid.UUID     `gorm:"type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID            *uuid.UUID     `gorm:"type:uuid" json:"updated_by_id,omitempty"`
}

func (GithubRepositorySync) TableName() string { return "github_repository_syncs" }

func (r *GithubRepositorySync) BeforeCreate(tx *gorm.DB) error {
	if r.ID == uuid.Nil {
		r.ID = uuid.New()
	}
	return nil
}

// GithubIssueSync links a GitHub PR (or issue) to a Devlane issue.
// We use kind='pull_request' for PRs (the Linear-style PR↔issue sync) and
// 'issue' if/when GH-issue ↔ Devlane-issue sync is added.
// Matches table "github_issue_syncs" (extended in 000003).
type GithubIssueSync struct {
	ID               uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	RepoIssueID      int64          `gorm:"column:repo_issue_id;type:bigint;not null" json:"repo_issue_id"`
	GithubIssueID    int64          `gorm:"column:github_issue_id;type:bigint;not null" json:"github_issue_id"`
	IssueURL         string         `gorm:"column:issue_url;type:text;not null" json:"issue_url"`
	IssueID          uuid.UUID      `gorm:"column:issue_id;type:uuid;not null" json:"issue_id"`
	RepositorySyncID uuid.UUID      `gorm:"column:repository_sync_id;type:uuid;not null" json:"repository_sync_id"`
	ProjectID        uuid.UUID      `gorm:"column:project_id;type:uuid;not null" json:"project_id"`
	WorkspaceID      uuid.UUID      `gorm:"column:workspace_id;type:uuid;not null" json:"workspace_id"`
	Kind             string         `gorm:"column:kind;type:varchar(30);not null;default:'pull_request'" json:"kind"`
	State            string         `gorm:"column:state;type:varchar(30);not null;default:'open'" json:"state"`
	Title            string         `gorm:"column:title;type:varchar(1024)" json:"title,omitempty"`
	Draft            bool           `gorm:"column:draft;not null;default:false" json:"draft"`
	MergedAt         *time.Time     `gorm:"column:merged_at" json:"merged_at,omitempty"`
	ClosedAt         *time.Time     `gorm:"column:closed_at" json:"closed_at,omitempty"`
	AuthorLogin      string         `gorm:"column:author_login;type:varchar(255)" json:"author_login,omitempty"`
	BaseBranch       string         `gorm:"column:base_branch;type:varchar(255)" json:"base_branch,omitempty"`
	HeadBranch       string         `gorm:"column:head_branch;type:varchar(255)" json:"head_branch,omitempty"`
	DetectionSource  string         `gorm:"column:detection_source;type:varchar(30)" json:"detection_source,omitempty"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
	CreatedByID      *uuid.UUID     `gorm:"type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID      *uuid.UUID     `gorm:"type:uuid" json:"updated_by_id,omitempty"`
}

func (GithubIssueSync) TableName() string { return "github_issue_syncs" }

func (g *GithubIssueSync) BeforeCreate(tx *gorm.DB) error {
	if g.ID == uuid.Nil {
		g.ID = uuid.New()
	}
	return nil
}

// GithubCommentSync links a GitHub comment to a Devlane comment (kept for
// future GH-issue ↔ Devlane-issue comment mirroring).
// Matches table "github_comment_syncs".
type GithubCommentSync struct {
	ID            uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	RepoCommentID int64          `gorm:"column:repo_comment_id;type:bigint;not null" json:"repo_comment_id"`
	CommentID     uuid.UUID      `gorm:"column:comment_id;type:uuid;not null" json:"comment_id"`
	IssueSyncID   uuid.UUID      `gorm:"column:issue_sync_id;type:uuid;not null" json:"issue_sync_id"`
	ProjectID     uuid.UUID      `gorm:"column:project_id;type:uuid;not null" json:"project_id"`
	WorkspaceID   uuid.UUID      `gorm:"column:workspace_id;type:uuid;not null" json:"workspace_id"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
	CreatedByID   *uuid.UUID     `gorm:"type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID   *uuid.UUID     `gorm:"type:uuid" json:"updated_by_id,omitempty"`
}

func (GithubCommentSync) TableName() string { return "github_comment_syncs" }

func (g *GithubCommentSync) BeforeCreate(tx *gorm.DB) error {
	if g.ID == uuid.Nil {
		g.ID = uuid.New()
	}
	return nil
}

// GithubWebhookEvent is an inbound webhook delivery (one row per X-GitHub-Delivery).
// Matches table "github_webhook_events".
type GithubWebhookEvent struct {
	ID                     uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	DeliveryID             string     `gorm:"column:delivery_id;type:varchar(255);uniqueIndex;not null" json:"delivery_id"`
	Event                  string     `gorm:"column:event;type:varchar(64);not null" json:"event"`
	Action                 string     `gorm:"column:action;type:varchar(64)" json:"action,omitempty"`
	InstallationID         *int64     `gorm:"column:installation_id;type:bigint" json:"installation_id,omitempty"`
	WorkspaceIntegrationID *uuid.UUID `gorm:"column:workspace_integration_id;type:uuid" json:"workspace_integration_id,omitempty"`
	RepositoryFullName     string     `gorm:"column:repository_full_name;type:varchar(500)" json:"repository_full_name,omitempty"`
	Payload                JSONMap    `gorm:"column:payload;type:jsonb;not null;serializer:json" json:"payload"`
	Status                 string     `gorm:"column:status;type:varchar(30);not null;default:'received'" json:"status"`
	ErrorMessage           string     `gorm:"column:error;type:text" json:"error,omitempty"`
	CreatedAt              time.Time  `json:"created_at"`
	ProcessedAt            *time.Time `gorm:"column:processed_at" json:"processed_at,omitempty"`
}

func (GithubWebhookEvent) TableName() string { return "github_webhook_events" }

func (e *GithubWebhookEvent) BeforeCreate(tx *gorm.DB) error {
	if e.ID == uuid.Nil {
		e.ID = uuid.New()
	}
	return nil
}
