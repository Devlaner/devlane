package model

import "time"

// Session matches migration table "sessions" (Django-style session store).
type Session struct {
	SessionKey  string    `gorm:"column:session_key;primaryKey;type:varchar(40)" json:"-"`
	SessionData string    `gorm:"column:session_data;type:text;not null" json:"-"`
	ExpireDate  time.Time `gorm:"column:expire_date;not null" json:"-"`
}

func (Session) TableName() string { return "sessions" }
