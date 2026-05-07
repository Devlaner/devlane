package handler_test

import (
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/require"
)

func TestRecentVisit_RequiresAuth(t *testing.T) {
	ts := testutil.NewTestServer(t)
	rr := ts.GET("/api/workspaces/x/recent-visits/", "")
	require.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestRecentVisit_ListEmpty(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)

	rr := ts.GET("/api/workspaces/"+w.Workspace.Slug+"/recent-visits/", w.Session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
}

func TestRecentVisit_RecordProject(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)

	rr := ts.POST("/api/workspaces/"+w.Workspace.Slug+"/recent-visits/", map[string]any{
		"entity_name":       "project",
		"entity_identifier": w.Project.ID.String(),
	}, w.Session)
	require.Equal(t, http.StatusNoContent, rr.Code, "body=%s", rr.Body.String())
}

func TestRecentVisit_RecordIssue(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	issue := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)

	rr := ts.POST("/api/workspaces/"+w.Workspace.Slug+"/recent-visits/", map[string]any{
		"entity_name":       "issue",
		"entity_identifier": issue.ID.String(),
		"project_id":        w.Project.ID.String(),
	}, w.Session)
	require.Equal(t, http.StatusNoContent, rr.Code, "body=%s", rr.Body.String())
}
