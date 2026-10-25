package handler_test

import (
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/require"
)

// A new work item created without an explicit state lands in the project's
// default state; an explicit state is respected. Covers #199.
func TestIssue_Create_UsesProjectDefaultState(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	base := issueBase(w.Workspace.Slug, w.Project.ID.String())

	// A non-default state and a default state in the project.
	other := testutil.CreateState(t, ts.DB, w.Project.ID, w.Workspace.ID)
	def := testutil.CreateState(t, ts.DB, w.Project.ID, w.Workspace.ID)
	require.NoError(t, ts.DB.Exec(`UPDATE states SET "default" = TRUE WHERE id = ?`, def.ID).Error)

	// No state provided -> default state is applied.
	rr := ts.POST(base, map[string]any{"name": "Auto-stated"}, w.Session)
	require.Equal(t, http.StatusCreated, rr.Code, "body=%s", rr.Body.String())
	require.Equal(t, def.ID.String(), testutil.MustJSONMap(t, rr)["state_id"])

	// Explicit state -> respected, not overridden by the default.
	rr2 := ts.POST(base, map[string]any{"name": "Explicit", "state_id": other.ID.String()}, w.Session)
	require.Equal(t, http.StatusCreated, rr2.Code, "body=%s", rr2.Body.String())
	require.Equal(t, other.ID.String(), testutil.MustJSONMap(t, rr2)["state_id"])
}
