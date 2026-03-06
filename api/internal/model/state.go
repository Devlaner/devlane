package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// State matches migration table "states" (workflow state for issues).
type State struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name        string         `gorm:"type:varchar(255);not null" json:"name"`
	Description string         `gorm:"type:text" json:"description,omitempty"`
	Color       string         `gorm:"type:varchar(255);not null" json:"color"`
	Slug        string         `gorm:"type:varchar(100)" json:"slug,omitempty"`
	ProjectID   uuid.UUID      `gorm:"type:uuid;not null" json:"project_id"`
	WorkspaceID uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	Sequence    float64        `gorm:"default:65535" json:"sequence"`
	Group       string         `gorm:"column:group;type:varchar(50);default:backlog" json:"group"`
	Default     bool           `gorm:"column:default;default:false" json:"default"`
}

func (State) TableName() string { return "states" }

func (s *State) BeforeCreate(tx *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return nil
}
