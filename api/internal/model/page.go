package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Page matches pages.
type Page struct {
	ID            uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name          string         `gorm:"type:text" json:"name"`
	DescriptionHTML string        `gorm:"column:description_html;type:text;default:<p></p>" json:"description_html,omitempty"`
	OwnedByID     uuid.UUID      `gorm:"type:uuid;not null" json:"owned_by_id"`
	WorkspaceID   uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	Access        int16          `gorm:"default:0" json:"access"`
	ParentID      *uuid.UUID     `gorm:"type:uuid" json:"parent_id,omitempty"`
	ArchivedAt    *time.Time     `gorm:"type:timestamptz" json:"archived_at,omitempty"`
	IsLocked      bool           `gorm:"column:is_locked;default:false" json:"is_locked"`
	SortOrder     float64        `gorm:"column:sort_order;default:65535" json:"sort_order"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
	CreatedByID   *uuid.UUID     `gorm:"type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID   *uuid.UUID     `gorm:"type:uuid" json:"updated_by_id,omitempty"`
}

func (Page) TableName() string { return "pages" }

func (p *Page) BeforeCreate(tx *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}

// ProjectPage links pages to projects.
type ProjectPage struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ProjectID   uuid.UUID      `gorm:"type:uuid;not null" json:"project_id"`
	PageID      uuid.UUID      `gorm:"type:uuid;not null" json:"page_id"`
	WorkspaceID uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	CreatedByID *uuid.UUID     `gorm:"type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID *uuid.UUID     `gorm:"type:uuid" json:"updated_by_id,omitempty"`
}

func (ProjectPage) TableName() string { return "project_pages" }

func (p *ProjectPage) BeforeCreate(tx *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}
