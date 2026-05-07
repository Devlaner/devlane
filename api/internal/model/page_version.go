package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// PageVersion matches page_versions — an immutable snapshot recorded on every
// content save so users can browse history and restore.
type PageVersion struct {
	ID                  uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	PageID              uuid.UUID `gorm:"type:uuid;not null" json:"page_id"`
	WorkspaceID         uuid.UUID `gorm:"type:uuid;not null" json:"workspace_id"`
	OwnedByID           uuid.UUID `gorm:"type:uuid;not null" json:"owned_by_id"`
	LastSavedAt         time.Time `gorm:"column:last_saved_at;not null" json:"last_saved_at"`
	DescriptionBinary   []byte    `gorm:"column:description_binary;type:bytea" json:"-"`
	DescriptionHTML     string    `gorm:"column:description_html;type:text;default:<p></p>" json:"description_html,omitempty"`
	DescriptionStripped string    `gorm:"column:description_stripped;type:text" json:"description_stripped,omitempty"`
	DescriptionJSON     JSONMap   `gorm:"column:description_json;type:jsonb;serializer:json" json:"description_json,omitempty"`
	SubPagesData        JSONMap   `gorm:"column:sub_pages_data;type:jsonb;serializer:json" json:"sub_pages_data,omitempty"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

func (PageVersion) TableName() string { return "page_versions" }

func (v *PageVersion) BeforeCreate(tx *gorm.DB) error {
	if v.ID == uuid.Nil {
		v.ID = uuid.New()
	}
	if v.LastSavedAt.IsZero() {
		v.LastSavedAt = time.Now()
	}
	return nil
}
