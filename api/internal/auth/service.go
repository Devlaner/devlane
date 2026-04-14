package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"
	"time"

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
	ErrResetTokenInvalid  = errors.New("invalid or expired reset token")
)

const bcryptCost = 12

// dummyHash is used for timing-safe responses when a user is not found.
var dummyHash []byte

func init() {
	h, _ := bcrypt.GenerateFromPassword([]byte("timing-safe-dummy"), bcryptCost)
	dummyHash = h
}

type Service struct {
	userStore       *store.UserStore
	sessionStore    *store.SessionStore
	resetTokenStore *store.PasswordResetTokenStore
	accountStore    *store.AccountStore
}

func NewService(userStore *store.UserStore, sessionStore *store.SessionStore, resetTokenStore *store.PasswordResetTokenStore) *Service {
	return &Service{userStore: userStore, sessionStore: sessionStore, resetTokenStore: resetTokenStore}
}

func (s *Service) SetAccountStore(as *store.AccountStore) { s.accountStore = as }

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

// EmailExists returns true if a user with the given email is registered.
func (s *Service) EmailExists(ctx context.Context, email string) bool {
	email = strings.TrimSpace(strings.ToLower(email))
	u, err := s.userStore.GetByEmail(ctx, email)
	return err == nil && u != nil
}

// UpdateUser persists changes to a user row (e.g. setting is_onboarded).
func (s *Service) UpdateUser(ctx context.Context, u *model.User) error {
	return s.userStore.Update(ctx, u)
}

// SignUpMagic creates a new user with a random password (same pattern as OAuth) and starts a session.
func (s *Service) SignUpMagic(ctx context.Context, email, firstName, lastName string) (sessionKey string, user *model.User, err error) {
	email = strings.TrimSpace(strings.ToLower(email))
	existing, _ := s.userStore.GetByEmail(ctx, email)
	if existing != nil {
		return "", nil, ErrEmailTaken
	}
	username := email
	if at := strings.Index(email, "@"); at > 0 {
		username = strings.ReplaceAll(email[:at], ".", "_")
	}
	if existing, _ = s.userStore.GetByUsername(ctx, username); existing != nil {
		username = email
	}
	dummyPwd := make([]byte, 32)
	if _, err := rand.Read(dummyPwd); err != nil {
		return "", nil, err
	}
	hash, err := bcrypt.GenerateFromPassword(dummyPwd, bcryptCost)
	if err != nil {
		return "", nil, err
	}
	u := &model.User{
		Username:          username,
		Email:             &email,
		Password:          string(hash),
		FirstName:         firstName,
		LastName:          lastName,
		DisplayName:       strings.TrimSpace(firstName + " " + lastName),
		IsActive:          true,
		IsPasswordAutoset: true,
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

// SessionForEmailUser creates a new session for an existing user by email (magic-code / trusted flows).
func (s *Service) SessionForEmailUser(ctx context.Context, email string) (sessionKey string, user *model.User, err error) {
	email = strings.TrimSpace(strings.ToLower(email))
	u, err := s.userStore.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", nil, ErrInvalidCredentials
		}
		return "", nil, err
	}
	if u == nil || !u.IsActive {
		return "", nil, ErrInvalidCredentials
	}
	sessionKey, err = s.createSession(ctx, u.ID)
	if err != nil {
		return "", nil, err
	}
	return sessionKey, u, nil
}

// SignIn authenticates a user with email+password. Uses a dummy bcrypt comparison
// when the user is not found to prevent timing-based user enumeration.
func (s *Service) SignIn(ctx context.Context, req SignInRequest) (sessionKey string, user *model.User, err error) {
	email := strings.TrimSpace(strings.ToLower(req.Email))
	u, err := s.userStore.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			_ = bcrypt.CompareHashAndPassword(dummyHash, []byte(req.Password))
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

func (s *Service) UpdateProfile(ctx context.Context, u *model.User) error {
	return s.userStore.Update(ctx, u)
}

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

// EmailCheck determines whether an email is already registered.
func (s *Service) EmailCheck(ctx context.Context, email string) (exists bool, err error) {
	email = strings.TrimSpace(strings.ToLower(email))
	u, err := s.userStore.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil
		}
		return false, err
	}
	return u != nil, nil
}

// ForgotPassword generates a reset token for the given email.
// Returns ("", nil) when the email does not exist (to prevent user enumeration).
func (s *Service) ForgotPassword(ctx context.Context, email string) (token string, err error) {
	if s.resetTokenStore == nil {
		return "", errors.New("password reset not configured")
	}
	email = strings.TrimSpace(strings.ToLower(email))
	u, err := s.userStore.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", nil
		}
		return "", err
	}
	if u == nil || !u.IsActive {
		return "", nil
	}
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", err
	}
	token = hex.EncodeToString(tokenBytes)
	if err := s.resetTokenStore.Create(ctx, u.ID, token); err != nil {
		return "", err
	}
	return token, nil
}

// ResetPassword validates the reset token and sets a new password.
// After a successful reset, ALL unused tokens for the user are invalidated.
func (s *Service) ResetPassword(ctx context.Context, token, newPassword string) error {
	if s.resetTokenStore == nil {
		return ErrResetTokenInvalid
	}
	rt, err := s.resetTokenStore.GetValid(ctx, token)
	if err != nil || rt == nil {
		return ErrResetTokenInvalid
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcryptCost)
	if err != nil {
		return err
	}
	u, err := s.userStore.GetByID(ctx, rt.UserID)
	if err != nil {
		return ErrResetTokenInvalid
	}
	u.Password = string(hash)
	if err := s.userStore.Update(ctx, u); err != nil {
		return err
	}
	_ = s.resetTokenStore.InvalidateForUser(ctx, rt.UserID)
	return nil
}

var ErrPasswordAlreadySet = errors.New("password is already set")

// SetPassword lets a user who signed up via OAuth/magic set their first password.
func (s *Service) SetPassword(ctx context.Context, userID uuid.UUID, newPassword string) error {
	u, err := s.userStore.GetByID(ctx, userID)
	if err != nil {
		return err
	}
	if u == nil {
		return ErrInvalidCredentials
	}
	if !u.IsPasswordAutoset {
		return ErrPasswordAlreadySet
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcryptCost)
	if err != nil {
		return err
	}
	u.Password = string(hash)
	u.IsPasswordAutoset = false
	return s.userStore.Update(ctx, u)
}

// OAuthLogin finds or creates a user from OAuth provider data and creates a session.
// If the email already exists, it links the account; if not, it creates a new user.
// isNewUser is true when a brand-new user row was created (first-time sign-up).
func (s *Service) OAuthLogin(ctx context.Context, provider, providerAccountID, email, firstName, lastName, avatar, accessToken, refreshToken, idToken string) (sessionKey string, user *model.User, isNewUser bool, err error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return "", nil, false, errors.New("oauth: email is required")
	}

	u, err := s.userStore.GetByEmail(ctx, email)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return "", nil, false, err
	}

	if u != nil && !u.IsActive {
		return "", nil, false, errors.New("account is deactivated")
	}

	newUser := u == nil
	if newUser {
		username := email
		if at := strings.Index(email, "@"); at > 0 {
			username = strings.ReplaceAll(email[:at], ".", "_")
		}
		if existing, _ := s.userStore.GetByUsername(ctx, username); existing != nil {
			username = email
		}
		dummyPwd := make([]byte, 32)
		_, _ = rand.Read(dummyPwd)
		hash, _ := bcrypt.GenerateFromPassword(dummyPwd, bcryptCost)
		u = &model.User{
			Username:          username,
			Email:             &email,
			Password:          string(hash),
			FirstName:         firstName,
			LastName:          lastName,
			DisplayName:       strings.TrimSpace(firstName + " " + lastName),
			Avatar:            avatar,
			IsActive:          true,
			IsPasswordAutoset: true,
		}
		if err := s.userStore.Create(ctx, u); err != nil {
			return "", nil, false, err
		}
	}

	if s.accountStore != nil {
		now := time.Now().UTC()
		_ = s.accountStore.Upsert(ctx, &model.Account{
			UserID:            u.ID,
			Provider:          provider,
			ProviderAccountID: providerAccountID,
			AccessToken:       accessToken,
			RefreshToken:      refreshToken,
			IDToken:           idToken,
			LastConnectedAt:   &now,
		})
	}

	sessionKey, err = s.createSession(ctx, u.ID)
	if err != nil {
		return "", nil, false, err
	}
	return sessionKey, u, newUser, nil
}

func (s *Service) createSession(ctx context.Context, userID uuid.UUID) (string, error) {
	key := make([]byte, 20)
	if _, err := rand.Read(key); err != nil {
		return "", err
	}
	sessionKey := hex.EncodeToString(key)
	return sessionKey, s.sessionStore.Create(ctx, sessionKey, userID)
}
