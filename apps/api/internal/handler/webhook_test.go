package handler_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/require"
)

// Webhook CRUD for a workspace admin: create (secret generated), list, toggle,
// delete. Covers #195.
func TestWebhook_CRUD(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB) // seeded user owns the workspace
	base := "/api/workspaces/" + w.Workspace.Slug + "/webhooks/"

	rr := ts.POST(base, map[string]any{"url": "https://example.com/hook", "issue": true}, w.Session)
	require.Equal(t, http.StatusCreated, rr.Code, "body=%s", rr.Body.String())
	var created map[string]any
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &created))
	id, _ := created["id"].(string)
	require.NotEmpty(t, id)
	require.NotEmpty(t, created["secret_key"], "a secret should be generated")
	require.Equal(t, true, created["issue"])

	// List includes the webhook but never the secret: it is returned only once,
	// at creation.
	lr := ts.GET(base, w.Session)
	require.Equal(t, http.StatusOK, lr.Code)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(lr.Body.Bytes(), &list))
	require.Len(t, list, 1)
	require.NotContains(t, list[0], "secret_key", "the secret must not leak on list")

	// Toggle it off.
	ur := ts.PATCH(base+id+"/", map[string]any{"is_active": false}, w.Session)
	require.Equal(t, http.StatusOK, ur.Code, "body=%s", ur.Body.String())
	var updated map[string]any
	require.NoError(t, json.Unmarshal(ur.Body.Bytes(), &updated))
	require.Equal(t, false, updated["is_active"])

	// Delete it.
	require.Equal(t, http.StatusNoContent, ts.DELETE(base+id+"/", w.Session).Code)
	lr2 := ts.GET(base, w.Session)
	var list2 []map[string]any
	require.NoError(t, json.Unmarshal(lr2.Body.Bytes(), &list2))
	require.Len(t, list2, 0)
}

// A non-http URL is rejected.
func TestWebhook_RejectsBadURL(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	rr := ts.POST("/api/workspaces/"+w.Workspace.Slug+"/webhooks/", map[string]any{"url": "ftp://example.com"}, w.Session)
	require.Equal(t, http.StatusBadRequest, rr.Code)
}

// A non-admin (non-member) cannot manage webhooks.
func TestWebhook_NonAdminForbidden(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	stranger := testutil.CreateUser(t, ts.DB)
	session := testutil.LoginAs(t, ts.DB, stranger)
	rr := ts.GET("/api/workspaces/"+w.Workspace.Slug+"/webhooks/", session)
	require.Equal(t, http.StatusForbidden, rr.Code)
}
