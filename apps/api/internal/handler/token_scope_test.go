package handler_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/require"
)

func bearer(token string) http.Header {
	h := http.Header{}
	h.Set("Authorization", "Bearer "+token)
	return h
}

// A workspace-scoped API token must only reach its own workspace's routes.
func TestWorkspaceTokenScope(t *testing.T) {
	ts := testutil.NewTestServer(t)
	db := ts.DB
	ctx := context.Background()

	user := testutil.CreateUser(t, db)
	wsA := testutil.CreateWorkspace(t, db, user.ID)
	wsB := testutil.CreateWorkspace(t, db, user.ID)

	tokens := store.NewApiTokenStore(db)
	wsToken, err := tokens.CreateForWorkspace(ctx, user.ID, wsA.ID, "ci", "", nil)
	require.NoError(t, err)

	// Allowed: its own workspace.
	rr := ts.DoWithHeaders("GET", "/api/workspaces/"+wsA.Slug+"/", nil, bearer(wsToken))
	require.Equal(t, http.StatusOK, rr.Code, "token should reach its own workspace")

	// Denied: a different workspace the owner also belongs to.
	rr = ts.DoWithHeaders("GET", "/api/workspaces/"+wsB.Slug+"/", nil, bearer(wsToken))
	require.Equal(t, http.StatusForbidden, rr.Code, "token must not reach another workspace")

	// Denied: a non-workspace route.
	rr = ts.DoWithHeaders("GET", "/api/users/me/", nil, bearer(wsToken))
	require.Equal(t, http.StatusForbidden, rr.Code, "workspace token must not reach /users/me")

	// A personal token (no workspace scope) still works everywhere.
	personal, err := tokens.Create(ctx, user.ID, "personal", "", nil)
	require.NoError(t, err)
	rr = ts.DoWithHeaders("GET", "/api/users/me/", nil, bearer(personal))
	require.Equal(t, http.StatusOK, rr.Code, "personal token should still reach /users/me")
	rr = ts.DoWithHeaders("GET", "/api/workspaces/"+wsB.Slug+"/", nil, bearer(personal))
	require.Equal(t, http.StatusOK, rr.Code, "personal token should still reach any workspace")
}
