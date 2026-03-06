package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// WorkspaceMemberInvite matches workspace_member_invites.
type WorkspaceMemberInvite struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	WorkspaceID uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	Email       string         `gorm:"type:varchar(255);not null" json:"email"`
	Accepted    bool           `gorm:"default:false" json:"accepted"`
	Token       string         `gorm:"type:varchar(255);not null" json:"token"`
	Message     string         `gorm:"type:text" json:"message,omitempty"`
	RespondedAt *time.Time     `gorm:"type:timestamptz" json:"responded_at,omitempty"`
	Role        int16          `gorm:"not null;default:10" json:"role"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	CreatedByID *uuid.UUID     `gorm:"type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID *uuid.UUID     `gorm:"type:uuid" json:"updated_by_id,omitempty"`
}

func (WorkspaceMemberInvite) TableName() string { return "workspace_member_invites" }

func (w *WorkspaceMemberInvite) BeforeCreate(tx *gorm.DB) error {
	if w.ID == uuid.Nil {
		w.ID = uuid.New()
	}
	return nil
}

// ProjectMemberInvite matches project_member_invites.
type ProjectMemberInvite struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ProjectID   uuid.UUID      `gorm:"type:uuid;not null" json:"project_id"`
	WorkspaceID uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	Email       string         `gorm:"type:varchar(255);not null" json:"email"`
	Accepted    bool           `gorm:"default:false" json:"accepted"`
	Token       string         `gorm:"type:varchar(255);not null" json:"token"`
	Message     string         `gorm:"type:text" json:"message,omitempty"`
	RespondedAt *time.Time     `gorm:"type:timestamptz" json:"responded_at,omitempty"`
	Role        int16          `gorm:"not null;default:10" json:"role"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	CreatedByID *uuid.UUID     `gorm:"type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID *uuid.UUID     `gorm:"type:uuid" json:"updated_by_id,omitempty"`
}

func (ProjectMemberInvite) TableName() string { return "project_member_invites" }

func (p *ProjectMemberInvite) BeforeCreate(tx *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}
