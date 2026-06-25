package handler_test

import (
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/require"
)

func TestEstimates_CRUD(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	base := "/api/workspaces/" + w.Workspace.Slug + "/projects/" + w.Project.ID.String() + "/estimates/"

	// Empty list.
	r0 := ts.GET(base, w.Session)
	require.Equal(t, http.StatusOK, r0.Code, "body=%s", r0.Body.String())

	// Create with points and mark it active.
	rc := ts.POST(base, map[string]any{
		"name":      "T-Shirt",
		"type":      "categories",
		"last_used": true,
		"points": []map[string]any{
			{"key": 0, "value": "S"},
			{"key": 1, "value": "M"},
			{"key": 2, "value": "L"},
		},
	}, w.Session)
	require.Equal(t, http.StatusCreated, rc.Code, "body=%s", rc.Body.String())
	m := testutil.MustJSONMap(t, rc)
	id, _ := m["id"].(string)
	require.NotEmpty(t, id)
	require.Equal(t, true, m["last_used"])
	pts, _ := m["points"].([]any)
	require.Len(t, pts, 3)

	// List contains it.
	require.Contains(t, ts.GET(base, w.Session).Body.String(), "T-Shirt")

	// Get returns the points.
	rg := ts.GET(base+id+"/", w.Session)
	require.Equal(t, http.StatusOK, rg.Code, "body=%s", rg.Body.String())
	require.Contains(t, rg.Body.String(), `"M"`)

	// Update: rename and replace the points with two.
	ru := ts.PATCH(base+id+"/", map[string]any{
		"name":   "Sizes",
		"points": []map[string]any{{"key": 0, "value": "1"}, {"key": 1, "value": "2"}},
	}, w.Session)
	require.Equal(t, http.StatusOK, ru.Code, "body=%s", ru.Body.String())
	um := testutil.MustJSONMap(t, ru)
	require.Equal(t, "Sizes", um["name"])
	upts, _ := um["points"].([]any)
	require.Len(t, upts, 2)

	// Delete.
	rd := ts.DELETE(base+id+"/", w.Session)
	require.Equal(t, http.StatusNoContent, rd.Code, "body=%s", rd.Body.String())

	// List is empty again.
	require.NotContains(t, ts.GET(base, w.Session).Body.String(), "Sizes")
}

func TestEstimates_NonMemberForbidden(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	outsider := testutil.CreateUser(t, ts.DB)
	session := testutil.LoginAs(t, ts.DB, outsider)
	base := "/api/workspaces/" + w.Workspace.Slug + "/projects/" + w.Project.ID.String() + "/estimates/"
	rr := ts.GET(base, session)
	require.Equal(t, http.StatusNotFound, rr.Code, "body=%s", rr.Body.String())
}
