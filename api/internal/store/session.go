package store

import (
	"context"
	"encoding/json"
	"time"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

const sessionExpireDays = 14

// SessionData stored in sessions.session_data (JSON).
type SessionData struct {
	UserID uuid.UUID `json:"user_id"`
}

// SessionStore handles session persistence using the sessions table.
type SessionStore struct{ db *gorm.DB }

func NewSessionStore(db *gorm.DB) *SessionStore { return &SessionStore{db: db} }

func (s *SessionStore) Create(ctx context.Context, sessionKey string, userID uuid.UUID) error {
	data, _ := json.Marshal(SessionData{UserID: userID})
	expire := time.Now().UTC().AddDate(0, 0, sessionExpireDays)
	rec := &model.Session{
		SessionKey:  sessionKey,
		SessionData:  string(data),
		ExpireDate:   expire,
	}
	return s.db.WithContext(ctx).Create(rec).Error
}

func (s *SessionStore) Get(ctx context.Context, sessionKey string) (*SessionData, error) {
	var rec model.Session
	err := s.db.WithContext(ctx).Where("session_key = ? AND expire_date > ?", sessionKey, time.Now().UTC()).First(&rec).Error
	if err != nil {
		return nil, err
	}
	var data SessionData
	if err := json.Unmarshal([]byte(rec.SessionData), &data); err != nil {
		return nil, err
	}
	return &data, nil
}

func (s *SessionStore) Delete(ctx context.Context, sessionKey string) error {
	return s.db.WithContext(ctx).Where("session_key = ?", sessionKey).Delete(&model.Session{}).Error
}

func (s *SessionStore) RefreshExpire(ctx context.Context, sessionKey string) error {
	expire := time.Now().UTC().AddDate(0, 0, sessionExpireDays)
	return s.db.WithContext(ctx).Model(&model.Session{}).Where("session_key = ?", sessionKey).Update("expire_date", expire).Error
}
