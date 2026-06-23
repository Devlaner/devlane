package main

import (
	"context"
	"log/slog"
	"testing"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAdminGrant_CreatesAndIsIdempotent(t *testing.T) {
	ts := testutil.NewTestServer(t)
	ctx := context.Background()
	admins := store.NewInstanceAdminStore(ts.DB)
	u := testutil.CreateUser(t, ts.DB)

	// Grant succeeds and creates an active admin row.
	require.NoError(t, grantInstanceAdmin(ctx, ts.DB, *u.Email))
	ok, err := admins.IsAdmin(ctx, u.ID)
	require.NoError(t, err)
	assert.True(t, ok)

	// Granting again reports the user is already an admin.
	require.ErrorIs(t, grantInstanceAdmin(ctx, ts.DB, *u.Email), errAlreadyAdmin)

	// Unknown email is rejected.
	require.ErrorIs(t, grantInstanceAdmin(ctx, ts.DB, "nobody@test.local"), errNoSuchUser)
}

func TestBootstrapFirstAdmin_HealsFromAdminEmail(t *testing.T) {
	ts := testutil.NewTestServer(t)
	ctx := context.Background()
	admins := store.NewInstanceAdminStore(ts.DB)
	u := testutil.CreateUser(t, ts.DB)

	// Simulate a pre-existing instance: general.admin_email set, zero admins.
	require.NoError(t, store.NewInstanceSettingStore(ts.DB).Upsert(ctx, "general", model.JSONMap{
		"admin_email": *u.Email,
	}))
	n, err := admins.CountActive(ctx)
	require.NoError(t, err)
	require.Equal(t, int64(0), n)

	bootstrapFirstAdmin(ctx, ts.DB, slog.Default())

	ok, err := admins.IsAdmin(ctx, u.ID)
	require.NoError(t, err)
	assert.True(t, ok)

	// Idempotent: a second run does not add another admin.
	bootstrapFirstAdmin(ctx, ts.DB, slog.Default())
	n, err = admins.CountActive(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(1), n)
}

func TestBootstrapFirstAdmin_NoopWhenNoAdminEmail(t *testing.T) {
	ts := testutil.NewTestServer(t)
	ctx := context.Background()
	admins := store.NewInstanceAdminStore(ts.DB)

	bootstrapFirstAdmin(ctx, ts.DB, slog.Default())

	n, err := admins.CountActive(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(0), n)
}

func TestBootstrapFirstAdmin_NoopWhenAdminExists(t *testing.T) {
	ts := testutil.NewTestServer(t)
	ctx := context.Background()
	admins := store.NewInstanceAdminStore(ts.DB)

	existing := testutil.CreateUser(t, ts.DB)
	testutil.SeedInstanceAdmin(t, ts.DB, existing)

	// admin_email points at a different user, but an admin already exists.
	other := testutil.CreateUser(t, ts.DB)
	require.NoError(t, store.NewInstanceSettingStore(ts.DB).Upsert(ctx, "general", model.JSONMap{
		"admin_email": *other.Email,
	}))

	bootstrapFirstAdmin(ctx, ts.DB, slog.Default())

	n, err := admins.CountActive(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(1), n)
	ok, err := admins.IsAdmin(ctx, other.ID)
	require.NoError(t, err)
	assert.False(t, ok, "should not have promoted the admin_email user when an admin already exists")
}
