package handler

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"errors"
	"fmt"
	"log/slog"
	"math/big"
	"net/http"
	"net/mail"
	"regexp"
	"strings"
	"time"

	"github.com/Devlaner/devlane/api/internal/auth"
	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/queue"
	"github.com/Devlaner/devlane/api/internal/redis"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AuthHandler struct {
	Auth            *auth.Service
	Settings        *store.InstanceSettingStore
	Winv            *store.WorkspaceInviteStore
	Ws              *store.WorkspaceStore
	NotifPrefs      *store.UserNotificationPreferenceStore
	ApiTokens       *store.ApiTokenStore
	Queue           *queue.Publisher
	Redis           *redis.Client
	MagicCodeSecret string
	AppBaseURL      string
	Log             *slog.Logger
}

type SignInRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type SignUpRequest struct {
	Email       string `json:"email" binding:"required,email"`
	Password    string `json:"password" binding:"required,min=8"`
	FirstName   string `json:"first_name"`
	LastName    string `json:"last_name"`
	InviteToken string `json:"invite_token"`
}

func authBool(v model.JSONMap, key string, defaultVal bool) bool {
	if v == nil {
		return defaultVal
	}
	x, ok := v[key]
	if !ok {
		return defaultVal
	}
	if b, ok := x.(bool); ok {
		return b
	}
	return defaultVal
}

func (h *AuthHandler) log() *slog.Logger {
	if h.Log != nil {
		return h.Log
	}
	return slog.Default()
}

// SignIn authenticates with email/password and sets a session cookie.
// POST /auth/sign-in/
func (h *AuthHandler) SignIn(c *gin.Context) {
	var req SignInRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	if h.Settings != nil {
		row, _ := h.Settings.Get(c.Request.Context(), "auth")
		if row != nil && !authBool(row.Value, "password", true) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Password sign-in is disabled"})
			return
		}
	}
	sessionKey, user, err := h.Auth.SignIn(c.Request.Context(), auth.SignInRequest{Email: req.Email, Password: req.Password})
	if err != nil {
		if errors.Is(err, auth.ErrUserDeactivated) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Your account has been deactivated. Please contact the administrator.", "error_code": "USER_ACCOUNT_DEACTIVATED"})
			return
		}
		if errors.Is(err, auth.ErrInvalidCredentials) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Sign in failed"})
		return
	}
	setSessionCookie(c, sessionKey)
	c.JSON(http.StatusOK, userResponse(user))
}

// SignUp registers a new user; invite required when instance has public sign-up disabled.
// POST /auth/sign-up/
func (h *AuthHandler) SignUp(c *gin.Context) {
	var req SignUpRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	ctx := c.Request.Context()
	var allowPublicSignup, passwordEnabled = true, true
	if h.Settings != nil {
		row, _ := h.Settings.Get(ctx, "auth")
		if row != nil {
			passwordEnabled = authBool(row.Value, "password", true)
			allowPublicSignup = authBool(row.Value, "allow_public_signup", true)
		}
	}
	if !passwordEnabled {
		c.JSON(http.StatusForbidden, gin.H{"error": "Password sign-up is disabled"})
		return
	}
	var inv *model.WorkspaceMemberInvite
	if !allowPublicSignup {
		if strings.TrimSpace(req.InviteToken) == "" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Sign-up is by invite only. Use the link from your invitation email."})
			return
		}
		if h.Winv == nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "Sign-up is by invite only. Use the link from your invitation email."})
			return
		}
		var err error
		inv, err = h.Winv.GetByToken(ctx, strings.TrimSpace(req.InviteToken))
		if err != nil || inv == nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "Invalid or expired invite. Use the link from your invitation email."})
			return
		}
		emailNorm := strings.TrimSpace(strings.ToLower(req.Email))
		invEmailNorm := strings.TrimSpace(strings.ToLower(inv.Email))
		if emailNorm != invEmailNorm {
			c.JSON(http.StatusForbidden, gin.H{"error": "Sign-up email must match the invited email address."})
			return
		}
	}
	sessionKey, user, err := h.Auth.SignUp(ctx, auth.SignUpRequest{
		Email:     req.Email,
		Password:  req.Password,
		FirstName: req.FirstName,
		LastName:  req.LastName,
	})
	if err != nil {
		if errors.Is(err, auth.ErrPasswordTooWeak) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Password must contain at least 8 characters, one uppercase, one lowercase, one digit, and one special character."})
			return
		}
		if errors.Is(err, auth.ErrEmailTaken) {
			c.JSON(http.StatusConflict, gin.H{"error": "An account with this email already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Sign up failed"})
		return
	}
	postSignUpWorkflow(ctx, h.postSignUpDeps(), user)
	setSessionCookie(c, sessionKey)
	c.JSON(http.StatusCreated, userResponse(user))
}

// SignOut invalidates the session and clears the session cookie.
// POST /auth/sign-out/
func (h *AuthHandler) SignOut(c *gin.Context) {
	sessionKey, _ := c.Cookie(middleware.SessionCookieName)
	if sessionKey != "" {
		_ = h.Auth.SignOut(c.Request.Context(), sessionKey)
	}
	clearSessionCookie(c)
	c.Status(http.StatusNoContent)
}

// Me returns the authenticated user.
// GET /api/users/me/
func (h *AuthHandler) Me(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	c.JSON(http.StatusOK, userResponse(user))
}

// UpdateMeRequest is the body for PATCH /api/users/me/
type UpdateMeRequest struct {
	FirstName    *string `json:"first_name" binding:"omitempty,max=255"`
	LastName     *string `json:"last_name" binding:"omitempty,max=255"`
	DisplayName  *string `json:"display_name" binding:"omitempty,max=255"`
	UserTimezone *string `json:"user_timezone" binding:"omitempty,max=100"`
	Avatar       *string `json:"avatar" binding:"omitempty,max=2048"`
	CoverImage   *string `json:"cover_image" binding:"omitempty,max=2048"`
}

// UpdateMe updates the authenticated user's profile (email is not updatable).
// PATCH /api/users/me/
func (h *AuthHandler) UpdateMe(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	var req UpdateMeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	if req.FirstName != nil {
		user.FirstName = *req.FirstName
	}
	if req.LastName != nil {
		user.LastName = *req.LastName
	}
	if req.DisplayName != nil {
		user.DisplayName = *req.DisplayName
	}
	if req.UserTimezone != nil {
		user.UserTimezone = *req.UserTimezone
	}
	if req.Avatar != nil {
		user.Avatar = *req.Avatar
	}
	if req.CoverImage != nil {
		user.CoverImage = *req.CoverImage
	}
	if err := h.Auth.UpdateProfile(c.Request.Context(), user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Update failed"})
		return
	}
	c.JSON(http.StatusOK, userResponse(user))
}

// ChangePasswordRequest is the body for POST /api/users/me/change-password/
type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required,min=8"`
}

// ChangePassword changes the authenticated user's password.
// POST /api/users/me/change-password/
func (h *AuthHandler) ChangePassword(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	if err := h.Auth.ChangePassword(c.Request.Context(), user.ID, req.CurrentPassword, req.NewPassword); err != nil {
		if errors.Is(err, auth.ErrPasswordTooWeak) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Password must contain at least 8 characters, one uppercase, one lowercase, one digit, and one special character."})
			return
		}
		if errors.Is(err, auth.ErrInvalidCredentials) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Current password is incorrect"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to change password"})
		return
	}
	c.Status(http.StatusNoContent)
}

// GetNotificationPreferences returns account-level notification preferences.
// GET /api/users/me/notification-preferences/
func (h *AuthHandler) GetNotificationPreferences(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	if h.NotifPrefs == nil {
		c.JSON(http.StatusOK, gin.H{
			"property_change": true,
			"state_change":    true,
			"comment":         true,
			"mention":         true,
			"issue_completed": true,
		})
		return
	}
	p, err := h.NotifPrefs.GetGlobal(c.Request.Context(), user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load preferences"})
		return
	}
	if p == nil {
		c.JSON(http.StatusOK, gin.H{
			"property_change": true,
			"state_change":    true,
			"comment":         true,
			"mention":         true,
			"issue_completed": true,
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"property_change": p.PropertyChange,
		"state_change":    p.StateChange,
		"comment":         p.Comment,
		"mention":         p.Mention,
		"issue_completed": p.IssueCompleted,
	})
}

// UpdateNotificationPreferencesRequest is the body for PUT /api/users/me/notification-preferences/
type UpdateNotificationPreferencesRequest struct {
	PropertyChange *bool `json:"property_change"`
	StateChange    *bool `json:"state_change"`
	Comment        *bool `json:"comment"`
	Mention        *bool `json:"mention"`
	IssueCompleted *bool `json:"issue_completed"`
}

// UpdateNotificationPreferences updates account-level notification preferences.
// PUT /api/users/me/notification-preferences/
func (h *AuthHandler) UpdateNotificationPreferences(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	if h.NotifPrefs == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Not configured"})
		return
	}
	var req UpdateNotificationPreferencesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	p, err := h.NotifPrefs.GetGlobal(c.Request.Context(), user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load preferences"})
		return
	}
	if p == nil {
		p = &model.UserNotificationPreference{UserID: user.ID}
		p.PropertyChange = true
		p.StateChange = true
		p.Comment = true
		p.Mention = true
		p.IssueCompleted = true
	}
	if req.PropertyChange != nil {
		p.PropertyChange = *req.PropertyChange
	}
	if req.StateChange != nil {
		p.StateChange = *req.StateChange
	}
	if req.Comment != nil {
		p.Comment = *req.Comment
	}
	if req.Mention != nil {
		p.Mention = *req.Mention
	}
	if req.IssueCompleted != nil {
		p.IssueCompleted = *req.IssueCompleted
	}
	if err := h.NotifPrefs.UpsertGlobal(c.Request.Context(), p); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save preferences"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"property_change": p.PropertyChange,
		"state_change":    p.StateChange,
		"comment":         p.Comment,
		"mention":         p.Mention,
		"issue_completed": p.IssueCompleted,
	})
}

// ListTokens returns the current user's API tokens (without secret values).
// GET /api/users/me/tokens/
func (h *AuthHandler) ListTokens(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	if h.ApiTokens == nil {
		c.JSON(http.StatusOK, gin.H{"tokens": []gin.H{}})
		return
	}
	list, err := h.ApiTokens.ListByUserID(c.Request.Context(), user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list tokens"})
		return
	}
	out := make([]gin.H, 0, len(list))
	for _, t := range list {
		out = append(out, gin.H{
			"id":          t.ID.String(),
			"label":       t.Label,
			"description": t.Description,
			"is_active":   t.IsActive,
			"last_used":   t.LastUsed,
			"expired_at":  t.ExpiredAt,
			"created_at":  t.CreatedAt,
		})
	}
	c.JSON(http.StatusOK, gin.H{"tokens": out})
}

// CreateTokenRequest is the body for POST /api/users/me/tokens/
type CreateTokenRequest struct {
	Label       string  `json:"label" binding:"required"`
	Description string  `json:"description"`
	ExpiresIn   *string `json:"expires_in"`
	ExpiredAt   *string `json:"expired_at"`
}

// CreateToken creates a new API token and returns it once (including secret).
// POST /api/users/me/tokens/
func (h *AuthHandler) CreateToken(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	if h.ApiTokens == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Not configured"})
		return
	}
	var req CreateTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	var expiredAt *time.Time
	if req.ExpiredAt != nil && *req.ExpiredAt != "" {
		t, err := time.Parse(time.RFC3339, *req.ExpiredAt)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid expired_at value", "detail": err.Error()})
			return
		}
		expiredAt = &t
	} else if req.ExpiresIn != nil && *req.ExpiresIn != "" {
		expiredAt = parseExpiresIn(*req.ExpiresIn)
		if expiredAt == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid expires_in value; use 7d, 30d, 90d, 365d, or 1 week, 1 month, 3 months, 1 year"})
			return
		}
	}
	plain, err := h.ApiTokens.Create(c.Request.Context(), user.ID, req.Label, req.Description, expiredAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create token"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{
		"token":       plain,
		"label":       req.Label,
		"description": req.Description,
		"expired_at":  expiredAt,
		"message":     "Copy this token now; it will not be shown again.",
	})
}

func parseExpiresIn(s string) *time.Time {
	now := time.Now().UTC()
	var d time.Duration
	switch s {
	case "7d", "1 week", "1week":
		d = 7 * 24 * time.Hour
	case "30d", "1 month", "1month":
		d = 30 * 24 * time.Hour
	case "90d", "3 months", "3months":
		d = 90 * 24 * time.Hour
	case "365d", "1 year", "1year":
		d = 365 * 24 * time.Hour
	default:
		return nil
	}
	t := now.Add(d)
	return &t
}

// RevokeToken deletes an API token.
// DELETE /api/users/me/tokens/:id/
func (h *AuthHandler) RevokeToken(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	if h.ApiTokens == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Not configured"})
		return
	}
	tokenID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid token id"})
		return
	}
	if err := h.ApiTokens.Delete(c.Request.Context(), tokenID, user.ID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Token not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to revoke token"})
		return
	}
	c.Status(http.StatusNoContent)
}

// InstanceAuthConfig returns public auth configuration (no auth required).
// GET /auth/config/
func (h *AuthHandler) InstanceAuthConfig(c *gin.Context) {
	isPasswordEnabled := true
	isMagicCodeEnabled := true
	enableSignup := true
	isSmtpConfigured := false
	ctx := c.Request.Context()
	googleAllowed := false
	githubAllowed := false
	gitlabAllowed := false
	if h.Settings != nil {
		row, _ := h.Settings.Get(ctx, "auth")
		if row != nil {
			isPasswordEnabled = authBool(row.Value, "password", true)
			isMagicCodeEnabled = authBool(row.Value, "magic_code", true)
			enableSignup = authBool(row.Value, "allow_public_signup", true)
			googleAllowed = authBool(row.Value, "google", false)
			githubAllowed = authBool(row.Value, "github", false)
			gitlabAllowed = authBool(row.Value, "gitlab", false)
		}
		emailRow, _ := h.Settings.Get(ctx, "email")
		if emailRow != nil && emailRow.Value != nil {
			host, _ := emailRow.Value["host"].(string)
			isSmtpConfigured = strings.TrimSpace(host) != ""
		}
	}
	isGoogleEnabled := googleAllowed && oauthGoogleCredentialsReady(ctx, h.Settings)
	isGitHubEnabled := githubAllowed && oauthGitHubCredentialsReady(ctx, h.Settings)
	isGitLabEnabled := gitlabAllowed && oauthGitLabCredentialsReady(ctx, h.Settings)

	out := gin.H{
		"is_email_password_enabled":      isPasswordEnabled,
		"is_magic_code_enabled":          isMagicCodeEnabled,
		"enable_signup":                  enableSignup,
		"is_smtp_configured":             isSmtpConfigured,
		"is_google_enabled":              isGoogleEnabled,
		"is_github_enabled":              isGitHubEnabled,
		"is_gitlab_enabled":              isGitLabEnabled,
		"is_workspace_creation_disabled": isWorkspaceCreationRestricted(ctx, h.Settings),
	}
	out["oauth_redirect_base"] = requestCallbackBase(c)
	if s := strings.TrimSpace(h.AppBaseURL); s != "" {
		out["oauth_js_origin"] = strings.TrimSuffix(s, "/")
	}
	c.JSON(http.StatusOK, out)
}

// EmailCheck checks whether an email is already registered.
// POST /auth/email-check/
func (h *AuthHandler) EmailCheck(c *gin.Context) {
	var body struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	exists, err := h.Auth.EmailCheck(c.Request.Context(), body.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Check failed"})
		return
	}
	allowPublicSignup := true
	if h.Settings != nil {
		row, _ := h.Settings.Get(c.Request.Context(), "auth")
		if row != nil {
			allowPublicSignup = authBool(row.Value, "allow_public_signup", true)
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"existing":            exists,
		"status":              "CREDENTIAL",
		"allow_public_signup": allowPublicSignup,
	})
}

// ForgotPassword initiates a password reset flow by sending an email.
// POST /auth/forgot-password/
func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var body struct {
		Email string `json:"email" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	ctx := c.Request.Context()
	if h.Settings != nil {
		row, _ := h.Settings.Get(ctx, "auth")
		if row != nil && !authBool(row.Value, "password", true) {
			c.JSON(http.StatusOK, gin.H{"message": "If an account exists for that email, a reset link has been sent."})
			return
		}
	}
	body.Email = strings.TrimSpace(body.Email)
	addr, err := mail.ParseAddress(body.Email)
	if err != nil || addr.Address == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	body.Email = strings.ToLower(addr.Address)
	token, err := h.Auth.ForgotPassword(ctx, body.Email)
	if err != nil {
		h.log().Error("forgot password error", "error", err)
	}
	if token != "" && h.Queue != nil && h.AppBaseURL != "" {
		resetLink := strings.TrimSuffix(h.AppBaseURL, "/") + "/reset-password?token=" + token
		subject := "Reset your Devlane password"
		bodyText := fmt.Sprintf(
			"You requested a password reset.\n\nClick the link below to reset your password:\n%s\n\nThis link expires in 30 minutes. If you did not request a reset, ignore this email.\n",
			resetLink,
		)
		_ = h.Queue.PublishSendEmail(ctx, queue.SendEmailPayload{
			To:      body.Email,
			Subject: subject,
			Body:    bodyText,
			Kind:    "forgot_password",
			Extra:   map[string]string{"reset_link": resetLink},
		})
	}
	c.JSON(http.StatusOK, gin.H{"message": "If an account exists for that email, a reset link has been sent."})
}

// ResetPassword validates a reset token and sets a new password.
// POST /auth/reset-password/
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var body struct {
		Token       string `json:"token" binding:"required"`
		NewPassword string `json:"new_password" binding:"required,min=8"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	ctx := c.Request.Context()
	if h.Settings != nil {
		row, _ := h.Settings.Get(ctx, "auth")
		if row != nil && !authBool(row.Value, "password", true) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Password sign-in is disabled; password reset is not available."})
			return
		}
	}
	if err := h.Auth.ResetPassword(ctx, body.Token, body.NewPassword); err != nil {
		if errors.Is(err, auth.ErrPasswordTooWeak) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Password must contain at least 8 characters, one uppercase, one lowercase, one digit, and one special character."})
			return
		}
		if errors.Is(err, auth.ErrResetTokenInvalid) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired reset token"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset password"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Password has been reset successfully."})
}

// MagicCodeRequest sends a one-time login code to the email when magic-code auth is enabled.
// POST /auth/magic-code/request/
func (h *AuthHandler) MagicCodeRequest(c *gin.Context) {
	var body struct {
		Email       string `json:"email" binding:"required,email"`
		InviteToken string `json:"invite_token"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	ctx := c.Request.Context()
	magicEnabled := true
	allowPublicSignup := true
	isSmtpConfigured := false
	if h.Settings != nil {
		row, _ := h.Settings.Get(ctx, "auth")
		if row != nil {
			magicEnabled = authBool(row.Value, "magic_code", true)
			allowPublicSignup = authBool(row.Value, "allow_public_signup", true)
		}
		emailRow, _ := h.Settings.Get(ctx, "email")
		if emailRow != nil && emailRow.Value != nil {
			host, _ := emailRow.Value["host"].(string)
			isSmtpConfigured = strings.TrimSpace(host) != ""
		}
	}
	if !magicEnabled {
		c.JSON(http.StatusForbidden, gin.H{"error": "Email code sign-in is disabled"})
		return
	}
	if !isSmtpConfigured {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Outbound email is not configured. Set SMTP (host) in Instance admin → Email."})
		return
	}
	if h.Queue == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Email queue unavailable. Start RabbitMQ and check RABBITMQ_URL (API logs show connection errors)."})
		return
	}
	if h.Redis == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Login codes unavailable. Redis is required; check REDIS_ADDR and API logs."})
		return
	}

	exists, err := h.Auth.EmailCheck(ctx, body.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Check failed"})
		return
	}

	var inv *model.WorkspaceMemberInvite
	if !exists {
		if !allowPublicSignup {
			if strings.TrimSpace(body.InviteToken) == "" {
				c.JSON(http.StatusForbidden, gin.H{"error": "Sign-up is by invite only. Use the link from your invitation email."})
				return
			}
			if h.Winv == nil {
				c.JSON(http.StatusForbidden, gin.H{"error": "Sign-up is by invite only. Use the link from your invitation email."})
				return
			}
			var ierr error
			inv, ierr = h.Winv.GetByToken(ctx, strings.TrimSpace(body.InviteToken))
			if ierr != nil || inv == nil {
				c.JSON(http.StatusForbidden, gin.H{"error": "Invalid or expired invite. Use the link from your invitation email."})
				return
			}
			emailNorm := strings.TrimSpace(strings.ToLower(body.Email))
			invEmailNorm := strings.TrimSpace(strings.ToLower(inv.Email))
			if emailNorm != invEmailNorm {
				c.JSON(http.StatusForbidden, gin.H{"error": "Sign-up email must match the invited email address."})
				return
			}
		}
	}
	_ = inv // invite validated when needed; stored in Redis for verify

	code, err := randomSixDigitLoginCode()
	if err != nil {
		h.log().Error("magic code generate", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send code"})
		return
	}
	mac := auth.MagicCodeHMAC(h.MagicCodeSecret, body.Email, code)
	store := &redis.MagicCodeLoginData{
		CodeMAC:     mac,
		Attempts:    0,
		InviteToken: strings.TrimSpace(body.InviteToken),
		IsSignup:    !exists,
	}
	if err := h.Redis.SetMagicCodeLogin(ctx, body.Email, store, redis.MagicCodeLoginTTL); err != nil {
		h.log().Error("magic code redis set", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send code"})
		return
	}

	subject := "Your Devlane sign-in code"
	bodyText := fmt.Sprintf(
		"Your Devlane sign-in code is: %s\n\nThis code expires in 10 minutes. If you did not request it, you can ignore this email.\n",
		code,
	)
	if err := h.Queue.PublishSendEmail(ctx, queue.SendEmailPayload{
		To:      body.Email,
		Subject: subject,
		Body:    bodyText,
		Kind:    "magic_code_login",
		Extra:   map[string]string{"email": body.Email},
	}); err != nil {
		h.log().Error("magic code enqueue email", "error", err)
		_ = h.Redis.DeleteMagicCodeLogin(ctx, body.Email)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send code"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "If that email can receive mail, a sign-in code has been sent."})
}

// MagicCodeVerify checks the code and creates a session (sign-in or sign-up).
// POST /auth/magic-code/verify/
func (h *AuthHandler) MagicCodeVerify(c *gin.Context) {
	var body struct {
		Email       string `json:"email" binding:"required,email"`
		Code        string `json:"code" binding:"required"`
		FirstName   string `json:"first_name"`
		LastName    string `json:"last_name"`
		InviteToken string `json:"invite_token"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	ctx := c.Request.Context()
	magicEnabled := true
	if h.Settings != nil {
		row, _ := h.Settings.Get(ctx, "auth")
		if row != nil {
			magicEnabled = authBool(row.Value, "magic_code", true)
		}
	}
	if !magicEnabled {
		c.JSON(http.StatusForbidden, gin.H{"error": "Email code sign-in is disabled"})
		return
	}
	if h.Redis == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Login codes are temporarily unavailable"})
		return
	}

	stored, err := h.Redis.GetMagicCodeLogin(ctx, body.Email)
	if err != nil {
		h.log().Error("magic code redis get", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Verification failed"})
		return
	}
	if stored == nil || stored.CodeMAC == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired code"})
		return
	}

	tryMAC := auth.MagicCodeHMAC(h.MagicCodeSecret, body.Email, body.Code)
	if subtle.ConstantTimeCompare([]byte(stored.CodeMAC), []byte(tryMAC)) != 1 {
		_ = h.Redis.BumpMagicCodeLoginFailedAttempt(ctx, body.Email)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired code"})
		return
	}

	if st := strings.TrimSpace(stored.InviteToken); st != "" && strings.TrimSpace(body.InviteToken) != "" &&
		st != strings.TrimSpace(body.InviteToken) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired code"})
		return
	}

	_ = h.Redis.DeleteMagicCodeLogin(ctx, body.Email)

	if stored.IsSignup {
		sessionKey, user, err := h.Auth.SignUpMagic(ctx, body.Email, body.FirstName, body.LastName)
		if err != nil {
			if errors.Is(err, auth.ErrEmailTaken) {
				sessionKey2, user2, err2 := h.Auth.SessionForEmailUser(ctx, body.Email)
				if err2 != nil {
					c.JSON(http.StatusConflict, gin.H{"error": "An account with this email already exists"})
					return
				}
				setSessionCookie(c, sessionKey2)
				c.JSON(http.StatusOK, userResponse(user2))
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Sign up failed"})
			return
		}
		postSignUpWorkflow(ctx, h.postSignUpDeps(), user)
		setSessionCookie(c, sessionKey)
		c.JSON(http.StatusCreated, userResponse(user))
		return
	}

	sessionKey, user, err := h.Auth.SessionForEmailUser(ctx, body.Email)
	if err != nil {
		if errors.Is(err, auth.ErrUserDeactivated) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Your account has been deactivated. Please contact the administrator.", "error_code": "USER_ACCOUNT_DEACTIVATED"})
			return
		}
		if errors.Is(err, auth.ErrInvalidCredentials) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired code"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Sign in failed"})
		return
	}
	setSessionCookie(c, sessionKey)
	c.JSON(http.StatusOK, userResponse(user))
}

func randomSixDigitLoginCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func isSecureRequest(c *gin.Context) bool {
	if c.Request.TLS != nil {
		return true
	}
	return strings.EqualFold(c.GetHeader("X-Forwarded-Proto"), "https")
}

func setSessionCookie(c *gin.Context, sessionKey string) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     middleware.SessionCookieName,
		Value:    sessionKey,
		Path:     "/",
		MaxAge:   14 * 24 * 3600,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   isSecureRequest(c),
	})
}

func clearSessionCookie(c *gin.Context) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     middleware.SessionCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   isSecureRequest(c),
	})
}

var autoSlugRe = regexp.MustCompile(`[^a-z0-9-]+`)

// postSignUpWorkflow mirrors Plane's post_user_auth_workflow: auto-accepts all
// pending workspace invites for the user's email, creates a default workspace
// when the user ends up with none and workspace creation is allowed, and marks
// is_onboarded. All failures are logged but never block the sign-up.
func postSignUpWorkflow(ctx context.Context, deps postSignUpDeps, u *model.User) {
	if u == nil {
		return
	}

	// 1. Auto-accept every pending workspace invite for this email.
	if deps.Invites != nil && u.Email != nil {
		invites, _ := deps.Invites.ListPendingByEmail(ctx, strings.TrimSpace(strings.ToLower(*u.Email)))
		now := time.Now()
		for i := range invites {
			invites[i].Accepted = true
			invites[i].RespondedAt = &now
			_ = deps.Invites.Update(ctx, &invites[i])
			if deps.Workspaces != nil {
				_ = deps.Workspaces.AddMember(ctx, &model.WorkspaceMember{
					WorkspaceID: invites[i].WorkspaceID,
					MemberID:    u.ID,
					Role:        invites[i].Role,
				})
			}
		}
	}

	// 2. If user still has no workspaces and workspace creation is allowed,
	//    create a personal default workspace.
	if deps.Workspaces != nil {
		list, _ := deps.Workspaces.ListByMemberID(ctx, u.ID)
		if len(list) == 0 && !isWorkspaceCreationRestricted(ctx, deps.Settings) {
			createDefaultWorkspace(ctx, deps, u)
		}
	}

	// 3. Mark user as onboarded.
	if deps.Auth != nil && !u.IsOnboarded {
		u.IsOnboarded = true
		if err := deps.Auth.UpdateUser(ctx, u); err != nil {
			deps.log().Warn("failed to set is_onboarded", "user_id", u.ID, "error", err)
		}
	}
}

func createDefaultWorkspace(ctx context.Context, deps postSignUpDeps, u *model.User) {
	displayName := strings.TrimSpace(u.DisplayName)
	if displayName == "" {
		displayName = strings.TrimSpace(u.FirstName)
	}
	if displayName == "" && u.Email != nil {
		displayName = strings.Split(*u.Email, "@")[0]
	}

	wsName := displayName + "'s Workspace"
	slug := strings.Trim(autoSlugRe.ReplaceAllString(strings.ToLower(displayName), "-"), "-")
	if slug == "" {
		slug = "workspace"
	}

	exists, _ := deps.Workspaces.SlugExists(ctx, slug, uuid.Nil)
	if exists {
		slug = slug + "-" + fmt.Sprintf("%x%x", u.ID[0], u.ID[1])
	}

	w := &model.Workspace{
		Name:        wsName,
		Slug:        slug,
		OwnerID:     u.ID,
		CreatedByID: &u.ID,
	}
	if err := deps.Workspaces.Create(ctx, w); err != nil {
		deps.log().Warn("auto-create workspace failed", "user_id", u.ID, "error", err)
		return
	}
	m := &model.WorkspaceMember{WorkspaceID: w.ID, MemberID: u.ID, Role: 20}
	if err := deps.Workspaces.AddMember(ctx, m); err != nil {
		deps.log().Warn("auto-add workspace member failed", "user_id", u.ID, "error", err)
	}
}

func isWorkspaceCreationRestricted(ctx context.Context, settings *store.InstanceSettingStore) bool {
	if settings == nil {
		return false
	}
	row, _ := settings.Get(ctx, "general")
	if row == nil {
		return false
	}
	if v, ok := row.Value["only_admin_can_create_workspace"]; ok {
		if b, ok := v.(bool); ok {
			return b
		}
	}
	return false
}

type postSignUpDeps struct {
	Auth       *auth.Service
	Invites    *store.WorkspaceInviteStore
	Workspaces *store.WorkspaceStore
	Settings   *store.InstanceSettingStore
	Logger     *slog.Logger
}

func (d postSignUpDeps) log() *slog.Logger {
	if d.Logger != nil {
		return d.Logger
	}
	return slog.Default()
}

func (h *AuthHandler) postSignUpDeps() postSignUpDeps {
	return postSignUpDeps{
		Auth:       h.Auth,
		Invites:    h.Winv,
		Workspaces: h.Ws,
		Settings:   h.Settings,
		Logger:     h.Log,
	}
}

// SetPassword lets OAuth/magic-code users set their first password.
// POST /auth/set-password/
func (h *AuthHandler) SetPassword(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	var body struct {
		Password string `json:"password" binding:"required,min=8"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	if err := h.Auth.SetPassword(c.Request.Context(), user.ID, body.Password); err != nil {
		if errors.Is(err, auth.ErrPasswordTooWeak) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Password must contain at least 8 characters, one uppercase, one lowercase, one digit, and one special character."})
			return
		}
		if errors.Is(err, auth.ErrPasswordAlreadySet) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Password is already set. Use change-password instead."})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set password"})
		return
	}
	user.IsPasswordAutoset = false
	c.JSON(http.StatusOK, userResponse(user))
}

func userResponse(u *model.User) gin.H {
	if u == nil {
		return gin.H{}
	}
	return gin.H{
		"id":                  u.ID.String(),
		"email":               u.Email,
		"username":            u.Username,
		"first_name":          u.FirstName,
		"last_name":           u.LastName,
		"display_name":        u.DisplayName,
		"avatar":              u.Avatar,
		"cover_image":         u.CoverImage,
		"is_active":           u.IsActive,
		"is_onboarded":        u.IsOnboarded,
		"is_password_autoset": u.IsPasswordAutoset,
		"date_joined":         u.DateJoined,
		"created_at":          u.CreatedAt,
		"updated_at":          u.UpdatedAt,
		"user_timezone":       u.UserTimezone,
	}
}
