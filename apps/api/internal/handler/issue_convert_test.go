package handler_test

import (
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/require"
)

func TestIssue_ConvertToEpicAndBack(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	base := "/api/workspaces/" + w.Workspace.Slug + "/projects/" + w.Project.ID.String() + "/issues/"

	a := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	id := a.ID.String()

	// Promote to epic.
	rr := ts.POST(base+id+"/convert/", map[string]any{"is_epic": true}, w.Session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
	require.Equal(t, true, testutil.MustJSONMap(t, rr)["is_epic"])

	// Give the epic a child work item; demoting should be rejected (409).
	child := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	require.NoError(t, ts.DB.Model(child).Update("parent_id", a.ID).Error)
	rr2 := ts.POST(base+id+"/convert/", map[string]any{"is_epic": false}, w.Session)
	require.Equal(t, http.StatusConflict, rr2.Code, "body=%s", rr2.Body.String())

	// Detach the child, then the epic can be demoted back to a work item.
	require.NoError(t, ts.DB.Model(child).Update("parent_id", nil).Error)
	rr3 := ts.POST(base+id+"/convert/", map[string]any{"is_epic": false}, w.Session)
	require.Equal(t, http.StatusOK, rr3.Code, "body=%s", rr3.Body.String())
	require.Equal(t, false, testutil.MustJSONMap(t, rr3)["is_epic"])
}

func TestIssue_ConvertRequiresIsEpic(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	a := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	base := "/api/workspaces/" + w.Workspace.Slug + "/projects/" + w.Project.ID.String() + "/issues/"
	rr := ts.POST(base+a.ID.String()+"/convert/", map[string]any{}, w.Session)
	require.Equal(t, http.StatusBadRequest, rr.Code, "body=%s", rr.Body.String())
}
