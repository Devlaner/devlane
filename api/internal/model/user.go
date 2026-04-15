package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// User matches migration table "users".
type User struct {
	ID                uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Password          string         `gorm:"type:varchar(128);not null" json:"-"`
	Username          string         `gorm:"type:varchar(128);uniqueIndex;not null" json:"username"`
	Email             *string        `gorm:"type:varchar(255);uniqueIndex" json:"email"`
	FirstName         string         `gorm:"column:first_name;type:varchar(255);default:''" json:"first_name"`
	LastName          string         `gorm:"column:last_name;type:varchar(255);default:''" json:"last_name"`
	DisplayName       string         `gorm:"column:display_name;type:varchar(255)" json:"display_name"`
	Avatar            string         `gorm:"type:text" json:"avatar,omitempty"`
	CoverImage        string         `gorm:"column:cover_image;type:text" json:"cover_image,omitempty"`
	DateJoined        time.Time      `gorm:"column:date_joined;not null" json:"date_joined"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
	IsActive          bool           `gorm:"column:is_active;default:true" json:"is_active"`
	IsOnboarded       bool           `gorm:"column:is_onboarded;default:false" json:"is_onboarded"`
	IsPasswordAutoset bool           `gorm:"column:is_password_autoset;default:false" json:"is_password_autoset"`
	UserTimezone      string         `gorm:"column:user_timezone;default:UTC" json:"user_timezone"`
}

func (User) TableName() string { return "users" }

// BeforeCreate sets ID and DateJoined if not set.
func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	if u.DateJoined.IsZero() {
		u.DateJoined = time.Now().UTC()
	}
	return nil
}
