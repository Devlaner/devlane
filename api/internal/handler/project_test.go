package handler_test

import (
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestProject_List_RequiresAuth(t *testing.T) {
	ts := testutil.NewTestServer(t)
	rr := ts.GET("/api/workspaces/some-slug/projects/", "")
	require.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestProject_List_Success(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)

	rr := ts.GET("/api/workspaces/"+w.Workspace.Slug+"/projects/", w.Session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
	list := testutil.DecodeJSON[[]map[string]any](t, rr)
	require.Len(t, list, 1)
	assert.Equal(t, w.Project.Name, list[0]["name"])
}

func TestProject_Create_Success(t *testing.T) {
	ts := testutil.NewTestServer(t)
	user := testutil.CreateUser(t, ts.DB)
	ws := testutil.CreateWorkspace(t, ts.DB, user.ID)
	session := testutil.LoginAs(t, ts.DB, user)

	rr := ts.POST("/api/workspaces/"+ws.Slug+"/projects/", map[string]any{
		"name":       "My Project",
		"identifier": "MYP",
	}, session)
	require.Equal(t, http.StatusCreated, rr.Code, "body=%s", rr.Body.String())
	body := testutil.MustJSONMap(t, rr)
	assert.Equal(t, "My Project", body["name"])

	projectID, _ := body["id"].(string)
	require.NotEmpty(t, projectID)

	statesRR := ts.GET("/api/workspaces/"+ws.Slug+"/projects/"+projectID+"/states/", session)
	require.Equal(t, http.StatusOK, statesRR.Code, "body=%s", statesRR.Body.String())
	states := testutil.DecodeJSON[[]map[string]any](t, statesRR)
	require.Len(t, states, 5)
	names := make([]string, len(states))
	for i, st := range states {
		name, _ := st["name"].(string)
		names[i] = name
	}
	assert.ElementsMatch(t, []string{"Backlog", "Todo", "In Progress", "Done", "Cancelled"}, names)
}

func TestProject_Create_RequiresMembership(t *testing.T) {
	ts := testutil.NewTestServer(t)
	owner := testutil.CreateUser(t, ts.DB)
	ws := testutil.CreateWorkspace(t, ts.DB, owner.ID)

	stranger := testutil.CreateUser(t, ts.DB)
	session := testutil.LoginAs(t, ts.DB, stranger)
	rr := ts.POST("/api/workspaces/"+ws.Slug+"/projects/", map[string]any{
		"name": "Hijack",
	}, session)
	require.Equal(t, http.StatusNotFound, rr.Code)
}

func TestProject_Get_Success(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)

	rr := ts.GET("/api/workspaces/"+w.Workspace.Slug+"/projects/"+w.Project.ID.String()+"/", w.Session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
}

func TestProject_Update(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)

	rr := ts.PATCH("/api/workspaces/"+w.Workspace.Slug+"/projects/"+w.Project.ID.String()+"/", map[string]any{
		"name": "Renamed",
	}, w.Session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
	assert.Equal(t, "Renamed", testutil.MustJSONMap(t, rr)["name"])
}

func TestProject_Delete(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)

	rr := ts.DELETE("/api/workspaces/"+w.Workspace.Slug+"/projects/"+w.Project.ID.String()+"/", w.Session)
	require.Equal(t, http.StatusNoContent, rr.Code, "body=%s", rr.Body.String())
}

func TestProject_Favorite_AddRemove(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)

	// Note: favorite route has NO trailing slash (router.go line 270/271).
	rr := ts.POST("/api/workspaces/"+w.Workspace.Slug+"/projects/"+w.Project.ID.String()+"/favorite", nil, w.Session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
	body := testutil.MustJSONMap(t, rr)
	assert.Equal(t, w.Project.ID.String(), body["project_id"])

	// Listed in favorites
	rr2 := ts.GET("/api/users/me/favorite-projects/", w.Session)
	require.Equal(t, http.StatusOK, rr2.Code)

	// Remove
	rr3 := ts.DELETE("/api/workspaces/"+w.Workspace.Slug+"/projects/"+w.Project.ID.String()+"/favorite", w.Session)
	require.Equal(t, http.StatusOK, rr3.Code, "body=%s", rr3.Body.String())
}

func TestProject_Members_List(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)

	rr := ts.GET("/api/workspaces/"+w.Workspace.Slug+"/projects/"+w.Project.ID.String()+"/members/", w.Session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
	list := testutil.DecodeJSON[[]map[string]any](t, rr)
	assert.GreaterOrEqual(t, len(list), 1)
}

func TestProject_Invitation_CRUD(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)

	// Create invite
	rr := ts.POST("/api/workspaces/"+w.Workspace.Slug+"/projects/"+w.Project.ID.String()+"/invitations/", map[string]any{
		"email": "p-invite@test.local",
		"role":  testutil.RoleMember,
	}, w.Session)
	require.Equal(t, http.StatusCreated, rr.Code, "body=%s", rr.Body.String())
	created := testutil.MustJSONMap(t, rr)
	inviteID, _ := created["id"].(string)
	require.NotEmpty(t, inviteID)

	// List invites
	rr2 := ts.GET("/api/workspaces/"+w.Workspace.Slug+"/projects/"+w.Project.ID.String()+"/invitations/", w.Session)
	require.Equal(t, http.StatusOK, rr2.Code)

	// Get invite
	rr3 := ts.GET("/api/workspaces/"+w.Workspace.Slug+"/projects/"+w.Project.ID.String()+"/invitations/"+inviteID+"/", w.Session)
	require.Equal(t, http.StatusOK, rr3.Code)

	// Delete invite
	rr4 := ts.DELETE("/api/workspaces/"+w.Workspace.Slug+"/projects/"+w.Project.ID.String()+"/invitations/"+inviteID+"/", w.Session)
	require.Equal(t, http.StatusNoContent, rr4.Code)
}

func TestProject_DraftIssues(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)

	rr := ts.GET("/api/workspaces/"+w.Workspace.Slug+"/draft-issues/", w.Session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
}

func TestProject_UserInvitations(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)

	rr := ts.GET("/api/users/me/workspaces/"+w.Workspace.Slug+"/projects/invitations/", w.Session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
}
