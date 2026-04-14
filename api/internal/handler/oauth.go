package handler

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net/http"
	"net/url"
	"regexp"
	"strings"

	"github.com/Devlaner/devlane/api/internal/auth"
	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/oauth"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type OAuthHandler struct {
	Settings   *store.InstanceSettingStore
	Workspaces *store.WorkspaceStore
	Auth       *auth.Service
	AppBaseURL string
	Log        *slog.Logger
}

func (h *OAuthHandler) log() *slog.Logger {
	if h.Log != nil {
		return h.Log
	}
	return slog.Default()
}

// requestCallbackBase derives the OAuth callback base URL from the incoming
// request, matching Plane's approach: scheme://host. This ensures the redirect
// URI always points to the API server that handles the callback.
func requestCallbackBase(c *gin.Context) string {
	scheme := "http"
	if c.Request.TLS != nil || strings.EqualFold(c.GetHeader("X-Forwarded-Proto"), "https") {
		scheme = "https"
	}
	return scheme + "://" + c.Request.Host
}

func (h *OAuthHandler) resolveProvider(c *gin.Context, name string) (oauth.Provider, bool) {
	ctx := c.Request.Context()
	base := requestCallbackBase(c)
	switch name {
	case "google":
		return BuildOAuthGoogleProvider(ctx, h.Settings, base)
	case "github":
		return BuildOAuthGitHubProvider(ctx, h.Settings, base)
	case "gitlab":
		return BuildOAuthGitLabProvider(ctx, h.Settings, base)
	default:
		return nil, false
	}
}

func (h *OAuthHandler) Initiate(c *gin.Context) {
	providerName := c.Param("provider")
	provider, ok := h.resolveProvider(c, providerName)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "Unknown OAuth provider"})
		return
	}

	stateBytes := make([]byte, 16)
	if _, err := rand.Read(stateBytes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate state"})
		return
	}
	state := hex.EncodeToString(stateBytes)

	nextPath := c.Query("next_path")
	sessionVal := state
	if nextPath != "" {
		sessionVal = state + "|" + nextPath
	}

	c.SetCookie("oauth_state", sessionVal, 600, "/", "", isSecureRequest(c), true)
	c.Redirect(http.StatusTemporaryRedirect, provider.AuthURL(state))
}

func (h *OAuthHandler) Callback(c *gin.Context) {
	providerName := c.Param("provider")
	provider, ok := h.resolveProvider(c, providerName)
	if !ok {
		h.redirectError(c, "Unknown OAuth provider")
		return
	}

	code := c.Query("code")
	state := c.Query("state")
	if code == "" {
		errMsg := c.Query("error_description")
		if errMsg == "" {
			errMsg = c.Query("error")
		}
		if errMsg == "" {
			errMsg = "Authorization code missing"
		}
		h.redirectError(c, errMsg)
		return
	}

	cookieVal, err := c.Cookie("oauth_state")
	if err != nil || cookieVal == "" {
		h.redirectError(c, "OAuth state cookie missing")
		return
	}
	parts := strings.SplitN(cookieVal, "|", 2)
	savedState := parts[0]
	nextPath := "/"
	if len(parts) == 2 {
		nextPath = parts[1]
	}

	if state != savedState {
		h.redirectError(c, "OAuth state mismatch")
		return
	}

	c.SetCookie("oauth_state", "", -1, "/", "", isSecureRequest(c), true)

	ctx := c.Request.Context()
	tokenData, err := provider.Exchange(ctx, code)
	if err != nil {
		h.log().Error("oauth token exchange failed", "provider", providerName, "error", err)
		h.redirectError(c, "Authentication failed")
		return
	}

	userInfo, err := provider.GetUserInfo(ctx, tokenData)
	if err != nil {
		h.log().Error("oauth user info failed", "provider", providerName, "error", err)
		h.redirectError(c, "Failed to get user information")
		return
	}

	if userInfo.Email == "" {
		h.redirectError(c, "Email not available from provider")
		return
	}

	sessionKey, user, isNewUser, err := h.Auth.OAuthLogin(
		ctx,
		providerName,
		userInfo.ProviderID,
		userInfo.Email,
		userInfo.FirstName,
		userInfo.LastName,
		userInfo.Avatar,
		tokenData.AccessToken,
		tokenData.RefreshToken,
		tokenData.IDToken,
	)
	if err != nil {
		h.log().Error("oauth login failed", "provider", providerName, "error", err)
		h.redirectError(c, "Authentication failed")
		return
	}

	if isNewUser {
		h.ensureDefaultWorkspace(ctx, user)
	}

	http.SetCookie(c.Writer, &http.Cookie{
		Name:     middleware.SessionCookieName,
		Value:    sessionKey,
		Path:     "/",
		MaxAge:   14 * 24 * 3600,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   isSecureRequest(c),
	})

	redirectURL := h.AppBaseURL
	if redirectURL == "" {
		redirectURL = "/"
	}
	redirectURL = strings.TrimSuffix(redirectURL, "/") + sanitizeRedirectPath(nextPath)

	// When the SPA runs on a different origin (dev mode), cross-origin cookies
	// may not be sent back on the first XHR. Pass the session key in the URL
	// fragment so the frontend can use it as a Bearer token. Fragments are never
	// sent to servers, so this is safe for browser history / logs.
	callbackOrigin := requestCallbackBase(c)
	spaOrigin := strings.TrimSuffix(strings.TrimSpace(h.AppBaseURL), "/")
	if spaOrigin != "" && !strings.EqualFold(spaOrigin, callbackOrigin) {
		redirectURL += "#session_token=" + url.QueryEscape(sessionKey)
	}

	c.Redirect(http.StatusTemporaryRedirect, redirectURL)
}

func (h *OAuthHandler) redirectError(c *gin.Context, message string) {
	redirectURL := h.AppBaseURL
	if redirectURL == "" {
		redirectURL = "/"
	}
	redirectURL = strings.TrimSuffix(redirectURL, "/") + "/login?error=" + url.QueryEscape(message)
	c.Redirect(http.StatusTemporaryRedirect, redirectURL)
}

func sanitizeRedirectPath(path string) string {
	if path == "" {
		return "/"
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	if strings.HasPrefix(path, "//") {
		return "/"
	}
	return path
}

var defaultSlugRe = regexp.MustCompile(`[^a-z0-9-]+`)

// ensureDefaultWorkspace creates a personal workspace for a newly signed-up
// user so they land inside a workspace instead of an empty "no workspaces"
// screen. Failures are logged but never block the sign-up.
func (h *OAuthHandler) ensureDefaultWorkspace(ctx context.Context, u *model.User) {
	if h.Workspaces == nil || u == nil {
		return
	}
	list, _ := h.Workspaces.ListByMemberID(ctx, u.ID)
	if len(list) > 0 {
		return
	}

	displayName := strings.TrimSpace(u.DisplayName)
	if displayName == "" {
		displayName = strings.TrimSpace(u.FirstName)
	}
	if displayName == "" && u.Email != nil {
		displayName = strings.Split(*u.Email, "@")[0]
	}

	wsName := displayName + "'s Workspace"
	slug := strings.Trim(defaultSlugRe.ReplaceAllString(strings.ToLower(displayName), "-"), "-")
	if slug == "" {
		slug = "workspace"
	}

	exists, _ := h.Workspaces.SlugExists(ctx, slug, uuid.Nil)
	if exists {
		slug = slug + "-" + hex.EncodeToString([]byte{byte(u.ID[0]), byte(u.ID[1])})
	}

	w := &model.Workspace{
		Name:        wsName,
		Slug:        slug,
		OwnerID:     u.ID,
		CreatedByID: &u.ID,
	}
	if err := h.Workspaces.Create(ctx, w); err != nil {
		h.log().Warn("auto-create workspace failed", "user_id", u.ID, "error", err)
		return
	}
	m := &model.WorkspaceMember{WorkspaceID: w.ID, MemberID: u.ID, Role: 20}
	if err := h.Workspaces.AddMember(ctx, m); err != nil {
		h.log().Warn("auto-add workspace member failed", "user_id", u.ID, "error", err)
	}
}
