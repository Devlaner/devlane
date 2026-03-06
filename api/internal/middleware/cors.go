package middleware

import (
	"github.com/gin-gonic/gin"
)

// CORS returns a handler that sets CORS headers and responds to OPTIONS preflight.
// allowOrigin is the value for Access-Control-Allow-Origin (e.g. "http://localhost:5173").
// If allowOrigin is empty, the middleware is a no-op.
func CORS(allowOrigin string) gin.HandlerFunc {
	if allowOrigin == "" {
		return func(c *gin.Context) { c.Next() }
	}
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", allowOrigin)
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Header("Access-Control-Max-Age", "86400")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}
