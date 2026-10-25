package store_test

import (
	"context"
	"testing"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/require"
)

// Resolve returns the most specific stored row (project → workspace → account),
// and nil when nothing is stored. Covers the scoped-preference resolution in #203.
func TestNotifPref_ResolvePrecedence(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	s := store.NewUserNotificationPreferenceStore(ts.DB)
	ctx := context.Background()
	ws := w.Workspace.ID
	proj := w.Project.ID

	// Nothing stored -> nil (caller uses the all-enabled default).
	got, err := s.Resolve(ctx, w.User.ID, &ws, &proj)
	require.NoError(t, err)
	require.Nil(t, got)

	// Account-level row with comment off.
	require.NoError(t, s.UpsertGlobal(ctx, &model.UserNotificationPreference{
		UserID: w.User.ID, PropertyChange: true, StateChange: true, Comment: false, Mention: true, IssueCompleted: true,
	}))
	got, err = s.Resolve(ctx, w.User.ID, &ws, &proj)
	require.NoError(t, err)
	require.NotNil(t, got)
	require.False(t, got.Comment, "falls back to the account row")

	// Workspace row with comment on, mention off -> now wins over account.
	require.NoError(t, s.UpsertScoped(ctx, &model.UserNotificationPreference{
		UserID: w.User.ID, WorkspaceID: &ws, PropertyChange: true, StateChange: true, Comment: true, Mention: false, IssueCompleted: true,
	}))
	got, err = s.Resolve(ctx, w.User.ID, &ws, &proj)
	require.NoError(t, err)
	require.True(t, got.Comment)
	require.False(t, got.Mention, "workspace row wins over account")

	// Project row with mention on -> most specific, wins over workspace.
	require.NoError(t, s.UpsertScoped(ctx, &model.UserNotificationPreference{
		UserID: w.User.ID, WorkspaceID: &ws, ProjectID: &proj, PropertyChange: true, StateChange: true, Comment: true, Mention: true, IssueCompleted: true,
	}))
	got, err = s.Resolve(ctx, w.User.ID, &ws, &proj)
	require.NoError(t, err)
	require.True(t, got.Mention, "project row wins over workspace")

	// A different project still resolves to the workspace row (mention off).
	otherProj := testutil.CreateProject(t, ts.DB, w.Workspace.ID, w.User.ID)
	got, err = s.Resolve(ctx, w.User.ID, &ws, &otherProj.ID)
	require.NoError(t, err)
	require.False(t, got.Mention, "unconfigured project inherits the workspace row")
}
