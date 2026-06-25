package handler_test

import (
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/require"
)

func TestIssue_ArchiveRestore(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	issue := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	id := issue.ID.String()
	issuesBase := "/api/workspaces/" + w.Workspace.Slug + "/projects/" + w.Project.ID.String() + "/issues/"
	archivedBase := "/api/workspaces/" + w.Workspace.Slug + "/projects/" + w.Project.ID.String() + "/archived-issues/"

	// Active list contains the issue; archived list is empty.
	rr := ts.GET(issuesBase, w.Session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
	require.Contains(t, rr.Body.String(), id)
	rrA := ts.GET(archivedBase, w.Session)
	require.Equal(t, http.StatusOK, rrA.Code, "body=%s", rrA.Body.String())
	require.NotContains(t, rrA.Body.String(), id)

	// Archive it.
	rr2 := ts.POST(issuesBase+id+"/archive/", map[string]any{}, w.Session)
	require.Equal(t, http.StatusOK, rr2.Code, "body=%s", rr2.Body.String())

	// Now absent from the active list, present in the archived list.
	rr3 := ts.GET(issuesBase, w.Session)
	require.NotContains(t, rr3.Body.String(), id)
	rr4 := ts.GET(archivedBase, w.Session)
	require.Contains(t, rr4.Body.String(), id)

	// Restore it.
	rr5 := ts.DELETE(issuesBase+id+"/archive/", w.Session)
	require.Equal(t, http.StatusOK, rr5.Code, "body=%s", rr5.Body.String())

	// Back in the active list.
	rr6 := ts.GET(issuesBase, w.Session)
	require.Contains(t, rr6.Body.String(), id)
}

func TestIssue_WorkspaceArchivedList(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	issue := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	id := issue.ID.String()
	issuesBase := "/api/workspaces/" + w.Workspace.Slug + "/projects/" + w.Project.ID.String() + "/issues/"
	wsArchived := "/api/workspaces/" + w.Workspace.Slug + "/archived-issues/"

	// Empty before archiving.
	r0 := ts.GET(wsArchived, w.Session)
	require.Equal(t, http.StatusOK, r0.Code, "body=%s", r0.Body.String())
	require.NotContains(t, r0.Body.String(), id)

	// Archive, then it appears in the workspace-wide archived list.
	require.Equal(t, http.StatusOK, ts.POST(issuesBase+id+"/archive/", map[string]any{}, w.Session).Code)
	require.Contains(t, ts.GET(wsArchived, w.Session).Body.String(), id)

	// Restore removes it again.
	require.Equal(t, http.StatusOK, ts.DELETE(issuesBase+id+"/archive/", w.Session).Code)
	require.NotContains(t, ts.GET(wsArchived, w.Session).Body.String(), id)

	// Non-members can't read it.
	outsider := testutil.CreateUser(t, ts.DB)
	require.Equal(t, http.StatusNotFound, ts.GET(wsArchived, testutil.LoginAs(t, ts.DB, outsider)).Code)
}
