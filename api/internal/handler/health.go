package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Health is the liveness probe.
// GET /health
func Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// Readiness is the readiness probe.
// GET /ready
func Readiness(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ready"})
}
