package service

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/Devlaner/devlane/api/internal/auth"
	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrAccountUserNotFound  = errors.New("user not found")
	ErrEmailInUse           = errors.New("that email address is already in use")
	ErrSameEmail            = errors.New("that is already your email address")
	ErrInvalidEmailCode     = errors.New("invalid or expired code")
	ErrNoPendingEmailChange = errors.New("no pending email change")
)

// emailChangeCodeTTL bounds how long a verification code is valid, and
// maxEmailChangeAttempts bounds how many wrong guesses a code tolerates before
// it is invalidated (defense in depth alongside route rate limiting).
const (
	emailChangeCodeTTL     = 15 * time.Minute
	maxEmailChangeAttempts = 5
)

// AccountService handles self-service account actions: deactivation and the
// verified email-change flow.
type AccountService struct {
	users    *store.UserStore
	sessions *store.SessionStore
	changes  *store.EmailChangeRequestStore
	secret   string
}

func NewAccountService(users *store.UserStore, sessions *store.SessionStore, changes *store.EmailChangeRequestStore, secret string) *AccountService {
	return &AccountService{users: users, sessions: sessions, changes: changes, secret: secret}
}

// userByID returns the user or ErrAccountUserNotFound, normalizing the store's
// gorm.ErrRecordNotFound.
func (s *AccountService) userByID(ctx context.Context, userID uuid.UUID) (*model.User, error) {
	u, err := s.users.GetByID(ctx, userID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrAccountUserNotFound
	}
	if err != nil {
		return nil, err
	}
	return u, nil
}

// userByEmail returns the user with the given email, or nil when none exists
// (treating the store's gorm.ErrRecordNotFound as "available").
func (s *AccountService) userByEmail(ctx context.Context, email string) (*model.User, error) {
	u, err := s.users.GetByEmail(ctx, email)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return u, nil
}

// Deactivate marks the user inactive and evicts all of their sessions. It is
// idempotent: deactivating an already-inactive user just clears sessions.
func (s *AccountService) Deactivate(ctx context.Context, userID uuid.UUID) error {
	u, err := s.userByID(ctx, userID)
	if err != nil {
		return err
	}
	if u.IsActive {
		u.IsActive = false
		if err := s.users.Update(ctx, u); err != nil {
			return err
		}
	}
	return s.sessions.DeleteByUserID(ctx, userID)
}

// RequestEmailChange validates the desired new email and stores a pending,
// hashed verification code, replacing any earlier request. It returns the
// plaintext code so the caller can email it to newEmail (the code is never
// stored or logged in plaintext).
func (s *AccountService) RequestEmailChange(ctx context.Context, userID uuid.UUID, newEmail string) (string, error) {
	email := strings.ToLower(strings.TrimSpace(newEmail))
	u, err := s.userByID(ctx, userID)
	if err != nil {
		return "", err
	}
	if u.Email != nil && strings.EqualFold(strings.TrimSpace(*u.Email), email) {
		return "", ErrSameEmail
	}
	existing, err := s.userByEmail(ctx, email)
	if err != nil {
		return "", err
	}
	if existing != nil {
		return "", ErrEmailInUse
	}
	code, err := randomSixDigitCode()
	if err != nil {
		return "", err
	}
	req := &model.EmailChangeRequest{
		UserID:    userID,
		NewEmail:  email,
		CodeHash:  s.hashCode(userID, email, code),
		ExpiresAt: time.Now().Add(emailChangeCodeTTL),
	}
	if err := s.changes.Upsert(ctx, req); err != nil {
		return "", err
	}
	return code, nil
}

// ConfirmEmailChange verifies the code against the user's pending request and,
// on success, swaps the user's email and clears the request. The new email's
// availability is re-checked at confirm time to avoid a race with another
// signup.
func (s *AccountService) ConfirmEmailChange(ctx context.Context, userID uuid.UUID, code string) (string, error) {
	req, err := s.changes.GetByUserID(ctx, userID)
	if err != nil {
		return "", err
	}
	if req == nil {
		return "", ErrNoPendingEmailChange
	}
	if time.Now().After(req.ExpiresAt) || req.Attempts >= maxEmailChangeAttempts {
		_ = s.changes.DeleteByUserID(ctx, userID)
		return "", ErrInvalidEmailCode
	}
	want := s.hashCode(userID, req.NewEmail, code)
	if subtle.ConstantTimeCompare([]byte(req.CodeHash), []byte(want)) != 1 {
		if n, aerr := s.changes.IncrementAttempts(ctx, userID); aerr == nil && n >= maxEmailChangeAttempts {
			_ = s.changes.DeleteByUserID(ctx, userID)
		}
		return "", ErrInvalidEmailCode
	}
	existing, err := s.userByEmail(ctx, req.NewEmail)
	if err != nil {
		return "", err
	}
	if existing != nil && existing.ID != userID {
		_ = s.changes.DeleteByUserID(ctx, userID)
		return "", ErrEmailInUse
	}
	u, err := s.userByID(ctx, userID)
	if err != nil {
		return "", err
	}
	newEmail := req.NewEmail
	u.Email = &newEmail
	if err := s.users.Update(ctx, u); err != nil {
		return "", err
	}
	_ = s.changes.DeleteByUserID(ctx, userID)
	return newEmail, nil
}

// hashCode binds the code to the user and target email so a code for one change
// can never verify a different one. When no secret is configured it falls back
// to the same development-only key as magic-code login, rather than introducing
// a second hardcoded key.
func (s *AccountService) hashCode(userID uuid.UUID, email, code string) string {
	key := strings.TrimSpace(s.secret)
	if key == "" {
		key = auth.DefaultMagicCodeHMACKey
	}
	mac := hmac.New(sha256.New, []byte(key))
	_, _ = mac.Write([]byte(userID.String()))
	_, _ = mac.Write([]byte{0})
	_, _ = mac.Write([]byte(strings.ToLower(strings.TrimSpace(email))))
	_, _ = mac.Write([]byte{0})
	_, _ = mac.Write([]byte(strings.TrimSpace(code)))
	return hex.EncodeToString(mac.Sum(nil))
}

// randomSixDigitCode returns a uniformly random zero-padded 6-digit code.
func randomSixDigitCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}
