package handler_test

import (
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestEpic_Progress(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)

	// An epic with two child work items.
	epic := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	require.NoError(t, ts.DB.Model(&model.Issue{}).Where("id = ?", epic.ID).Update("is_epic", true).Error)
	c1 := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	c2 := testutil.CreateIssue(t, ts.DB, w.Project.ID, w.Workspace.ID, w.User.ID)
	require.NoError(t, ts.DB.Model(&model.Issue{}).
		Where("id IN ?", []uuid.UUID{c1.ID, c2.ID}).
		Update("parent_id", epic.ID).Error)

	url := "/api/workspaces/" + w.Workspace.Slug + "/projects/" + w.Project.ID.String() + "/epics-progress/"
	rr := ts.GET(url, w.Session)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
	// The epic appears in the map and totals its two children.
	require.Contains(t, rr.Body.String(), epic.ID.String())
	require.Contains(t, rr.Body.String(), "\"total\":2")
}
