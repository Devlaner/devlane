package store

import (
	"context"

	"github.com/Devlaner/devlane/api/internal/model"
	"gorm.io/gorm"
)

// InstanceSettingStore handles instance_settings persistence.
type InstanceSettingStore struct{ db *gorm.DB }

func NewInstanceSettingStore(db *gorm.DB) *InstanceSettingStore {
	return &InstanceSettingStore{db: db}
}

func (s *InstanceSettingStore) Get(ctx context.Context, key string) (*model.InstanceSetting, error) {
	var row model.InstanceSetting
	err := s.db.WithContext(ctx).Where("key = ?", key).First(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (s *InstanceSettingStore) GetAll(ctx context.Context) (map[string]model.InstanceSetting, error) {
	var rows []model.InstanceSetting
	if err := s.db.WithContext(ctx).Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make(map[string]model.InstanceSetting)
	for _, r := range rows {
		out[r.Key] = r
	}
	return out, nil
}

func (s *InstanceSettingStore) Set(ctx context.Context, key string, value model.JSONMap) error {
	return s.db.WithContext(ctx).Where("key = ?", key).Assign(model.InstanceSetting{Value: value}).FirstOrCreate(&model.InstanceSetting{Key: key, Value: value}).Error
}

// Upsert updates or creates the row for key with the given value.
func (s *InstanceSettingStore) Upsert(ctx context.Context, key string, value model.JSONMap) error {
	row := model.InstanceSetting{Key: key, Value: value}
	return s.db.WithContext(ctx).Save(&row).Error
}
