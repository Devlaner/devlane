package handler_test

import (
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/require"
)

func TestInvitation_GetByToken_NotFound(t *testing.T) {
	ts := testutil.NewTestServer(t)
	rr := ts.GET("/api/invitations/by-token/?token=does-not-exist", "")
	require.Equal(t, http.StatusNotFound, rr.Code)
}

func TestInvitation_GetByToken_Found(t *testing.T) {
	ts := testutil.NewTestServer(t)
	owner := testutil.CreateUser(t, ts.DB)
	w := testutil.CreateWorkspace(t, ts.DB, owner.ID)
	inv := testutil.CreateWorkspaceInvite(t, ts.DB, w.ID, "candidate@test.local", "tok-aaa-111")

	rr := ts.GET("/api/invitations/by-token/?token="+inv.Token, "")
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
}

func TestInvitation_DeclineByToken(t *testing.T) {
	ts := testutil.NewTestServer(t)
	owner := testutil.CreateUser(t, ts.DB)
	w := testutil.CreateWorkspace(t, ts.DB, owner.ID)
	inv := testutil.CreateWorkspaceInvite(t, ts.DB, w.ID, "decline@test.local", "tok-decline-111")

	rr := ts.POST("/api/invitations/decline/", map[string]any{"token": inv.Token}, "")
	// Either 200 or 204; we just want a non-error.
	require.Truef(t, rr.Code < 400, "unexpected status %d body=%s", rr.Code, rr.Body.String())
}

func TestInvitation_NoAuthRequired(t *testing.T) {
	ts := testutil.NewTestServer(t)
	rr := ts.POST("/api/invitations/decline/", map[string]any{"token": "x"}, "")
	// Endpoint is public — must not 401.
	require.NotEqual(t, http.StatusUnauthorized, rr.Code)
}
