package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// UserFavorite matches user_favorites.
type UserFavorite struct {
	ID               uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name             string     `gorm:"type:varchar(255);not null" json:"name"`
	Type             string     `gorm:"type:varchar(50);not null" json:"type"`
	EntityType       string     `gorm:"type:varchar(50);not null;uniqueIndex:idx_user_fav_entity" json:"entity_type"`
	EntityIdentifier uuid.UUID  `gorm:"type:uuid;not null;uniqueIndex:idx_user_fav_entity" json:"entity_identifier"`
	WorkspaceID      uuid.UUID  `gorm:"type:uuid;not null" json:"workspace_id"`
	ProjectID        *uuid.UUID `gorm:"type:uuid" json:"project_id,omitempty"`
	UserID           uuid.UUID  `gorm:"type:uuid;not null;uniqueIndex:idx_user_fav_entity" json:"user_id"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
	CreatedByID      *uuid.UUID `gorm:"type:uuid" json:"created_by_id,omitempty"`
	UpdatedByID      *uuid.UUID `gorm:"type:uuid" json:"updated_by_id,omitempty"`
}

func (UserFavorite) TableName() string { return "user_favorites" }

func (u *UserFavorite) BeforeCreate(tx *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}
