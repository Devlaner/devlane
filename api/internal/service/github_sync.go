package service

import (
	"context"
	"errors"
	"regexp"
	"strconv"
	"strings"

	gh "github.com/Devlaner/devlane/api/internal/github"
	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
)

var (
	ErrRepoSyncNotFound       = errors.New("repository sync not found")
	ErrRepoSyncExists         = errors.New("project already linked to a github repository")
	ErrInvalidPRURL           = errors.New("invalid github pull request url")
	ErrPRRepoMismatch         = errors.New("pull request belongs to a different repository than the one linked to this project")
	ErrIssueLinkNotFound      = errors.New("pull request link not found")
)

// prURLRegex matches https://github.com/owner/repo/pull/123 (with optional trailing slash or path).
var prURLRegex = regexp.MustCompile(`^https?://github\.com/([^/\s]+)/([^/\s]+)/pull/(\d+)`)

// GithubSyncService manages per-project GitHub repository links.
type GithubSyncService struct {
	is     *IntegrationService
	wis    *store.WorkspaceIntegrationStore
	repo   *store.GithubRepositoryStore
	rs     *store.GithubRepositorySyncStore
	issues *store.GithubIssueSyncStore
	issue  *store.IssueStore
	ws     *store.WorkspaceStore
	ps     *store.ProjectStore
}

func NewGithubSyncService(
	is *IntegrationService,
	wis *store.WorkspaceIntegrationStore,
	repo *store.GithubRepositoryStore,
	rs *store.GithubRepositorySyncStore,
	issues *store.GithubIssueSyncStore,
	issue *store.IssueStore,
	ws *store.WorkspaceStore,
	ps *store.ProjectStore,
) *GithubSyncService {
	return &GithubSyncService{
		is: is, wis: wis, repo: repo, rs: rs, issues: issues, issue: issue, ws: ws, ps: ps,
	}
}

// ListRepositories proxies the installation's repos via the GitHub API.
// Pagination follows GitHub's `page` (1-based) / `per_page` (≤100).
func (s *GithubSyncService) ListRepositories(ctx context.Context, workspaceSlug string, userID uuid.UUID, page, perPage int) ([]gh.Repository, int, error) {
	w, err := s.ws.GetBySlug(ctx, workspaceSlug)
	if err != nil {
		return nil, 0, ErrWorkspaceNotFound
	}
	ok, _ := s.ws.IsMember(ctx, w.ID, userID)
	if !ok {
		return nil, 0, ErrWorkspaceForbidden
	}
	wi, err := s.wis.GetByWorkspaceAndProvider(ctx, w.ID, "github")
	if err != nil || wi.InstallationID == nil {
		return nil, 0, ErrIntegrationNotFound
	}
	client := s.is.GitHubClient()
	if client == nil {
		return nil, 0, ErrGitHubAppNotConfigured
	}
	return client.ListInstallationRepositories(ctx, *wi.InstallationID, page, perPage)
}

// LinkRequest is the input for creating a sync.
type LinkRequest struct {
	GithubRepositoryID int64  // required (GitHub's numeric repo ID)
	Owner              string // required
	Name               string // required
	URL                string // optional (HTML URL for display)
}

// CreateSync links a GitHub repository to a Devlane project. Errors with
// ErrRepoSyncExists if the project already has a sync. We don't enforce
// repository uniqueness across projects within a workspace — multiple projects
// in the same workspace may legitimately track the same repo.
func (s *GithubSyncService) CreateSync(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID, req LinkRequest) (*model.GithubRepositorySync, *model.GithubRepository, error) {
	if req.GithubRepositoryID <= 0 || strings.TrimSpace(req.Owner) == "" || strings.TrimSpace(req.Name) == "" {
		return nil, nil, errors.New("github_repository_id, owner, name are required")
	}
	w, err := s.ws.GetBySlug(ctx, workspaceSlug)
	if err != nil {
		return nil, nil, ErrWorkspaceNotFound
	}
	ok, _ := s.ws.IsMember(ctx, w.ID, userID)
	if !ok {
		return nil, nil, ErrWorkspaceForbidden
	}
	inWorkspace, _ := s.ps.IsInWorkspace(ctx, projectID, w.ID)
	if !inWorkspace {
		return nil, nil, ErrProjectNotFound
	}
	wi, err := s.wis.GetByWorkspaceAndProvider(ctx, w.ID, "github")
	if err != nil {
		return nil, nil, ErrIntegrationNotFound
	}
	if existing, err := s.rs.GetByProjectID(ctx, projectID); err == nil && existing != nil {
		return nil, nil, ErrRepoSyncExists
	}
	repo := &model.GithubRepository{
		Name:         req.Name,
		Owner:        req.Owner,
		URL:          req.URL,
		RepositoryID: req.GithubRepositoryID,
		ProjectID:    projectID,
		WorkspaceID:  w.ID,
		Config:       model.JSONMap{},
		CreatedByID:  &userID,
	}
	if err := s.repo.Create(ctx, repo); err != nil {
		return nil, nil, err
	}
	sync := &model.GithubRepositorySync{
		RepositoryID:           repo.ID,
		ActorID:                userID,
		WorkspaceIntegrationID: wi.ID,
		ProjectID:              projectID,
		WorkspaceID:            w.ID,
		AutoLink:               true,
		AutoCloseOnMerge:       true,
		Credentials:            model.JSONMap{},
		CreatedByID:            &userID,
	}
	if err := s.rs.Create(ctx, sync); err != nil {
		// Best-effort rollback of the repo row.
		_ = s.repo.Delete(ctx, repo.ID)
		return nil, nil, err
	}
	return sync, repo, nil
}

// UpdateSync updates per-repo settings (auto_link, auto_close_on_merge, state map).
func (s *GithubSyncService) UpdateSync(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID, autoLink, autoCloseOnMerge *bool, inProgressStateID, doneStateID *uuid.UUID) (*model.GithubRepositorySync, error) {
	sync, _, err := s.GetByProject(ctx, workspaceSlug, projectID, userID)
	if err != nil {
		return nil, err
	}
	if autoLink != nil {
		sync.AutoLink = *autoLink
	}
	if autoCloseOnMerge != nil {
		sync.AutoCloseOnMerge = *autoCloseOnMerge
	}
	if inProgressStateID != nil {
		if *inProgressStateID == uuid.Nil {
			sync.InProgressStateID = nil
		} else {
			sync.InProgressStateID = inProgressStateID
		}
	}
	if doneStateID != nil {
		if *doneStateID == uuid.Nil {
			sync.DoneStateID = nil
		} else {
			sync.DoneStateID = doneStateID
		}
	}
	sync.UpdatedByID = &userID
	if err := s.rs.Update(ctx, sync); err != nil {
		return nil, err
	}
	return sync, nil
}

// GetByProject returns the project's sync row along with its github_repositories row.
func (s *GithubSyncService) GetByProject(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID) (*model.GithubRepositorySync, *model.GithubRepository, error) {
	w, err := s.ws.GetBySlug(ctx, workspaceSlug)
	if err != nil {
		return nil, nil, ErrWorkspaceNotFound
	}
	ok, _ := s.ws.IsMember(ctx, w.ID, userID)
	if !ok {
		return nil, nil, ErrWorkspaceForbidden
	}
	inWorkspace, _ := s.ps.IsInWorkspace(ctx, projectID, w.ID)
	if !inWorkspace {
		return nil, nil, ErrProjectNotFound
	}
	sync, err := s.rs.GetByProjectID(ctx, projectID)
	if err != nil {
		return nil, nil, ErrRepoSyncNotFound
	}
	repo, err := s.repo.GetByID(ctx, sync.RepositoryID)
	if err != nil {
		return sync, nil, nil
	}
	return sync, repo, nil
}

// DeleteSync removes the project ↔ repo link.
func (s *GithubSyncService) DeleteSync(ctx context.Context, workspaceSlug string, projectID uuid.UUID, userID uuid.UUID) error {
	sync, repo, err := s.GetByProject(ctx, workspaceSlug, projectID, userID)
	if err != nil {
		return err
	}
	if err := s.rs.Delete(ctx, sync.ID); err != nil {
		return err
	}
	if repo != nil {
		_ = s.repo.Delete(ctx, repo.ID)
	}
	return nil
}

// ---------------------------------------------------------------------------
// Per-issue PR links (issue detail page sidebar)
// ---------------------------------------------------------------------------

// ListLinksForIssue returns all PR links attached to a Devlane issue.
func (s *GithubSyncService) ListLinksForIssue(ctx context.Context, workspaceSlug string, projectID, issueID uuid.UUID, userID uuid.UUID) ([]model.GithubIssueSync, error) {
	if err := s.ensureIssueAccess(ctx, workspaceSlug, projectID, issueID, userID); err != nil {
		return nil, err
	}
	return s.issues.ListByIssueID(ctx, issueID)
}

// CreateLinkFromURL parses a GitHub PR URL, fetches the PR via the App
// installation, and links it to the Devlane issue. The PR's repo must match
// the project's currently-linked repo.
func (s *GithubSyncService) CreateLinkFromURL(ctx context.Context, workspaceSlug string, projectID, issueID uuid.UUID, userID uuid.UUID, prURL string) (*model.GithubIssueSync, error) {
	if err := s.ensureIssueAccess(ctx, workspaceSlug, projectID, issueID, userID); err != nil {
		return nil, err
	}
	owner, repoName, number, err := parsePRURL(prURL)
	if err != nil {
		return nil, err
	}
	sync, err := s.rs.GetByProjectID(ctx, projectID)
	if err != nil {
		return nil, ErrRepoSyncNotFound
	}
	repo, err := s.repo.GetByID(ctx, sync.RepositoryID)
	if err != nil {
		return nil, ErrRepoSyncNotFound
	}
	if !strings.EqualFold(repo.Owner, owner) || !strings.EqualFold(repo.Name, repoName) {
		return nil, ErrPRRepoMismatch
	}
	wi, err := s.wis.GetByID(ctx, sync.WorkspaceIntegrationID)
	if err != nil || wi.InstallationID == nil {
		return nil, ErrIntegrationNotFound
	}
	client := s.is.GitHubClient()
	if client == nil {
		return nil, ErrGitHubAppNotConfigured
	}
	pr, err := client.GetPullRequest(ctx, *wi.InstallationID, owner, repoName, number)
	if err != nil {
		return nil, err
	}

	link := &model.GithubIssueSync{
		RepoIssueID:      int64(pr.Number),
		GithubIssueID:    pr.ID,
		IssueURL:         pr.HTMLURL,
		IssueID:          issueID,
		RepositorySyncID: sync.ID,
		ProjectID:        sync.ProjectID,
		WorkspaceID:      sync.WorkspaceID,
		Kind:             "pull_request",
		State:            pr.EffectiveState(),
		Title:            pr.Title,
		Draft:            pr.Draft,
		MergedAt:         pr.MergedAt,
		ClosedAt:         pr.ClosedAt,
		AuthorLogin:      pr.User.Login,
		BaseBranch:       pr.Base.Ref,
		HeadBranch:       pr.Head.Ref,
		DetectionSource:  "manual",
		CreatedByID:      &userID,
	}
	return s.issues.UpsertByPRAndIssue(ctx, link)
}

// DeleteLinkForIssue removes one PR↔issue link.
func (s *GithubSyncService) DeleteLinkForIssue(ctx context.Context, workspaceSlug string, projectID, issueID, linkID uuid.UUID, userID uuid.UUID) error {
	if err := s.ensureIssueAccess(ctx, workspaceSlug, projectID, issueID, userID); err != nil {
		return err
	}
	link, err := s.issues.GetByID(ctx, linkID)
	if err != nil {
		return ErrIssueLinkNotFound
	}
	// Make sure the link actually belongs to this issue/project — defensive.
	if link.IssueID != issueID || link.ProjectID != projectID {
		return ErrIssueLinkNotFound
	}
	return s.issues.Delete(ctx, linkID)
}

// IssueSummaryForProject returns aggregate PR counts per issue ID, scoped to
// a single project. Used by the issues list page to render badges.
func (s *GithubSyncService) IssueSummaryForProject(ctx context.Context, workspaceSlug string, projectID uuid.UUID, issueIDs []uuid.UUID, userID uuid.UUID) (map[uuid.UUID]store.IssueSummary, error) {
	w, err := s.ws.GetBySlug(ctx, workspaceSlug)
	if err != nil {
		return nil, ErrWorkspaceNotFound
	}
	ok, _ := s.ws.IsMember(ctx, w.ID, userID)
	if !ok {
		return nil, ErrWorkspaceForbidden
	}
	inWorkspace, _ := s.ps.IsInWorkspace(ctx, projectID, w.ID)
	if !inWorkspace {
		return nil, ErrProjectNotFound
	}
	return s.issues.SummaryForIssues(ctx, projectID, issueIDs)
}

// ensureIssueAccess validates that the requester is a workspace member and
// that the issue belongs to the project (which belongs to the workspace).
func (s *GithubSyncService) ensureIssueAccess(ctx context.Context, workspaceSlug string, projectID, issueID uuid.UUID, userID uuid.UUID) error {
	w, err := s.ws.GetBySlug(ctx, workspaceSlug)
	if err != nil {
		return ErrWorkspaceNotFound
	}
	ok, _ := s.ws.IsMember(ctx, w.ID, userID)
	if !ok {
		return ErrWorkspaceForbidden
	}
	inWorkspace, _ := s.ps.IsInWorkspace(ctx, projectID, w.ID)
	if !inWorkspace {
		return ErrProjectNotFound
	}
	issue, err := s.issue.GetByID(ctx, issueID)
	if err != nil || issue.ProjectID != projectID {
		return ErrProjectNotFound
	}
	return nil
}

// parsePRURL extracts owner/repo/number from a GitHub PR URL.
func parsePRURL(s string) (owner, repo string, number int, err error) {
	s = strings.TrimSpace(s)
	m := prURLRegex.FindStringSubmatch(s)
	if m == nil {
		return "", "", 0, ErrInvalidPRURL
	}
	n, convErr := strconv.Atoi(m[3])
	if convErr != nil || n <= 0 {
		return "", "", 0, ErrInvalidPRURL
	}
	return m[1], m[2], n, nil
}
