package handler

import (
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net/http"
	"net/url"
	"strings"

	"github.com/Devlaner/devlane/api/internal/auth"
	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/oauth"
	"github.com/gin-gonic/gin"
)

type OAuthHandler struct {
	Providers  map[string]oauth.Provider
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

func (h *OAuthHandler) Initiate(c *gin.Context) {
	providerName := c.Param("provider")
	provider, ok := h.Providers[providerName]
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
	provider, ok := h.Providers[providerName]
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

	sessionKey, _, err := h.Auth.OAuthLogin(
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
