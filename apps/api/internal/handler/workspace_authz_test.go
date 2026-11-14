package handler_test

import (
	"net/http"
	"testing"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/testutil"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// Regression tests for workspace role escalation (GHSA-9g3w-8rw9-vxwp):
// role-changing and destructive membership endpoints must enforce the role
// hierarchy, not just workspace membership.

func memberRole(t *testing.T, db *gorm.DB, pk uuid.UUID) int16 {
	t.Helper()
	var m model.WorkspaceMember
	require.NoError(t, db.First(&m, "id = ?", pk).Error)
	return m.Role
}

func workspaceMemberRow(t *testing.T, db *gorm.DB, workspaceID, userID uuid.UUID) model.WorkspaceMember {
	t.Helper()
	var m model.WorkspaceMember
	require.NoError(t, db.First(&m, "workspace_id = ? AND member_id = ?", workspaceID, userID).Error)
	return m
}

func TestWorkspaceAuthz_MemberCannotSelfPromote(t *testing.T) {
	ts := testutil.NewTestServer(t)
	owner := testutil.CreateUser(t, ts.DB)
	w := testutil.CreateWorkspace(t, ts.DB, owner.ID)
	member := testutil.CreateUser(t, ts.DB)
	m := testutil.AddWorkspaceMember(t, ts.DB, w.ID, member.ID, testutil.RoleMember)
	session := testutil.LoginAs(t, ts.DB, member)

	for _, role := range []int16{testutil.RoleAdmin, testutil.RoleOwner} {
		rr := ts.PATCH("/api/workspaces/"+w.Slug+"/members/"+m.ID.String()+"/", map[string]any{"role": role}, session)
		require.Equal(t, http.StatusNotFound, rr.Code, "role=%d body=%s", role, rr.Body.String())
	}
	require.Equal(t, testutil.RoleMember, memberRole(t, ts.DB, m.ID))
}

func TestWorkspaceAuthz_MemberCannotChangeOthersRole(t *testing.T) {
	ts := testutil.NewTestServer(t)
	owner := testutil.CreateUser(t, ts.DB)
	w := testutil.CreateWorkspace(t, ts.DB, owner.ID)
	member := testutil.CreateUser(t, ts.DB)
	testutil.AddWorkspaceMember(t, ts.DB, w.ID, member.ID, testutil.RoleMember)
	ownerRow := workspaceMemberRow(t, ts.DB, w.ID, owner.ID)
	session := testutil.LoginAs(t, ts.DB, member)

	rr := ts.PATCH("/api/workspaces/"+w.Slug+"/members/"+ownerRow.ID.String()+"/", map[string]any{"role": testutil.RoleGuest}, session)
	require.Equal(t, http.StatusNotFound, rr.Code, "body=%s", rr.Body.String())
	require.Equal(t, testutil.RoleOwner, memberRole(t, ts.DB, ownerRow.ID))
}

func TestWorkspaceAuthz_AdminCannotGrantOwnerOrDemoteOwner(t *testing.T) {
	ts := testutil.NewTestServer(t)
	owner := testutil.CreateUser(t, ts.DB)
	w := testutil.CreateWorkspace(t, ts.DB, owner.ID)
	admin := testutil.CreateUser(t, ts.DB)
	adminRow := testutil.AddWorkspaceMember(t, ts.DB, w.ID, admin.ID, testutil.RoleAdmin)
	other := testutil.CreateUser(t, ts.DB)
	otherRow := testutil.AddWorkspaceMember(t, ts.DB, w.ID, other.ID, testutil.RoleMember)
	ownerRow := workspaceMemberRow(t, ts.DB, w.ID, owner.ID)
	session := testutil.LoginAs(t, ts.DB, admin)

	// Promote self or someone else to Owner.
	for _, pk := range []uuid.UUID{adminRow.ID, otherRow.ID} {
		rr := ts.PATCH("/api/workspaces/"+w.Slug+"/members/"+pk.String()+"/", map[string]any{"role": testutil.RoleOwner}, session)
		require.Equal(t, http.StatusNotFound, rr.Code, "body=%s", rr.Body.String())
	}
	// Demote the owner.
	rr := ts.PATCH("/api/workspaces/"+w.Slug+"/members/"+ownerRow.ID.String()+"/", map[string]any{"role": testutil.RoleMember}, session)
	require.Equal(t, http.StatusNotFound, rr.Code, "body=%s", rr.Body.String())

	require.Equal(t, testutil.RoleAdmin, memberRole(t, ts.DB, adminRow.ID))
	require.Equal(t, testutil.RoleMember, memberRole(t, ts.DB, otherRow.ID))
	require.Equal(t, testutil.RoleOwner, memberRole(t, ts.DB, ownerRow.ID))
}

func TestWorkspaceAuthz_InvalidRoleRejected(t *testing.T) {
	ts := testutil.NewTestServer(t)
	owner := testutil.CreateUser(t, ts.DB)
	w := testutil.CreateWorkspace(t, ts.DB, owner.ID)
	member := testutil.CreateUser(t, ts.DB)
	m := testutil.AddWorkspaceMember(t, ts.DB, w.ID, member.ID, testutil.RoleMember)
	session := testutil.LoginAs(t, ts.DB, owner)

	for _, role := range []int{-1, 7, 19, 21, 32767} {
		rr := ts.PATCH("/api/workspaces/"+w.Slug+"/members/"+m.ID.String()+"/", map[string]any{"role": role}, session)
		require.Equal(t, http.StatusBadRequest, rr.Code, "role=%d body=%s", role, rr.Body.String())

		rr = ts.POST("/api/workspaces/"+w.Slug+"/invitations/", map[string]any{"email": "x@example.com", "role": role}, session)
		require.Equal(t, http.StatusBadRequest, rr.Code, "role=%d body=%s", role, rr.Body.String())
	}
	require.Equal(t, testutil.RoleMember, memberRole(t, ts.DB, m.ID))
}

func TestWorkspaceAuthz_MemberCannotRemoveOwnerOrOthers(t *testing.T) {
	ts := testutil.NewTestServer(t)
	owner := testutil.CreateUser(t, ts.DB)
	w := testutil.CreateWorkspace(t, ts.DB, owner.ID)
	member := testutil.CreateUser(t, ts.DB)
	testutil.AddWorkspaceMember(t, ts.DB, w.ID, member.ID, testutil.RoleMember)
	other := testutil.CreateUser(t, ts.DB)
	otherRow := testutil.AddWorkspaceMember(t, ts.DB, w.ID, other.ID, testutil.RoleMember)
	ownerRow := workspaceMemberRow(t, ts.DB, w.ID, owner.ID)
	session := testutil.LoginAs(t, ts.DB, member)

	for _, pk := range []uuid.UUID{ownerRow.ID, otherRow.ID} {
		rr := ts.DELETE("/api/workspaces/"+w.Slug+"/members/"+pk.String()+"/", session)
		require.Equal(t, http.StatusNotFound, rr.Code, "body=%s", rr.Body.String())
		memberRole(t, ts.DB, pk) // row still present
	}
}

func TestWorkspaceAuthz_AdminCannotRemoveOwner(t *testing.T) {
	ts := testutil.NewTestServer(t)
	owner := testutil.CreateUser(t, ts.DB)
	w := testutil.CreateWorkspace(t, ts.DB, owner.ID)
	admin := testutil.CreateUser(t, ts.DB)
	testutil.AddWorkspaceMember(t, ts.DB, w.ID, admin.ID, testutil.RoleAdmin)
	ownerRow := workspaceMemberRow(t, ts.DB, w.ID, owner.ID)
	session := testutil.LoginAs(t, ts.DB, admin)

	rr := ts.DELETE("/api/workspaces/"+w.Slug+"/members/"+ownerRow.ID.String()+"/", session)
	require.Equal(t, http.StatusNotFound, rr.Code, "body=%s", rr.Body.String())
	require.Equal(t, testutil.RoleOwner, memberRole(t, ts.DB, ownerRow.ID))
}

func TestWorkspaceAuthz_InviteRoleCapped(t *testing.T) {
	ts := testutil.NewTestServer(t)
	owner := testutil.CreateUser(t, ts.DB)
	w := testutil.CreateWorkspace(t, ts.DB, owner.ID)
	member := testutil.CreateUser(t, ts.DB)
	testutil.AddWorkspaceMember(t, ts.DB, w.ID, member.ID, testutil.RoleMember)
	admin := testutil.CreateUser(t, ts.DB)
	testutil.AddWorkspaceMember(t, ts.DB, w.ID, admin.ID, testutil.RoleAdmin)
	url := "/api/workspaces/" + w.Slug + "/invitations/"

	// Plain members cannot invite at all.
	memberSession := testutil.LoginAs(t, ts.DB, member)
	rr := ts.POST(url, map[string]any{"email": "a@example.com", "role": testutil.RoleMember}, memberSession)
	require.Equal(t, http.StatusNotFound, rr.Code, "body=%s", rr.Body.String())
	rr = ts.POST(url, map[string]any{"email": "b@example.com", "role": testutil.RoleOwner}, memberSession)
	require.Equal(t, http.StatusNotFound, rr.Code, "body=%s", rr.Body.String())

	// Admins cannot invite above their own role.
	adminSession := testutil.LoginAs(t, ts.DB, admin)
	rr = ts.POST(url, map[string]any{"email": "c@example.com", "role": testutil.RoleOwner}, adminSession)
	require.Equal(t, http.StatusNotFound, rr.Code, "body=%s", rr.Body.String())

	var count int64
	require.NoError(t, ts.DB.Model(&model.WorkspaceMemberInvite{}).Where("workspace_id = ?", w.ID).Count(&count).Error)
	require.Zero(t, count)
}

func TestWorkspaceAuthz_MemberCannotDeleteProject(t *testing.T) {
	ts := testutil.NewTestServer(t)
	owner := testutil.CreateUser(t, ts.DB)
	w := testutil.CreateWorkspace(t, ts.DB, owner.ID)
	p := testutil.CreateProject(t, ts.DB, w.ID, owner.ID)
	member := testutil.CreateUser(t, ts.DB)
	testutil.AddWorkspaceMember(t, ts.DB, w.ID, member.ID, testutil.RoleMember)
	testutil.AddProjectMember(t, ts.DB, p.ID, w.ID, member.ID, testutil.RoleMember)
	session := testutil.LoginAs(t, ts.DB, member)

	rr := ts.DELETE("/api/workspaces/"+w.Slug+"/projects/"+p.ID.String()+"/", session)
	require.Equal(t, http.StatusNotFound, rr.Code, "body=%s", rr.Body.String())

	var proj model.Project
	require.NoError(t, ts.DB.First(&proj, "id = ?", p.ID).Error, "project must still exist")
}
