package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrEmailTaken         = errors.New("email already registered")
	ErrUsernameTaken      = errors.New("username already taken")
)

const bcryptCost = 12

type Service struct {
	userStore    *store.UserStore
	sessionStore *store.SessionStore
}

func NewService(userStore *store.UserStore, sessionStore *store.SessionStore) *Service {
	return &Service{userStore: userStore, sessionStore: sessionStore}
}

type SignUpRequest struct {
	Email     string `json:"email" binding:"required,email"`
	Password  string `json:"password" binding:"required,min=8"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

type SignInRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

func (s *Service) SignUp(ctx context.Context, req SignUpRequest) (sessionKey string, user *model.User, err error) {
	email := strings.TrimSpace(strings.ToLower(req.Email))
	existing, _ := s.userStore.GetByEmail(ctx, email)
	if existing != nil {
		return "", nil, ErrEmailTaken
	}
	username := email
	if at := strings.Index(email, "@"); at > 0 {
		username = strings.ReplaceAll(email[:at], ".", "_")
	}
	existing, _ = s.userStore.GetByUsername(ctx, username)
	if existing != nil {
		username = email
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcryptCost)
	if err != nil {
		return "", nil, err
	}
	u := &model.User{
		Username:    username,
		Email:       &email,
		Password:    string(hash),
		FirstName:   req.FirstName,
		LastName:    req.LastName,
		DisplayName: strings.TrimSpace(req.FirstName + " " + req.LastName),
		IsActive:    true,
	}
	if err := s.userStore.Create(ctx, u); err != nil {
		return "", nil, err
	}
	sessionKey, err = s.createSession(ctx, u.ID)
	if err != nil {
		return "", nil, err
	}
	return sessionKey, u, nil
}

func (s *Service) SignIn(ctx context.Context, req SignInRequest) (sessionKey string, user *model.User, err error) {
	email := strings.TrimSpace(strings.ToLower(req.Email))
	u, err := s.userStore.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", nil, ErrInvalidCredentials
		}
		return "", nil, err
	}
	if !u.IsActive {
		return "", nil, ErrInvalidCredentials
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(req.Password)); err != nil {
		return "", nil, ErrInvalidCredentials
	}
	sessionKey, err = s.createSession(ctx, u.ID)
	if err != nil {
		return "", nil, err
	}
	return sessionKey, u, nil
}

func (s *Service) SignOut(ctx context.Context, sessionKey string) error {
	return s.sessionStore.Delete(ctx, sessionKey)
}

func (s *Service) UserFromSession(ctx context.Context, sessionKey string) (*model.User, error) {
	if sessionKey == "" {
		return nil, nil
	}
	data, err := s.sessionStore.Get(ctx, sessionKey)
	if err != nil || data == nil {
		return nil, nil
	}
	return s.userStore.GetByID(ctx, data.UserID)
}

// UpdateProfile updates the user's profile (first name, last name, display name, timezone). Email is not updatable.
func (s *Service) UpdateProfile(ctx context.Context, u *model.User) error {
	return s.userStore.Update(ctx, u)
}

// ChangePassword verifies current password and sets a new one. Returns ErrInvalidCredentials if current password is wrong or user not found.
func (s *Service) ChangePassword(ctx context.Context, userID uuid.UUID, currentPassword, newPassword string) error {
	u, err := s.userStore.GetByID(ctx, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrInvalidCredentials
		}
		return err
	}
	if u == nil {
		return ErrInvalidCredentials
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(currentPassword)); err != nil {
		return ErrInvalidCredentials
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcryptCost)
	if err != nil {
		return err
	}
	u.Password = string(hash)
	return s.userStore.Update(ctx, u)
}

func (s *Service) createSession(ctx context.Context, userID uuid.UUID) (string, error) {
	key := make([]byte, 20)
	if _, err := rand.Read(key); err != nil {
		return "", err
	}
	sessionKey := hex.EncodeToString(key)
	return sessionKey, s.sessionStore.Create(ctx, sessionKey, userID)
}
