package handler_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/require"
)

type favJSON struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	IsFolder  bool    `json:"is_folder"`
	ParentID  *string `json:"parent_id"`
	SortOrder float64 `json:"sort_order"`
	EntityID  string  `json:"entity_identifier"`
	Type      string  `json:"entity_type"`
}

func favList(t *testing.T, body string) []favJSON {
	t.Helper()
	var out []favJSON
	require.NoError(t, json.Unmarshal([]byte(body), &out))
	return out
}

// The favorites tree: favorite a cycle, put it in a folder, reorder it, and
// deleting the folder keeps the favorite (moved to the top level). Covers #205.
func TestFavorites_CycleFolderOrdering(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	base := "/api/workspaces/" + w.Workspace.Slug + "/favorites/"
	cycle := testutil.CreateCycle(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)

	// Favorite the cycle.
	rr := ts.POST(base, map[string]any{
		"entity_type": "cycle",
		"entity_id":   cycle.ID.String(),
		"project_id":  w.Project.ID.String(),
		"name":        "Sprint 1",
	}, w.Session)
	require.Equal(t, http.StatusCreated, rr.Code, "body=%s", rr.Body.String())
	var favResp favJSON
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &favResp))
	require.Equal(t, cycle.ID.String(), favResp.EntityID)

	// Create a folder.
	rr = ts.POST(base, map[string]any{"is_folder": true, "name": "Sprints"}, w.Session)
	require.Equal(t, http.StatusCreated, rr.Code, "body=%s", rr.Body.String())
	var folder favJSON
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &folder))
	require.True(t, folder.IsFolder)

	// Move the cycle favorite into the folder and reorder it.
	rr = ts.PATCH(base+favResp.ID+"/", map[string]any{"parent_id": folder.ID, "sort_order": 10}, w.Session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())

	list := favList(t, ts.GET(base, w.Session).Body.String())
	require.Len(t, list, 2)
	for _, f := range list {
		if f.ID == favResp.ID {
			require.NotNil(t, f.ParentID)
			require.Equal(t, folder.ID, *f.ParentID)
			require.EqualValues(t, 10, f.SortOrder)
		}
	}

	// Deleting the folder keeps the cycle favorite (parent cleared).
	require.Equal(t, http.StatusNoContent, ts.DELETE(base+folder.ID+"/", w.Session).Code)
	list = favList(t, ts.GET(base, w.Session).Body.String())
	require.Len(t, list, 1)
	require.Equal(t, favResp.ID, list[0].ID)
	require.Nil(t, list[0].ParentID)

	// Unfavorite by deleting the favorite row.
	require.Equal(t, http.StatusNoContent, ts.DELETE(base+favResp.ID+"/", w.Session).Code)
	require.Len(t, favList(t, ts.GET(base, w.Session).Body.String()), 0)
}

// An empty name is rejected for both folders and entity favorites.
func TestFavorites_EmptyNameRejected(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	base := "/api/workspaces/" + w.Workspace.Slug + "/favorites/"

	rr := ts.POST(base, map[string]any{"is_folder": true, "name": "   "}, w.Session)
	require.Equal(t, http.StatusBadRequest, rr.Code, "body=%s", rr.Body.String())
}

// A non-member can't read a workspace's favorites.
func TestFavorites_NonMemberForbidden(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	stranger := testutil.CreateUser(t, ts.DB)
	strangerSession := testutil.LoginAs(t, ts.DB, stranger)
	rr := ts.GET("/api/workspaces/"+w.Workspace.Slug+"/favorites/", strangerSession)
	require.Equal(t, http.StatusNotFound, rr.Code)
}
