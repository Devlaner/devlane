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
	IsEpic          bool           `gorm:"column:is_epic;default:false" json:"is_epic"`
	Type            string         `gorm:"type:varchar(50);default:task" json:"type,omitempty"`
	EstimatePointID *uuid.UUID     `gorm:"column:estimate_point_id;type:uuid" json:"estimate_point_id,omitempty"`
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

// IssueRelation matches migration table "issue_relations".
// Both directions of every relation are stored as separate rows so queries
// only need WHERE issue_id = ?.
// Reverse mapping: blocking↔blocked_by, duplicate↔duplicate, relates_to↔relates_to
type IssueRelation struct {
	ID             uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	IssueID        uuid.UUID  `gorm:"type:uuid;not null" json:"issue_id"`
	RelatedIssueID uuid.UUID  `gorm:"type:uuid;not null;column:related_issue_id" json:"related_issue_id"`
	RelationType   string     `gorm:"type:varchar(50);not null;default:relates_to" json:"relation_type"`
	ProjectID      uuid.UUID  `gorm:"type:uuid;not null" json:"project_id"`
	WorkspaceID    uuid.UUID  `gorm:"type:uuid;not null" json:"workspace_id"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	CreatedByID    *uuid.UUID `gorm:"type:uuid" json:"created_by_id,omitempty"`
}

func (IssueRelation) TableName() string { return "issue_relations" }

func (r *IssueRelation) BeforeCreate(tx *gorm.DB) error {
	if r.ID == uuid.Nil {
		r.ID = uuid.New()
	}
	return nil
}

// IssueLink matches migration table "issue_links".
type IssueLink struct {
	ID          uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	Title       string     `gorm:"type:varchar(255);not null" json:"title"`
	URL         string     `gorm:"type:text;not null" json:"url"`
	IssueID     uuid.UUID  `gorm:"type:uuid;not null" json:"issue_id"`
	ProjectID   uuid.UUID  `gorm:"type:uuid;not null" json:"project_id"`
	WorkspaceID uuid.UUID  `gorm:"type:uuid;not null" json:"workspace_id"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	CreatedByID *uuid.UUID `gorm:"type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID *uuid.UUID `gorm:"type:uuid" json:"updated_by_id,omitempty"`
}

func (IssueLink) TableName() string { return "issue_links" }

func (l *IssueLink) BeforeCreate(tx *gorm.DB) error {
	if l.ID == uuid.Nil {
		l.ID = uuid.New()
	}
	return nil
}

// FileAsset matches migration table "file_assets".
type FileAsset struct {
	ID               uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	Asset            string         `gorm:"type:varchar(800);not null" json:"asset"`
	Attributes       JSONMap        `gorm:"type:jsonb;serializer:json;not null;default:'{}'" json:"attributes,omitempty"`
	IsUploaded       bool           `gorm:"column:is_uploaded;default:false" json:"is_uploaded"`
	IsDeleted        bool           `gorm:"column:is_deleted;default:false" json:"is_deleted"`
	IsArchived       bool           `gorm:"column:is_archived;default:false" json:"is_archived"`
	Size             float64        `gorm:"default:0" json:"size"`
	EntityType       string         `gorm:"type:varchar(255);default:''" json:"entity_type,omitempty"`
	EntityIdentifier string         `gorm:"type:varchar(255);default:''" json:"entity_identifier,omitempty"`
	ExternalID       string         `gorm:"type:varchar(255);default:''" json:"external_id,omitempty"`
	ExternalSource   string         `gorm:"type:varchar(255);default:''" json:"external_source,omitempty"`
	StorageMetadata  JSONMap        `gorm:"type:jsonb;serializer:json" json:"storage_metadata,omitempty"`
	WorkspaceID      *uuid.UUID     `gorm:"type:uuid" json:"workspace_id,omitempty"`
	ProjectID        *uuid.UUID     `gorm:"type:uuid" json:"project_id,omitempty"`
	IssueID          *uuid.UUID     `gorm:"type:uuid" json:"issue_id,omitempty"`
	UserID           *uuid.UUID     `gorm:"type:uuid" json:"user_id,omitempty"`
	CommentID        *uuid.UUID     `gorm:"type:uuid" json:"comment_id,omitempty"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
	CreatedByID      *uuid.UUID     `gorm:"type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID      *uuid.UUID     `gorm:"type:uuid" json:"updated_by_id,omitempty"`
}

func (FileAsset) TableName() string { return "file_assets" }

func (f *FileAsset) BeforeCreate(tx *gorm.DB) error {
	if f.ID == uuid.Nil {
		f.ID = uuid.New()
	}
	// attributes is NOT NULL DEFAULT '{}' — ensure GORM never sends null.
	if f.Attributes == nil {
		f.Attributes = JSONMap{}
	}
	return nil
}

// IssueAttachment matches migration table "issue_attachments".
type IssueAttachment struct {
	ID             uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	IssueID        uuid.UUID      `gorm:"type:uuid;not null" json:"issue_id"`
	AssetID        uuid.UUID      `gorm:"type:uuid;not null" json:"asset_id"`
	Attributes     JSONMap        `gorm:"type:jsonb;serializer:json;default:'{}'" json:"attributes,omitempty"`
	ExternalSource string         `gorm:"type:varchar(255);default:''" json:"external_source,omitempty"`
	ExternalID     string         `gorm:"type:varchar(255);default:''" json:"external_id,omitempty"`
	ProjectID      uuid.UUID      `gorm:"type:uuid;not null" json:"project_id"`
	WorkspaceID    uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
	CreatedByID    *uuid.UUID     `gorm:"type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID    *uuid.UUID     `gorm:"type:uuid" json:"updated_by_id,omitempty"`
}

func (IssueAttachment) TableName() string { return "issue_attachments" }

func (a *IssueAttachment) BeforeCreate(tx *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return nil
}

// ReverseRelationType returns the relation type that the related issue holds
// back toward the source issue.
func ReverseRelationType(t string) string {
	switch t {
	case "blocking":
		return "blocked_by"
	case "blocked_by":
		return "blocking"
	default:
		return t // duplicate↔duplicate, relates_to↔relates_to
	}
}
