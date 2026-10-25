package service_test

import (
	"context"
	"testing"
	"time"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func isArchived(t *testing.T, db *gorm.DB, id uuid.UUID) bool {
	t.Helper()
	var iss model.Issue
	require.NoError(t, db.First(&iss, "id = ?", id).Error)
	return iss.ArchivedAt != nil
}

// Auto-archive only touches work items that are both settled (completed/cancelled
// state) and untouched for longer than the project's archive_in months; active or
// recently-settled items are left alone. Covers #194.
func TestAutoArchive_ArchivesOnlySettledStaleIssues(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)

	// Enable auto-archive after 1 month.
	require.NoError(t, ts.DB.Model(&model.Project{}).Where("id = ?", w.Project.ID).
		UpdateColumn("archive_in", 1).Error)

	doneState := testutil.CreateState(t, ts.DB, w.Project.ID, w.Workspace.ID)
	require.NoError(t, ts.DB.Model(doneState).Updates(map[string]any{"group": "completed"}).Error)

	old := time.Now().AddDate(0, -2, 0) // two months ago
	now := time.Now()

	// settled + stale -> should archive.
	settledOld := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	require.NoError(t, ts.DB.Model(&model.Issue{}).Where("id = ?", settledOld.ID).
		UpdateColumns(map[string]any{"state_id": doneState.ID, "updated_at": old}).Error)

	// settled + recent -> should not archive.
	settledRecent := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	require.NoError(t, ts.DB.Model(&model.Issue{}).Where("id = ?", settledRecent.ID).
		UpdateColumns(map[string]any{"state_id": doneState.ID, "updated_at": now}).Error)

	// active (no state -> backlog) + stale -> should not archive.
	activeOld := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	require.NoError(t, ts.DB.Model(&model.Issue{}).Where("id = ?", activeOld.ID).
		UpdateColumn("updated_at", old).Error)

	svc := service.NewAutomationService(store.NewProjectStore(ts.DB), store.NewIssueStore(ts.DB))
	n, err := svc.RunAutoArchive(context.Background())
	require.NoError(t, err)
	require.EqualValues(t, 1, n, "only the stale settled issue should be archived")

	require.True(t, isArchived(t, ts.DB, settledOld.ID))
	require.False(t, isArchived(t, ts.DB, settledRecent.ID))
	require.False(t, isArchived(t, ts.DB, activeOld.ID))

	// Running again is a no-op (already archived).
	n2, err := svc.RunAutoArchive(context.Background())
	require.NoError(t, err)
	require.EqualValues(t, 0, n2)
}

// A project with auto-archive disabled (archive_in = 0) is never touched.
func TestAutoArchive_DisabledProjectUntouched(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB) // archive_in defaults to 0

	doneState := testutil.CreateState(t, ts.DB, w.Project.ID, w.Workspace.ID)
	require.NoError(t, ts.DB.Model(doneState).Updates(map[string]any{"group": "completed"}).Error)

	old := time.Now().AddDate(0, -12, 0)
	iss := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	require.NoError(t, ts.DB.Model(&model.Issue{}).Where("id = ?", iss.ID).
		UpdateColumns(map[string]any{"state_id": doneState.ID, "updated_at": old}).Error)

	svc := service.NewAutomationService(store.NewProjectStore(ts.DB), store.NewIssueStore(ts.DB))
	n, err := svc.RunAutoArchive(context.Background())
	require.NoError(t, err)
	require.EqualValues(t, 0, n)
	require.False(t, isArchived(t, ts.DB, iss.ID))
}

func issueStateID(t *testing.T, db *gorm.DB, id uuid.UUID) *uuid.UUID {
	t.Helper()
	var iss model.Issue
	require.NoError(t, db.First(&iss, "id = ?", id).Error)
	return iss.StateID
}

// Auto-close moves only inactive (non-terminal) work items that were untouched
// past the project's close_in months into the project's cancelled state;
// recently-touched items and items already in a completed/cancelled state are
// left alone. Covers #193.
func TestAutoClose_ClosesOnlyInactiveStaleIssues(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)

	// Enable auto-close after 1 month.
	require.NoError(t, ts.DB.Model(&model.Project{}).Where("id = ?", w.Project.ID).
		UpdateColumn("close_in", 1).Error)

	// The close target: a state in the cancelled group.
	cancelledState := testutil.CreateState(t, ts.DB, w.Project.ID, w.Workspace.ID)
	require.NoError(t, ts.DB.Model(cancelledState).Updates(map[string]any{"group": "cancelled"}).Error)
	// A completed state, to prove terminal items are left alone.
	doneState := testutil.CreateState(t, ts.DB, w.Project.ID, w.Workspace.ID)
	require.NoError(t, ts.DB.Model(doneState).Updates(map[string]any{"group": "completed"}).Error)

	old := time.Now().AddDate(0, -2, 0) // two months ago
	now := time.Now()

	// active (no state -> backlog) + stale -> should close.
	inactiveOld := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	require.NoError(t, ts.DB.Model(&model.Issue{}).Where("id = ?", inactiveOld.ID).
		UpdateColumn("updated_at", old).Error)

	// active + recent -> should not close.
	inactiveRecent := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	require.NoError(t, ts.DB.Model(&model.Issue{}).Where("id = ?", inactiveRecent.ID).
		UpdateColumn("updated_at", now).Error)

	// already completed + stale -> should not close (already terminal).
	settledOld := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	require.NoError(t, ts.DB.Model(&model.Issue{}).Where("id = ?", settledOld.ID).
		UpdateColumns(map[string]any{"state_id": doneState.ID, "updated_at": old}).Error)

	svc := service.NewAutomationService(store.NewProjectStore(ts.DB), store.NewIssueStore(ts.DB))
	n, err := svc.RunAutoClose(context.Background())
	require.NoError(t, err)
	require.EqualValues(t, 1, n, "only the stale active issue should be closed")

	closed := issueStateID(t, ts.DB, inactiveOld.ID)
	require.NotNil(t, closed)
	require.Equal(t, cancelledState.ID, *closed)
	require.Nil(t, issueStateID(t, ts.DB, inactiveRecent.ID))
	require.Equal(t, doneState.ID, *issueStateID(t, ts.DB, settledOld.ID))

	// Running again is a no-op (the closed item now sits in the cancelled group).
	n2, err := svc.RunAutoClose(context.Background())
	require.NoError(t, err)
	require.EqualValues(t, 0, n2)
}

// A project with auto-close disabled (close_in = 0) is never touched.
func TestAutoClose_DisabledProjectUntouched(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB) // close_in defaults to 0

	cancelledState := testutil.CreateState(t, ts.DB, w.Project.ID, w.Workspace.ID)
	require.NoError(t, ts.DB.Model(cancelledState).Updates(map[string]any{"group": "cancelled"}).Error)

	old := time.Now().AddDate(0, -12, 0)
	iss := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	require.NoError(t, ts.DB.Model(&model.Issue{}).Where("id = ?", iss.ID).
		UpdateColumn("updated_at", old).Error)

	svc := service.NewAutomationService(store.NewProjectStore(ts.DB), store.NewIssueStore(ts.DB))
	n, err := svc.RunAutoClose(context.Background())
	require.NoError(t, err)
	require.EqualValues(t, 0, n)
	require.Nil(t, issueStateID(t, ts.DB, iss.ID))
}

// A project with auto-close enabled but no cancelled state has nowhere to close
// to, so inactive items are left untouched.
func TestAutoClose_NoCancelledStateSkips(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	require.NoError(t, ts.DB.Model(&model.Project{}).Where("id = ?", w.Project.ID).
		UpdateColumn("close_in", 1).Error)

	old := time.Now().AddDate(0, -6, 0)
	iss := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	require.NoError(t, ts.DB.Model(&model.Issue{}).Where("id = ?", iss.ID).
		UpdateColumn("updated_at", old).Error)

	svc := service.NewAutomationService(store.NewProjectStore(ts.DB), store.NewIssueStore(ts.DB))
	n, err := svc.RunAutoClose(context.Background())
	require.NoError(t, err)
	require.EqualValues(t, 0, n)
	require.Nil(t, issueStateID(t, ts.DB, iss.ID))
}
