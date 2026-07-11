package handler_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func projectListHas(t *testing.T, rr *httptest.ResponseRecorder, id uuid.UUID) bool {
	t.Helper()
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
	var rows []struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &rows))
	for _, r := range rows {
		if r.ID == id.String() {
			return true
		}
	}
	return false
}

// A secret (network=0) project is hidden from workspace members who aren't
// members of it, while a public one stays visible; members and the invalid
// value are handled too. Covers #197.
func TestProject_NetworkVisibility(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)

	// A plain workspace member who is not a member of the project.
	outsider := testutil.CreateUser(t, ts.DB)
	testutil.AddWorkspaceMember(t, ts.DB, w.Workspace.ID, outsider.ID, model.RoleMember)
	outsiderSession := testutil.LoginAs(t, ts.DB, outsider)

	listURL := "/api/workspaces/" + w.Workspace.Slug + "/projects/"
	projectURL := listURL + w.Project.ID.String() + "/"

	// Public by default: the outsider sees and can open it.
	require.True(t, projectListHas(t, ts.GET(listURL, outsiderSession), w.Project.ID))
	require.Equal(t, http.StatusOK, ts.GET(projectURL, outsiderSession).Code)

	// Make it secret.
	require.Equal(t, http.StatusOK,
		ts.PATCH(projectURL, map[string]any{"network": 0}, w.Session).Code)

	// The outsider can no longer see or open it.
	require.False(t, projectListHas(t, ts.GET(listURL, outsiderSession), w.Project.ID),
		"secret project must be hidden from non-members")
	require.Equal(t, http.StatusNotFound, ts.GET(projectURL, outsiderSession).Code)

	// The owner (a project member) still sees and can open it.
	require.True(t, projectListHas(t, ts.GET(listURL, w.Session), w.Project.ID))
	require.Equal(t, http.StatusOK, ts.GET(projectURL, w.Session).Code)

	// Restoring it to public makes it visible again.
	require.Equal(t, http.StatusOK,
		ts.PATCH(projectURL, map[string]any{"network": 2}, w.Session).Code)
	require.True(t, projectListHas(t, ts.GET(listURL, outsiderSession), w.Project.ID))

	// An out-of-range network value is rejected.
	require.Equal(t, http.StatusBadRequest,
		ts.PATCH(projectURL, map[string]any{"network": 5}, w.Session).Code)
}

func projectListCount(t *testing.T, rr *httptest.ResponseRecorder) int {
	t.Helper()
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
	var rows []json.RawMessage
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &rows))
	return len(rows)
}

// Creating a project with an out-of-range network is rejected up front and
// leaves no half-created project behind (Create persists before it can apply
// network via Update). Covers #197.
func TestProject_CreateInvalidNetworkNoSideEffect(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)

	listURL := "/api/workspaces/" + w.Workspace.Slug + "/projects/"
	before := projectListCount(t, ts.GET(listURL, w.Session))

	rr := ts.POST(listURL, map[string]any{
		"name":       "Bad Network",
		"identifier": "BADNET",
		"network":    5,
	}, w.Session)
	require.Equal(t, http.StatusBadRequest, rr.Code, "body=%s", rr.Body.String())

	after := projectListCount(t, ts.GET(listURL, w.Session))
	require.Equal(t, before, after, "invalid create must not leave a project behind")
}
