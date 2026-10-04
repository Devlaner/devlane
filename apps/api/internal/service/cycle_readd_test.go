package service_test

import (
	"context"
	"testing"

	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/require"
)

// Removing an issue from a cycle soft-deletes the link, but the unique
// (cycle_id, issue_id) constraint ignores deleted_at, so re-adding used to fail
// with a 500. AddCycleIssue now revives the soft-deleted row.
func TestCycleIssueReAddAfterRemove(t *testing.T) {
	ts := testutil.NewTestServer(t)
	db := ts.DB
	ctx := context.Background()
	w := testutil.SeedWorld(t, db)

	svc := service.NewCycleService(
		store.NewCycleStore(db),
		store.NewProjectStore(db),
		store.NewWorkspaceStore(db),
	)
	svc.SetIssueStore(store.NewIssueStore(db))

	cycle := testutil.CreateCycle(t, db, w.Project.ID, w.Workspace.ID, w.User.ID)
	issue := testutil.CreateIssue(t, db, w.Project.ID, w.Workspace.ID, w.User.ID)

	require.NoError(t, svc.AddCycleIssue(ctx, w.Workspace.Slug, w.Project.ID, cycle.ID, issue.ID, w.User.ID))
	require.NoError(t, svc.RemoveCycleIssue(ctx, w.Workspace.Slug, w.Project.ID, cycle.ID, issue.ID, w.User.ID))
	// The re-add is the regression: it used to hit a unique violation.
	require.NoError(t, svc.AddCycleIssue(ctx, w.Workspace.Slug, w.Project.ID, cycle.ID, issue.ID, w.User.ID))

	ids, err := svc.ListCycleIssueIDs(ctx, w.Workspace.Slug, w.Project.ID, cycle.ID, w.User.ID)
	require.NoError(t, err)
	require.Contains(t, ids, issue.ID, "re-added issue should be an active member of the cycle")
}
