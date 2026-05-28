package handler_test

import (
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func cycleProgressURL(slug, projectID, cycleID string) string {
	return "/api/workspaces/" + slug + "/projects/" + projectID + "/cycles/" + cycleID + "/progress/"
}

func cycleAnalyticsURL(slug, projectID, cycleID string) string {
	return "/api/workspaces/" + slug + "/projects/" + projectID + "/cycles/" + cycleID + "/analytics"
}

func TestCycleProgress_RequiresAuth(t *testing.T) {
	ts := testutil.NewTestServer(t)
	nilID := "00000000-0000-0000-0000-000000000000"
	rr := ts.GET(cycleProgressURL("x", nilID, nilID), "")
	require.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestCycleProgress_EmptyCycle(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	cycle := testutil.CreateCycle(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)

	rr := ts.GET(cycleProgressURL(w.Workspace.Slug, w.Project.ID.String(), cycle.ID.String()), w.Session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())

	body := testutil.MustJSONMap(t, rr)
	assert.Equal(t, float64(0), body["total_issues"])
	assert.Equal(t, float64(0), body["completed_issues"])
	dist, ok := body["distribution"].(map[string]interface{})
	require.True(t, ok, "distribution should be present")
	_, hasChart := dist["completion_chart"]
	assert.True(t, hasChart, "completion_chart should be in distribution")
}

func TestCycleAnalytics_ReturnsProgress(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	cycle := testutil.CreateCycle(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)

	rr := ts.GET(cycleAnalyticsURL(w.Workspace.Slug, w.Project.ID.String(), cycle.ID.String())+"?type=points", w.Session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
}

func TestCycleProgress_NonMember404(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	cycle := testutil.CreateCycle(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	stranger := testutil.CreateUser(t, ts.DB)
	strangerSession := testutil.LoginAs(t, ts.DB, stranger)

	rr := ts.GET(cycleProgressURL(w.Workspace.Slug, w.Project.ID.String(), cycle.ID.String()), strangerSession)
	require.Equal(t, http.StatusNotFound, rr.Code)
}
