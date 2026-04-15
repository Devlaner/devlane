package auth

import (
	"context"
	"errors"
	"testing"

	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func newTestService(t *testing.T) (*Service, *gorm.DB) {
	t.Helper()

	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}

	// Our production models include Postgres-specific column types/defaults (e.g. uuid + gen_random_uuid()).
	// For unit tests, we create a SQLite-compatible schema that matches the columns used by stores.
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			password TEXT NOT NULL,
			username TEXT NOT NULL,
			email TEXT,
			first_name TEXT DEFAULT '',
			last_name TEXT DEFAULT '',
			display_name TEXT,
			avatar TEXT,
			cover_image TEXT,
			date_joined DATETIME NOT NULL,
			created_at DATETIME,
			updated_at DATETIME,
			deleted_at DATETIME,
			is_active INTEGER DEFAULT 1,
			is_onboarded INTEGER DEFAULT 0,
			is_password_autoset INTEGER DEFAULT 0,
			user_timezone TEXT DEFAULT 'UTC'
		);`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);`,
		`CREATE TABLE IF NOT EXISTS sessions (
			session_key TEXT PRIMARY KEY,
			session_data TEXT NOT NULL,
			expire_date DATETIME NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS password_reset_tokens (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			token TEXT NOT NULL UNIQUE,
			expires_at DATETIME NOT NULL,
			used_at DATETIME,
			created_at DATETIME
		);`,
		`CREATE INDEX IF NOT EXISTS idx_prt_user_id ON password_reset_tokens(user_id);`,
	}
	for _, s := range stmts {
		if err := db.Exec(s).Error; err != nil {
			t.Fatalf("create test schema: %v", err)
		}
	}

	userStore := store.NewUserStore(db)
	sessionStore := store.NewSessionStore(db)
	resetStore := store.NewPasswordResetTokenStore(db)

	svc := NewService(userStore, sessionStore, resetStore)
	return svc, db
}

func TestPasswordSignupSigninMeFlow(t *testing.T) {
	t.Parallel()
	ctx := context.Background()

	svc, _ := newTestService(t)

	// Sign up
	sessionKey, user, err := svc.SignUp(ctx, SignUpRequest{
		Email:     "Test.User@example.com",
		Password:  "S3cur3!Pass",
		FirstName: "Test",
		LastName:  "User",
	})
	if err != nil {
		t.Fatalf("SignUp: %v", err)
	}
	if user == nil || user.Email == nil || *user.Email != "test.user@example.com" {
		t.Fatalf("unexpected user email: %#v", user)
	}
	if sessionKey == "" {
		t.Fatalf("expected session key")
	}

	// Session -> user
	got, err := svc.UserFromSession(ctx, sessionKey)
	if err != nil {
		t.Fatalf("UserFromSession: %v", err)
	}
	if got == nil || got.ID != user.ID {
		t.Fatalf("unexpected user from session: %#v", got)
	}

	// Sign out invalidates session
	if err := svc.SignOut(ctx, sessionKey); err != nil {
		t.Fatalf("SignOut: %v", err)
	}
	got2, err := svc.UserFromSession(ctx, sessionKey)
	if err == nil && got2 != nil {
		t.Fatalf("expected no user after signout, got: %#v", got2)
	}

	// Sign in
	sessionKey2, user2, err := svc.SignIn(ctx, SignInRequest{
		Email:    "test.user@example.com",
		Password: "S3cur3!Pass",
	})
	if err != nil {
		t.Fatalf("SignIn: %v", err)
	}
	if sessionKey2 == "" {
		t.Fatalf("expected session key from SignIn")
	}
	if user2 == nil || user2.ID != user.ID {
		t.Fatalf("unexpected user from SignIn: %#v", user2)
	}
}

func TestEmailCheck(t *testing.T) {
	t.Parallel()
	ctx := context.Background()

	svc, _ := newTestService(t)

	exists, err := svc.EmailCheck(ctx, "nobody@example.com")
	if err != nil {
		t.Fatalf("EmailCheck: %v", err)
	}
	if exists {
		t.Fatalf("expected email to not exist")
	}

	_, _, err = svc.SignUp(ctx, SignUpRequest{
		Email:    "someone@example.com",
		Password: "S3cur3!Pass",
	})
	if err != nil {
		t.Fatalf("SignUp: %v", err)
	}

	exists2, err := svc.EmailCheck(ctx, "SOMEONE@EXAMPLE.COM")
	if err != nil {
		t.Fatalf("EmailCheck: %v", err)
	}
	if !exists2 {
		t.Fatalf("expected email to exist")
	}
}

func TestForgotResetPassword(t *testing.T) {
	t.Parallel()
	ctx := context.Background()

	svc, _ := newTestService(t)

	_, _, err := svc.SignUp(ctx, SignUpRequest{
		Email:    "resetme@example.com",
		Password: "OldP@ssw0rd!",
	})
	if err != nil {
		t.Fatalf("SignUp: %v", err)
	}

	token, err := svc.ForgotPassword(ctx, "resetme@example.com")
	if err != nil {
		t.Fatalf("ForgotPassword: %v", err)
	}
	if token == "" {
		t.Fatalf("expected non-empty reset token")
	}

	if err := svc.ResetPassword(ctx, token, "NewP@ssw0rd!"); err != nil {
		t.Fatalf("ResetPassword: %v", err)
	}

	// Old password no longer works
	_, _, err = svc.SignIn(ctx, SignInRequest{Email: "resetme@example.com", Password: "OldP@ssw0rd!"})
	if err == nil {
		t.Fatalf("expected old password to fail")
	}

	// New password works
	_, _, err = svc.SignIn(ctx, SignInRequest{Email: "resetme@example.com", Password: "NewP@ssw0rd!"})
	if err != nil {
		t.Fatalf("expected new password to work, got: %v", err)
	}

	// Token is no longer valid (invalidate-for-user)
	if err := svc.ResetPassword(ctx, token, "AnotherP@ssw0rd!"); err == nil {
		t.Fatalf("expected reused token to fail")
	}
}

func TestResetPasswordInactiveUser(t *testing.T) {
	t.Parallel()
	ctx := context.Background()

	svc, db := newTestService(t)

	_, user, err := svc.SignUp(ctx, SignUpRequest{
		Email:    "inactive-reset@example.com",
		Password: "OldP@ssw0rd!",
	})
	if err != nil {
		t.Fatalf("SignUp: %v", err)
	}

	token, err := svc.ForgotPassword(ctx, "inactive-reset@example.com")
	if err != nil {
		t.Fatalf("ForgotPassword: %v", err)
	}
	if token == "" {
		t.Fatalf("expected non-empty reset token")
	}

	if err := db.Exec("UPDATE users SET is_active = 0 WHERE id = ?", user.ID.String()).Error; err != nil {
		t.Fatalf("deactivate user: %v", err)
	}

	err = svc.ResetPassword(ctx, token, "NewP@ssw0rd!")
	if !errors.Is(err, ErrResetTokenInvalid) {
		t.Fatalf("expected ErrResetTokenInvalid, got %v", err)
	}
}

func TestSignUpMagicAndSessionForEmail(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	svc, _ := newTestService(t)

	sk1, u1, err := svc.SignUpMagic(ctx, "magic-new@example.com", "A", "B")
	if err != nil {
		t.Fatalf("SignUpMagic: %v", err)
	}
	if sk1 == "" || u1 == nil {
		t.Fatalf("expected session and user")
	}

	sk2, u2, err := svc.SessionForEmailUser(ctx, "magic-new@example.com")
	if err != nil {
		t.Fatalf("SessionForEmailUser: %v", err)
	}
	if sk2 == "" || u2 == nil || u2.ID != u1.ID {
		t.Fatalf("unexpected second session user: %#v", u2)
	}

	_, _, err = svc.SignUpMagic(ctx, "magic-new@example.com", "X", "Y")
	if err == nil || !errors.Is(err, ErrEmailTaken) {
		t.Fatalf("expected ErrEmailTaken, got %v", err)
	}
}
