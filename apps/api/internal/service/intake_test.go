package service_test

import (
	"context"
	"testing"
	"time"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func newIntakeSvc(db *gorm.DB) *service.IntakeService {
	return service.NewIntakeService(
		store.NewIntakeStore(db),
		store.NewIssueStore(db),
		store.NewProjectStore(db),
		store.NewWorkspaceStore(db),
	)
}

func makeDraft(t *testing.T, db *gorm.DB, w testutil.SeededWorld) *model.Issue {
	t.Helper()
	iss := testutil.CreateIssue(t, db, w.Project.ID, w.Workspace.ID, w.User.ID)
	require.NoError(t, db.Model(&model.Issue{}).Where("id = ?", iss.ID).UpdateColumn("is_draft", true).Error)
	return iss
}

// The intake list backfills a pending row for every draft in the project (and
// only drafts), joining the work-item summary. Covers #196.
func TestIntake_ListBackfillsDrafts(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	svc := newIntakeSvc(ts.DB)
	ctx := context.Background()

	d1 := makeDraft(t, ts.DB, w)
	makeDraft(t, ts.DB, w)
	active := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID) // not a draft

	items, err := svc.List(ctx, w.Workspace.Slug, w.Project.ID, w.User.ID, nil)
	require.NoError(t, err)
	require.Len(t, items, 2, "only the two drafts should be in intake")
	for _, it := range items {
		require.Equal(t, model.IntakeStatusPending, it.Status)
		require.NotEqual(t, active.ID, it.IssueID)
		require.NotZero(t, it.Issue.SequenceID)
	}

	// Idempotent: listing again does not create duplicate rows.
	again, err := svc.List(ctx, w.Workspace.Slug, w.Project.ID, w.User.ID, nil)
	require.NoError(t, err)
	require.Len(t, again, 2)

	// The pending count matches.
	n, err := svc.PendingCount(ctx, w.Workspace.Slug, w.Project.ID, w.User.ID)
	require.NoError(t, err)
	require.EqualValues(t, 2, n)
	_ = d1
}

func itemForIssue(t *testing.T, items []service.IntakeItem, issueID interface{ String() string }) service.IntakeItem {
	t.Helper()
	for _, it := range items {
		if it.IssueID.String() == issueID.String() {
			return it
		}
	}
	t.Fatalf("no intake item for issue %s", issueID.String())
	return service.IntakeItem{}
}

// Accepting promotes the draft into an active work item and marks it accepted.
func TestIntake_Accept(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	svc := newIntakeSvc(ts.DB)
	ctx := context.Background()
	d := makeDraft(t, ts.DB, w)

	items, err := svc.List(ctx, w.Workspace.Slug, w.Project.ID, w.User.ID, nil)
	require.NoError(t, err)
	it := itemForIssue(t, items, d.ID)

	require.NoError(t, svc.Accept(ctx, w.Workspace.Slug, w.Project.ID, it.ID, w.User.ID))

	iss, err := store.NewIssueStore(ts.DB).GetByID(ctx, d.ID)
	require.NoError(t, err)
	require.False(t, iss.IsDraft, "accepted item is no longer a draft")

	n, err := svc.PendingCount(ctx, w.Workspace.Slug, w.Project.ID, w.User.ID)
	require.NoError(t, err)
	require.EqualValues(t, 0, n)

	accepted, err := svc.List(ctx, w.Workspace.Slug, w.Project.ID, w.User.ID, []int{model.IntakeStatusAccepted})
	require.NoError(t, err)
	require.Len(t, accepted, 1)
}

// Snooze hides an item until its snooze time; a past time is rejected.
func TestIntake_Snooze(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	svc := newIntakeSvc(ts.DB)
	ctx := context.Background()
	d := makeDraft(t, ts.DB, w)
	items, _ := svc.List(ctx, w.Workspace.Slug, w.Project.ID, w.User.ID, nil)
	it := itemForIssue(t, items, d.ID)

	require.ErrorIs(t,
		svc.Snooze(ctx, w.Workspace.Slug, w.Project.ID, it.ID, w.User.ID, time.Now().Add(-time.Hour)),
		service.ErrIntakeNeedSnooze)

	require.NoError(t, svc.Snooze(ctx, w.Workspace.Slug, w.Project.ID, it.ID, w.User.ID, time.Now().Add(48*time.Hour)))
	n, err := svc.PendingCount(ctx, w.Workspace.Slug, w.Project.ID, w.User.ID)
	require.NoError(t, err)
	require.EqualValues(t, 0, n, "snoozed item is not pending")
	snoozed, err := svc.List(ctx, w.Workspace.Slug, w.Project.ID, w.User.ID, []int{model.IntakeStatusSnoozed})
	require.NoError(t, err)
	require.Len(t, snoozed, 1)
}

// Decline removes from the queue; MarkDuplicate records the target and needs one.
func TestIntake_DeclineAndDuplicate(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	svc := newIntakeSvc(ts.DB)
	ctx := context.Background()
	d1 := makeDraft(t, ts.DB, w)
	d2 := makeDraft(t, ts.DB, w)
	target := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)

	items, _ := svc.List(ctx, w.Workspace.Slug, w.Project.ID, w.User.ID, nil)
	it1 := itemForIssue(t, items, d1.ID)
	it2 := itemForIssue(t, items, d2.ID)

	require.NoError(t, svc.Decline(ctx, w.Workspace.Slug, w.Project.ID, it1.ID, w.User.ID))
	require.NoError(t, svc.MarkDuplicate(ctx, w.Workspace.Slug, w.Project.ID, it2.ID, w.User.ID, target.ID))

	n, err := svc.PendingCount(ctx, w.Workspace.Slug, w.Project.ID, w.User.ID)
	require.NoError(t, err)
	require.EqualValues(t, 0, n)

	dup, err := svc.List(ctx, w.Workspace.Slug, w.Project.ID, w.User.ID, []int{model.IntakeStatusDuplicate})
	require.NoError(t, err)
	require.Len(t, dup, 1)
	require.NotNil(t, dup[0].DuplicateToID)
	require.Equal(t, target.ID, *dup[0].DuplicateToID)
}

// A duplicate target that isn't a work item in this project is rejected.
func TestIntake_MarkDuplicate_RejectsForeignTarget(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	svc := newIntakeSvc(ts.DB)
	ctx := context.Background()
	d := makeDraft(t, ts.DB, w)
	items, _ := svc.List(ctx, w.Workspace.Slug, w.Project.ID, w.User.ID, nil)
	it := itemForIssue(t, items, d.ID)

	// A work item that lives in a different project.
	otherProject := testutil.CreateProject(t, ts.DB, w.Workspace.ID, w.User.ID)
	foreign := testutil.CreateIssue(t, ts.DB, otherProject.ID, w.Workspace.ID, w.User.ID)

	require.ErrorIs(t,
		svc.MarkDuplicate(ctx, w.Workspace.Slug, w.Project.ID, it.ID, w.User.ID, foreign.ID),
		service.ErrIntakeBadDuplicate)
}
