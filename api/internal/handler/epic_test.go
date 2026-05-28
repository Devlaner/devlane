package handler_test

import (
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func epicBase(slug, projectID string) string {
	return "/api/workspaces/" + slug + "/projects/" + projectID + "/epics/"
}

func TestEpic_RequiresAuth(t *testing.T) {
	ts := testutil.NewTestServer(t)
	rr := ts.GET(epicBase("x", "00000000-0000-0000-0000-000000000000"), "")
	require.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestEpic_CRUD(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	base := epicBase(w.Workspace.Slug, w.Project.ID.String())

	// List (empty)
	rr := ts.GET(base, w.Session)
	require.Equal(t, http.StatusOK, rr.Code)

	// Create
	rr2 := ts.POST(base, map[string]any{
		"name":     "Authentication epic",
		"priority": "high",
	}, w.Session)
	require.Equal(t, http.StatusCreated, rr2.Code, "body=%s", rr2.Body.String())
	created := testutil.MustJSONMap(t, rr2)
	epicID, _ := created["id"].(string)
	require.NotEmpty(t, epicID)
	assert.Equal(t, true, created["is_epic"], "is_epic should be true")

	// Get
	rr3 := ts.GET(base+epicID+"/", w.Session)
	require.Equal(t, http.StatusOK, rr3.Code)
	got := testutil.MustJSONMap(t, rr3)
	assert.Equal(t, "Authentication epic", got["name"])
	assert.Equal(t, true, got["is_epic"])

	// Update
	rr4 := ts.PATCH(base+epicID+"/", map[string]any{"name": "Auth epic (renamed)"}, w.Session)
	require.Equal(t, http.StatusOK, rr4.Code, "body=%s", rr4.Body.String())
	assert.Equal(t, "Auth epic (renamed)", testutil.MustJSONMap(t, rr4)["name"])

	// List (one epic)
	rr5 := ts.GET(base, w.Session)
	require.Equal(t, http.StatusOK, rr5.Code)
	assert.Contains(t, rr5.Body.String(), "Auth epic")

	// Delete
	rr6 := ts.DELETE(base+epicID+"/", w.Session)
	require.Equal(t, http.StatusNoContent, rr6.Code)
}

func TestEpic_IssuesChild(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	base := epicBase(w.Workspace.Slug, w.Project.ID.String())

	// Create epic
	rr := ts.POST(base, map[string]any{"name": "Parent epic"}, w.Session)
	require.Equal(t, http.StatusCreated, rr.Code)
	epicID, _ := testutil.MustJSONMap(t, rr)["id"].(string)

	// Create a regular issue to link to the epic
	issue := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)

	// Add issue to epic
	rr2 := ts.POST(base+epicID+"/issues/", map[string]any{"issue_id": issue.ID.String()}, w.Session)
	require.Equal(t, http.StatusNoContent, rr2.Code, "body=%s", rr2.Body.String())

	// List epic issues
	rr3 := ts.GET(base+epicID+"/issues/", w.Session)
	require.Equal(t, http.StatusOK, rr3.Code)
	assert.Contains(t, rr3.Body.String(), issue.ID.String())
}

func TestEpic_NonMember404(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	stranger := testutil.CreateUser(t, ts.DB)
	strangerSession := testutil.LoginAs(t, ts.DB, stranger)

	rr := ts.GET(epicBase(w.Workspace.Slug, w.Project.ID.String()), strangerSession)
	require.Equal(t, http.StatusNotFound, rr.Code)
}

func TestEpic_Link_CRUD(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	base := epicBase(w.Workspace.Slug, w.Project.ID.String())

	// Create epic
	rr := ts.POST(base, map[string]any{"name": "Epic with links"}, w.Session)
	require.Equal(t, http.StatusCreated, rr.Code)
	epicID, _ := testutil.MustJSONMap(t, rr)["id"].(string)

	linkBase := base + epicID + "/links/"

	// Add link to epic
	rr2 := ts.POST(linkBase, map[string]any{
		"title": "Design doc",
		"url":   "https://figma.com/design",
	}, w.Session)
	require.Equal(t, http.StatusCreated, rr2.Code, "body=%s", rr2.Body.String())

	// List links
	rr3 := ts.GET(linkBase, w.Session)
	require.Equal(t, http.StatusOK, rr3.Code)
	assert.Contains(t, rr3.Body.String(), "Design doc")
}
