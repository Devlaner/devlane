package model

import (
	"time"
)

// InstanceSetting holds one section of instance admin settings (key-value, value is JSONB).
type InstanceSetting struct {
	Key       string    `gorm:"type:varchar(64);primaryKey" json:"key"`
	Value     JSONMap   `gorm:"type:jsonb;not null;default:{}" json:"value"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (InstanceSetting) TableName() string { return "instance_settings" }
