package handler_test

import (
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/require"
)

func TestModule_Links(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	modBase := "/api/workspaces/" + w.Workspace.Slug + "/projects/" + w.Project.ID.String() + "/modules/"

	rr := ts.POST(modBase, map[string]any{"name": "M"}, w.Session)
	require.Equal(t, http.StatusCreated, rr.Code, "body=%s", rr.Body.String())
	id, _ := testutil.MustJSONMap(t, rr)["id"].(string)
	require.NotEmpty(t, id)
	links := modBase + id + "/links/"

	// Empty list.
	rr0 := ts.GET(links, w.Session)
	require.Equal(t, http.StatusOK, rr0.Code, "body=%s", rr0.Body.String())

	// Create.
	rr2 := ts.POST(links, map[string]any{"title": "Docs", "url": "https://example.com/"}, w.Session)
	require.Equal(t, http.StatusCreated, rr2.Code, "body=%s", rr2.Body.String())
	linkID, _ := testutil.MustJSONMap(t, rr2)["id"].(string)
	require.NotEmpty(t, linkID)
	require.Contains(t, rr2.Body.String(), "https://example.com/")

	// List contains it.
	require.Contains(t, ts.GET(links, w.Session).Body.String(), "Docs")

	// Update.
	rr3 := ts.PATCH(links+linkID+"/", map[string]any{"title": "Docs v2"}, w.Session)
	require.Equal(t, http.StatusOK, rr3.Code, "body=%s", rr3.Body.String())
	require.Contains(t, rr3.Body.String(), "Docs v2")

	// Delete.
	rr4 := ts.DELETE(links+linkID+"/", w.Session)
	require.Equal(t, http.StatusNoContent, rr4.Code, "body=%s", rr4.Body.String())
}
