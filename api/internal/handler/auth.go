// Package handler implements HTTP handlers for the API.
package handler

import (
	"net/http"
	"strings"
	"time"

	"github.com/Devlaner/devlane/api/internal/auth"
	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	Auth    *auth.Service
	Settings *store.InstanceSettingStore
	Winv    *store.WorkspaceInviteStore
	Ws      *store.WorkspaceStore
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
		"id":           u.ID.String(),
		"email":        u.Email,
		"username":     u.Username,
		"first_name":   u.FirstName,
		"last_name":    u.LastName,
		"display_name": u.DisplayName,
		"avatar":       u.Avatar,
		"is_active":    u.IsActive,
		"is_onboarded": u.IsOnboarded,
		"date_joined":  u.DateJoined,
		"created_at":   u.CreatedAt,
		"updated_at":   u.UpdatedAt,
	}
}

