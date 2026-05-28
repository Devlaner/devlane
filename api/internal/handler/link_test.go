package handler_test

import (
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func linkBase(slug, projectID, issueID string) string {
	return issueBase(slug, projectID) + issueID + "/issue-links/"
}

func TestIssueLink_RequiresAuth(t *testing.T) {
	ts := testutil.NewTestServer(t)
	nilID := "00000000-0000-0000-0000-000000000000"
	rr := ts.GET(linkBase("x", nilID, nilID), "")
	require.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestIssueLink_CRUD(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	issue := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	base := linkBase(w.Workspace.Slug, w.Project.ID.String(), issue.ID.String())

	// List (empty)
	rr := ts.GET(base, w.Session)
	require.Equal(t, http.StatusOK, rr.Code)

	// Create
	rr2 := ts.POST(base, map[string]any{
		"title": "Plane repo",
		"url":   "https://github.com/makeplane/plane",
	}, w.Session)
	require.Equal(t, http.StatusCreated, rr2.Code, "body=%s", rr2.Body.String())
	created := testutil.MustJSONMap(t, rr2)
	linkID, _ := created["id"].(string)
	require.NotEmpty(t, linkID)
	assert.Equal(t, "Plane repo", created["title"])

	// List (one item)
	rr3 := ts.GET(base, w.Session)
	require.Equal(t, http.StatusOK, rr3.Code)
	assert.Contains(t, rr3.Body.String(), "Plane repo")

	// Update
	rr4 := ts.PATCH(base+linkID+"/", map[string]any{"title": "Plane (updated)"}, w.Session)
	require.Equal(t, http.StatusOK, rr4.Code, "body=%s", rr4.Body.String())
	assert.Equal(t, "Plane (updated)", testutil.MustJSONMap(t, rr4)["title"])

	// Delete
	rr5 := ts.DELETE(base+linkID+"/", w.Session)
	require.Equal(t, http.StatusNoContent, rr5.Code)

	// List (empty again)
	rr6 := ts.GET(base, w.Session)
	require.Equal(t, http.StatusOK, rr6.Code)
	assert.NotContains(t, rr6.Body.String(), "Plane")
}

func TestIssueLink_NonMember404(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	issue := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	stranger := testutil.CreateUser(t, ts.DB)
	strangerSession := testutil.LoginAs(t, ts.DB, stranger)

	rr := ts.GET(linkBase(w.Workspace.Slug, w.Project.ID.String(), issue.ID.String()), strangerSession)
	require.Equal(t, http.StatusNotFound, rr.Code)
}

func TestIssueLink_MissingURL_400(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	issue := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	base := linkBase(w.Workspace.Slug, w.Project.ID.String(), issue.ID.String())

	rr := ts.POST(base, map[string]any{"title": "no url here"}, w.Session)
	require.Equal(t, http.StatusBadRequest, rr.Code)
}
