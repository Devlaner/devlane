package handler

import (
	"net/http"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const xlsxContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

// ExportHandler serves server-side issue exports.
type ExportHandler struct {
	Export *service.ExportService
}

// CreateExport generates an .xlsx of the selected projects' issues and streams
// it back, recording the request in the export history.
// POST /api/workspaces/:slug/exports/
func (h *ExportHandler) CreateExport(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	var body struct {
		ProjectIDs []string `json:"project_ids"`
		Name       string   `json:"name"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	projectIDs := make([]uuid.UUID, 0, len(body.ProjectIDs))
	for _, s := range body.ProjectIDs {
		id, err := uuid.Parse(s)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID: " + s})
			return
		}
		projectIDs = append(projectIDs, id)
	}
	filename, data, err := h.Export.ExportIssues(c.Request.Context(), slug, user.ID, projectIDs, body.Name)
	if err != nil {
		switch err {
		case service.ErrWorkspaceNotFound, service.ErrProjectNotFound:
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		case service.ErrWorkspaceForbidden:
			c.JSON(http.StatusForbidden, gin.H{"error": "Not a member of this workspace"})
		case service.ErrNoProjectsSelected:
			c.JSON(http.StatusBadRequest, gin.H{"error": "Select at least one project to export"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate export"})
		}
		return
	}
	c.Header("Content-Disposition", `attachment; filename="`+filename+`"`)
	c.Data(http.StatusOK, xlsxContentType, data)
}

// ListExports returns the workspace's export history.
// GET /api/workspaces/:slug/exports/
func (h *ExportHandler) ListExports(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	list, err := h.Export.ListHistory(c.Request.Context(), slug, user.ID)
	if err != nil {
		switch err {
		case service.ErrWorkspaceNotFound:
			c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
		case service.ErrWorkspaceForbidden:
			c.JSON(http.StatusForbidden, gin.H{"error": "Not a member of this workspace"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list exports"})
		}
		return
	}
	c.JSON(http.StatusOK, gin.H{"exports": list})
}
