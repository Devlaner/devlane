package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// UserFavorite matches user_favorites. A row is either a favorited entity
// (is_folder = false) or a folder (is_folder = true) that other favorites nest
// under via parent_id. sort_order orders siblings.
type UserFavorite struct {
	ID               uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name             string     `gorm:"type:varchar(255);not null" json:"name"`
	Type             string     `gorm:"type:varchar(50);not null" json:"type"`
	EntityType       string     `gorm:"type:varchar(50);not null;uniqueIndex:idx_user_fav_entity" json:"entity_type"`
	EntityIdentifier uuid.UUID  `gorm:"type:uuid;not null;uniqueIndex:idx_user_fav_entity" json:"entity_identifier"`
	IsFolder         bool       `gorm:"column:is_folder;not null;default:false" json:"is_folder"`
	ParentID         *uuid.UUID `gorm:"column:parent_id;type:uuid" json:"parent_id,omitempty"`
	SortOrder        float64    `gorm:"column:sort_order;not null;default:65535" json:"sort_order"`
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
