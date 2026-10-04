package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrWorkspaceNotFound  = errors.New("workspace not found")
	ErrWorkspaceForbidden = errors.New("not a member of this workspace")
	ErrSlugInvalid        = errors.New("invalid slug")
	ErrSlugTaken          = errors.New("slug already in use")
	ErrInviteNotFound     = errors.New("invite not found")
	ErrMemberNotFound     = errors.New("member not found")
	// ErrTokenNotFound is returned when a workspace service token to revoke does not exist.
	ErrTokenNotFound = errors.New("token not found")
	// ErrApiTokensNotConfigured is returned when the token store was never wired
	// on the service (a configuration gap, not a client error).
	ErrApiTokensNotConfigured = errors.New("api token store not configured")
)

var (
	slugRegex   = regexp.MustCompile(`^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$`)
	slugifyName = regexp.MustCompile(`[^a-z0-9]+`)
)

// WorkspaceService handles workspace business logic.
type WorkspaceService struct {
	ws        *store.WorkspaceStore
	winv      *store.WorkspaceInviteStore
	us        *store.UserStore
	apiTokens *store.ApiTokenStore // optional: workspace-scoped service tokens
}

func NewWorkspaceService(ws *store.WorkspaceStore, winv *store.WorkspaceInviteStore, us *store.UserStore) *WorkspaceService {
	return &WorkspaceService{ws: ws, winv: winv, us: us}
}

// SetApiTokenStore wires workspace-scoped service API tokens. Optional.
func (s *WorkspaceService) SetApiTokenStore(ts *store.ApiTokenStore) { s.apiTokens = ts }

// ListTokens returns a workspace's service tokens. Admin-only (they're secrets).
func (s *WorkspaceService) ListTokens(ctx context.Context, slug string, userID uuid.UUID) ([]model.ApiToken, error) {
	w, err := s.ws.GetBySlug(ctx, slug)
	if err != nil {
		return nil, ErrWorkspaceNotFound
	}
	if _, err := s.requireAdmin(ctx, w.ID, userID); err != nil {
		return nil, err
	}
	if s.apiTokens == nil {
		return nil, ErrApiTokensNotConfigured
	}
	return s.apiTokens.ListByWorkspaceID(ctx, w.ID)
}

// CreateToken mints a workspace service token and returns the secret once.
func (s *WorkspaceService) CreateToken(ctx context.Context, slug string, userID uuid.UUID, label, description string, expiredAt *time.Time) (string, error) {
	w, err := s.ws.GetBySlug(ctx, slug)
	if err != nil {
		return "", ErrWorkspaceNotFound
	}
	if _, err := s.requireAdmin(ctx, w.ID, userID); err != nil {
		return "", err
	}
	if s.apiTokens == nil {
		return "", ErrApiTokensNotConfigured
	}
	return s.apiTokens.CreateForWorkspace(ctx, userID, w.ID, label, description, expiredAt)
}

// RevokeToken deletes a workspace service token.
func (s *WorkspaceService) RevokeToken(ctx context.Context, slug string, tokenID uuid.UUID, userID uuid.UUID) error {
	w, err := s.ws.GetBySlug(ctx, slug)
	if err != nil {
		return ErrWorkspaceNotFound
	}
	if _, err := s.requireAdmin(ctx, w.ID, userID); err != nil {
		return err
	}
	if s.apiTokens == nil {
		return ErrApiTokensNotConfigured
	}
	if err := s.apiTokens.DeleteByWorkspace(ctx, tokenID, w.ID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrTokenNotFound
		}
		return err
	}
	return nil
}

func (s *WorkspaceService) ListForUser(ctx context.Context, userID uuid.UUID) ([]model.Workspace, error) {
	return s.ws.ListByMemberID(ctx, userID)
}

func (s *WorkspaceService) GetBySlug(ctx context.Context, slug string, userID uuid.UUID) (*model.Workspace, error) {
	w, err := s.ws.GetBySlug(ctx, slug)
	if err != nil {
		return nil, ErrWorkspaceNotFound
	}
	ok, _ := s.ws.IsMember(ctx, w.ID, userID)
	if !ok {
		return nil, ErrWorkspaceForbidden
	}
	return w, nil
}

func (s *WorkspaceService) Create(ctx context.Context, name, slug, organizationSize string, ownerID uuid.UUID) (*model.Workspace, error) {
	slug = strings.TrimSpace(strings.ToLower(slug))
	if slug == "" {
		slug = strings.Trim(slugifyName.ReplaceAllString(strings.ToLower(name), "-"), "-")
		if slug == "" {
			slug = "workspace"
		}
	}
	if !slugRegex.MatchString(slug) {
		return nil, ErrSlugInvalid
	}
	exists, _ := s.ws.SlugExists(ctx, slug, uuid.Nil)
	if exists {
		return nil, ErrSlugTaken
	}
	orgSize := strings.TrimSpace(organizationSize)
	if len(orgSize) > 50 {
		orgSize = orgSize[:50]
	}
	w := &model.Workspace{
		Name:             name,
		Slug:             slug,
		OwnerID:          ownerID,
		CreatedByID:      &ownerID,
		OrganizationSize: orgSize,
	}
	if err := s.ws.CreateWithOwner(ctx, w, ownerID); err != nil {
		return nil, err
	}
	return w, nil
}

func (s *WorkspaceService) Update(ctx context.Context, slug string, userID uuid.UUID, name, newSlug, logo *string) (*model.Workspace, error) {
	w, err := s.GetBySlug(ctx, slug, userID)
	if err != nil {
		return nil, err
	}
	if _, err := s.requireAdmin(ctx, w.ID, userID); err != nil {
		return nil, err
	}
	if name != nil {
		w.Name = *name
	}
	if logo != nil {
		w.Logo = *logo
	}
	if newSlug != nil {
		slugVal := strings.TrimSpace(strings.ToLower(*newSlug))
		if !slugRegex.MatchString(slugVal) {
			return nil, ErrSlugInvalid
		}
		exists, _ := s.ws.SlugExists(ctx, slugVal, w.ID)
		if exists {
			return nil, ErrSlugTaken
		}
		w.Slug = slugVal
	}
	if err := s.ws.Update(ctx, w); err != nil {
		return nil, err
	}
	return w, nil
}

func (s *WorkspaceService) Delete(ctx context.Context, slug string, userID uuid.UUID) error {
	w, err := s.GetBySlug(ctx, slug, userID)
	if err != nil {
		return err
	}
	if w.OwnerID != userID {
		return ErrWorkspaceForbidden
	}
	return s.ws.Delete(ctx, w.ID)
}

func (s *WorkspaceService) SlugCheck(ctx context.Context, slug string, excludeID uuid.UUID) (bool, error) {
	slug = strings.TrimSpace(strings.ToLower(slug))
	if !slugRegex.MatchString(slug) {
		return false, nil
	}
	return s.ws.SlugExists(ctx, slug, excludeID)
}

func (s *WorkspaceService) ListMembers(ctx context.Context, slug string, userID uuid.UUID) ([]model.WorkspaceMember, error) {
	w, err := s.GetBySlug(ctx, slug, userID)
	if err != nil {
		return nil, err
	}
	return s.ws.ListMembers(ctx, w.ID)
}

// callerRole returns the authenticated user's role in the workspace, or
// ErrWorkspaceForbidden if they are not a member.
func (s *WorkspaceService) callerRole(ctx context.Context, workspaceID, userID uuid.UUID) (int16, error) {
	m, err := s.ws.GetMember(ctx, workspaceID, userID)
	if err != nil || m == nil {
		return 0, ErrWorkspaceForbidden
	}
	return m.Role, nil
}

// requireAdmin ensures the caller is at least a workspace admin.
func (s *WorkspaceService) requireAdmin(ctx context.Context, workspaceID, userID uuid.UUID) (int16, error) {
	role, err := s.callerRole(ctx, workspaceID, userID)
	if err != nil {
		return 0, err
	}
	if role < model.RoleAdmin {
		return 0, ErrWorkspaceForbidden
	}
	return role, nil
}

func (s *WorkspaceService) GetMember(ctx context.Context, slug string, memberID uuid.UUID, userID uuid.UUID) (*model.WorkspaceMember, error) {
	w, err := s.GetBySlug(ctx, slug, userID)
	if err != nil {
		return nil, err
	}
	m, err := s.ws.GetMemberByPK(ctx, memberID)
	if err != nil || m.WorkspaceID != w.ID {
		return nil, ErrMemberNotFound
	}
	return m, nil
}

func (s *WorkspaceService) UpdateMemberRole(ctx context.Context, slug string, memberID uuid.UUID, userID uuid.UUID, role int16) (*model.WorkspaceMember, error) {
	w, err := s.GetBySlug(ctx, slug, userID)
	if err != nil {
		return nil, err
	}
	callerRole, err := s.requireAdmin(ctx, w.ID, userID)
	if err != nil {
		return nil, err
	}
	m, err := s.ws.GetMemberByPK(ctx, memberID)
	if err != nil || m.WorkspaceID != w.ID {
		return nil, ErrMemberNotFound
	}
	// Only the owner may change the owner's role; nobody may demote the owner.
	if m.MemberID == w.OwnerID && userID != w.OwnerID {
		return nil, ErrWorkspaceForbidden
	}
	// Cannot grant a role above your own, and only the owner may grant Owner.
	if role > callerRole || (role >= model.RoleOwner && userID != w.OwnerID) {
		return nil, ErrWorkspaceForbidden
	}
	m.Role = role
	if err := s.ws.UpdateMember(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *WorkspaceService) DeleteMember(ctx context.Context, slug string, memberID uuid.UUID, userID uuid.UUID) error {
	w, err := s.GetBySlug(ctx, slug, userID)
	if err != nil {
		return err
	}
	if _, err := s.requireAdmin(ctx, w.ID, userID); err != nil {
		return err
	}
	m, err := s.ws.GetMemberByPK(ctx, memberID)
	if err != nil || m.WorkspaceID != w.ID {
		return ErrMemberNotFound
	}
	// The workspace owner cannot be removed.
	if m.MemberID == w.OwnerID {
		return ErrWorkspaceForbidden
	}
	return s.ws.DeleteMember(ctx, w.ID, m.MemberID)
}

func (s *WorkspaceService) Leave(ctx context.Context, slug string, userID uuid.UUID) error {
	w, err := s.GetBySlug(ctx, slug, userID)
	if err != nil {
		return err
	}
	if w.OwnerID == userID {
		return ErrWorkspaceForbidden
	}
	return s.ws.Leave(ctx, w.ID, userID)
}

func (s *WorkspaceService) CreateInvite(ctx context.Context, slug string, userID uuid.UUID, email string, role int16) (*model.WorkspaceMemberInvite, error) {
	w, err := s.GetBySlug(ctx, slug, userID)
	if err != nil {
		return nil, err
	}
	callerRole, err := s.requireAdmin(ctx, w.ID, userID)
	if err != nil {
		return nil, err
	}
	// Cannot invite at a role above your own.
	if role > callerRole {
		return nil, ErrWorkspaceForbidden
	}
	token := genInviteToken()
	inv := &model.WorkspaceMemberInvite{
		WorkspaceID: w.ID,
		Email:       strings.TrimSpace(strings.ToLower(email)),
		Token:       token,
		Role:        role,
		CreatedByID: &userID,
	}
	if err := s.winv.Create(ctx, inv); err != nil {
		return nil, err
	}
	return inv, nil
}

func (s *WorkspaceService) ListInvites(ctx context.Context, slug string, userID uuid.UUID) ([]model.WorkspaceMemberInvite, error) {
	w, err := s.GetBySlug(ctx, slug, userID)
	if err != nil {
		return nil, err
	}
	return s.winv.ListByWorkspaceID(ctx, w.ID)
}

func (s *WorkspaceService) GetInvite(ctx context.Context, slug string, inviteID uuid.UUID, userID uuid.UUID) (*model.WorkspaceMemberInvite, error) {
	w, err := s.GetBySlug(ctx, slug, userID)
	if err != nil {
		return nil, err
	}
	inv, err := s.winv.GetByID(ctx, inviteID)
	if err != nil || inv.WorkspaceID != w.ID {
		return nil, ErrInviteNotFound
	}
	return inv, nil
}

func (s *WorkspaceService) DeleteInvite(ctx context.Context, slug string, inviteID uuid.UUID, userID uuid.UUID) error {
	inv, err := s.GetInvite(ctx, slug, inviteID, userID)
	if err != nil {
		return err
	}
	if _, err := s.requireAdmin(ctx, inv.WorkspaceID, userID); err != nil {
		return err
	}
	return s.winv.Delete(ctx, inviteID)
}

// requireInviteEmailMatch ensures the authenticated user's email matches the
// invite's email, so a leaked/forwarded token can't be redeemed by a
// different account.
func (s *WorkspaceService) requireInviteEmailMatch(ctx context.Context, inviteEmail string, userID uuid.UUID) error {
	u, err := s.us.GetByID(ctx, userID)
	if err != nil || u.Email == nil || !strings.EqualFold(*u.Email, inviteEmail) {
		return ErrInviteNotFound
	}
	return nil
}

// upsertWorkspaceMember adds userID as a member of workspaceID, reviving a
// previously soft-deleted membership row (e.g. from a past removal/leave)
// instead of inserting a fresh one, since workspace_members has a plain
// UNIQUE(workspace_id, member_id) constraint that a stale soft-deleted row
// would otherwise violate.
func upsertWorkspaceMember(tx *gorm.DB, workspaceID, userID uuid.UUID, role int16) error {
	var existing model.WorkspaceMember
	err := tx.Unscoped().Where("workspace_id = ? AND member_id = ?", workspaceID, userID).First(&existing).Error
	if err == nil {
		existing.DeletedAt = gorm.DeletedAt{}
		existing.Role = role
		return tx.Unscoped().Save(&existing).Error
	}
	if err != gorm.ErrRecordNotFound {
		return err
	}
	m := &model.WorkspaceMember{WorkspaceID: workspaceID, MemberID: userID, Role: role}
	return tx.Create(m).Error
}

func (s *WorkspaceService) JoinByToken(ctx context.Context, token string, userID uuid.UUID) (*model.Workspace, error) {
	inv, err := s.winv.GetByToken(ctx, token)
	if err != nil || inv == nil {
		return nil, ErrInviteNotFound
	}
	w, err := s.ws.GetByID(ctx, inv.WorkspaceID)
	if err != nil {
		return nil, ErrWorkspaceNotFound
	}
	if err := s.requireInviteEmailMatch(ctx, inv.Email, userID); err != nil {
		return nil, err
	}
	inv.Accepted = true
	if err := s.ws.Transaction(ctx, func(tx *gorm.DB) error {
		if err := tx.Save(inv).Error; err != nil {
			return err
		}
		return upsertWorkspaceMember(tx, w.ID, userID, inv.Role)
	}); err != nil {
		return nil, err
	}
	return w, nil
}

// JoinByInviteID accepts an invite by invite ID (used when slug is known from link).
func (s *WorkspaceService) JoinByInviteID(ctx context.Context, slug string, inviteID uuid.UUID, userID uuid.UUID) (*model.Workspace, error) {
	w, err := s.ws.GetBySlug(ctx, slug)
	if err != nil {
		return nil, ErrWorkspaceNotFound
	}
	inv, err := s.winv.GetByID(ctx, inviteID)
	if err != nil || inv.WorkspaceID != w.ID || inv.Accepted {
		return nil, ErrInviteNotFound
	}
	if err := s.requireInviteEmailMatch(ctx, inv.Email, userID); err != nil {
		return nil, err
	}
	inv.Accepted = true
	if err := s.ws.Transaction(ctx, func(tx *gorm.DB) error {
		if err := tx.Save(inv).Error; err != nil {
			return err
		}
		return upsertWorkspaceMember(tx, w.ID, userID, inv.Role)
	}); err != nil {
		return nil, err
	}
	return w, nil
}

func (s *WorkspaceService) ListUserInvitations(ctx context.Context, userID uuid.UUID) ([]model.WorkspaceMemberInvite, error) {
	u, err := s.us.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if u.Email == nil {
		return nil, nil
	}
	return s.winv.ListPendingByEmail(ctx, *u.Email)
}

func genInviteToken() string {
	b := make([]byte, 24)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
