package handler

import (
	"encoding/csv"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/model"
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

func sanitizeFilename(s string) string {
	r := strings.NewReplacer("\"", "", "\n", "", "\r", "")
	return r.Replace(s)
}

func parseParamUUID(c *gin.Context, key string) (uuid.UUID, bool) {
	val := c.Param(key)
	if val == "" {
		val = c.Param("projectID")
	}
	if val == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing ID parameter"})
		return uuid.Nil, false
	}
	parsed, err := uuid.Parse(val)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project ID"})
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

	res, err := h.AnalyticsService.GetWorkspaceAnalytics(c.Request.Context(), slug, user.ID)
	if err != nil {
		if errors.Is(err, service.ErrWorkspaceForbidden) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
			return
		}
		if errors.Is(err, service.ErrWorkspaceNotFound) {
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
	projectID, ok := parseParamUUID(c, "projectId")
	if !ok {
		return
	}

	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	res, err := h.AnalyticsService.GetProjectAnalytics(c.Request.Context(), projectID, user.ID)
	if err != nil {
		if errors.Is(err, service.ErrProjectForbidden) || errors.Is(err, service.ErrWorkspaceForbidden) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
			return
		}
		if errors.Is(err, service.ErrProjectNotFound) || errors.Is(err, service.ErrWorkspaceNotFound) {
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

	writer := csv.NewWriter(c.Writer)
	headerWritten := false

	err := h.AnalyticsService.ExportWorkspaceCSV(c.Request.Context(), slug, user.ID, func(issue model.WorkspaceIssueExport) error {
		if !headerWritten {
			safeSlug := sanitizeFilename(slug)
			filename := fmt.Sprintf("workspace-%s-analytics-%s.csv", safeSlug, time.Now().Format("2006-01-02"))
			c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
			c.Header("Content-Type", "text/csv")

			if err := writer.Write([]string{"Issue ID", "Title", "State", "Priority"}); err != nil {
				return err
			}
			headerWritten = true
		}

		if err := writer.Write([]string{
			issue.ID,
			sanitizeCSVField(issue.Name),
			sanitizeCSVField(issue.State),
			sanitizeCSVField(issue.Priority),
		}); err != nil {
			return err
		}

		writer.Flush()
		return writer.Error()
	})

	if err != nil {
		if !headerWritten {
			if errors.Is(err, service.ErrWorkspaceForbidden) {
				c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
				return
			}
			if errors.Is(err, service.ErrWorkspaceNotFound) {
				c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch workspace data"})
		}
		h.Log.Error("failed to stream workspace CSV export", "error", err, "slug", slug)
	}
}

func (h *AnalyticsHandler) ExportProjectCSV(c *gin.Context) {
	projectID, ok := parseParamUUID(c, "projectId")
	if !ok {
		return
	}

	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	writer := csv.NewWriter(c.Writer)
	headerWritten := false

	err := h.AnalyticsService.ExportProjectCSV(c.Request.Context(), projectID, user.ID, func(issue model.ProjectIssueExport) error {
		if !headerWritten {
			filename := fmt.Sprintf("project-%s-analytics-%s.csv", projectID, time.Now().Format("2006-01-02"))
			c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
			c.Header("Content-Type", "text/csv")

			if err := writer.Write([]string{"Project Issue ID", "Title", "State"}); err != nil {
				return err
			}
			headerWritten = true
		}

		if err := writer.Write([]string{
			issue.ID,
			sanitizeCSVField(issue.Name),
			sanitizeCSVField(issue.State),
		}); err != nil {
			return err
		}

		writer.Flush()
		return writer.Error()
	})

	if err != nil {
		if !headerWritten {
			if errors.Is(err, service.ErrProjectForbidden) || errors.Is(err, service.ErrWorkspaceForbidden) {
				c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
				return
			}
			if errors.Is(err, service.ErrProjectNotFound) || errors.Is(err, service.ErrWorkspaceNotFound) {
				c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch project data"})
		}
		h.Log.Error("failed to stream project CSV export", "error", err, "project_id", projectID)
	}
}
