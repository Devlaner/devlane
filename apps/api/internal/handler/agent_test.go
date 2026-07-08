package handler_test

import (
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func agentBase(slug string) string {
	return "/api/workspaces/" + slug + "/agents/"
}

func projectAgentBase(slug, projectID string) string {
	return "/api/workspaces/" + slug + "/projects/" + projectID + "/agents/"
}

func issueAgentBase(slug, projectID, issueID string) string {
	return "/api/workspaces/" + slug + "/projects/" + projectID + "/issues/" + issueID + "/"
}

func createTestAgent(t *testing.T, ts *testutil.TestServer, w testutil.SeededWorld, name string) string {
	t.Helper()
	rr := ts.POST(agentBase(w.Workspace.Slug), map[string]any{
		"name":           name,
		"description":    "Keeps issue work tidy",
		"instructions":   "Summarize the issue and propose next steps.",
		"autonomy_level": "comment",
		"tool_permissions": []map[string]any{
			{"tool": "issue.read", "scope": "workspace"},
			{"tool": "issue.comment", "scope": "workspace"},
		},
	}, w.Session)
	require.Equal(t, http.StatusCreated, rr.Code, "body=%s", rr.Body.String())
	id, _ := testutil.MustJSONMap(t, rr)["id"].(string)
	require.NotEmpty(t, id)
	return id
}

func TestAgent_RequiresAuth(t *testing.T) {
	ts := testutil.NewTestServer(t)
	rr := ts.GET(agentBase("x"), "")
	require.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestAgent_CRUD(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	base := agentBase(w.Workspace.Slug)

	agentID := createTestAgent(t, ts, w, "Bug Triage")

	rrList := ts.GET(base, w.Session)
	require.Equal(t, http.StatusOK, rrList.Code, "body=%s", rrList.Body.String())
	agents := testutil.DecodeJSON[[]map[string]any](t, rrList)
	require.Len(t, agents, 1)
	assert.Equal(t, "Bug Triage", agents[0]["name"])
	require.Len(t, agents[0]["tool_permissions"], 2)

	rrGet := ts.GET(base+agentID+"/", w.Session)
	require.Equal(t, http.StatusOK, rrGet.Code, "body=%s", rrGet.Body.String())
	assert.Equal(t, "comment", testutil.MustJSONMap(t, rrGet)["autonomy_level"])

	enabled := false
	rrPatch := ts.PATCH(base+agentID+"/", map[string]any{
		"name":             "Bug Triage v2",
		"enabled":          enabled,
		"autonomy_level":   "suggest",
		"tool_permissions": []map[string]any{{"tool": "issue.read", "scope": "workspace"}},
	}, w.Session)
	require.Equal(t, http.StatusOK, rrPatch.Code, "body=%s", rrPatch.Body.String())
	updated := testutil.MustJSONMap(t, rrPatch)
	assert.Equal(t, "Bug Triage v2", updated["name"])
	assert.Equal(t, false, updated["enabled"])
	assert.Equal(t, "suggest", updated["autonomy_level"])
	require.Len(t, updated["tool_permissions"], 1)

	rrDelete := ts.DELETE(base+agentID+"/", w.Session)
	require.Equal(t, http.StatusNoContent, rrDelete.Code, "body=%s", rrDelete.Body.String())

	rrMissing := ts.GET(base+agentID+"/", w.Session)
	require.Equal(t, http.StatusNotFound, rrMissing.Code)
}

func TestAgent_ProjectRosterIncludesWorkspaceAgents(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	createTestAgent(t, ts, w, "Workspace Agent")

	rrProject := ts.POST(projectAgentBase(w.Workspace.Slug, w.Project.ID.String()), map[string]any{
		"name":           "Project Agent",
		"autonomy_level": "suggest",
	}, w.Session)
	require.Equal(t, http.StatusCreated, rrProject.Code, "body=%s", rrProject.Body.String())
	assert.Equal(t, w.Project.ID.String(), testutil.MustJSONMap(t, rrProject)["project_id"])

	rrList := ts.GET(projectAgentBase(w.Workspace.Slug, w.Project.ID.String()), w.Session)
	require.Equal(t, http.StatusOK, rrList.Code, "body=%s", rrList.Body.String())
	agents := testutil.DecodeJSON[[]map[string]any](t, rrList)
	require.Len(t, agents, 2)
	assert.Equal(t, "Workspace Agent", agents[0]["name"])
	assert.Equal(t, "Project Agent", agents[1]["name"])
}

func TestAgent_CreateRequiresWorkspaceAdmin(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	member := testutil.CreateUser(t, ts.DB)
	testutil.AddWorkspaceMember(t, ts.DB, w.Workspace.ID, member.ID, testutil.RoleMember)
	memberSession := testutil.LoginAs(t, ts.DB, member)

	rr := ts.POST(agentBase(w.Workspace.Slug), map[string]any{"name": "Docs Writer"}, memberSession)
	require.Equal(t, http.StatusForbidden, rr.Code, "body=%s", rr.Body.String())
}

func TestAgent_IssueAssignmentAndRun(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	agentID := createTestAgent(t, ts, w, "Spec Breaker")
	issue := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	base := issueAgentBase(w.Workspace.Slug, w.Project.ID.String(), issue.ID.String())

	rrAssign := ts.POST(base+"agent-assignments/", map[string]any{
		"agent_id": agentID,
		"reason":   "Break this into child tasks",
	}, w.Session)
	require.Equal(t, http.StatusCreated, rrAssign.Code, "body=%s", rrAssign.Body.String())
	assignment := testutil.MustJSONMap(t, rrAssign)
	assert.Equal(t, agentID, assignment["agent_id"])
	assert.Equal(t, "active", assignment["status"])

	rrAssignments := ts.GET(base+"agent-assignments/", w.Session)
	require.Equal(t, http.StatusOK, rrAssignments.Code, "body=%s", rrAssignments.Body.String())
	require.Len(t, testutil.DecodeJSON[[]map[string]any](t, rrAssignments), 1)

	rrRun := ts.POST(base+"agent-runs/", map[string]any{
		"agent_id": agentID,
		"trigger":  "manual",
		"input": map[string]any{
			"task": "draft_subtasks",
		},
	}, w.Session)
	require.Equal(t, http.StatusCreated, rrRun.Code, "body=%s", rrRun.Body.String())
	run := testutil.MustJSONMap(t, rrRun)
	assert.Equal(t, agentID, run["agent_id"])
	assert.Equal(t, "queued", run["status"])
	assert.Equal(t, "manual", run["trigger"])

	rrRuns := ts.GET(base+"agent-runs/", w.Session)
	require.Equal(t, http.StatusOK, rrRuns.Code, "body=%s", rrRuns.Body.String())
	require.Len(t, testutil.DecodeJSON[[]map[string]any](t, rrRuns), 1)

	rrActivities := ts.GET(base+"activities/", w.Session)
	require.Equal(t, http.StatusOK, rrActivities.Code, "body=%s", rrActivities.Body.String())
	activities := testutil.DecodeJSON[[]map[string]any](t, rrActivities)
	var verbs []string
	for _, activity := range activities {
		if verb, ok := activity["verb"].(string); ok {
			verbs = append(verbs, verb)
		}
	}
	assert.Contains(t, verbs, "agent_assigned")
	assert.Contains(t, verbs, "agent_run_queued")
}

func TestAgent_DisabledAgentCannotBeAssigned(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	agentID := createTestAgent(t, ts, w, "Disabled Agent")
	rrPatch := ts.PATCH(agentBase(w.Workspace.Slug)+agentID+"/", map[string]any{"enabled": false}, w.Session)
	require.Equal(t, http.StatusOK, rrPatch.Code, "body=%s", rrPatch.Body.String())
	issue := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	base := issueAgentBase(w.Workspace.Slug, w.Project.ID.String(), issue.ID.String())

	rrAssign := ts.POST(base+"agent-assignments/", map[string]any{"agent_id": agentID}, w.Session)
	require.Equal(t, http.StatusBadRequest, rrAssign.Code, "body=%s", rrAssign.Body.String())
	assert.Contains(t, rrAssign.Body.String(), "agent is not available")
}
