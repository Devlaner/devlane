package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"regexp"
	"strings"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
)

var (
	ErrWorkspaceNotFound  = errors.New("workspace not found")
	ErrWorkspaceForbidden = errors.New("not a member of this workspace")
	ErrSlugInvalid        = errors.New("invalid slug")
	ErrSlugTaken          = errors.New("slug already in use")
	ErrInviteNotFound     = errors.New("invite not found")
	ErrMemberNotFound     = errors.New("member not found")
)

var (
	slugRegex   = regexp.MustCompile(`^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$`)
	slugifyName = regexp.MustCompile(`[^a-z0-9]+`)
)

// WorkspaceService handles workspace business logic.
type WorkspaceService struct {
	ws   *store.WorkspaceStore
	winv *store.WorkspaceInviteStore
	us   *store.UserStore
}

func NewWorkspaceService(ws *store.WorkspaceStore, winv *store.WorkspaceInviteStore, us *store.UserStore) *WorkspaceService {
	return &WorkspaceService{ws: ws, winv: winv, us: us}
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

func (s *WorkspaceService) Create(ctx context.Context, name, slug string, ownerID uuid.UUID) (*model.Workspace, error) {
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
	w := &model.Workspace{
		Name:        name,
		Slug:        slug,
		OwnerID:     ownerID,
		CreatedByID: &ownerID,
	}
	if err := s.ws.Create(ctx, w); err != nil {
		return nil, err
	}
	m := &model.WorkspaceMember{WorkspaceID: w.ID, MemberID: ownerID, Role: 20}
	_ = s.ws.AddMember(ctx, m)
	return w, nil
}

func (s *WorkspaceService) Update(ctx context.Context, slug string, userID uuid.UUID, name, newSlug *string) (*model.Workspace, error) {
	w, err := s.GetBySlug(ctx, slug, userID)
	if err != nil {
		return nil, err
	}
	if name != nil {
		w.Name = *name
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
	m, err := s.GetMember(ctx, slug, memberID, userID)
	if err != nil {
		return nil, err
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
	m, err := s.ws.GetMemberByPK(ctx, memberID)
	if err != nil || m.WorkspaceID != w.ID {
		return ErrMemberNotFound
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
	_, err := s.GetInvite(ctx, slug, inviteID, userID)
	if err != nil {
		return err
	}
	return s.winv.Delete(ctx, inviteID)
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
	inv.Accepted = true
	_ = s.winv.Update(ctx, inv)
	m := &model.WorkspaceMember{WorkspaceID: w.ID, MemberID: userID, Role: inv.Role}
	_ = s.ws.AddMember(ctx, m)
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
	inv.Accepted = true
	_ = s.winv.Update(ctx, inv)
	m := &model.WorkspaceMember{WorkspaceID: w.ID, MemberID: userID, Role: inv.Role}
	_ = s.ws.AddMember(ctx, m)
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
