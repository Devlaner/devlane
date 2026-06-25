package handler_test

import (
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/require"
)

func TestIssue_MoveToProject(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	target := testutil.CreateProject(t, ts.DB, w.Workspace.ID, w.User.ID)

	// An issue in the source project with a state and a label.
	issue := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	state := testutil.CreateState(t, ts.DB, w.Project.ID, w.Workspace.ID)
	require.NoError(t, ts.DB.Model(issue).Update("state_id", state.ID).Error)
	label := testutil.CreateLabel(t, ts.DB, w.Project.ID, w.Workspace.ID)
	require.NoError(t, ts.DB.Create(&model.IssueLabel{
		IssueID: issue.ID, LabelID: label.ID, ProjectID: w.Project.ID, WorkspaceID: w.Workspace.ID,
	}).Error)

	// Pre-seed the target with an issue so the moved item gets a fresh sequence.
	testutil.CreateIssue(t, ts.DB, target.ID, w.Workspace.ID, w.User.ID)

	base := "/api/workspaces/" + w.Workspace.Slug + "/projects/" + w.Project.ID.String() + "/issues/"
	rr := ts.POST(base+issue.ID.String()+"/move/", map[string]any{"target_project_id": target.ID.String()}, w.Session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
	body := testutil.MustJSONMap(t, rr)
	require.Equal(t, target.ID.String(), body["project_id"])
	require.Nil(t, body["state_id"], "state should reset on move")

	// Project-scoped associations are dropped.
	var labels int64
	require.NoError(t, ts.DB.Model(&model.IssueLabel{}).Where("issue_id = ?", issue.ID).Count(&labels).Error)
	require.Zero(t, labels, "labels should be cleared on move")

	// The row really lives in the target project now.
	var moved model.Issue
	require.NoError(t, ts.DB.First(&moved, "id = ?", issue.ID).Error)
	require.Equal(t, target.ID, moved.ProjectID)
	require.Nil(t, moved.StateID)
}

func TestIssue_MoveToSameProjectRejected(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	issue := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	base := "/api/workspaces/" + w.Workspace.Slug + "/projects/" + w.Project.ID.String() + "/issues/"
	rr := ts.POST(base+issue.ID.String()+"/move/", map[string]any{"target_project_id": w.Project.ID.String()}, w.Session)
	require.Equal(t, http.StatusBadRequest, rr.Code, "body=%s", rr.Body.String())
}

func TestIssue_MoveRequiresTarget(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	issue := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	base := "/api/workspaces/" + w.Workspace.Slug + "/projects/" + w.Project.ID.String() + "/issues/"
	rr := ts.POST(base+issue.ID.String()+"/move/", map[string]any{}, w.Session)
	require.Equal(t, http.StatusBadRequest, rr.Code, "body=%s", rr.Body.String())
}

func TestIssue_MoveCrossWorkspaceRejected(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	// A project that belongs to a different workspace.
	otherUser := testutil.CreateUser(t, ts.DB)
	otherWS := testutil.CreateWorkspace(t, ts.DB, otherUser.ID)
	foreign := testutil.CreateProject(t, ts.DB, otherWS.ID, otherUser.ID)

	issue := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	base := "/api/workspaces/" + w.Workspace.Slug + "/projects/" + w.Project.ID.String() + "/issues/"
	rr := ts.POST(base+issue.ID.String()+"/move/", map[string]any{"target_project_id": foreign.ID.String()}, w.Session)
	require.Equal(t, http.StatusNotFound, rr.Code, "body=%s", rr.Body.String())
}
