package handler_test

import (
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/require"
)

func issueReactionBase(slug, projectID, issueID string) string {
	return "/api/workspaces/" + slug + "/projects/" + projectID + "/issues/" + issueID + "/reactions/"
}

func TestIssueReactions_RequiresAuth(t *testing.T) {
	ts := testutil.NewTestServer(t)
	rr := ts.GET(issueReactionBase("x", "00000000-0000-0000-0000-000000000000", "00000000-0000-0000-0000-000000000000"), "")
	require.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestIssue_Reactions(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	issue := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	base := issueReactionBase(w.Workspace.Slug, w.Project.ID.String(), issue.ID.String())

	// List (empty)
	rr := ts.GET(base, w.Session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())

	// Add reaction
	rr2 := ts.POST(base, map[string]any{"reaction": "👍"}, w.Session)
	require.Equal(t, http.StatusCreated, rr2.Code, "body=%s", rr2.Body.String())

	// List (now contains the reaction)
	rr3 := ts.GET(base, w.Session)
	require.Equal(t, http.StatusOK, rr3.Code, "body=%s", rr3.Body.String())
	require.Contains(t, rr3.Body.String(), "👍")

	// Adding the same reaction again is rejected by the unique constraint
	rr4 := ts.POST(base, map[string]any{"reaction": "👍"}, w.Session)
	require.Equal(t, http.StatusConflict, rr4.Code, "body=%s", rr4.Body.String())

	// Remove reaction (URL-encoded thumbs-up)
	rr5 := ts.DELETE(base+"%F0%9F%91%8D/", w.Session)
	require.Equal(t, http.StatusNoContent, rr5.Code, "body=%s", rr5.Body.String())
}
