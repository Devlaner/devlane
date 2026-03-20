package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// IssueView matches issue_views (saved filters with owner and access).
type IssueView struct {
	ID                uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name              string         `gorm:"type:varchar(255);not null" json:"name"`
	Description       string         `gorm:"type:text" json:"description,omitempty"`
	Query             JSONMap        `gorm:"type:jsonb;not null;default:{};serializer:json" json:"query"`
	Filters           JSONMap        `gorm:"type:jsonb;default:{};serializer:json" json:"filters,omitempty"`
	DisplayFilters    JSONMap        `gorm:"type:jsonb;default:{};serializer:json" json:"display_filters,omitempty"`
	DisplayProperties JSONMap        `gorm:"type:jsonb;default:{};serializer:json" json:"display_properties,omitempty"`
	RichFilters       JSONMap        `gorm:"type:jsonb;default:{};serializer:json" json:"rich_filters,omitempty"`
	Access            int16          `gorm:"default:1" json:"access"` // 0 private, 1 public
	SortOrder         float64        `gorm:"column:sort_order;default:65535" json:"sort_order"`
	LogoProps         JSONMap        `gorm:"type:jsonb;default:{};serializer:json" json:"logo_props,omitempty"`
	OwnedByID         uuid.UUID      `gorm:"type:uuid;not null" json:"owned_by_id"`
	IsLocked          bool           `gorm:"column:is_locked;default:false" json:"is_locked"`
	WorkspaceID       uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	ProjectID         *uuid.UUID     `gorm:"type:uuid" json:"project_id,omitempty"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
	CreatedByID       *uuid.UUID     `gorm:"type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID       *uuid.UUID     `gorm:"type:uuid" json:"updated_by_id,omitempty"`
	IsFavorite bool `gorm:"-" json:"is_favorite,omitempty"`
}

func (IssueView) TableName() string { return "issue_views" }

func (v *IssueView) BeforeCreate(tx *gorm.DB) error {
	if v.ID == uuid.Nil {
		v.ID = uuid.New()
	}
	if v.Query == nil {
		v.Query = JSONMap{}
	}
	return nil
}
