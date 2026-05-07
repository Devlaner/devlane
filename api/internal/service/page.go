package service

import (
	"context"
	"errors"
	"strings"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
)

var (
	ErrPageNotFound    = errors.New("page not found")
	ErrPageLocked      = errors.New("page is locked")
	ErrPageArchived    = errors.New("page is archived")
	ErrPageReadOnly    = errors.New("no permission to edit this page")
	ErrPageNotArchived = errors.New("page must be archived before deletion")
	ErrPageBadParent   = errors.New("invalid parent page")
	ErrPageBadRequest  = errors.New("invalid page request")
)

// PageService handles page business logic and permission gating.
//
// Permission model:
//   - Public page (access=0): any workspace member can view; any workspace member
//     can edit content unless is_locked is true (then only owner). Owner-only meta.
//   - Private page (access=1): owner-only view + edit.
//   - Archived page: read-only for everyone; owner can unarchive or delete.
//
// Workspace membership is the auth boundary. Project membership is not strictly
// required to view a public page in the workspace, since pages can be linked to
// multiple projects via project_pages.
type PageService struct {
	pageStore    *store.PageStore
	projectStore *store.ProjectStore
	ws           *store.WorkspaceStore
	favorites    *store.UserFavoriteStore // optional — when nil, favorite endpoints return errors
}

func NewPageService(pageStore *store.PageStore, projectStore *store.ProjectStore, ws *store.WorkspaceStore) *PageService {
	return &PageService{pageStore: pageStore, projectStore: projectStore, ws: ws}
}

// SetFavoriteStore wires the user_favorites store. Optional — without it,
// favorite endpoints return ErrPageNotFound (treated as 404).
func (s *PageService) SetFavoriteStore(f *store.UserFavoriteStore) { s.favorites = f }

// ----- Permission helpers --------------------------------------------------

// canView returns true if userID may read the page.
//
// isMember must be true if userID is a member of page.WorkspaceID. The caller
// is responsible for that check; canView avoids re-querying it.
//
// Workspace membership is the auth boundary — even page owners lose access
// when they are removed from the workspace.
func canView(page *model.Page, userID uuid.UUID, isMember bool) bool {
	if page == nil || !isMember {
		return false
	}
	if page.OwnedByID == userID {
		return true
	}
	return page.Access == model.PageAccessPublic
}

// canEditContent returns true if userID may edit page body content right now.
//
// The lock blocks everyone except the owner. Archived pages are read-only.
// Private pages are owner-only.
func canEditContent(page *model.Page, userID uuid.UUID, isMember bool) bool {
	if page == nil || !isMember {
		return false
	}
	if page.ArchivedAt != nil {
		return false
	}
	if page.OwnedByID == userID {
		return true
	}
	if page.IsLocked {
		return false
	}
	return page.Access == model.PageAccessPublic
}

// canEditMeta returns true if userID may change name/access/parent. Owner-only,
// but the owner must still be a workspace member (auth boundary).
func canEditMeta(page *model.Page, userID uuid.UUID, isMember bool) bool {
	if page == nil || !isMember {
		return false
	}
	return page.OwnedByID == userID
}

// ----- Common access guards -----------------------------------------------

func (s *PageService) ensureWorkspaceAccess(ctx context.Context, workspaceSlug string, userID uuid.UUID) (uuid.UUID, error) {
	wrk, err := s.ws.GetBySlug(ctx, workspaceSlug)
	if err != nil {
		return uuid.Nil, ErrProjectForbidden
	}
	ok, _ := s.ws.IsMember(ctx, wrk.ID, userID)
	if !ok {
		return uuid.Nil, ErrProjectForbidden
	}
	return wrk.ID, nil
}

func (s *PageService) ensureProjectAccess(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID) error {
	wrk, err := s.ws.GetBySlug(ctx, workspaceSlug)
	if err != nil {
		return ErrProjectForbidden
	}
	ok, _ := s.ws.IsMember(ctx, wrk.ID, userID)
	if !ok {
		return ErrProjectForbidden
	}
	inWorkspace, _ := s.projectStore.IsInWorkspace(ctx, projectID, wrk.ID)
	if !inWorkspace {
		return ErrProjectNotFound
	}
	return nil
}

// loadAndCheckView fetches a page and 404s if userID can't view it. Returns
// the page plus the workspace-membership flag so subsequent permission checks
// don't re-query.
func (s *PageService) loadAndCheckView(ctx context.Context, workspaceSlug string, pageID, userID uuid.UUID) (*model.Page, bool, error) {
	wrk, err := s.ws.GetBySlug(ctx, workspaceSlug)
	if err != nil {
		return nil, false, ErrProjectForbidden
	}
	isMember, _ := s.ws.IsMember(ctx, wrk.ID, userID)
	page, err := s.pageStore.GetByID(ctx, pageID)
	if err != nil {
		return nil, false, ErrPageNotFound
	}
	if page.WorkspaceID != wrk.ID {
		return nil, false, ErrPageNotFound
	}
	if !canView(page, userID, isMember) {
		return nil, false, ErrPageNotFound
	}
	return page, isMember, nil
}

// ----- Reads --------------------------------------------------------------

// List lists pages for workspace or for a project (projectID optional).
// Filters are honoured on the server (owner, archived, search, parent).
//
// Private pages owned by other users are filtered out post-query. The list
// page is small enough that this is fine; for very large workspaces we'd push
// the predicate into SQL.
func (s *PageService) List(ctx context.Context, workspaceSlug string, projectID *uuid.UUID, userID uuid.UUID, opts store.ListPagesOpts) ([]model.Page, error) {
	workspaceID, err := s.ensureWorkspaceAccess(ctx, workspaceSlug, userID)
	if err != nil {
		return nil, err
	}
	var pages []model.Page
	if projectID != nil {
		if err := s.ensureProjectAccess(ctx, workspaceSlug, *projectID, userID); err != nil {
			return nil, err
		}
		pages, err = s.pageStore.ListByProjectID(ctx, *projectID, opts)
	} else {
		pages, err = s.pageStore.ListByWorkspaceID(ctx, workspaceID, opts)
	}
	if err != nil {
		return nil, err
	}
	out := pages[:0]
	for _, p := range pages {
		if p.Access == model.PageAccessPrivate && p.OwnedByID != userID {
			continue
		}
		out = append(out, p)
	}
	return out, nil
}

func (s *PageService) ListChildren(ctx context.Context, workspaceSlug string, parentID, userID uuid.UUID) ([]model.Page, error) {
	parent, _, err := s.loadAndCheckView(ctx, workspaceSlug, parentID, userID)
	if err != nil {
		return nil, err
	}
	children, err := s.pageStore.ListChildrenByParentID(ctx, parent.ID)
	if err != nil {
		return nil, err
	}
	out := children[:0]
	for _, p := range children {
		if p.Access == model.PageAccessPrivate && p.OwnedByID != userID {
			continue
		}
		out = append(out, p)
	}
	return out, nil
}

func (s *PageService) Get(ctx context.Context, workspaceSlug string, pageID, userID uuid.UUID) (*model.Page, error) {
	page, _, err := s.loadAndCheckView(ctx, workspaceSlug, pageID, userID)
	return page, err
}

// ----- Writes -------------------------------------------------------------

func (s *PageService) Create(ctx context.Context, workspaceSlug string, projectID *uuid.UUID, userID uuid.UUID, name, html string, access int16, parentID *uuid.UUID) (*model.Page, error) {
	workspaceID, err := s.ensureWorkspaceAccess(ctx, workspaceSlug, userID)
	if err != nil {
		return nil, err
	}
	if projectID != nil {
		if err := s.ensureProjectAccess(ctx, workspaceSlug, *projectID, userID); err != nil {
			return nil, err
		}
	}
	if access != model.PageAccessPublic && access != model.PageAccessPrivate {
		access = model.PageAccessPublic
	}
	if html == "" {
		html = "<p></p>"
	}
	if name == "" {
		name = "Untitled page"
	}
	// Validate parent (if any) before insert. We re-use loadAndCheckView so the
	// caller must be able to *view* the proposed parent — not just be in the
	// same workspace. This prevents creating a child under another user's
	// private page where the parent would be inaccessible to the creator.
	if parentID != nil {
		if _, _, err := s.loadAndCheckView(ctx, workspaceSlug, *parentID, userID); err != nil {
			return nil, ErrPageBadParent
		}
	}
	page := &model.Page{
		Name:            name,
		DescriptionHTML: html,
		OwnedByID:       userID,
		WorkspaceID:     workspaceID,
		Access:          access,
		ParentID:        parentID,
		CreatedByID:     &userID,
		UpdatedByID:     &userID,
	}
	// Insert the page and its project_pages link in a single transaction so a
	// failed link doesn't leave behind an orphan page that's invisible to the
	// project's pages list.
	if err := s.pageStore.CreateWithProjectLink(ctx, page, projectID, &userID); err != nil {
		return nil, err
	}
	// Initial version row so history is anchored from page-creation onward.
	_ = s.pageStore.CreateVersion(ctx, &model.PageVersion{
		PageID:              page.ID,
		WorkspaceID:         workspaceID,
		OwnedByID:           userID,
		DescriptionHTML:     html,
		DescriptionStripped: stripHTML(html),
	})
	return page, nil
}

// PageMetaUpdate carries the optional fields UpdateMeta accepts. nil values
// are left untouched; zero values for required fields are validated.
//
// LogoProps is owner-editable like name/access/parent: passing a non-nil value
// replaces the stored JSON, and SetLogoProps with a nil LogoProps clears it.
type PageMetaUpdate struct {
	Name         *string
	Access       *int16
	ParentID     *uuid.UUID
	ClearParent  bool
	LogoProps    model.JSONMap
	SetLogoProps bool
}

// UpdateMeta changes name / access / parent / logo. Owner-only.
func (s *PageService) UpdateMeta(ctx context.Context, workspaceSlug string, pageID, userID uuid.UUID, in PageMetaUpdate) (*model.Page, error) {
	page, isMember, err := s.loadAndCheckView(ctx, workspaceSlug, pageID, userID)
	if err != nil {
		return nil, err
	}
	if !canEditMeta(page, userID, isMember) {
		return nil, ErrPageReadOnly
	}
	if page.ArchivedAt != nil {
		return nil, ErrPageArchived
	}
	if in.Name != nil {
		page.Name = strings.TrimSpace(*in.Name)
	}
	if in.Access != nil {
		if *in.Access != model.PageAccessPublic && *in.Access != model.PageAccessPrivate {
			return nil, ErrPageBadRequest
		}
		page.Access = *in.Access
	}
	if in.ClearParent {
		page.ParentID = nil
	} else if in.ParentID != nil {
		if err := s.validateParent(ctx, workspaceSlug, page, *in.ParentID, userID); err != nil {
			return nil, err
		}
		page.ParentID = in.ParentID
	}
	if in.SetLogoProps {
		page.LogoProps = in.LogoProps
	}
	page.UpdatedByID = &userID
	if err := s.pageStore.Update(ctx, page); err != nil {
		return nil, err
	}
	return page, nil
}

// validateParent rejects parents that would corrupt the tree:
//   - same page as itself,
//   - caller cannot view the proposed parent,
//   - parent is a descendant of the page being updated (cycle).
//
// Walks up the proposed parent's ancestor chain. Bounded by a max depth so a
// pre-existing cycle in the data can't loop us forever.
func (s *PageService) validateParent(ctx context.Context, workspaceSlug string, page *model.Page, parentID, userID uuid.UUID) error {
	if parentID == page.ID {
		return ErrPageBadParent
	}
	parent, _, err := s.loadAndCheckView(ctx, workspaceSlug, parentID, userID)
	if err != nil {
		return ErrPageBadParent
	}
	const maxDepth = 64
	cursor := parent
	for i := 0; i < maxDepth && cursor.ParentID != nil; i++ {
		if *cursor.ParentID == page.ID {
			return ErrPageBadParent
		}
		next, err := s.pageStore.GetByID(ctx, *cursor.ParentID)
		if err != nil {
			break
		}
		cursor = next
	}
	return nil
}

// UpdateContent autosaves the body HTML. Records a version row on every save.
func (s *PageService) UpdateContent(ctx context.Context, workspaceSlug string, pageID, userID uuid.UUID, html string) (*model.Page, error) {
	page, isMember, err := s.loadAndCheckView(ctx, workspaceSlug, pageID, userID)
	if err != nil {
		return nil, err
	}
	if !canEditContent(page, userID, isMember) {
		switch {
		case page.ArchivedAt != nil:
			return nil, ErrPageArchived
		case page.IsLocked:
			return nil, ErrPageLocked
		default:
			return nil, ErrPageReadOnly
		}
	}
	if err := s.pageStore.UpdateContent(ctx, page.ID, html, userID); err != nil {
		return nil, err
	}
	page.DescriptionHTML = html
	page.UpdatedByID = &userID
	_ = s.pageStore.CreateVersion(ctx, &model.PageVersion{
		PageID:              page.ID,
		WorkspaceID:         page.WorkspaceID,
		OwnedByID:           userID,
		DescriptionHTML:     html,
		DescriptionStripped: stripHTML(html),
	})
	return page, nil
}

func (s *PageService) Lock(ctx context.Context, workspaceSlug string, pageID, userID uuid.UUID) error {
	page, isMember, err := s.loadAndCheckView(ctx, workspaceSlug, pageID, userID)
	if err != nil {
		return err
	}
	if !canEditMeta(page, userID, isMember) {
		return ErrPageReadOnly
	}
	return s.pageStore.Lock(ctx, page.ID)
}

func (s *PageService) Unlock(ctx context.Context, workspaceSlug string, pageID, userID uuid.UUID) error {
	page, isMember, err := s.loadAndCheckView(ctx, workspaceSlug, pageID, userID)
	if err != nil {
		return err
	}
	if !canEditMeta(page, userID, isMember) {
		return ErrPageReadOnly
	}
	return s.pageStore.Unlock(ctx, page.ID)
}

func (s *PageService) Archive(ctx context.Context, workspaceSlug string, pageID, userID uuid.UUID) error {
	page, isMember, err := s.loadAndCheckView(ctx, workspaceSlug, pageID, userID)
	if err != nil {
		return err
	}
	if !canEditMeta(page, userID, isMember) {
		return ErrPageReadOnly
	}
	// Archive the root and its descendants atomically so a failure doesn't
	// leave a partially-archived subtree behind.
	if err := s.pageStore.ArchiveTree(ctx, page.ID); err != nil {
		return err
	}
	return nil
}

func (s *PageService) Unarchive(ctx context.Context, workspaceSlug string, pageID, userID uuid.UUID) error {
	page, isMember, err := s.loadAndCheckView(ctx, workspaceSlug, pageID, userID)
	if err != nil {
		return err
	}
	if !canEditMeta(page, userID, isMember) {
		return ErrPageReadOnly
	}
	return s.pageStore.Unarchive(ctx, page.ID)
}

func (s *PageService) Delete(ctx context.Context, workspaceSlug string, pageID, userID uuid.UUID) error {
	page, isMember, err := s.loadAndCheckView(ctx, workspaceSlug, pageID, userID)
	if err != nil {
		return err
	}
	if !canEditMeta(page, userID, isMember) {
		return ErrPageReadOnly
	}
	if page.ArchivedAt == nil {
		return ErrPageNotArchived
	}
	return s.pageStore.Delete(ctx, page.ID)
}

// Duplicate copies a page (and its project_pages links) into a new page owned
// by the caller. Any workspace member who can view the source may duplicate it.
func (s *PageService) Duplicate(ctx context.Context, workspaceSlug string, pageID, userID uuid.UUID) (*model.Page, error) {
	src, _, err := s.loadAndCheckView(ctx, workspaceSlug, pageID, userID)
	if err != nil {
		return nil, err
	}
	dup := &model.Page{
		Name:            strings.TrimSpace(src.Name) + " (Copy)",
		DescriptionHTML: src.DescriptionHTML,
		OwnedByID:       userID,
		WorkspaceID:     src.WorkspaceID,
		Access:          src.Access,
		Color:           src.Color,
		ParentID:        src.ParentID,
		CreatedByID:     &userID,
		UpdatedByID:     &userID,
	}
	projectIDs, err := s.pageStore.ListProjectIDsForPage(ctx, src.ID)
	if err != nil {
		return nil, err
	}
	// Create the duplicate page + every project_pages link atomically.
	if err := s.pageStore.DuplicateInTransaction(ctx, dup, projectIDs, &userID); err != nil {
		return nil, err
	}
	_ = s.pageStore.CreateVersion(ctx, &model.PageVersion{
		PageID:              dup.ID,
		WorkspaceID:         dup.WorkspaceID,
		OwnedByID:           userID,
		DescriptionHTML:     dup.DescriptionHTML,
		DescriptionStripped: stripHTML(dup.DescriptionHTML),
	})
	return dup, nil
}

// ----- Versions -----------------------------------------------------------

func (s *PageService) ListVersions(ctx context.Context, workspaceSlug string, pageID, userID uuid.UUID) ([]model.PageVersion, error) {
	page, _, err := s.loadAndCheckView(ctx, workspaceSlug, pageID, userID)
	if err != nil {
		return nil, err
	}
	return s.pageStore.ListVersions(ctx, page.ID)
}

func (s *PageService) GetVersion(ctx context.Context, workspaceSlug string, pageID, versionID, userID uuid.UUID) (*model.PageVersion, error) {
	page, _, err := s.loadAndCheckView(ctx, workspaceSlug, pageID, userID)
	if err != nil {
		return nil, err
	}
	v, err := s.pageStore.GetVersion(ctx, versionID)
	if err != nil || v.PageID != page.ID {
		return nil, ErrPageNotFound
	}
	return v, nil
}

// RestoreVersion sets the page's body to the version's HTML and records a new
// version row so the restore itself is browsable history.
func (s *PageService) RestoreVersion(ctx context.Context, workspaceSlug string, pageID, versionID, userID uuid.UUID) (*model.Page, error) {
	page, isMember, err := s.loadAndCheckView(ctx, workspaceSlug, pageID, userID)
	if err != nil {
		return nil, err
	}
	if !canEditContent(page, userID, isMember) {
		return nil, ErrPageReadOnly
	}
	v, err := s.pageStore.GetVersion(ctx, versionID)
	if err != nil || v.PageID != page.ID {
		return nil, ErrPageNotFound
	}
	if err := s.pageStore.UpdateContent(ctx, page.ID, v.DescriptionHTML, userID); err != nil {
		return nil, err
	}
	page.DescriptionHTML = v.DescriptionHTML
	page.UpdatedByID = &userID
	_ = s.pageStore.CreateVersion(ctx, &model.PageVersion{
		PageID:              page.ID,
		WorkspaceID:         page.WorkspaceID,
		OwnedByID:           userID,
		DescriptionHTML:     v.DescriptionHTML,
		DescriptionStripped: stripHTML(v.DescriptionHTML),
	})
	return page, nil
}

// ----- Favorites ----------------------------------------------------------

func (s *PageService) AddFavorite(ctx context.Context, workspaceSlug string, pageID, userID uuid.UUID) error {
	page, _, err := s.loadAndCheckView(ctx, workspaceSlug, pageID, userID)
	if err != nil {
		return err
	}
	if s.favorites == nil {
		return ErrPageNotFound
	}
	return s.favorites.AddPage(ctx, userID, page.WorkspaceID, nil, page.ID)
}

func (s *PageService) RemoveFavorite(ctx context.Context, workspaceSlug string, pageID, userID uuid.UUID) error {
	if _, _, err := s.loadAndCheckView(ctx, workspaceSlug, pageID, userID); err != nil {
		return err
	}
	if s.favorites == nil {
		return ErrPageNotFound
	}
	return s.favorites.RemovePage(ctx, userID, pageID)
}

func (s *PageService) ListFavoriteIDs(ctx context.Context, workspaceSlug string, userID uuid.UUID) ([]uuid.UUID, error) {
	workspaceID, err := s.ensureWorkspaceAccess(ctx, workspaceSlug, userID)
	if err != nil {
		return nil, err
	}
	if s.favorites == nil {
		return []uuid.UUID{}, nil
	}
	return s.favorites.ListPageIDsByUserAndWorkspace(ctx, userID, workspaceID)
}

// ----- Helpers ------------------------------------------------------------

// stripHTML returns a plain-text approximation of an HTML body for search/preview.
// Cheap heuristic: drop tags + collapse whitespace.
func stripHTML(htmlContent string) string {
	if htmlContent == "" {
		return ""
	}
	var b strings.Builder
	inTag := false
	for _, r := range htmlContent {
		switch {
		case r == '<':
			inTag = true
		case r == '>':
			inTag = false
		case !inTag:
			b.WriteRune(r)
		}
	}
	return strings.Join(strings.Fields(b.String()), " ")
}
