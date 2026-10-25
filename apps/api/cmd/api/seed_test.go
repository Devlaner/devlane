package main

import (
	"context"
	"testing"

	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The local-dev seed creates a demo user, workspace, project, states, and
// issues, and is idempotent on a second run. Covers #24.
func TestSeedDevData_CreatesDemoAndIsIdempotent(t *testing.T) {
	ts := testutil.NewTestServer(t)
	ctx := context.Background()

	require.NoError(t, seedDevData(ctx, ts.DB))

	users := store.NewUserStore(ts.DB)
	u, err := users.GetByEmail(ctx, seedEmail)
	require.NoError(t, err)
	require.NotNil(t, u, "demo user should exist")

	ws := store.NewWorkspaceStore(ts.DB)
	wrk, err := ws.GetBySlug(ctx, seedWorkspaceSlug)
	require.NoError(t, err)
	require.NotNil(t, wrk)

	projects, err := store.NewProjectStore(ts.DB).ListByWorkspaceID(ctx, wrk.ID)
	require.NoError(t, err)
	require.Len(t, projects, 1)

	states, err := store.NewStateStore(ts.DB).ListByProjectID(ctx, projects[0].ID)
	require.NoError(t, err)
	require.Len(t, states, 5)
	defaults := 0
	for _, s := range states {
		if s.Default {
			defaults++
		}
	}
	assert.Equal(t, 1, defaults, "exactly one default state")

	issues, err := store.NewIssueStore(ts.DB).ListByProjectID(ctx, projects[0].ID, 100, 0)
	require.NoError(t, err)
	assert.Len(t, issues, 5)

	// Second run is a no-op: no error and no duplicate workspace/issues.
	require.NoError(t, seedDevData(ctx, ts.DB))
	issues2, err := store.NewIssueStore(ts.DB).ListByProjectID(ctx, projects[0].ID, 100, 0)
	require.NoError(t, err)
	assert.Len(t, issues2, 5, "second seed should not add issues")
}
