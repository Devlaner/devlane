package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Estimate matches estimates.
type Estimate struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name        string         `gorm:"type:varchar(255);not null" json:"name"`
	Type        string         `gorm:"type:varchar(255);default:categories" json:"type"`
	ProjectID   uuid.UUID      `gorm:"type:uuid;not null" json:"project_id"`
	WorkspaceID uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	CreatedByID *uuid.UUID     `gorm:"type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID *uuid.UUID     `gorm:"type:uuid" json:"updated_by_id,omitempty"`
}

func (Estimate) TableName() string { return "estimates" }

func (e *Estimate) BeforeCreate(tx *gorm.DB) error {
	if e.ID == uuid.Nil {
		e.ID = uuid.New()
	}
	return nil
}

// EstimatePoint matches estimate_points.
type EstimatePoint struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	EstimateID  uuid.UUID      `gorm:"type:uuid;not null" json:"estimate_id"`
	Key         int            `gorm:"default:0" json:"key"`
	Value       string         `gorm:"type:varchar(255);not null" json:"value"`
	ProjectID   uuid.UUID      `gorm:"type:uuid;not null" json:"project_id"`
	WorkspaceID uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	CreatedByID *uuid.UUID     `gorm:"type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID *uuid.UUID     `gorm:"type:uuid" json:"updated_by_id,omitempty"`
}

func (EstimatePoint) TableName() string { return "estimate_points" }

func (e *EstimatePoint) BeforeCreate(tx *gorm.DB) error {
	if e.ID == uuid.Nil {
		e.ID = uuid.New()
	}
	return nil
}
