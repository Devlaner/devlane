package handler

import (
	"errors"
	"net/http"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// maxImportUpload caps the CSV upload size (10 MiB).
const maxImportUpload = 10 << 20

// ImporterHandler serves project bulk-import (CSV) creation + status.
type ImporterHandler struct {
	Importers *service.ImporterService
}

// Create accepts a multipart CSV upload and starts an import.
// POST /api/workspaces/:slug/projects/:projectId/importers/
func (h *ImporterHandler) Create(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	projectID, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}
	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "A CSV file is required (field 'file')"})
		return
	}
	if fileHeader.Size > maxImportUpload {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "The CSV file is too large"})
		return
	}
	f, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Could not read the uploaded file"})
		return
	}
	defer f.Close()

	im, err := h.Importers.CreateCSV(c.Request.Context(), c.Param("slug"), projectID, user.ID, fileHeader.Filename, f)
	if err != nil {
		h.importError(c, err)
		return
	}
	c.JSON(http.StatusCreated, im)
}

// List returns a project's imports.
// GET /api/workspaces/:slug/projects/:projectId/importers/
func (h *ImporterHandler) List(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	projectID, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}
	list, err := h.Importers.List(c.Request.Context(), c.Param("slug"), projectID, user.ID)
	if err != nil {
		h.importError(c, err)
		return
	}
	c.JSON(http.StatusOK, list)
}

// Get returns a single import's status.
// GET /api/workspaces/:slug/projects/:projectId/importers/:importerId/
func (h *ImporterHandler) Get(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	projectID, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}
	id, err := uuid.Parse(c.Param("importerId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid import ID"})
		return
	}
	im, err := h.Importers.Get(c.Request.Context(), c.Param("slug"), projectID, user.ID, id)
	if err != nil {
		h.importError(c, err)
		return
	}
	c.JSON(http.StatusOK, im)
}

func (h *ImporterHandler) importError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrImportForbidden):
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
	case errors.Is(err, service.ErrImportWorkspace), errors.Is(err, service.ErrImportNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
	case errors.Is(err, service.ErrImportBadFile), errors.Is(err, service.ErrImportNoName),
		errors.Is(err, service.ErrImportEmpty):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Import failed"})
	}
}
