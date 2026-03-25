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
)

var (
	ErrProjectNotFound          = errors.New("project not found")
	ErrProjectForbidden         = errors.New("no access to this project")
	ErrProjectIdentifierTooLong = errors.New("project identifier must be at most 7 characters")
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

func (s *ProjectService) ListByWorkspace(ctx context.Context, workspaceSlug string, userID uuid.UUID) ([]model.Project, error) {
	wrk, err := s.ws.GetBySlug(context.Background(), workspaceSlug)
	if err != nil {
		return nil, ErrProjectNotFound
	}
	ok, _ := s.ws.IsMember(ctx, wrk.ID, userID)
	if !ok {
		return nil, ErrProjectForbidden
	}
	return s.ps.ListByWorkspaceID(ctx, wrk.ID)
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
	return s.ps.GetByID(ctx, projectID)
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
	if err := s.ps.Create(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *ProjectService) Update(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID, name, identifier, description, timezone, coverImage *string, emoji *string, iconProp *model.JSONMap, projectLeadIDSet bool, projectLeadID *uuid.UUID, defaultAssigneeIDSet bool, defaultAssigneeID *uuid.UUID, guestViewAllFeatures *bool, moduleView, cycleView, issueViewsView, pageView, intakeView, isTimeTrackingEnabled *bool) (*model.Project, error) {
	p, err := s.GetByID(ctx, workspaceSlug, projectID, userID)
	if err != nil {
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
	if err := s.ps.Update(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *ProjectService) Delete(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID) error {
	_, err := s.GetByID(ctx, workspaceSlug, projectID, userID)
	if err != nil {
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
	m, err := s.GetMember(ctx, workspaceSlug, projectID, memberPK, userID)
	if err != nil {
		return nil, err
	}
	m.Role = role
	if err := s.ps.UpdateProjectMember(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *ProjectService) DeleteMember(ctx context.Context, workspaceSlug string, projectID uuid.UUID, memberPK uuid.UUID, userID uuid.UUID) error {
	_, err := s.GetByID(ctx, workspaceSlug, projectID, userID)
	if err != nil {
		return err
	}
	m, err := s.ps.GetProjectMemberByPK(ctx, memberPK)
	if err != nil || m.ProjectID != projectID {
		return ErrMemberNotFound
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
	_, err := s.GetInvite(ctx, workspaceSlug, projectID, inviteID, userID)
	if err != nil {
		return err
	}
	return s.pinv.Delete(ctx, inviteID)
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
	inv.Accepted = true
	_ = s.pinv.Update(ctx, inv)
	m := &model.ProjectMember{ProjectID: p.ID, WorkspaceID: p.WorkspaceID, MemberID: &userID, Role: inv.Role}
	_ = s.ps.AddProjectMember(ctx, m)
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
	inv.Accepted = true
	_ = s.pinv.Update(ctx, inv)
	m := &model.ProjectMember{ProjectID: p.ID, WorkspaceID: p.WorkspaceID, MemberID: &userID, Role: inv.Role}
	_ = s.ps.AddProjectMember(ctx, m)
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
