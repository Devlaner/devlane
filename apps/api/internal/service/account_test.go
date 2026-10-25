package service_test

import (
	"context"
	"testing"

	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func newAccountSvc(db *gorm.DB) *service.AccountService {
	return service.NewAccountService(
		store.NewUserStore(db),
		store.NewSessionStore(db),
		store.NewEmailChangeRequestStore(db),
		"test-email-change-secret",
	)
}

// Deactivate flips is_active off and evicts the user's sessions, and is
// idempotent. Covers #209.
func TestAccount_Deactivate(t *testing.T) {
	db := testutil.NewTestServer(t).DB
	ctx := context.Background()
	u := testutil.CreateUser(t, db)
	key := testutil.LoginAs(t, db, u)
	svc := newAccountSvc(db)

	require.NoError(t, svc.Deactivate(ctx, u.ID))

	got, err := store.NewUserStore(db).GetByID(ctx, u.ID)
	require.NoError(t, err)
	require.False(t, got.IsActive, "user should be deactivated")

	sd, err := store.NewSessionStore(db).Get(ctx, key)
	require.Nil(t, sd, "sessions should be evicted")
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)

	// Idempotent: deactivating again is a no-op that still succeeds.
	require.NoError(t, svc.Deactivate(ctx, u.ID))
}

// The email-change flow issues a code, rejects a wrong code, and on the correct
// code swaps the user's email (normalized) and clears the pending request.
func TestAccount_EmailChange_HappyPath(t *testing.T) {
	db := testutil.NewTestServer(t).DB
	ctx := context.Background()
	u := testutil.CreateUser(t, db)
	svc := newAccountSvc(db)

	code, err := svc.RequestEmailChange(ctx, u.ID, "New.Email@Example.com")
	require.NoError(t, err)
	require.Len(t, code, 6)

	_, err = svc.ConfirmEmailChange(ctx, u.ID, "wrong0")
	require.ErrorIs(t, err, service.ErrInvalidEmailCode)

	newEmail, err := svc.ConfirmEmailChange(ctx, u.ID, code)
	require.NoError(t, err)
	require.Equal(t, "new.email@example.com", newEmail)

	got, err := store.NewUserStore(db).GetByID(ctx, u.ID)
	require.NoError(t, err)
	require.NotNil(t, got.Email)
	require.Equal(t, "new.email@example.com", *got.Email)

	// The pending request is gone, so a second confirm fails.
	_, err = svc.ConfirmEmailChange(ctx, u.ID, code)
	require.ErrorIs(t, err, service.ErrNoPendingEmailChange)
}

// After too many wrong codes the pending request is invalidated, so even the
// correct code no longer works (defense against brute-forcing the 6-digit code).
func TestAccount_EmailChange_LocksOutAfterMaxAttempts(t *testing.T) {
	db := testutil.NewTestServer(t).DB
	ctx := context.Background()
	u := testutil.CreateUser(t, db)
	svc := newAccountSvc(db)

	code, err := svc.RequestEmailChange(ctx, u.ID, "later@example.com")
	require.NoError(t, err)

	for i := 0; i < 5; i++ {
		_, err = svc.ConfirmEmailChange(ctx, u.ID, "wrong0")
		require.ErrorIs(t, err, service.ErrInvalidEmailCode)
	}
	// The request is now gone; the correct code no longer verifies.
	_, err = svc.ConfirmEmailChange(ctx, u.ID, code)
	require.ErrorIs(t, err, service.ErrNoPendingEmailChange)
}

// Requesting a change to an address another account already uses is rejected.
func TestAccount_EmailChange_InUse(t *testing.T) {
	db := testutil.NewTestServer(t).DB
	ctx := context.Background()
	testutil.CreateUser(t, db, testutil.WithUserEmail("taken@example.com"))
	u := testutil.CreateUser(t, db)
	svc := newAccountSvc(db)

	_, err := svc.RequestEmailChange(ctx, u.ID, "taken@example.com")
	require.ErrorIs(t, err, service.ErrEmailInUse)
}

// Requesting a change to the current email is rejected.
func TestAccount_EmailChange_SameEmail(t *testing.T) {
	db := testutil.NewTestServer(t).DB
	ctx := context.Background()
	u := testutil.CreateUser(t, db, testutil.WithUserEmail("me@example.com"))
	svc := newAccountSvc(db)

	_, err := svc.RequestEmailChange(ctx, u.ID, "ME@example.com")
	require.ErrorIs(t, err, service.ErrSameEmail)
}
