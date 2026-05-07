package handler_test

import (
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLabel_RequiresAuth(t *testing.T) {
	ts := testutil.NewTestServer(t)
	rr := ts.GET("/api/workspaces/x/projects/00000000-0000-0000-0000-000000000000/issue-labels/", "")
	require.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestLabel_CRUD(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	base := "/api/workspaces/" + w.Workspace.Slug + "/projects/" + w.Project.ID.String() + "/issue-labels/"

	// Create
	rr := ts.POST(base, map[string]any{"name": "bug", "color": "#ff0000"}, w.Session)
	require.Equal(t, http.StatusCreated, rr.Code, "body=%s", rr.Body.String())
	id, _ := testutil.MustJSONMap(t, rr)["id"].(string)
	require.NotEmpty(t, id)

	// List
	rr2 := ts.GET(base, w.Session)
	require.Equal(t, http.StatusOK, rr2.Code)
	assert.Len(t, testutil.DecodeJSON[[]map[string]any](t, rr2), 1)

	// Update
	rr3 := ts.PATCH(base+id+"/", map[string]any{"name": "feature"}, w.Session)
	require.Equal(t, http.StatusOK, rr3.Code)
	assert.Equal(t, "feature", testutil.MustJSONMap(t, rr3)["name"])

	// Delete
	rr4 := ts.DELETE(base+id+"/", w.Session)
	require.Equal(t, http.StatusNoContent, rr4.Code)
}
