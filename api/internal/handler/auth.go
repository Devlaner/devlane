// Package handler implements HTTP handlers for the API.
package handler

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/Devlaner/devlane/api/internal/auth"
	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AuthHandler struct {
	Auth        *auth.Service
	Settings    *store.InstanceSettingStore
	Winv        *store.WorkspaceInviteStore
	Ws         *store.WorkspaceStore
	NotifPrefs  *store.UserNotificationPreferenceStore
	ApiTokens   *store.ApiTokenStore
}

type SignInRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type SignUpRequest struct {
	Email      string `json:"email" binding:"required,email"`
	Password   string `json:"password" binding:"required,min=8"`
	FirstName  string `json:"first_name"`
	LastName   string `json:"last_name"`
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
		if err == auth.ErrInvalidCredentials {
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
		if err == auth.ErrEmailTaken {
			c.JSON(http.StatusConflict, gin.H{"error": "Email already registered"})
			return
		}
		if err == auth.ErrUsernameTaken {
			c.JSON(http.StatusConflict, gin.H{"error": "Username already taken"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Sign up failed"})
		return
	}
	if inv != nil && h.Winv != nil && h.Ws != nil {
		now := time.Now()
		inv.Accepted = true
		inv.RespondedAt = &now
		_ = h.Winv.Update(ctx, inv)
		_ = h.Ws.AddMember(ctx, &model.WorkspaceMember{WorkspaceID: inv.WorkspaceID, MemberID: user.ID, Role: inv.Role})
	}
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
	FirstName    *string `json:"first_name"`
	LastName     *string `json:"last_name"`
	DisplayName  *string `json:"display_name"`
	UserTimezone *string `json:"user_timezone"`
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
		if err == auth.ErrInvalidCredentials {
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
			"property_change":  true,
			"state_change":     true,
			"comment":          true,
			"mention":          true,
			"issue_completed":  true,
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
			"property_change":  true,
			"state_change":     true,
			"comment":          true,
			"mention":          true,
			"issue_completed":  true,
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"property_change":  p.PropertyChange,
		"state_change":     p.StateChange,
		"comment":          p.Comment,
		"mention":          p.Mention,
		"issue_completed":  p.IssueCompleted,
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
	p, _ := h.NotifPrefs.GetGlobal(c.Request.Context(), user.ID)
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
	ExpiresIn   *string `json:"expires_in"` // e.g. "7d", "30d", "90d", "365d", or empty for never
	ExpiredAt   *string `json:"expired_at"` // ISO date for custom expiry
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
		if err == nil {
			expiredAt = &t
		}
	} else if req.ExpiresIn != nil && *req.ExpiresIn != "" {
		expiredAt = parseExpiresIn(*req.ExpiresIn)
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

func setSessionCookie(c *gin.Context, sessionKey string) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     middleware.SessionCookieName,
		Value:    sessionKey,
		Path:     "/",
		MaxAge:   14 * 24 * 3600,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   false,
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
	})
}

func userResponse(u *model.User) gin.H {
	if u == nil {
		return gin.H{}
	}
	return gin.H{
		"id":            u.ID.String(),
		"email":         u.Email,
		"username":      u.Username,
		"first_name":    u.FirstName,
		"last_name":     u.LastName,
		"display_name":  u.DisplayName,
		"avatar":        u.Avatar,
		"is_active":     u.IsActive,
		"is_onboarded":  u.IsOnboarded,
		"date_joined":   u.DateJoined,
		"created_at":    u.CreatedAt,
		"updated_at":    u.UpdatedAt,
		"user_timezone": u.UserTimezone,
	}
}

