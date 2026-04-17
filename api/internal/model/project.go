package model

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// JSONMap for JSONB columns.
type JSONMap map[string]interface{}

func (m JSONMap) Value() (driver.Value, error) { return json.Marshal(m) }
func (m *JSONMap) Scan(v interface{}) error {
	if v == nil {
		*m = nil
		return nil
	}
	var raw []byte
	switch x := v.(type) {
	case []byte:
		raw = x
	case string:
		raw = []byte(x)
	default:
		return fmt.Errorf("JSONMap: unsupported scan type %T", v)
	}
	if len(raw) == 0 {
		*m = JSONMap{}
		return nil
	}
	mm := make(map[string]interface{})
	if err := json.Unmarshal(raw, &mm); err != nil {
		return err
	}
	*m = mm
	return nil
}

// Project matches migration table "projects".
type Project struct {
	ID                    uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	WorkspaceID           uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	Name                  string         `gorm:"type:varchar(255);not null" json:"name"`
	Description           string         `gorm:"type:text" json:"description,omitempty"`
	Identifier            string         `gorm:"type:varchar(12)" json:"identifier,omitempty"`
	Slug                  string         `gorm:"type:varchar(100)" json:"slug,omitempty"`
	Network               int16          `gorm:"default:2" json:"network"`
	CreatedAt             time.Time      `json:"created_at"`
	UpdatedAt             time.Time      `json:"updated_at"`
	DeletedAt             gorm.DeletedAt `gorm:"index" json:"-"`
	CreatedByID           *uuid.UUID     `gorm:"type:uuid" json:"created_by_id,omitempty"`
	DefaultAssigneeID     *uuid.UUID     `gorm:"type:uuid" json:"default_assignee_id,omitempty"`
	ProjectLeadID         *uuid.UUID     `gorm:"type:uuid" json:"project_lead_id,omitempty"`
	UpdatedByID           *uuid.UUID     `gorm:"type:uuid" json:"updated_by_id,omitempty"`
	DefaultStateID        *uuid.UUID     `gorm:"type:uuid" json:"default_state_id,omitempty"`
	Emoji                 string         `gorm:"type:varchar(10)" json:"emoji,omitempty"`
	IconProp              JSONMap        `gorm:"column:icon_prop;type:jsonb;serializer:json" json:"icon_prop,omitempty"`
	ModuleView            bool           `gorm:"default:true" json:"module_view"`
	CycleView             bool           `gorm:"default:true" json:"cycle_view"`
	IssueViewsView        bool           `gorm:"column:issue_views_view;default:true" json:"issue_views_view"`
	PageView              bool           `gorm:"default:true" json:"page_view"`
	IntakeView            bool           `gorm:"default:true" json:"intake_view"`
	IsTimeTrackingEnabled bool           `gorm:"column:is_time_tracking_enabled;default:false" json:"is_time_tracking_enabled"`
	GuestViewAllFeatures  bool           `gorm:"column:guest_view_all_features;default:false" json:"guest_view_all_features"`
	CoverImage            string         `gorm:"column:cover_image;type:text" json:"cover_image,omitempty"`
	Timezone              string         `gorm:"default:UTC" json:"timezone"`
}

func (Project) TableName() string { return "projects" }

func (p *Project) BeforeCreate(tx *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}

// ProjectMember matches migration table "project_members".
type ProjectMember struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ProjectID   uuid.UUID      `gorm:"type:uuid;not null" json:"project_id"`
	WorkspaceID uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	MemberID    *uuid.UUID     `gorm:"type:uuid" json:"member_id"`
	Role        int16          `gorm:"not null;default:10" json:"role"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (ProjectMember) TableName() string { return "project_members" }

func (m *ProjectMember) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	return nil
}
