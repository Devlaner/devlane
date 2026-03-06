package middleware

import (
	"log/slog"
	"net/http"

	"github.com/Devlaner/devlane/api/internal/auth"
	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/gin-gonic/gin"
)

const (
	SessionCookieName = "session_id"
	UserContextKey    = "user"
)

// RequireAuth loads the user from session and returns 401 if not authenticated.
func RequireAuth(authSvc *auth.Service, log *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		sessionKey, _ := c.Cookie(SessionCookieName)
		if sessionKey == "" {
			// Also check Authorization header for Bearer (session key) for API clients
			if authHeader := c.GetHeader("Authorization"); len(authHeader) > 7 && authHeader[:7] == "Bearer " {
				sessionKey = authHeader[7:]
			}
		}
		user, err := authSvc.UserFromSession(c.Request.Context(), sessionKey)
		if err != nil || user == nil {
			if log != nil {
				log.Debug("auth required", "error", err, "has_cookie", sessionKey != "")
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
