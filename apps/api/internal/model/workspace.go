package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Workspace matches migration table "workspaces".
type Workspace struct {
	ID               uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name             string         `gorm:"type:varchar(255);not null" json:"name"`
	Logo             string         `gorm:"type:text" json:"logo,omitempty"`
	Slug             string         `gorm:"type:varchar(100);uniqueIndex;not null" json:"slug"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
	CreatedByID      *uuid.UUID     `gorm:"type:uuid" json:"created_by_id,omitempty"`
	OwnerID          uuid.UUID      `gorm:"type:uuid;not null" json:"owner_id"`
	UpdatedByID      *uuid.UUID     `gorm:"type:uuid" json:"updated_by_id,omitempty"`
	OrganizationSize string         `gorm:"column:organization_size;type:varchar(50)" json:"organization_size,omitempty"`
	Timezone         string         `gorm:"default:UTC" json:"timezone"`
	BackgroundColor  string         `gorm:"column:background_color;type:varchar(255)" json:"background_color,omitempty"`
}

func (Workspace) TableName() string { return "workspaces" }

// Workspace/project member role levels (int16, ascending privilege).
// These mirror the values used throughout the API and tests.
const (
	RoleGuest  int16 = 5
	RoleMember int16 = 10
	RoleAdmin  int16 = 15
	RoleOwner  int16 = 20
)

// IsValidRole reports whether r is one of the defined member role levels.
func IsValidRole(r int16) bool {
	switch r {
	case RoleGuest, RoleMember, RoleAdmin, RoleOwner:
		return true
	}
	return false
}

func (w *Workspace) BeforeCreate(tx *gorm.DB) error {
	if w.ID == uuid.Nil {
		w.ID = uuid.New()
	}
	return nil
}

// WorkspaceMember matches migration table "workspace_members".
type WorkspaceMember struct {
	ID                uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	WorkspaceID       uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	MemberID          uuid.UUID      `gorm:"type:uuid;not null" json:"member_id"`
	Role              int16          `gorm:"not null;default:10" json:"role"`
	MemberDisplayName string         `gorm:"column:member_display_name;->" json:"member_display_name,omitempty"`
	MemberEmail       *string        `gorm:"column:member_email;->" json:"member_email,omitempty"`
	MemberAvatar      string         `gorm:"column:member_avatar;->" json:"member_avatar,omitempty"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}

func (WorkspaceMember) TableName() string { return "workspace_members" }

func (m *WorkspaceMember) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	return nil
}
