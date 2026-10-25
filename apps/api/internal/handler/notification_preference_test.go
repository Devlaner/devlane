package handler_test

import (
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Scoped notification preferences round-trip, and a project override does not
// leak up to the workspace scope. Also covers inheritance (project reads the
// workspace row until it has its own) and access control. Covers #203.
func TestNotifPref_ScopedRoundTrip(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	wsBase := "/api/workspaces/" + w.Workspace.Slug + "/notification-preferences/"
	projBase := "/api/workspaces/" + w.Workspace.Slug + "/projects/" + w.Project.ID.String() + "/notification-preferences/"

	// Workspace defaults: everything on.
	rr := ts.GET(wsBase, w.Session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
	body := testutil.MustJSONMap(t, rr)
	assert.Equal(t, true, body["email_comment"])
	assert.Equal(t, true, body["comment"])

	// Mute workspace email for comments; the in-app channel stays on.
	rr = ts.PUT(wsBase, map[string]any{"email_comment": false}, w.Session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
	body = testutil.MustJSONMap(t, rr)
	assert.Equal(t, false, body["email_comment"])
	assert.Equal(t, true, body["comment"])

	// The project inherits the workspace row until it has its own.
	rr = ts.GET(projBase, w.Session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
	assert.Equal(t, false, testutil.MustJSONMap(t, rr)["email_comment"], "project inherits workspace")

	// A project override (in-app comment off) does not change the workspace row.
	rr = ts.PUT(projBase, map[string]any{"comment": false}, w.Session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
	assert.Equal(t, false, testutil.MustJSONMap(t, rr)["comment"])

	rr = ts.GET(projBase, w.Session)
	assert.Equal(t, false, testutil.MustJSONMap(t, rr)["comment"], "project override persists")
	rr = ts.GET(wsBase, w.Session)
	assert.Equal(t, true, testutil.MustJSONMap(t, rr)["comment"], "workspace unchanged by project override")
}

// A non-member cannot read a workspace's notification preferences.
func TestNotifPref_NonMemberForbidden(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	stranger := testutil.CreateUser(t, ts.DB)
	strangerSession := testutil.LoginAs(t, ts.DB, stranger)

	rr := ts.GET("/api/workspaces/"+w.Workspace.Slug+"/notification-preferences/", strangerSession)
	require.Equal(t, http.StatusNotFound, rr.Code)
}
