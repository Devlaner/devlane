package handler_test

import (
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestView_RequiresAuth(t *testing.T) {
	ts := testutil.NewTestServer(t)
	rr := ts.GET("/api/workspaces/x/views/", "")
	require.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestView_CRUD(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	base := "/api/workspaces/" + w.Workspace.Slug + "/views/"

	// Create
	rr := ts.POST(base, map[string]any{
		"name":  "My Open Issues",
		"query": map[string]any{"state": "open"},
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

	// Update
	rr4 := ts.PATCH(base+id+"/", map[string]any{"name": "All Issues"}, w.Session)
	require.Equal(t, http.StatusOK, rr4.Code, "body=%s", rr4.Body.String())
	assert.Equal(t, "All Issues", testutil.MustJSONMap(t, rr4)["name"])

	// Delete
	rr5 := ts.DELETE(base+id+"/", w.Session)
	require.Equal(t, http.StatusNoContent, rr5.Code)
}

// A saved view round-trips its filters + display settings through the backend so
// they are shared across users/devices, and only the owner may update them. This
// is the contract the ViewDetailPage "Save changes" action relies on. Covers #173.
func TestView_PersistsFiltersAndDisplaySettings(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	base := "/api/workspaces/" + w.Workspace.Slug + "/views/"

	rr := ts.POST(base, map[string]any{"name": "Board"}, w.Session)
	require.Equal(t, http.StatusCreated, rr.Code, "body=%s", rr.Body.String())
	id, _ := testutil.MustJSONMap(t, rr)["id"].(string)
	require.NotEmpty(t, id)

	// The owner saves filters + display settings (the shape the UI sends).
	patch := map[string]any{
		"filters":         map[string]any{"priority": "high,urgent"},
		"display_filters": map[string]any{"groupBy": "priority", "orderBy": "due_date"},
		"display_properties": map[string]any{
			"displayProperties": []string{"id", "state", "assignee"},
		},
	}
	rr2 := ts.PATCH(base+id+"/", patch, w.Session)
	require.Equal(t, http.StatusOK, rr2.Code, "body=%s", rr2.Body.String())

	// GET echoes them back unchanged so another device can reconstruct the view.
	rr3 := ts.GET(base+id+"/", w.Session)
	require.Equal(t, http.StatusOK, rr3.Code)
	got := testutil.MustJSONMap(t, rr3)
	filters, _ := got["filters"].(map[string]any)
	require.Equal(t, "high,urgent", filters["priority"])
	df, _ := got["display_filters"].(map[string]any)
	require.Equal(t, "priority", df["groupBy"])
	require.Equal(t, "due_date", df["orderBy"])
	dp, _ := got["display_properties"].(map[string]any)
	props, _ := dp["displayProperties"].([]any)
	require.Len(t, props, 3)

	// A workspace member who does not own the view cannot update it.
	other := testutil.CreateUser(t, ts.DB)
	testutil.AddWorkspaceMember(t, ts.DB, w.Workspace.ID, other.ID, model.RoleMember)
	otherSession := testutil.LoginAs(t, ts.DB, other)
	rr4 := ts.PATCH(base+id+"/", map[string]any{"name": "Hijack"}, otherSession)
	require.Equal(t, http.StatusNotFound, rr4.Code, "non-owner must not update a view")
}

func TestView_Favorites_DualVariantRoutes(t *testing.T) {
	// Router lines 332-337 register both /favorite and /favorite/ variants on
	// purpose. This test asserts BOTH paths reach the same handler.
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	v := testutil.CreateView(t, ts.DB, w.Workspace.ID, w.User.ID)
	base := "/api/workspaces/" + w.Workspace.Slug + "/views/" + v.ID.String() + "/favorite"

	// GET on /favorite — explicit 405-ish wrong-method (handler returns 4xx).
	rr := ts.GET(base, w.Session)
	assert.GreaterOrEqual(t, rr.Code, 400, "GET on /favorite should be a client error")

	// POST without trailing slash → favorite
	rr2 := ts.POST(base, nil, w.Session)
	require.Truef(t, rr2.Code < 400, "POST /favorite should succeed: %d %s", rr2.Code, rr2.Body.String())

	// DELETE with trailing slash → unfavorite (must reach same handler as no-slash)
	rr3 := ts.DELETE(base+"/", w.Session)
	require.Truef(t, rr3.Code < 400, "DELETE /favorite/ should succeed: %d %s", rr3.Code, rr3.Body.String())

	// POST with trailing slash → favorite again
	rr4 := ts.POST(base+"/", nil, w.Session)
	require.Truef(t, rr4.Code < 400, "POST /favorite/ should succeed: %d %s", rr4.Code, rr4.Body.String())

	// DELETE without trailing slash → unfavorite again
	rr5 := ts.DELETE(base, w.Session)
	require.Truef(t, rr5.Code < 400, "DELETE /favorite should succeed: %d %s", rr5.Code, rr5.Body.String())
}

func TestView_ListFavorites(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	v := testutil.CreateView(t, ts.DB, w.Workspace.ID, w.User.ID)

	// Empty initially
	rr := ts.GET("/api/workspaces/"+w.Workspace.Slug+"/views/favorites/", w.Session)
	require.Equal(t, http.StatusOK, rr.Code)

	// Favorite the view
	rr2 := ts.POST("/api/workspaces/"+w.Workspace.Slug+"/views/"+v.ID.String()+"/favorite", nil, w.Session)
	require.Truef(t, rr2.Code < 400, "favorite failed: %d %s", rr2.Code, rr2.Body.String())

	// Now should appear
	rr3 := ts.GET("/api/workspaces/"+w.Workspace.Slug+"/views/favorites/", w.Session)
	require.Equal(t, http.StatusOK, rr3.Code)
}
