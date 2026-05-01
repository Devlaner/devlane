package handler

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	gh "github.com/Devlaner/devlane/api/internal/github"
	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// IntegrationHandler exposes generic integration endpoints. Provider-specific
// flows (GitHub install, repo sync, webhook) live in github.go.
type IntegrationHandler struct {
	Integration *service.IntegrationService
	GithubSync  *service.GithubSyncService
	GithubEvent *service.GithubEventService
	Settings    *store.InstanceSettingStore
	AppBaseURL  string
	APIPublicURL string
	Log         *slog.Logger
}

func (h *IntegrationHandler) log() *slog.Logger {
	if h.Log != nil {
		return h.Log
	}
	return slog.Default()
}

// ListAvailable returns all registered integration providers.
// GET /api/integrations/
func (h *IntegrationHandler) ListAvailable(c *gin.Context) {
	list, err := h.Integration.ListAvailable(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list integrations"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// ListInstalled returns the workspace's installed integrations.
// GET /api/workspaces/:slug/integrations/
func (h *IntegrationHandler) ListInstalled(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	list, err := h.Integration.ListInstalled(c.Request.Context(), c.Param("slug"), user.ID)
	if err != nil {
		writeIntegrationError(c, err)
		return
	}
	c.JSON(http.StatusOK, list)
}

// Uninstall removes the workspace's installed integration for a provider.
// DELETE /api/workspaces/:slug/integrations/:provider/
func (h *IntegrationHandler) Uninstall(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	provider := strings.ToLower(c.Param("provider"))
	if err := h.Integration.Uninstall(c.Request.Context(), c.Param("slug"), provider, user.ID); err != nil {
		writeIntegrationError(c, err)
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

// ---------------------------------------------------------------------------
// GitHub App install flow (browser → github.com → callback → workspace settings)
// ---------------------------------------------------------------------------

// GitHubInstallStart redirects the user to github.com to install the App.
// We carry the workspace slug in the OAuth state cookie so the callback can
// link the resulting installation to the right workspace.
// GET /auth/github-app/install?workspace=:slug
func (h *IntegrationHandler) GitHubInstallStart(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	workspaceSlug := strings.TrimSpace(c.Query("workspace"))
	if workspaceSlug == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workspace query param is required"})
		return
	}
	appName := service.LoadGitHubAppNameFromSettings(c.Request.Context(), h.Settings)
	if appName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "GitHub App is not configured. Ask an instance admin to set the github_app section."})
		return
	}

	stateBytes := make([]byte, 16)
	if _, err := rand.Read(stateBytes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate state"})
		return
	}
	state := hex.EncodeToString(stateBytes) + ":" + workspaceSlug
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "github_app_state",
		Value:    state,
		Path:     "/",
		MaxAge:   600,
		HttpOnly: true,
		Secure:   isSecureRequest(c),
		SameSite: http.SameSiteLaxMode,
	})

	installURL := "https://github.com/apps/" + url.PathEscape(appName) + "/installations/new?state=" + url.QueryEscape(state)
	c.Redirect(http.StatusTemporaryRedirect, installURL)
}

// GitHubInstallCallback handles the redirect back from github.com after the
// user installs (or updates) the App. GitHub appends ?installation_id=&state=
// to the redirect URL configured on the App.
// GET /auth/github-app/callback?installation_id=...&state=...&setup_action=install
func (h *IntegrationHandler) GitHubInstallCallback(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		// Not logged in — kick to login then bounce back.
		next := "/login"
		if h.AppBaseURL != "" {
			next = strings.TrimSuffix(h.AppBaseURL, "/") + "/login"
		}
		c.Redirect(http.StatusTemporaryRedirect, next)
		return
	}

	installationIDStr := c.Query("installation_id")
	stateRaw := c.Query("state")
	cookieVal, _ := c.Cookie("github_app_state")
	// Clear cookie regardless of outcome.
	http.SetCookie(c.Writer, &http.Cookie{
		Name: "github_app_state", Value: "", Path: "/", MaxAge: -1, HttpOnly: true,
		Secure: isSecureRequest(c), SameSite: http.SameSiteLaxMode,
	})

	if cookieVal == "" || cookieVal != stateRaw {
		h.redirectIntegration(c, "", "GitHub App install state mismatch")
		return
	}
	parts := strings.SplitN(stateRaw, ":", 2)
	if len(parts) != 2 {
		h.redirectIntegration(c, "", "Invalid GitHub App install state")
		return
	}
	workspaceSlug := parts[1]
	installationID, err := strconv.ParseInt(installationIDStr, 10, 64)
	if err != nil || installationID <= 0 {
		h.redirectIntegration(c, workspaceSlug, "Missing installation_id from GitHub")
		return
	}
	if _, err := h.Integration.InstallGitHub(c.Request.Context(), workspaceSlug, user.ID, installationID); err != nil {
		h.log().Error("github app install failed", "error", err, "workspace", workspaceSlug, "installation_id", installationID)
		h.redirectIntegration(c, workspaceSlug, "Failed to complete GitHub App install: "+err.Error())
		return
	}
	h.redirectIntegration(c, workspaceSlug, "")
}

func (h *IntegrationHandler) redirectIntegration(c *gin.Context, workspaceSlug, errMsg string) {
	target := strings.TrimSuffix(h.AppBaseURL, "/")
	if target == "" {
		target = ""
	}
	if workspaceSlug != "" {
		target += "/" + url.PathEscape(workspaceSlug) + "/settings"
	} else {
		target += "/"
	}
	q := url.Values{}
	q.Set("section", "integrations")
	if errMsg != "" {
		q.Set("error", errMsg)
	} else {
		q.Set("connected", "github")
	}
	target += "?" + q.Encode()
	c.Redirect(http.StatusTemporaryRedirect, target)
}

// ---------------------------------------------------------------------------
// GitHub repo sync (workspace + project scoped)
// ---------------------------------------------------------------------------

// GitHubListRepositories proxies the installation's accessible repositories.
// GET /api/workspaces/:slug/integrations/github/repositories?page=1&per_page=30
func (h *IntegrationHandler) GitHubListRepositories(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "30"))
	repos, total, err := h.GithubSync.ListRepositories(c.Request.Context(), c.Param("slug"), user.ID, page, perPage)
	if err != nil {
		writeIntegrationError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"total_count":  total,
		"page":         page,
		"per_page":     perPage,
		"repositories": repos,
	})
}

// GitHubGetSync returns the project's GitHub repo sync row, if any.
// GET /api/workspaces/:slug/projects/:projectId/integrations/github/sync/
func (h *IntegrationHandler) GitHubGetSync(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	projectID, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project id"})
		return
	}
	sync, repo, err := h.GithubSync.GetByProject(c.Request.Context(), c.Param("slug"), projectID, user.ID)
	if err != nil {
		writeIntegrationError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"sync": sync, "repository": repo})
}

// GitHubCreateSync links a GitHub repo to a Devlane project.
// POST /api/workspaces/:slug/projects/:projectId/integrations/github/sync/
type githubCreateSyncRequest struct {
	GithubRepositoryID int64  `json:"github_repository_id" binding:"required"`
	Owner              string `json:"owner" binding:"required"`
	Name               string `json:"name" binding:"required"`
	URL                string `json:"url"`
}

func (h *IntegrationHandler) GitHubCreateSync(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	projectID, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project id"})
		return
	}
	var body githubCreateSyncRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	sync, repo, err := h.GithubSync.CreateSync(c.Request.Context(), c.Param("slug"), projectID, user.ID, service.LinkRequest{
		GithubRepositoryID: body.GithubRepositoryID,
		Owner:              body.Owner,
		Name:               body.Name,
		URL:                body.URL,
	})
	if err != nil {
		writeIntegrationError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"sync": sync, "repository": repo})
}

// GitHubUpdateSync updates per-repo sync settings (auto_link, state map, ...).
// PATCH /api/workspaces/:slug/projects/:projectId/integrations/github/sync/
type githubUpdateSyncRequest struct {
	AutoLink          *bool   `json:"auto_link"`
	AutoCloseOnMerge  *bool   `json:"auto_close_on_merge"`
	InProgressStateID *string `json:"in_progress_state_id"`
	DoneStateID       *string `json:"done_state_id"`
}

func (h *IntegrationHandler) GitHubUpdateSync(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	projectID, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project id"})
		return
	}
	var body githubUpdateSyncRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	var inProg, done *uuid.UUID
	if body.InProgressStateID != nil {
		v := strings.TrimSpace(*body.InProgressStateID)
		if v == "" {
			zero := uuid.Nil
			inProg = &zero
		} else if id, err := uuid.Parse(v); err == nil {
			inProg = &id
		}
	}
	if body.DoneStateID != nil {
		v := strings.TrimSpace(*body.DoneStateID)
		if v == "" {
			zero := uuid.Nil
			done = &zero
		} else if id, err := uuid.Parse(v); err == nil {
			done = &id
		}
	}
	sync, err := h.GithubSync.UpdateSync(c.Request.Context(), c.Param("slug"), projectID, user.ID, body.AutoLink, body.AutoCloseOnMerge, inProg, done)
	if err != nil {
		writeIntegrationError(c, err)
		return
	}
	c.JSON(http.StatusOK, sync)
}

// GitHubDeleteSync removes the project ↔ repo link.
// DELETE /api/workspaces/:slug/projects/:projectId/integrations/github/sync/
func (h *IntegrationHandler) GitHubDeleteSync(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	projectID, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project id"})
		return
	}
	if err := h.GithubSync.DeleteSync(c.Request.Context(), c.Param("slug"), projectID, user.ID); err != nil {
		writeIntegrationError(c, err)
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

// ---------------------------------------------------------------------------
// Per-issue PR links (issue detail page sidebar)
// ---------------------------------------------------------------------------

// GitHubListIssueLinks lists every PR linked to a Devlane issue.
// GET /api/workspaces/:slug/projects/:projectId/issues/:pk/integrations/github/links/
func (h *IntegrationHandler) GitHubListIssueLinks(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	projectID, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project id"})
		return
	}
	issueID, err := uuid.Parse(c.Param("pk"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid issue id"})
		return
	}
	links, err := h.GithubSync.ListLinksForIssue(c.Request.Context(), c.Param("slug"), projectID, issueID, user.ID)
	if err != nil {
		writeIntegrationError(c, err)
		return
	}
	c.JSON(http.StatusOK, links)
}

// GitHubCreateIssueLink links a PR (by URL) to a Devlane issue.
// POST /api/workspaces/:slug/projects/:projectId/issues/:pk/integrations/github/links/
type githubCreateIssueLinkRequest struct {
	URL string `json:"url" binding:"required"`
}

func (h *IntegrationHandler) GitHubCreateIssueLink(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	projectID, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project id"})
		return
	}
	issueID, err := uuid.Parse(c.Param("pk"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid issue id"})
		return
	}
	var body githubCreateIssueLinkRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	link, err := h.GithubSync.CreateLinkFromURL(c.Request.Context(), c.Param("slug"), projectID, issueID, user.ID, body.URL)
	if err != nil {
		writeIntegrationError(c, err)
		return
	}
	c.JSON(http.StatusCreated, link)
}

// GitHubDeleteIssueLink removes a single PR↔issue link.
// DELETE /api/workspaces/:slug/projects/:projectId/issues/:pk/integrations/github/links/:linkId/
func (h *IntegrationHandler) GitHubDeleteIssueLink(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	projectID, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project id"})
		return
	}
	issueID, err := uuid.Parse(c.Param("pk"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid issue id"})
		return
	}
	linkID, err := uuid.Parse(c.Param("linkId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid link id"})
		return
	}
	if err := h.GithubSync.DeleteLinkForIssue(c.Request.Context(), c.Param("slug"), projectID, issueID, linkID, user.ID); err != nil {
		writeIntegrationError(c, err)
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

// GitHubIssueSummary returns aggregate PR counts for the given issue IDs.
// GET /api/workspaces/:slug/projects/:projectId/integrations/github/issue-summary/?ids=a,b,c
func (h *IntegrationHandler) GitHubIssueSummary(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	projectID, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project id"})
		return
	}
	idsParam := strings.TrimSpace(c.Query("ids"))
	if idsParam == "" {
		c.JSON(http.StatusOK, gin.H{"summary": map[string]any{}})
		return
	}
	parts := strings.Split(idsParam, ",")
	ids := make([]uuid.UUID, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		id, err := uuid.Parse(p)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid id in ids list", "detail": p})
			return
		}
		ids = append(ids, id)
	}
	out, err := h.GithubSync.IssueSummaryForProject(c.Request.Context(), c.Param("slug"), projectID, ids, user.ID)
	if err != nil {
		writeIntegrationError(c, err)
		return
	}
	// Marshal map[uuid]…  → map[string]…  for the JSON response.
	resp := make(map[string]any, len(out))
	for k, v := range out {
		resp[k.String()] = v
	}
	c.JSON(http.StatusOK, gin.H{"summary": resp})
}

// ---------------------------------------------------------------------------
// Webhook receiver (no auth — signature-verified)
// ---------------------------------------------------------------------------

// GitHubWebhook receives events from github.com. Public endpoint, no session
// auth — authentication is the HMAC signature in X-Hub-Signature-256.
// POST /webhooks/github
func (h *IntegrationHandler) GitHubWebhook(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read body"})
		return
	}

	secret := service.LoadGitHubWebhookSecretFromSettings(c.Request.Context(), h.Settings)
	if err := gh.VerifySignature(secret, body, c.GetHeader("X-Hub-Signature-256")); err != nil {
		h.log().Warn("github webhook signature verification failed", "error", err, "delivery", c.GetHeader("X-GitHub-Delivery"))
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Signature verification failed"})
		return
	}

	event := c.GetHeader("X-GitHub-Event")
	deliveryID := c.GetHeader("X-GitHub-Delivery")
	if event == "" || deliveryID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing event headers"})
		return
	}

	if h.GithubEvent == nil {
		h.log().Warn("github webhook received but event service is not wired")
		c.JSON(http.StatusOK, gin.H{"ok": true})
		return
	}
	if err := h.GithubEvent.HandleWebhook(c.Request.Context(), event, deliveryID, body); err != nil {
		h.log().Warn("github webhook processing error", "error", err, "event", event)
		// Still return 200 — failure is logged in github_webhook_events.
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// writeIntegrationError maps service errors to HTTP responses.
func writeIntegrationError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrIntegrationNotFound),
		errors.Is(err, service.ErrRepoSyncNotFound),
		errors.Is(err, service.ErrIssueLinkNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
	case errors.Is(err, service.ErrIntegrationAlreadyInstalled),
		errors.Is(err, service.ErrRepoSyncExists):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	case errors.Is(err, service.ErrInvalidPRURL),
		errors.Is(err, service.ErrPRRepoMismatch):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	case errors.Is(err, service.ErrGitHubAppNotConfigured):
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
	case errors.Is(err, service.ErrInstallationFetch):
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
	case errors.Is(err, service.ErrWorkspaceNotFound),
		errors.Is(err, service.ErrWorkspaceForbidden),
		errors.Is(err, service.ErrProjectNotFound),
		errors.Is(err, service.ErrProjectForbidden):
		c.JSON(http.StatusNotFound, gin.H{"error": "Workspace or project not found"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Integration request failed", "detail": err.Error()})
	}
}
