package service_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/Devlaner/devlane/api/internal/testutil"
)

func makeProjectSecret(t *testing.T, db *gorm.DB, projectID uuid.UUID) {
	t.Helper()
	if err := db.Model(&model.Project{}).Where("id = ?", projectID).
		Update("network", model.NetworkSecret).Error; err != nil {
		t.Fatalf("make project secret: %v", err)
	}
}

// A secret (non-public) project's sub-resources must respect the same
// visibility rule as ProjectService.GetByID: reachable only by a workspace
// admin/owner or a member of the project — never by a plain workspace member
// who was never added to the project, even though workspace membership and
// project-in-workspace both pass. Exercised through real service methods so the
// gate is verified end-to-end for every sub-resource that shares
// ensureProjectAccess.
func TestSecretProjectVisibility(t *testing.T) {
	ts := testutil.NewTestServer(t)
	db := ts.DB
	ctx := context.Background()

	owner := testutil.CreateUser(t, db)
	wrk := testutil.CreateWorkspace(t, db, owner.ID) // workspace owner + auto project lead

	admin := testutil.CreateUser(t, db)
	testutil.AddWorkspaceMember(t, db, wrk.ID, admin.ID, model.RoleAdmin)

	// Plain workspace member, not added to the project.
	outsider := testutil.CreateUser(t, db)
	testutil.AddWorkspaceMember(t, db, wrk.ID, outsider.ID, model.RoleMember)

	// Plain workspace member who IS a member of the project.
	insider := testutil.CreateUser(t, db)
	testutil.AddWorkspaceMember(t, db, wrk.ID, insider.ID, model.RoleMember)

	proj := testutil.CreateProject(t, db, wrk.ID, owner.ID)
	testutil.AddProjectMember(t, db, proj.ID, wrk.ID, insider.ID, model.RoleMember)

	intakeSvc := service.NewIntakeService(
		store.NewIntakeStore(db),
		store.NewIssueStore(db),
		store.NewProjectStore(db),
		store.NewWorkspaceStore(db),
	)
	stateSvc := service.NewStateService(
		store.NewStateStore(db),
		store.NewProjectStore(db),
		store.NewWorkspaceStore(db),
	)

	// listErr returns the access error surfaced by two independent
	// sub-resource services (intake and states), so the assertion isn't tied
	// to one code path.
	listErr := func(userID uuid.UUID) (error, error) {
		_, e1 := intakeSvc.List(ctx, wrk.Slug, proj.ID, userID, nil)
		_, e2 := stateSvc.List(ctx, wrk.Slug, proj.ID, userID)
		return e1, e2
	}

	// While public, every workspace member can read the sub-resources.
	if e1, e2 := listErr(outsider.ID); e1 != nil || e2 != nil {
		t.Fatalf("public project should be readable by a workspace member: intake=%v state=%v", e1, e2)
	}

	makeProjectSecret(t, db, proj.ID)

	t.Run("outsider-denied", func(t *testing.T) {
		e1, e2 := listErr(outsider.ID)
		if !errors.Is(e1, service.ErrProjectNotFound) {
			t.Errorf("intake: want ErrProjectNotFound, got %v", e1)
		}
		if !errors.Is(e2, service.ErrProjectNotFound) {
			t.Errorf("states: want ErrProjectNotFound, got %v", e2)
		}
	})

	t.Run("workspace-admin-allowed", func(t *testing.T) {
		if e1, e2 := listErr(admin.ID); e1 != nil || e2 != nil {
			t.Errorf("workspace admin should see the secret project: intake=%v state=%v", e1, e2)
		}
	})

	t.Run("project-member-allowed", func(t *testing.T) {
		if e1, e2 := listErr(insider.ID); e1 != nil || e2 != nil {
			t.Errorf("project member should see the secret project: intake=%v state=%v", e1, e2)
		}
	})

	t.Run("project-lead-allowed", func(t *testing.T) {
		if e1, e2 := listErr(owner.ID); e1 != nil || e2 != nil {
			t.Errorf("project lead should see the secret project: intake=%v state=%v", e1, e2)
		}
	})
}
