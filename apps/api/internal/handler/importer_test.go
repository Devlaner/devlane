package handler_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/require"
)

// Bulk CSV import runs synchronously in tests (no RabbitMQ configured) and
// creates one issue per row, mapping the state column by name. Covers #207.
func TestImporter_CSV(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	state := testutil.CreateState(t, ts.DB, w.Project.ID, w.Workspace.ID)

	base := "/api/workspaces/" + w.Workspace.Slug + "/projects/" + w.Project.ID.String() + "/importers/"
	csv := "name,description,priority,state\n" +
		"First task,Do the thing,high," + state.Name + "\n" +
		"Second task,,low,\n" +
		",skip me (no name),,\n" + // no name -> skipped
		"Third task,More detail,bogus,Nonexistent State\n"

	rr := ts.DoMultipart(http.MethodPost, base, "issues.csv", csv, w.Session)
	require.Equal(t, http.StatusCreated, rr.Code, "body=%s", rr.Body.String())

	var created map[string]any
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &created))
	require.Equal(t, float64(3), created["total_count"], "3 rows have a name")
	require.Equal(t, float64(3), created["processed_count"])
	require.Equal(t, "completed", created["status"])

	// It shows up in the list.
	lr := ts.GET(base, w.Session)
	require.Equal(t, http.StatusOK, lr.Code)
	var list []map[string]any
	require.NoError(t, json.Unmarshal(lr.Body.Bytes(), &list))
	require.Len(t, list, 1)

	// The three issues now exist on the project.
	ir := ts.GET("/api/workspaces/"+w.Workspace.Slug+"/projects/"+w.Project.ID.String()+"/issues/", w.Session)
	require.Equal(t, http.StatusOK, ir.Code)
	var issues []map[string]any
	require.NoError(t, json.Unmarshal(ir.Body.Bytes(), &issues))
	require.Len(t, issues, 3)
}

// A CSV without a name/title/summary column is rejected.
func TestImporter_RejectsNoNameColumn(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	base := "/api/workspaces/" + w.Workspace.Slug + "/projects/" + w.Project.ID.String() + "/importers/"
	rr := ts.DoMultipart(http.MethodPost, base, "bad.csv", "foo,bar\n1,2\n", w.Session)
	require.Equal(t, http.StatusBadRequest, rr.Code, "body=%s", rr.Body.String())
}

// A non-member cannot import into the project.
func TestImporter_Forbidden(t *testing.T) {
	ts := testutil.NewTestServer(t)
	w := testutil.SeedWorld(t, ts.DB)
	stranger := testutil.CreateUser(t, ts.DB)
	session := testutil.LoginAs(t, ts.DB, stranger)
	base := "/api/workspaces/" + w.Workspace.Slug + "/projects/" + w.Project.ID.String() + "/importers/"
	rr := ts.DoMultipart(http.MethodPost, base, "x.csv", "name\nHello\n", session)
	require.Equal(t, http.StatusForbidden, rr.Code)
}
