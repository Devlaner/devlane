package handler_test

import (
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/require"
)

func TestIntegration_ListAvailable_RequiresAuth(t *testing.T) {
	ts := testutil.NewTestServer(t)

	rr := ts.GET("/api/integrations/", "")
	require.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestIntegration_ListAvailable_OK(t *testing.T) {
	ts := testutil.NewTestServer(t)
	user := testutil.CreateUser(t, ts.DB)
	session := testutil.LoginAs(t, ts.DB, user)

	rr := ts.GET("/api/integrations/", session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
}

func TestIntegration_ListInstalled_RequiresAuth(t *testing.T) {
	ts := testutil.NewTestServer(t)
	rr := ts.GET("/api/workspaces/x/integrations/", "")
	require.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestIntegration_ListInstalled_OK(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)

	rr := ts.GET("/api/workspaces/"+w.Workspace.Slug+"/integrations/", w.Session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
}

func TestIntegration_GitHubInstall_NoWorkspaceParam(t *testing.T) {
	ts := testutil.NewTestServer(t)
	user := testutil.CreateUser(t, ts.DB)
	session := testutil.LoginAs(t, ts.DB, user)

	rr := ts.GET("/auth/github-app/install", session)
	require.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestIntegration_GitHubInstall_RequiresAuth(t *testing.T) {
	ts := testutil.NewTestServer(t)
	rr := ts.GET("/auth/github-app/install?workspace=x", "")
	require.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestIntegration_GitHubSync_RequiresAuth(t *testing.T) {
	ts := testutil.NewTestServer(t)
	rr := ts.GET("/api/workspaces/x/projects/00000000-0000-0000-0000-000000000000/integrations/github/sync/", "")
	require.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestIntegration_GitHubRepositories_RequiresAuth(t *testing.T) {
	ts := testutil.NewTestServer(t)
	rr := ts.GET("/api/workspaces/x/integrations/github/repositories/", "")
	require.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestIntegration_LegacyV1(t *testing.T) {
	ts := testutil.NewTestServer(t)
	user := testutil.CreateUser(t, ts.DB)
	session := testutil.LoginAs(t, ts.DB, user)

	rr := ts.GET("/api/v1/", session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
}

func TestIntegration_LegacyV1_RequiresAuth(t *testing.T) {
	ts := testutil.NewTestServer(t)
	rr := ts.GET("/api/v1/", "")
	require.Equal(t, http.StatusUnauthorized, rr.Code)
}
