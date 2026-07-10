package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrProjectNotFound          = errors.New("project not found")
	ErrProjectForbidden         = errors.New("no access to this project")
	ErrProjectIdentifierTooLong = errors.New("project identifier must be at most 7 characters")
	ErrInvalidNetwork           = errors.New("network must be public or secret")
	ErrInvalidArchiveIn         = errors.New("archive_in must be zero or a positive number of months")
)

// ProjectService handles project business logic.
type ProjectService struct {
	ps   *store.ProjectStore
	pinv *store.ProjectInviteStore
	ws   *store.WorkspaceStore
	us   *store.UserStore
}

func NewProjectService(ps *store.ProjectStore, pinv *store.ProjectInviteStore, ws *store.WorkspaceStore, us *store.UserStore) *ProjectService {
	return &ProjectService{ps: ps, pinv: pinv, ws: ws, us: us}
}

// isWorkspaceAdmin reports whether the user is an admin/owner of the workspace,
// who can see and manage every project regardless of its network visibility.
func (s *ProjectService) isWorkspaceAdmin(ctx context.Context, workspaceID, userID uuid.UUID) bool {
	wm, err := s.ws.GetMember(ctx, workspaceID, userID)
	return err == nil && wm != nil && wm.Role >= model.RoleAdmin
}

func (s *ProjectService) ListByWorkspace(ctx context.Context, workspaceSlug string, userID uuid.UUID) ([]model.Project, error) {
	wrk, err := s.ws.GetBySlug(context.Background(), workspaceSlug)
	if err != nil {
		return nil, ErrProjectNotFound
	}
	ok, _ := s.ws.IsMember(ctx, wrk.ID, userID)
	if !ok {
		return nil, ErrProjectForbidden
	}
	// Workspace admins see everything; everyone else sees public projects plus
	// the secret ones they belong to.
	if s.isWorkspaceAdmin(ctx, wrk.ID, userID) {
		return s.ps.ListByWorkspaceID(ctx, wrk.ID)
	}
	return s.ps.ListVisibleByWorkspaceID(ctx, wrk.ID, userID)
}

func (s *ProjectService) GetByID(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID) (*model.Project, error) {
	wrk, err := s.ws.GetBySlug(ctx, workspaceSlug)
	if err != nil {
		return nil, ErrProjectNotFound
	}
	ok, _ := s.ws.IsMember(ctx, wrk.ID, userID)
	if !ok {
		return nil, ErrProjectForbidden
	}
	inWorkspace, _ := s.ps.IsInWorkspace(ctx, projectID, wrk.ID)
	if !inWorkspace {
		return nil, ErrProjectNotFound
	}
	p, err := s.ps.GetByID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	// A secret project is reachable only by its members (or a workspace admin).
	if p.Network != model.NetworkPublic && !s.isWorkspaceAdmin(ctx, wrk.ID, userID) {
		pm, _ := s.ps.GetProjectMember(ctx, projectID, userID)
		if pm == nil {
			return nil, ErrProjectNotFound
		}
	}
	return p, nil
}

// projectCallerRole returns the caller's effective role for admin actions on
// a project: their workspace role if they are a workspace admin/owner,
// otherwise their project-member role. Returns ErrProjectForbidden if
// neither grants at least the Admin role. Read access (workspace membership)
// is validated separately by GetByID.
func (s *ProjectService) projectCallerRole(ctx context.Context, workspaceID, projectID, userID uuid.UUID) (int16, error) {
	if wm, err := s.ws.GetMember(ctx, workspaceID, userID); err == nil && wm != nil && wm.Role >= model.RoleAdmin {
		return wm.Role, nil
	}
	pm, err := s.ps.GetProjectMember(ctx, projectID, userID)
	if err != nil || pm == nil || pm.Role < model.RoleAdmin {
		return 0, ErrProjectForbidden
	}
	return pm.Role, nil
}

// requireProjectAdmin allows the action when the caller is a workspace
// admin/owner, or a project member with at least the Admin role.
func (s *ProjectService) requireProjectAdmin(ctx context.Context, workspaceID, projectID, userID uuid.UUID) error {
	_, err := s.projectCallerRole(ctx, workspaceID, projectID, userID)
	return err
}

func (s *ProjectService) Create(ctx context.Context, workspaceSlug, name, identifier string, userID uuid.UUID) (*model.Project, error) {
	wrk, err := s.ws.GetBySlug(ctx, workspaceSlug)
	if err != nil {
		return nil, ErrProjectNotFound
	}
	ok, _ := s.ws.IsMember(ctx, wrk.ID, userID)
	if !ok {
		return nil, ErrProjectForbidden
	}
	if identifier != "" && utf8.RuneCountInString(identifier) > 7 {
		return nil, ErrProjectIdentifierTooLong
	}
	p := &model.Project{
		WorkspaceID: wrk.ID,
		Name:        name,
		Identifier:  identifier,
		CreatedByID: &userID,
	}
	// Create the project and the creator's admin membership together, so the
	// creator can manage the project they just made even if they're only a
	// regular workspace member.
	if err := s.ps.CreateWithCreatorMember(ctx, p, userID, model.RoleAdmin); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *ProjectService) Update(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID, name, identifier, description, timezone, coverImage *string, emoji *string, iconProp *model.JSONMap, projectLeadIDSet bool, projectLeadID *uuid.UUID, defaultAssigneeIDSet bool, defaultAssigneeID *uuid.UUID, guestViewAllFeatures *bool, network *int16, moduleView, cycleView, issueViewsView, pageView, intakeView, isTimeTrackingEnabled *bool, archiveIn *int) (*model.Project, error) {
	p, err := s.GetByID(ctx, workspaceSlug, projectID, userID)
	if err != nil {
		return nil, err
	}
	if err := s.requireProjectAdmin(ctx, p.WorkspaceID, p.ID, userID); err != nil {
		return nil, err
	}
	if name != nil {
		p.Name = *name
	}
	if identifier != nil {
		if *identifier != "" && utf8.RuneCountInString(*identifier) > 7 {
			return nil, ErrProjectIdentifierTooLong
		}
		p.Identifier = *identifier
	}
	if description != nil {
		p.Description = *description
	}
	if timezone != nil {
		p.Timezone = *timezone
	}
	if coverImage != nil {
		p.CoverImage = *coverImage
	}
	if emoji != nil {
		p.Emoji = *emoji
	}
	if iconProp != nil {
		p.IconProp = *iconProp
		if len(*iconProp) > 0 {
			p.Emoji = "" // clear emoji when setting icon
		}
	}
	if projectLeadIDSet {
		p.ProjectLeadID = projectLeadID
	}
	if defaultAssigneeIDSet {
		p.DefaultAssigneeID = defaultAssigneeID
	}
	if guestViewAllFeatures != nil {
		p.GuestViewAllFeatures = *guestViewAllFeatures
	}
	if network != nil {
		if *network != model.NetworkPublic && *network != model.NetworkSecret {
			return nil, ErrInvalidNetwork
		}
		p.Network = *network
	}
	if moduleView != nil {
		p.ModuleView = *moduleView
	}
	if cycleView != nil {
		p.CycleView = *cycleView
	}
	if issueViewsView != nil {
		p.IssueViewsView = *issueViewsView
	}
	if pageView != nil {
		p.PageView = *pageView
	}
	if intakeView != nil {
		p.IntakeView = *intakeView
	}
	if isTimeTrackingEnabled != nil {
		p.IsTimeTrackingEnabled = *isTimeTrackingEnabled
	}
	if archiveIn != nil {
		if *archiveIn < 0 {
			return nil, ErrInvalidArchiveIn
		}
		p.ArchiveIn = *archiveIn
	}
	if err := s.ps.Update(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *ProjectService) Delete(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID) error {
	p, err := s.GetByID(ctx, workspaceSlug, projectID, userID)
	if err != nil {
		return err
	}
	if err := s.requireProjectAdmin(ctx, p.WorkspaceID, p.ID, userID); err != nil {
		return err
	}
	return s.ps.Delete(ctx, projectID)
}

func (s *ProjectService) ListMembers(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID) ([]model.ProjectMember, error) {
	_, err := s.GetByID(ctx, workspaceSlug, projectID, userID)
	if err != nil {
		return nil, err
	}
	return s.ps.ListMembers(ctx, projectID)
}

func (s *ProjectService) GetMember(ctx context.Context, workspaceSlug string, projectID uuid.UUID, memberPK uuid.UUID, userID uuid.UUID) (*model.ProjectMember, error) {
	_, err := s.GetByID(ctx, workspaceSlug, projectID, userID)
	if err != nil {
		return nil, err
	}
	m, err := s.ps.GetProjectMemberByPK(ctx, memberPK)
	if err != nil || m.ProjectID != projectID {
		return nil, ErrMemberNotFound
	}
	return m, nil
}

func (s *ProjectService) UpdateMemberRole(ctx context.Context, workspaceSlug string, projectID uuid.UUID, memberPK uuid.UUID, userID uuid.UUID, role int16) (*model.ProjectMember, error) {
	p, err := s.GetByID(ctx, workspaceSlug, projectID, userID)
	if err != nil {
		return nil, err
	}
	callerRole, err := s.projectCallerRole(ctx, p.WorkspaceID, p.ID, userID)
	if err != nil {
		return nil, err
	}
	wrk, err := s.ws.GetByID(ctx, p.WorkspaceID)
	if err != nil {
		return nil, ErrProjectNotFound
	}
	m, err := s.ps.GetProjectMemberByPK(ctx, memberPK)
	if err != nil || m.ProjectID != projectID {
		return nil, ErrMemberNotFound
	}
	// Only the workspace owner may change the role of their own project
	// membership; nobody else may touch it.
	if m.MemberID != nil && *m.MemberID == wrk.OwnerID && userID != wrk.OwnerID {
		return nil, ErrProjectForbidden
	}
	// Only the workspace owner may act on a member who already holds a
	// higher role than the caller (e.g. a delegated project Owner).
	if userID != wrk.OwnerID && m.Role > callerRole {
		return nil, ErrProjectForbidden
	}
	// Cannot grant a role above your own, and only the workspace owner may
	// grant project Owner.
	if role > callerRole || (role >= model.RoleOwner && userID != wrk.OwnerID) {
		return nil, ErrProjectForbidden
	}
	m.Role = role
	if err := s.ps.UpdateProjectMember(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *ProjectService) DeleteMember(ctx context.Context, workspaceSlug string, projectID uuid.UUID, memberPK uuid.UUID, userID uuid.UUID) error {
	p, err := s.GetByID(ctx, workspaceSlug, projectID, userID)
	if err != nil {
		return err
	}
	callerRole, err := s.projectCallerRole(ctx, p.WorkspaceID, p.ID, userID)
	if err != nil {
		return err
	}
	wrk, err := s.ws.GetByID(ctx, p.WorkspaceID)
	if err != nil {
		return ErrProjectNotFound
	}
	m, err := s.ps.GetProjectMemberByPK(ctx, memberPK)
	if err != nil || m.ProjectID != projectID {
		return ErrMemberNotFound
	}
	// The workspace owner's project membership cannot be removed by anyone.
	if m.MemberID != nil && *m.MemberID == wrk.OwnerID {
		return ErrProjectForbidden
	}
	// Only the workspace owner may remove a member who already holds a
	// higher role than the caller (e.g. a delegated project Owner).
	if userID != wrk.OwnerID && m.Role > callerRole {
		return ErrProjectForbidden
	}
	if m.MemberID != nil {
		return s.ps.DeleteProjectMember(ctx, projectID, *m.MemberID)
	}
	return s.ps.DeleteProjectMemberByPK(ctx, m.ID)
}

func (s *ProjectService) Leave(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID) error {
	_, err := s.GetByID(ctx, workspaceSlug, projectID, userID)
	if err != nil {
		return err
	}
	return s.ps.DeleteProjectMember(ctx, projectID, userID)
}

func genProjectInviteToken() string {
	b := make([]byte, 24)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func (s *ProjectService) CreateInvite(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID, email string, role int16) (*model.ProjectMemberInvite, error) {
	p, err := s.GetByID(ctx, workspaceSlug, projectID, userID)
	if err != nil {
		return nil, err
	}
	callerRole, err := s.projectCallerRole(ctx, p.WorkspaceID, p.ID, userID)
	if err != nil {
		return nil, err
	}
	wrk, err := s.ws.GetByID(ctx, p.WorkspaceID)
	if err != nil {
		return nil, ErrProjectNotFound
	}
	// Cannot invite at a role above your own, and only the workspace owner
	// may invite at project Owner.
	if role > callerRole || (role >= model.RoleOwner && userID != wrk.OwnerID) {
		return nil, ErrProjectForbidden
	}
	inv := &model.ProjectMemberInvite{
		ProjectID:   p.ID,
		WorkspaceID: p.WorkspaceID,
		Email:       strings.TrimSpace(strings.ToLower(email)),
		Token:       genProjectInviteToken(),
		Role:        role,
		CreatedByID: &userID,
	}
	if err := s.pinv.Create(ctx, inv); err != nil {
		return nil, err
	}
	return inv, nil
}

func (s *ProjectService) ListInvites(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID) ([]model.ProjectMemberInvite, error) {
	_, err := s.GetByID(ctx, workspaceSlug, projectID, userID)
	if err != nil {
		return nil, err
	}
	return s.pinv.ListByProjectID(ctx, projectID)
}

func (s *ProjectService) GetInvite(ctx context.Context, workspaceSlug string, projectID uuid.UUID, inviteID uuid.UUID, userID uuid.UUID) (*model.ProjectMemberInvite, error) {
	_, err := s.GetByID(ctx, workspaceSlug, projectID, userID)
	if err != nil {
		return nil, err
	}
	inv, err := s.pinv.GetByID(ctx, inviteID)
	if err != nil || inv.ProjectID != projectID {
		return nil, ErrInviteNotFound
	}
	return inv, nil
}

func (s *ProjectService) DeleteInvite(ctx context.Context, workspaceSlug string, projectID uuid.UUID, inviteID uuid.UUID, userID uuid.UUID) error {
	inv, err := s.GetInvite(ctx, workspaceSlug, projectID, inviteID, userID)
	if err != nil {
		return err
	}
	if err := s.requireProjectAdmin(ctx, inv.WorkspaceID, inv.ProjectID, userID); err != nil {
		return err
	}
	return s.pinv.Delete(ctx, inviteID)
}

// requireInviteEmailMatch ensures the authenticated user's email matches the
// invite's email, so a leaked/forwarded token can't be redeemed by a
// different account.
func (s *ProjectService) requireInviteEmailMatch(ctx context.Context, inviteEmail string, userID uuid.UUID) error {
	u, err := s.us.GetByID(ctx, userID)
	if err != nil || u.Email == nil || !strings.EqualFold(*u.Email, inviteEmail) {
		return ErrInviteNotFound
	}
	return nil
}

// upsertProjectMember adds userID as a member of projectID, reviving a
// previously soft-deleted membership row (e.g. from a past removal/leave)
// instead of inserting a fresh one, since project_members has a plain
// UNIQUE(project_id, member_id) constraint that a stale soft-deleted row
// would otherwise violate.
func upsertProjectMember(tx *gorm.DB, projectID, workspaceID, userID uuid.UUID, role int16) error {
	var existing model.ProjectMember
	err := tx.Unscoped().Where("project_id = ? AND member_id = ?", projectID, userID).First(&existing).Error
	if err == nil {
		existing.DeletedAt = gorm.DeletedAt{}
		existing.Role = role
		return tx.Unscoped().Save(&existing).Error
	}
	if err != gorm.ErrRecordNotFound {
		return err
	}
	m := &model.ProjectMember{ProjectID: projectID, WorkspaceID: workspaceID, MemberID: &userID, Role: role}
	return tx.Create(m).Error
}

func (s *ProjectService) JoinByToken(ctx context.Context, token string, userID uuid.UUID) (*model.Project, error) {
	inv, err := s.pinv.GetByToken(ctx, token)
	if err != nil || inv == nil {
		return nil, ErrInviteNotFound
	}
	p, err := s.ps.GetByID(ctx, inv.ProjectID)
	if err != nil {
		return nil, ErrProjectNotFound
	}
	if err := s.requireInviteEmailMatch(ctx, inv.Email, userID); err != nil {
		return nil, err
	}
	inv.Accepted = true
	if err := s.ps.Transaction(ctx, func(tx *gorm.DB) error {
		if err := tx.Save(inv).Error; err != nil {
			return err
		}
		return upsertProjectMember(tx, p.ID, p.WorkspaceID, userID, inv.Role)
	}); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *ProjectService) JoinByInviteID(ctx context.Context, workspaceSlug string, projectID uuid.UUID, inviteID uuid.UUID, userID uuid.UUID) (*model.Project, error) {
	p, err := s.GetByID(ctx, workspaceSlug, projectID, userID)
	if err != nil {
		return nil, err
	}
	inv, err := s.pinv.GetByID(ctx, inviteID)
	if err != nil || inv.ProjectID != p.ID || inv.Accepted {
		return nil, ErrInviteNotFound
	}
	if err := s.requireInviteEmailMatch(ctx, inv.Email, userID); err != nil {
		return nil, err
	}
	inv.Accepted = true
	if err := s.ps.Transaction(ctx, func(tx *gorm.DB) error {
		if err := tx.Save(inv).Error; err != nil {
			return err
		}
		return upsertProjectMember(tx, p.ID, p.WorkspaceID, userID, inv.Role)
	}); err != nil {
		return nil, err
	}
	return p, nil
}

// ListUserProjectInvitations returns pending project invites for the current user in the given workspace.
func (s *ProjectService) ListUserProjectInvitations(ctx context.Context, workspaceSlug string, userID uuid.UUID) ([]model.ProjectMemberInvite, error) {
	wrk, err := s.ws.GetBySlug(ctx, workspaceSlug)
	if err != nil {
		return nil, ErrProjectNotFound
	}
	ok, _ := s.ws.IsMember(ctx, wrk.ID, userID)
	if !ok {
		return nil, ErrProjectForbidden
	}
	u, err := s.us.GetByID(ctx, userID)
	if err != nil || u.Email == nil {
		return nil, nil
	}
	all, err := s.pinv.ListPendingByEmail(ctx, *u.Email)
	if err != nil {
		return nil, err
	}
	out := make([]model.ProjectMemberInvite, 0)
	for _, inv := range all {
		if inv.WorkspaceID == wrk.ID {
			out = append(out, inv)
		}
	}
	return out, nil
}
