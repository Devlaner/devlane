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

func TestCycle_ProgressBulk(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	cycle := testutil.CreateCycle(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	issuesBase := cycleBase(w.Workspace.Slug, w.Project.ID.String()) + cycle.ID.String() + "/issues/"
	for range []int{0, 1} {
		issue := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
		add := ts.POST(issuesBase, map[string]any{"issue_id": issue.ID.String()}, w.Session)
		require.Less(t, add.Code, 300, "body=%s", add.Body.String())
	}

	rr := ts.GET(
		"/api/workspaces/"+w.Workspace.Slug+"/projects/"+w.Project.ID.String()+"/cycles-progress/",
		w.Session,
	)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
	m := testutil.MustJSONMap(t, rr)
	entry, ok := m[cycle.ID.String()].(map[string]any)
	require.True(t, ok, "expected progress for the cycle, body=%s", rr.Body.String())
	assert.Equal(t, float64(2), entry["total"])
	assert.Equal(t, float64(0), entry["completed"])
}

func TestCycle_RejectsInvalidDates(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	base := cycleBase(w.Workspace.Slug, w.Project.ID.String())

	// End before start is rejected on create.
	rr := ts.POST(base, map[string]any{
		"name":       "Backwards",
		"start_date": "2026-02-10T00:00:00Z",
		"end_date":   "2026-02-01T00:00:00Z",
	}, w.Session)
	require.Equal(t, http.StatusBadRequest, rr.Code, "body=%s", rr.Body.String())

	// A valid range is accepted, then an update that inverts it is rejected.
	ok := ts.POST(base, map[string]any{
		"name":       "Sprint",
		"start_date": "2026-02-01T00:00:00Z",
		"end_date":   "2026-02-10T00:00:00Z",
	}, w.Session)
	require.Equal(t, http.StatusCreated, ok.Code, "body=%s", ok.Body.String())
	id, _ := testutil.MustJSONMap(t, ok)["id"].(string)

	bad := ts.PATCH(base+id+"/", map[string]any{"end_date": "2026-01-01T00:00:00Z"}, w.Session)
	require.Equal(t, http.StatusBadRequest, bad.Code, "body=%s", bad.Body.String())
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
