package handler_test

import (
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestState_RequiresAuth(t *testing.T) {
	ts := testutil.NewTestServer(t)
	rr := ts.GET("/api/workspaces/x/projects/00000000-0000-0000-0000-000000000000/states/", "")
	require.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestState_CRUD(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	base := "/api/workspaces/" + w.Workspace.Slug + "/projects/" + w.Project.ID.String() + "/states/"

	// Create
	rr := ts.POST(base, map[string]any{
		"name":  "Backlog",
		"color": "#ff0000",
		"group": "backlog",
	}, w.Session)
	require.Equal(t, http.StatusCreated, rr.Code, "body=%s", rr.Body.String())
	stateID, _ := testutil.MustJSONMap(t, rr)["id"].(string)
	require.NotEmpty(t, stateID)

	// List
	rr2 := ts.GET(base, w.Session)
	require.Equal(t, http.StatusOK, rr2.Code)
	list := testutil.DecodeJSON[[]map[string]any](t, rr2)
	assert.Len(t, list, 1)

	// Update
	rr3 := ts.PATCH(base+stateID+"/", map[string]any{"name": "In Progress"}, w.Session)
	require.Equal(t, http.StatusOK, rr3.Code, "body=%s", rr3.Body.String())
	assert.Equal(t, "In Progress", testutil.MustJSONMap(t, rr3)["name"])

	// Delete
	rr4 := ts.DELETE(base+stateID+"/", w.Session)
	require.Equal(t, http.StatusNoContent, rr4.Code)
}

func TestState_List_SeedsDefaultStates(t *testing.T) {
	ts := testutil.NewTestServer(t)
	user := testutil.CreateUser(t, ts.DB)
	ws := testutil.CreateWorkspace(t, ts.DB, user.ID)
	session := testutil.LoginAs(t, ts.DB, user)
	project := testutil.CreateProject(t, ts.DB, ws.ID, user.ID)

	base := "/api/workspaces/" + ws.Slug + "/projects/" + project.ID.String() + "/states/"
	rr := ts.GET(base, session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())

	list := testutil.DecodeJSON[[]map[string]any](t, rr)
	require.Len(t, list, 5)
	names := make([]string, len(list))
	for i, st := range list {
		name, _ := st["name"].(string)
		names[i] = name
	}
	assert.ElementsMatch(t, []string{"Backlog", "Todo", "In Progress", "Done", "Cancelled"}, names)
}

func TestState_NonMember404(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	stranger := testutil.CreateUser(t, ts.DB)
	strangerSession := testutil.LoginAs(t, ts.DB, stranger)

	rr := ts.GET("/api/workspaces/"+w.Workspace.Slug+"/projects/"+w.Project.ID.String()+"/states/", strangerSession)
	require.Equal(t, http.StatusNotFound, rr.Code)
}
