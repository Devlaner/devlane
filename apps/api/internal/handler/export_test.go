package handler_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/require"
	"github.com/xuri/excelize/v2"
)

// A workspace member can export a project's issues as a real .xlsx workbook that
// parses back and contains the issues, the request is recorded in the export
// history, and non-members / empty selections are refused. Covers #198.
func TestExport_IssuesXLSXAndHistory(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	url := "/api/workspaces/" + w.Workspace.Slug + "/exports/"

	i1 := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)

	rr := ts.POST(url, map[string]any{"project_ids": []string{w.Project.ID.String()}}, w.Session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
	require.Contains(t, rr.Header().Get("Content-Type"), "spreadsheetml.sheet")

	body := rr.Body.Bytes()
	require.True(t, len(body) > 4 && body[0] == 'P' && body[1] == 'K', "response should be an xlsx (zip) file")

	// It opens as a real workbook and contains the exported issue.
	f, err := excelize.OpenReader(bytes.NewReader(body))
	require.NoError(t, err)
	rows, err := f.GetRows("Issues")
	require.NoError(t, err)
	require.GreaterOrEqual(t, len(rows), 3, "header row + two issues")
	require.Equal(t, "Title", rows[0][2])
	found := false
	for _, r := range rows[1:] {
		if len(r) > 2 && r[2] == i1.Name {
			found = true
		}
	}
	require.True(t, found, "exported sheet should contain the issue title")

	// The request is recorded in the export history.
	lr := ts.GET(url, w.Session)
	require.Equal(t, http.StatusOK, lr.Code)
	var hist struct {
		Exports []struct {
			Provider string `json:"provider"`
			Status   string `json:"status"`
		} `json:"exports"`
	}
	require.NoError(t, json.Unmarshal(lr.Body.Bytes(), &hist))
	require.Len(t, hist.Exports, 1)
	require.Equal(t, "xlsx", hist.Exports[0].Provider)
	require.Equal(t, "completed", hist.Exports[0].Status)

	// A non-member is refused.
	outsider := testutil.CreateUser(t, ts.DB)
	outsiderSession := testutil.LoginAs(t, ts.DB, outsider)
	require.Equal(t, http.StatusForbidden,
		ts.POST(url, map[string]any{"project_ids": []string{w.Project.ID.String()}}, outsiderSession).Code)

	// An empty selection is a 400.
	require.Equal(t, http.StatusBadRequest,
		ts.POST(url, map[string]any{"project_ids": []string{}}, w.Session).Code)
}
