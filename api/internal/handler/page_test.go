package handler_test

import (
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPage_RequiresAuth(t *testing.T) {
	ts := testutil.NewTestServer(t)
	rr := ts.GET("/api/workspaces/x/pages/", "")
	require.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestPage_CRUD(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	base := "/api/workspaces/" + w.Workspace.Slug + "/pages/"

	// Create
	rr := ts.POST(base, map[string]any{
		"name":             "Onboarding",
		"description_html": "<p>welcome</p>",
		"access":           0,
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

	// Update meta (rename)
	rr4 := ts.PATCH(base+id+"/", map[string]any{"name": "Onboarding v2"}, w.Session)
	require.Equal(t, http.StatusOK, rr4.Code, "body=%s", rr4.Body.String())
	assert.Equal(t, "Onboarding v2", testutil.MustJSONMap(t, rr4)["name"])

	// Update content
	rr5 := ts.PATCH(base+id+"/content/", map[string]any{
		"description_html": "<p>Updated content</p>",
	}, w.Session)
	require.Equal(t, http.StatusOK, rr5.Code, "body=%s", rr5.Body.String())

	// Archive (must precede delete, per ErrPageNotArchived)
	rr6 := ts.POST(base+id+"/archive/", nil, w.Session)
	require.Truef(t, rr6.Code < 400, "archive failed: %d %s", rr6.Code, rr6.Body.String())

	// Delete
	rr7 := ts.DELETE(base+id+"/", w.Session)
	require.Equal(t, http.StatusNoContent, rr7.Code, "body=%s", rr7.Body.String())
}

func TestPage_Children(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	parent := testutil.CreatePage(t, ts.DB, w.Workspace.ID, w.User.ID)

	rr := ts.GET("/api/workspaces/"+w.Workspace.Slug+"/pages/"+parent.ID.String()+"/children/", w.Session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
}

func TestPage_LockUnlock(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	page := testutil.CreatePage(t, ts.DB, w.Workspace.ID, w.User.ID)
	base := "/api/workspaces/" + w.Workspace.Slug + "/pages/" + page.ID.String()

	rr := ts.POST(base+"/lock/", nil, w.Session)
	require.Truef(t, rr.Code < 400, "lock failed: %d %s", rr.Code, rr.Body.String())

	rr2 := ts.DELETE(base+"/lock/", w.Session)
	require.Truef(t, rr2.Code < 400, "unlock failed: %d %s", rr2.Code, rr2.Body.String())
}

func TestPage_ArchiveUnarchive(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	page := testutil.CreatePage(t, ts.DB, w.Workspace.ID, w.User.ID)
	base := "/api/workspaces/" + w.Workspace.Slug + "/pages/" + page.ID.String()

	rr := ts.POST(base+"/archive/", nil, w.Session)
	require.Truef(t, rr.Code < 400, "archive failed: %d %s", rr.Code, rr.Body.String())

	rr2 := ts.DELETE(base+"/archive/", w.Session)
	require.Truef(t, rr2.Code < 400, "unarchive failed: %d %s", rr2.Code, rr2.Body.String())
}

func TestPage_Duplicate(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	page := testutil.CreatePage(t, ts.DB, w.Workspace.ID, w.User.ID)

	rr := ts.POST("/api/workspaces/"+w.Workspace.Slug+"/pages/"+page.ID.String()+"/duplicate/", nil, w.Session)
	require.Truef(t, rr.Code == http.StatusOK || rr.Code == http.StatusCreated,
		"duplicate failed: %d %s", rr.Code, rr.Body.String())
}

func TestPage_VersionsList(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	page := testutil.CreatePage(t, ts.DB, w.Workspace.ID, w.User.ID)

	rr := ts.GET("/api/workspaces/"+w.Workspace.Slug+"/pages/"+page.ID.String()+"/versions/", w.Session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
}

func TestPage_Favorite(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	page := testutil.CreatePage(t, ts.DB, w.Workspace.ID, w.User.ID)
	base := "/api/workspaces/" + w.Workspace.Slug + "/pages/" + page.ID.String() + "/favorite/"

	rr := ts.POST(base, nil, w.Session)
	require.Truef(t, rr.Code < 400, "favorite failed: %d %s", rr.Code, rr.Body.String())

	rr2 := ts.DELETE(base, w.Session)
	require.Truef(t, rr2.Code < 400, "unfavorite failed: %d %s", rr2.Code, rr2.Body.String())
}

func TestPage_Favorites_List(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)

	rr := ts.GET("/api/workspaces/"+w.Workspace.Slug+"/pages/favorites/", w.Session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
}
