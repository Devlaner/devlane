package store

import "gorm.io/gorm"

type AnalyticsStore struct{ db *gorm.DB }
