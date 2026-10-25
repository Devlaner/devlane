package service_test

import (
	"context"
	"testing"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/stretchr/testify/require"
)

// Workspace search must not return content from a secret project to a member
// who isn't on that project. Previously it authorized only workspace membership
// and filtered the SQL by workspace_id alone.
func TestSearchRespectsProjectVisibility(t *testing.T) {
	ts := testutil.NewTestServer(t)
	db := ts.DB
	ctx := context.Background()

	owner := testutil.CreateUser(t, db)
	wrk := testutil.CreateWorkspace(t, db, owner.ID) // owner is also the project lead/member

	outsider := testutil.CreateUser(t, db)
	testutil.AddWorkspaceMember(t, db, wrk.ID, outsider.ID, model.RoleMember)

	proj := testutil.CreateProject(t, db, wrk.ID, owner.ID)
	const projToken = "zqxsecretproj"
	require.NoError(t, db.Model(&model.Project{}).Where("id = ?", proj.ID).
		Updates(map[string]any{"network": model.NetworkSecret, "name": projToken}).Error)

	issue := testutil.CreateIssue(t, db, proj.ID, wrk.ID, owner.ID)
	const issueToken = "zqxsecretwidget"
	require.NoError(t, db.Model(&model.Issue{}).Where("id = ?", issue.ID).
		Update("name", issueToken).Error)

	svc := service.NewSearchService(store.NewSearchStore(db), store.NewWorkspaceStore(db))

	// Outsider is a workspace member but not on the secret project.
	out, err := svc.Search(ctx, wrk.Slug, issueToken, nil, outsider.ID)
	require.NoError(t, err)
	require.Empty(t, out.Issues, "outsider must not see a secret project's issue")
	outProj, err := svc.Search(ctx, wrk.Slug, projToken, nil, outsider.ID)
	require.NoError(t, err)
	require.Empty(t, outProj.Projects, "outsider must not see the secret project itself")

	// The owner (a project member) still finds both.
	own, err := svc.Search(ctx, wrk.Slug, issueToken, nil, owner.ID)
	require.NoError(t, err)
	require.Len(t, own.Issues, 1, "project member should see the issue")
	ownProj, err := svc.Search(ctx, wrk.Slug, projToken, nil, owner.ID)
	require.NoError(t, err)
	require.Len(t, ownProj.Projects, 1, "project member should see the project")
}
