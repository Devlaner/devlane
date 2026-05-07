package handler_test

import (
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func issueBase(slug, projectID string) string {
	return "/api/workspaces/" + slug + "/projects/" + projectID + "/issues/"
}

func TestIssue_RequiresAuth(t *testing.T) {
	ts := testutil.NewTestServer(t)
	rr := ts.GET("/api/workspaces/x/projects/00000000-0000-0000-0000-000000000000/issues/", "")
	require.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestIssue_CRUD(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	base := issueBase(w.Workspace.Slug, w.Project.ID.String())

	// Create
	rr := ts.POST(base, map[string]any{
		"name":     "Bug 1",
		"priority": "high",
	}, w.Session)
	require.Equal(t, http.StatusCreated, rr.Code, "body=%s", rr.Body.String())
	created := testutil.MustJSONMap(t, rr)
	id, _ := created["id"].(string)
	require.NotEmpty(t, id)

	// List
	rr2 := ts.GET(base, w.Session)
	require.Equal(t, http.StatusOK, rr2.Code, "body=%s", rr2.Body.String())
	// Response may be {results:[]} pagination wrapper or a bare array — check for either.
	body := rr2.Body.String()
	assert.Contains(t, body, "Bug 1")

	// Get
	rr3 := ts.GET(base+id+"/", w.Session)
	require.Equal(t, http.StatusOK, rr3.Code)
	got := testutil.MustJSONMap(t, rr3)
	assert.Equal(t, "Bug 1", got["name"])

	// Update
	rr4 := ts.PATCH(base+id+"/", map[string]any{"name": "Bug 1 (renamed)"}, w.Session)
	require.Equal(t, http.StatusOK, rr4.Code, "body=%s", rr4.Body.String())
	assert.Equal(t, "Bug 1 (renamed)", testutil.MustJSONMap(t, rr4)["name"])

	// Delete
	rr5 := ts.DELETE(base+id+"/", w.Session)
	require.Equal(t, http.StatusNoContent, rr5.Code)
}

func TestIssue_Assignees_AddAndList(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	issue := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)

	other := testutil.CreateUser(t, ts.DB)
	testutil.AddWorkspaceMember(t, ts.DB, w.Workspace.ID, other.ID, testutil.RoleMember)
	testutil.AddProjectMember(t, ts.DB, w.Project.ID, w.Workspace.ID, other.ID, testutil.RoleMember)

	base := issueBase(w.Workspace.Slug, w.Project.ID.String()) + issue.ID.String() + "/assignees/"

	// Add
	rr := ts.POST(base, map[string]any{"assignee_id": other.ID.String()}, w.Session)
	require.Truef(t, rr.Code == http.StatusOK || rr.Code == http.StatusCreated || rr.Code == http.StatusNoContent,
		"unexpected status %d body=%s", rr.Code, rr.Body.String())

	// List
	rr2 := ts.GET(base, w.Session)
	require.Equal(t, http.StatusOK, rr2.Code, "body=%s", rr2.Body.String())
}

func TestIssue_Activities(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	issue := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)

	rr := ts.GET(issueBase(w.Workspace.Slug, w.Project.ID.String())+issue.ID.String()+"/activities/", w.Session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
}

func TestIssue_Subscribe_RoundTrip(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	issue := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	base := issueBase(w.Workspace.Slug, w.Project.ID.String()) + issue.ID.String() + "/subscribe/"

	// IsSubscribed (initial)
	rr := ts.GET(base, w.Session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())

	// Subscribe
	rr2 := ts.POST(base, nil, w.Session)
	require.Truef(t, rr2.Code < 400, "unexpected status %d body=%s", rr2.Code, rr2.Body.String())

	// Unsubscribe
	rr3 := ts.DELETE(base, w.Session)
	require.Truef(t, rr3.Code < 400, "unexpected status %d body=%s", rr3.Code, rr3.Body.String())
}

func TestIssue_NonMember404(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	stranger := testutil.CreateUser(t, ts.DB)
	strangerSession := testutil.LoginAs(t, ts.DB, stranger)

	rr := ts.GET(issueBase(w.Workspace.Slug, w.Project.ID.String()), strangerSession)
	require.Equal(t, http.StatusNotFound, rr.Code)
}

func TestIssue_DraftCreation(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)

	rr := ts.POST(issueBase(w.Workspace.Slug, w.Project.ID.String()), map[string]any{
		"name":     "draft work",
		"is_draft": true,
	}, w.Session)
	require.Equal(t, http.StatusCreated, rr.Code, "body=%s", rr.Body.String())
	body := testutil.MustJSONMap(t, rr)
	assert.Equal(t, true, body["is_draft"])
}
