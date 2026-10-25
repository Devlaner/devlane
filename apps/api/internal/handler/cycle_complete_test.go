package handler_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/require"
)

func cycleIssueIDs(t *testing.T, ts *testutil.TestServer, url, session string) []string {
	t.Helper()
	rr := ts.GET(url, session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
	var ids []string
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &ids))
	return ids
}

// Completing a cycle snapshots its distribution, marks it completed (which sticks
// on subsequent reads), and transfers only the incomplete work items to the
// chosen target cycle. Covers #184.
func TestCycle_CompleteAndTransfer(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	base := "/api/workspaces/" + w.Workspace.Slug + "/projects/" + w.Project.ID.String() + "/cycles/"

	source := testutil.CreateCycle(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	target := testutil.CreateCycle(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)

	// A state in the "completed" group; issues in it should not be transferred.
	doneState := testutil.CreateState(t, ts.DB, w.Project.ID, w.Workspace.ID)
	require.NoError(t, ts.DB.Model(doneState).Updates(map[string]any{"group": "completed"}).Error)

	// Two incomplete issues (no state -> backlog) and one completed issue.
	inc1 := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	inc2 := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	done := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	require.NoError(t, ts.DB.Model(done).Updates(map[string]any{"state_id": doneState.ID}).Error)

	for _, iss := range []*model.Issue{inc1, inc2, done} {
		ci := &model.CycleIssue{
			CycleID:     source.ID,
			IssueID:     iss.ID,
			ProjectID:   w.Project.ID,
			WorkspaceID: w.Workspace.ID,
		}
		require.NoError(t, ts.DB.Create(ci).Error)
	}

	// Complete the source cycle, transferring incomplete work to the target.
	rr := ts.POST(base+source.ID.String()+"/transfer-issues/",
		map[string]any{"target_cycle_id": target.ID.String()}, w.Session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
	var resp struct {
		Cycle struct {
			Status           string         `json:"status"`
			ProgressSnapshot map[string]any `json:"progress_snapshot"`
		} `json:"cycle"`
		TransferredCount int `json:"transferred_count"`
	}
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &resp))
	require.Equal(t, 2, resp.TransferredCount)
	require.Equal(t, "completed", resp.Cycle.Status)
	require.EqualValues(t, 3, resp.Cycle.ProgressSnapshot["total"])
	require.EqualValues(t, 1, resp.Cycle.ProgressSnapshot["completed"])

	// The two incomplete issues moved to the target; the completed one stayed.
	require.ElementsMatch(t, []string{inc1.ID.String(), inc2.ID.String()},
		cycleIssueIDs(t, ts, base+target.ID.String()+"/issues/", w.Session))
	require.Equal(t, []string{done.ID.String()},
		cycleIssueIDs(t, ts, base+source.ID.String()+"/issues/", w.Session))

	// The completed status persists on a later read (via the snapshot marker).
	getRR := ts.GET(base+source.ID.String()+"/", w.Session)
	require.Equal(t, http.StatusOK, getRR.Code)
	require.Equal(t, "completed", testutil.MustJSONMap(t, getRR)["status"])

	// Targeting the cycle itself is rejected.
	require.Equal(t, http.StatusBadRequest,
		ts.POST(base+source.ID.String()+"/transfer-issues/",
			map[string]any{"target_cycle_id": source.ID.String()}, w.Session).Code)
}

// Completing a cycle with no target just snapshots and marks it completed,
// leaving its work items in place.
func TestCycle_CompleteWithoutTransfer(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	base := "/api/workspaces/" + w.Workspace.Slug + "/projects/" + w.Project.ID.String() + "/cycles/"

	cy := testutil.CreateCycle(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	iss := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	require.NoError(t, ts.DB.Create(&model.CycleIssue{
		CycleID: cy.ID, IssueID: iss.ID, ProjectID: w.Project.ID, WorkspaceID: w.Workspace.ID,
	}).Error)

	rr := ts.POST(base+cy.ID.String()+"/transfer-issues/", map[string]any{}, w.Session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
	var resp struct {
		TransferredCount int `json:"transferred_count"`
	}
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &resp))
	require.Equal(t, 0, resp.TransferredCount)

	// The issue stays in the completed cycle.
	require.Equal(t, []string{iss.ID.String()},
		cycleIssueIDs(t, ts, base+cy.ID.String()+"/issues/", w.Session))
}
