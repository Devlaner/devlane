package handler_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/require"
)

func projectIDsIn(t *testing.T, body string) map[string]bool {
	t.Helper()
	out := map[string]bool{}
	var list []map[string]any
	if err := json.Unmarshal([]byte(body), &list); err != nil {
		return out
	}
	for _, p := range list {
		if id, ok := p["id"].(string); ok {
			out[id] = true
		}
	}
	return out
}

// Archiving a project hides it from the active list and surfaces it under
// archived-projects; restoring reverses that. Covers #128.
func TestProject_ArchiveRestore(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	pid := w.Project.ID.String()
	activeURL := "/api/workspaces/" + w.Workspace.Slug + "/projects/"
	archivedURL := "/api/workspaces/" + w.Workspace.Slug + "/archived-projects/"
	archiveURL := activeURL + pid + "/archive/"

	// Baseline: project is active.
	require.True(t, projectIDsIn(t, ts.GET(activeURL, w.Session).Body.String())[pid])

	// Archive it.
	require.Equal(t, http.StatusNoContent, ts.POST(archiveURL, nil, w.Session).Code)
	require.False(t, projectIDsIn(t, ts.GET(activeURL, w.Session).Body.String())[pid], "archived project hidden from active list")
	require.True(t, projectIDsIn(t, ts.GET(archivedURL, w.Session).Body.String())[pid], "archived project listed under archived")

	// Restore it.
	require.Equal(t, http.StatusNoContent, ts.DELETE(archiveURL, w.Session).Code)
	require.True(t, projectIDsIn(t, ts.GET(activeURL, w.Session).Body.String())[pid], "restored project back in active list")
	require.False(t, projectIDsIn(t, ts.GET(archivedURL, w.Session).Body.String())[pid])
}

// A non-member cannot archive a project.
func TestProject_Archive_NonMemberForbidden(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	stranger := testutil.CreateUser(t, ts.DB)
	strangerSession := testutil.LoginAs(t, ts.DB, stranger)

	rr := ts.POST("/api/workspaces/"+w.Workspace.Slug+"/projects/"+w.Project.ID.String()+"/archive/", nil, strangerSession)
	require.Equal(t, http.StatusNotFound, rr.Code)
}
