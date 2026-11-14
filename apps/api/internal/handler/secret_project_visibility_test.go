package handler_test

import (
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/require"
)

// Regression tests for GHSA-8r9p-34cv-98qg: workspace-wide search, analytics
// and the analytics CSV export must not expose data from secret projects to
// workspace members who are neither project members nor workspace admins.

type secretFixture struct {
	ts                 *testutil.TestServer
	slug               string
	secretID, publicID string
	outsider           string // plain workspace member, not in the secret project
	insider            string // plain workspace member, in the secret project
	admin              string // workspace admin, not in the secret project
}

const (
	secretIssueName   = "zzsecret confidential merger plan"
	secretProjectName = "zzsecret project"
	secretLabelName   = "zzsecret-label"
	secretStateName   = "zzsecret-state"
	publicIssueName   = "zzpublic roadmap item"
)

func newSecretFixture(t *testing.T) secretFixture {
	t.Helper()
	ts := testutil.NewTestServer(t)
	db := ts.DB
	owner := testutil.CreateUser(t, db)
	w := testutil.CreateWorkspace(t, db, owner.ID)

	public := testutil.CreateProject(t, db, w.ID, owner.ID)
	secret := testutil.CreateProject(t, db, w.ID, owner.ID)
	require.NoError(t, db.Model(secret).Updates(map[string]any{"network": model.NetworkSecret, "name": secretProjectName}).Error)

	// Secret project data: issue with state, label, and an assignee.
	assignee := testutil.CreateUser(t, db, testutil.WithUserEmail("zzsecret-assignee@example.com"))
	testutil.AddWorkspaceMember(t, db, w.ID, assignee.ID, testutil.RoleMember)
	testutil.AddProjectMember(t, db, secret.ID, w.ID, assignee.ID, testutil.RoleMember)

	sState := testutil.CreateState(t, db, secret.ID, w.ID)
	require.NoError(t, db.Model(sState).Update("name", secretStateName).Error)
	sLabel := testutil.CreateLabel(t, db, secret.ID, w.ID)
	require.NoError(t, db.Model(sLabel).Update("name", secretLabelName).Error)
	sIssue := testutil.CreateIssue(t, db, secret.ID, w.ID, owner.ID)
	require.NoError(t, db.Model(sIssue).Updates(map[string]any{"name": secretIssueName, "state_id": sState.ID}).Error)
	require.NoError(t, db.Create(&model.IssueLabel{IssueID: sIssue.ID, LabelID: sLabel.ID, ProjectID: secret.ID, WorkspaceID: w.ID}).Error)
	require.NoError(t, db.Create(&model.IssueAssignee{IssueID: sIssue.ID, AssigneeID: assignee.ID, ProjectID: secret.ID, WorkspaceID: w.ID}).Error)

	// A page linked only to the secret project.
	page := testutil.CreatePage(t, db, w.ID, owner.ID)
	require.NoError(t, db.Model(page).Update("name", "zzsecret page").Error)
	require.NoError(t, db.Create(&model.ProjectPage{ProjectID: secret.ID, PageID: page.ID, WorkspaceID: w.ID}).Error)

	// Public project data.
	pState := testutil.CreateState(t, db, public.ID, w.ID)
	pIssue := testutil.CreateIssue(t, db, public.ID, w.ID, owner.ID)
	require.NoError(t, db.Model(pIssue).Updates(map[string]any{"name": publicIssueName, "state_id": pState.ID}).Error)

	outsider := testutil.CreateUser(t, db)
	testutil.AddWorkspaceMember(t, db, w.ID, outsider.ID, testutil.RoleMember)
	testutil.AddProjectMember(t, db, public.ID, w.ID, outsider.ID, testutil.RoleMember)

	admin := testutil.CreateUser(t, db)
	testutil.AddWorkspaceMember(t, db, w.ID, admin.ID, testutil.RoleAdmin)

	return secretFixture{
		ts:       ts,
		slug:     w.Slug,
		secretID: secret.ID.String(),
		publicID: public.ID.String(),
		outsider: testutil.LoginAs(t, db, outsider),
		insider:  testutil.LoginAs(t, db, assignee),
		admin:    testutil.LoginAs(t, db, admin),
	}
}

func TestSecretProject_SearchHiddenFromOutsiders(t *testing.T) {
	f := newSecretFixture(t)
	url := "/api/workspaces/" + f.slug + "/search/?query=zzsecret"

	out := parseSearch(t, f.ts.GET(url, f.outsider))
	require.Empty(t, out.Results.Issue, "outsider must not see secret issues")
	require.Empty(t, out.Results.Project, "outsider must not see secret projects")
	require.Empty(t, out.Results.Page, "outsider must not see pages of secret projects")

	// The public project is still searchable for the outsider.
	pub := parseSearch(t, f.ts.GET("/api/workspaces/"+f.slug+"/search/?query=zzpublic", f.outsider))
	require.Contains(t, names(pub.Results.Issue), publicIssueName)

	for _, session := range []string{f.insider, f.admin} {
		in := parseSearch(t, f.ts.GET(url, session))
		require.Contains(t, names(in.Results.Issue), secretIssueName)
		require.Contains(t, names(in.Results.Project), secretProjectName)
		require.Contains(t, names(in.Results.Page), "zzsecret page")
	}

	// Project-scoped search against the secret project leaks nothing either.
	scoped := parseSearch(t, f.ts.GET(url+"&project_id="+f.secretID, f.outsider))
	require.Empty(t, scoped.Results.Issue)
}

func TestSecretProject_WorkspaceAnalyticsHiddenFromOutsiders(t *testing.T) {
	f := newSecretFixture(t)
	url := "/api/workspaces/" + f.slug + "/analytics/"

	rr := f.ts.GET(url, f.outsider)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
	require.NotContains(t, rr.Body.String(), "zzsecret")

	for _, session := range []string{f.insider, f.admin} {
		rr := f.ts.GET(url, session)
		require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
		body := rr.Body.String()
		require.Contains(t, body, secretStateName)
		require.Contains(t, body, secretLabelName)
		require.Contains(t, body, "zzsecret-assignee@example.com")
	}
}

func TestSecretProject_WorkspaceCSVExportHiddenFromOutsiders(t *testing.T) {
	f := newSecretFixture(t)
	url := "/api/workspaces/" + f.slug + "/analytics/export/"

	rr := f.ts.GET(url, f.outsider)
	require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
	require.NotContains(t, rr.Body.String(), "zzsecret")
	require.Contains(t, rr.Body.String(), publicIssueName)

	for _, session := range []string{f.insider, f.admin} {
		rr := f.ts.GET(url, session)
		require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
		require.Contains(t, rr.Body.String(), secretIssueName)
	}
}

func TestSecretProject_ProjectAnalyticsExportHiddenFromOutsiders(t *testing.T) {
	f := newSecretFixture(t)
	url := "/api/workspaces/" + f.slug + "/projects/" + f.secretID + "/analytics/export/"

	rr := f.ts.GET(url, f.outsider)
	require.Equal(t, http.StatusNotFound, rr.Code, "body=%s", rr.Body.String())
	require.NotContains(t, rr.Body.String(), "zzsecret")

	for _, session := range []string{f.insider, f.admin} {
		rr := f.ts.GET(url, session)
		require.Equal(t, http.StatusOK, rr.Code, "body=%s", rr.Body.String())
		require.Contains(t, rr.Body.String(), secretIssueName)
	}
}

func TestProjectAnalytics_RejectsProjectFromAnotherWorkspace(t *testing.T) {
	f := newSecretFixture(t)
	// A different workspace the outsider belongs to.
	other := testutil.CreateUser(t, f.ts.DB)
	ow := testutil.CreateWorkspace(t, f.ts.DB, other.ID)
	session := testutil.LoginAs(t, f.ts.DB, other)

	// Using their own workspace slug with a project id from f's workspace.
	rr := f.ts.GET("/api/workspaces/"+ow.Slug+"/projects/"+f.publicID+"/analytics/export/", session)
	require.Equal(t, http.StatusNotFound, rr.Code, "body=%s", rr.Body.String())
}
