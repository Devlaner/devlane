package handler

import (
	"encoding/csv"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AnalyticsHandler struct {
	AnalyticsService *service.AnalyticsService
	Log              *slog.Logger
}

func sanitizeCSVField(v string) string {
	if v == "" {
		return v
	}
	switch v[0] {
	case '=', '+', '-', '@', '\t', '\r':
		return "'" + v
	default:
		return v
	}
}

func parseParamUUID(c *gin.Context, key string) (uuid.UUID, bool) {
	val := c.Param(key)
	if val == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing ID parameter"})
		return uuid.Nil, false
	}
	parsed, err := uuid.Parse(val)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid UUID parameter"})
		return uuid.Nil, false
	}
	return parsed, true
}

func (h *AnalyticsHandler) GetWorkspaceAnalytics(c *gin.Context) {
	slug := c.Param("slug")
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	res, err := h.AnalyticsService.GetWorkspaceAnalytics(c.Request.Context(), user.ID, slug)
	if err != nil {
		if errors.Is(err, service.ErrAnalyticsForbidden) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
			return
		}
		if errors.Is(err, service.ErrAnalyticsNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
			return
		}
		h.Log.Error("failed to fetch workspace analytics", "error", err, "slug", slug)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	c.JSON(http.StatusOK, res)
}

func (h *AnalyticsHandler) GetProjectAnalytics(c *gin.Context) {
	projectParam := c.Param("projectId")
	if projectParam == "" {
		projectParam = c.Param("projectID")
	}
	projectID, err := uuid.Parse(projectParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project ID"})
		return
	}

	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	res, err := h.AnalyticsService.GetProjectAnalytics(c.Request.Context(), user.ID, projectID)
	if err != nil {
		if errors.Is(err, service.ErrAnalyticsForbidden) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
			return
		}
		if errors.Is(err, service.ErrAnalyticsNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
			return
		}
		h.Log.Error("failed to fetch project analytics", "error", err, "project_id", projectID)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	c.JSON(http.StatusOK, res)
}

func (h *AnalyticsHandler) ExportWorkspaceCSV(c *gin.Context) {
	slug := c.Param("slug")
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	issues, err := h.AnalyticsService.ExportWorkspaceCSV(c.Request.Context(), user.ID, slug)
	if err != nil {
		if errors.Is(err, service.ErrAnalyticsForbidden) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
			return
		}
		if errors.Is(err, service.ErrAnalyticsNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
			return
		}
		h.Log.Error("failed to fetch workspace issues for CSV export", "error", err, "slug", slug)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch workspace data"})
		return
	}

	safeSlug := strings.ReplaceAll(slug, `"`, "")
	filename := fmt.Sprintf("workspace-%s-analytics-%s.csv", safeSlug, time.Now().Format("2006-01-02"))
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	c.Header("Content-Type", "text/csv")

	writer := csv.NewWriter(c.Writer)
	_ = writer.Write([]string{"Issue ID", "Title", "State", "Priority"})

	for _, issue := range issues {
		_ = writer.Write([]string{
			issue.ID,
			sanitizeCSVField(issue.Name),
			sanitizeCSVField(issue.State),
			sanitizeCSVField(issue.Priority),
		})
	}
	writer.Flush()
}

func (h *AnalyticsHandler) ExportProjectCSV(c *gin.Context) {
	projectParam := c.Param("projectId")
	if projectParam == "" {
		projectParam = c.Param("projectID")
	}
	projectID, err := uuid.Parse(projectParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project ID"})
		return
	}

	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	issues, err := h.AnalyticsService.ExportProjectCSV(c.Request.Context(), user.ID, projectID)
	if err != nil {
		if errors.Is(err, service.ErrAnalyticsForbidden) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
			return
		}
		if errors.Is(err, service.ErrAnalyticsNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
			return
		}
		h.Log.Error("failed to fetch project issues for CSV export", "error", err, "project_id", projectID)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch project data"})
		return
	}

	filename := fmt.Sprintf("project-%s-analytics-%s.csv", projectID, time.Now().Format("2006-01-02"))
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	c.Header("Content-Type", "text/csv")

	writer := csv.NewWriter(c.Writer)
	_ = writer.Write([]string{"Project Issue ID", "Title", "State"})

	for _, issue := range issues {
		_ = writer.Write([]string{
			issue.ID,
			sanitizeCSVField(issue.Name),
			sanitizeCSVField(issue.State),
		})
	}
	writer.Flush()
}
