package handler_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/require"
)

func TestIssue_BulkActions(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	i1 := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	i2 := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	i3 := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	base := "/api/workspaces/" + w.Workspace.Slug + "/projects/" + w.Project.ID.String() + "/issues/"
	bulk := "/api/workspaces/" + w.Workspace.Slug + "/projects/" + w.Project.ID.String() + "/issues-bulk/"

	// Bulk update priority on i1 + i2.
	rrU := ts.POST(bulk+"update/", map[string]any{
		"issue_ids": []string{i1.ID.String(), i2.ID.String()},
		"priority":  "high",
	}, w.Session)
	require.Equal(t, http.StatusOK, rrU.Code, "body=%s", rrU.Body.String())
	got := ts.GET(base+i1.ID.String()+"/", w.Session)
	require.Contains(t, got.Body.String(), "\"priority\":\"high\"")

	// Bulk archive i1 + i2; they should leave the active list.
	rrA := ts.POST(bulk+"archive/", map[string]any{
		"issue_ids": []string{i1.ID.String(), i2.ID.String()},
		"archived":  true,
	}, w.Session)
	require.Equal(t, http.StatusOK, rrA.Code, "body=%s", rrA.Body.String())
	list := ts.GET(base+"?limit=100", w.Session)
	require.NotContains(t, list.Body.String(), i1.ID.String())
	require.Contains(t, list.Body.String(), i3.ID.String())

	// Bulk delete i3.
	rrD := ts.POST(bulk+"delete/", map[string]any{
		"issue_ids": []string{i3.ID.String()},
	}, w.Session)
	require.Equal(t, http.StatusOK, rrD.Code, "body=%s", rrD.Body.String())
	gone := ts.GET(base+i3.ID.String()+"/", w.Session)
	require.Equal(t, http.StatusNotFound, gone.Code, "body=%s", gone.Body.String())
}

func TestIssue_BulkUpdate_RejectsInvalidPriority(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	i1 := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	bulk := "/api/workspaces/" + w.Workspace.Slug + "/projects/" + w.Project.ID.String() + "/issues-bulk/"

	rr := ts.POST(bulk+"update/", map[string]any{
		"issue_ids": []string{i1.ID.String()},
		"priority":  "bogus",
	}, w.Session)
	require.Equal(t, http.StatusBadRequest, rr.Code, "body=%s", rr.Body.String())
}

func TestIssue_BulkReorder(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	i1 := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	i2 := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	i3 := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	base := "/api/workspaces/" + w.Workspace.Slug + "/projects/" + w.Project.ID.String() + "/issues/"
	bulk := "/api/workspaces/" + w.Workspace.Slug + "/projects/" + w.Project.ID.String() + "/issues-bulk/"

	// New issues all share the default sort_order; reorder to i3, i1, i2.
	rr := ts.POST(bulk+"reorder/", map[string]any{
		"issue_ids": []string{i3.ID.String(), i1.ID.String(), i2.ID.String()},
	}, w.Session)
	require.Equal(t, http.StatusNoContent, rr.Code, "body=%s", rr.Body.String())

	// The list (ordered by sort_order ASC) now reflects the requested order.
	body := ts.GET(base+"?limit=100", w.Session).Body.String()
	p3, p1, p2 := strings.Index(body, i3.ID.String()), strings.Index(body, i1.ID.String()), strings.Index(body, i2.ID.String())
	require.Less(t, p3, p1, "i3 should precede i1")
	require.Less(t, p1, p2, "i1 should precede i2")

	// Empty payload is rejected.
	require.Equal(t, http.StatusBadRequest, ts.POST(bulk+"reorder/", map[string]any{"issue_ids": []string{}}, w.Session).Code)
}
