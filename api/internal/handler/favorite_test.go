package handler_test

import (
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/require"
)

func TestFavorite_FavoriteProjects_RequiresAuth(t *testing.T) {
	ts := testutil.NewTestServer(t)
	rr := ts.GET("/api/users/me/favorite-projects/", "")
	require.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestFavorite_FavoriteProjects_Empty(t *testing.T) {
	ts := testutil.NewTestServer(t)
	user := testutil.CreateUser(t, ts.DB)
	session := testutil.LoginAs(t, ts.DB, user)

	rr := ts.GET("/api/users/me/favorite-projects/", session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
}

func TestFavorite_FavoriteProjects_AfterFavoriting(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)

	// Add favorite
	rr := ts.POST("/api/workspaces/"+w.Workspace.Slug+"/projects/"+w.Project.ID.String()+"/favorite", nil, w.Session)
	require.Truef(t, rr.Code < 400, "favorite failed: %d %s", rr.Code, rr.Body.String())

	// List favorites — endpoint returns {"project_ids": ["uuid", ...]}.
	rr2 := ts.GET("/api/users/me/favorite-projects/", w.Session)
	require.Equal(t, http.StatusOK, rr2.Code, "body=%s", rr2.Body.String())
	body := testutil.MustJSONMap(t, rr2)
	ids, _ := body["project_ids"].([]any)
	require.GreaterOrEqual(t, len(ids), 1)
}
