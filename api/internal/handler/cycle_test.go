package handler_test

import (
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func cycleBase(slug, projectID string) string {
	return "/api/workspaces/" + slug + "/projects/" + projectID + "/cycles/"
}

func TestCycle_RequiresAuth(t *testing.T) {
	ts := testutil.NewTestServer(t)
	rr := ts.GET(cycleBase("x", "00000000-0000-0000-0000-000000000000"), "")
	require.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestCycle_CRUD(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	base := cycleBase(w.Workspace.Slug, w.Project.ID.String())

	// Create
	rr := ts.POST(base, map[string]any{
		"name":        "Sprint 1",
		"description": "First sprint",
	}, w.Session)
	require.Equal(t, http.StatusCreated, rr.Code, "body=%s", rr.Body.String())
	id, _ := testutil.MustJSONMap(t, rr)["id"].(string)
	require.NotEmpty(t, id)

	// List
	rr2 := ts.GET(base, w.Session)
	require.Equal(t, http.StatusOK, rr2.Code)

	// Get
	rr3 := ts.GET(base+id+"/", w.Session)
	require.Equal(t, http.StatusOK, rr3.Code)
	assert.Equal(t, "Sprint 1", testutil.MustJSONMap(t, rr3)["name"])

	// Update
	rr4 := ts.PATCH(base+id+"/", map[string]any{"name": "Sprint 1.1"}, w.Session)
	require.Equal(t, http.StatusOK, rr4.Code)
	assert.Equal(t, "Sprint 1.1", testutil.MustJSONMap(t, rr4)["name"])

	// Delete
	rr5 := ts.DELETE(base+id+"/", w.Session)
	require.Equal(t, http.StatusNoContent, rr5.Code)
}

func TestCycle_Issues_AddListRemove(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	cycle := testutil.CreateCycle(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	issue := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	base := cycleBase(w.Workspace.Slug, w.Project.ID.String()) + cycle.ID.String() + "/issues/"

	// Add
	rr := ts.POST(base, map[string]any{"issue_id": issue.ID.String()}, w.Session)
	require.Truef(t, rr.Code < 400, "unexpected status %d body=%s", rr.Code, rr.Body.String())

	// List
	rr2 := ts.GET(base, w.Session)
	require.Equal(t, http.StatusOK, rr2.Code, "body=%s", rr2.Body.String())

	// Remove
	rr3 := ts.DELETE(base+issue.ID.String()+"/", w.Session)
	require.Equal(t, http.StatusNoContent, rr3.Code, "body=%s", rr3.Body.String())
}
