package middleware

import (
	"log/slog"
	"net/http"
	"strings"

	"github.com/Devlaner/devlane/api/internal/auth"
	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/gin-gonic/gin"
)

const (
	SessionCookieName = "session_id"
	UserContextKey    = "user"
)

// SessionKeyFromCookieOrBearer returns the session id from the session cookie or Authorization: Bearer.
// Must stay in sync with how authenticated clients send the session (including OAuth SPA fragment flow).
func SessionKeyFromCookieOrBearer(c *gin.Context) string {
	sessionKey, _ := c.Cookie(SessionCookieName)
	if sessionKey == "" {
		if authHeader := c.GetHeader("Authorization"); len(authHeader) > 7 && strings.EqualFold(authHeader[:7], "bearer ") {
			sessionKey = strings.TrimSpace(authHeader[7:])
		}
	}
	return sessionKey
}

// RequireAuth loads the user from session and returns 401 if not authenticated.
func RequireAuth(authSvc *auth.Service, log *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		sessionKey := SessionKeyFromCookieOrBearer(c)
		user, err := authSvc.UserFromSession(c.Request.Context(), sessionKey)
		if err != nil || user == nil {
			if log != nil {
				log.Debug("auth required", "error", err, "has_session_key", sessionKey != "")
			}
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			return
		}
		c.Set(UserContextKey, user)
		c.Next()
	}
}

// GetUser returns the authenticated user from context (must be used after RequireAuth).
func GetUser(c *gin.Context) *model.User {
	v, ok := c.Get(UserContextKey)
	if !ok {
		return nil
	}
	u, _ := v.(*model.User)
	return u
}
