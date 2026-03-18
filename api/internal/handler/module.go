package handler

import (
	"net/http"
	"time"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ModuleHandler serves modules for a project.
type ModuleHandler struct {
	Module *service.ModuleService
}

func parseOptionalDate(s string) *time.Time {
	if s == "" {
		return nil
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return nil
	}
	return &t
}

// List returns modules for the project.
// GET /api/workspaces/:slug/projects/:projectId/modules/
func (h *ModuleHandler) List(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	projectID, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}
	list, err := h.Module.List(c.Request.Context(), slug, projectID, user.ID)
	if err != nil {
		if err == service.ErrProjectForbidden || err == service.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list modules"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// Create creates a module.
// POST /api/workspaces/:slug/projects/:projectId/modules/
func (h *ModuleHandler) Create(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	projectID, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}
	var body struct {
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
		Status      string `json:"status"`
		StartDate   string `json:"start_date"`
		TargetDate  string `json:"target_date"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	mod, err := h.Module.Create(c.Request.Context(), slug, projectID, user.ID, body.Name, body.Description, body.Status, parseOptionalDate(body.StartDate), parseOptionalDate(body.TargetDate))
	if err != nil {
		if err == service.ErrProjectForbidden || err == service.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create module"})
		return
	}
	c.JSON(http.StatusCreated, mod)
}

// Get returns a module by id.
// GET /api/workspaces/:slug/projects/:projectId/modules/:moduleId/
func (h *ModuleHandler) Get(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	projectID, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}
	moduleID, err := uuid.Parse(c.Param("moduleId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid module ID"})
		return
	}
	mod, err := h.Module.Get(c.Request.Context(), slug, projectID, moduleID, user.ID)
	if err != nil {
		if err == service.ErrModuleNotFound || err == service.ErrProjectForbidden || err == service.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get module"})
		return
	}
	c.JSON(http.StatusOK, mod)
}

// Update updates a module.
// PATCH /api/workspaces/:slug/projects/:projectId/modules/:moduleId/
func (h *ModuleHandler) Update(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	projectID, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}
	moduleID, err := uuid.Parse(c.Param("moduleId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid module ID"})
		return
	}
	var body struct {
		Name        string  `json:"name"`
		Description string  `json:"description"`
		Status      string  `json:"status"`
		StartDate   string  `json:"start_date"`
		TargetDate  string  `json:"target_date"`
		LeadID      *string `json:"lead_id"`
	}
	_ = c.ShouldBindJSON(&body)
	var leadIDPtr *uuid.UUID
	if body.LeadID != nil {
		if *body.LeadID != "" {
			id, parseErr := uuid.Parse(*body.LeadID)
			if parseErr != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid lead_id", "detail": "must be a valid UUID"})
				return
			}
			leadIDPtr = &id
		}
	}
	mod, err := h.Module.Update(c.Request.Context(), slug, projectID, moduleID, user.ID, body.Name, body.Description, body.Status, parseOptionalDate(body.StartDate), parseOptionalDate(body.TargetDate), body.LeadID != nil, leadIDPtr)
	if err != nil {
		if err == service.ErrModuleNotFound || err == service.ErrProjectForbidden || err == service.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update module"})
		return
	}
	c.JSON(http.StatusOK, mod)
}

// Delete deletes a module.
// DELETE /api/workspaces/:slug/projects/:projectId/modules/:moduleId/
func (h *ModuleHandler) Delete(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	projectID, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}
	moduleID, err := uuid.Parse(c.Param("moduleId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid module ID"})
		return
	}
	if err := h.Module.Delete(c.Request.Context(), slug, projectID, moduleID, user.ID); err != nil {
		if err == service.ErrModuleNotFound || err == service.ErrProjectForbidden || err == service.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete module"})
		return
	}
	c.Status(http.StatusNoContent)
}

// ListIssues returns issue IDs linked to the module.
// GET /api/workspaces/:slug/projects/:projectId/modules/:moduleId/issues/
func (h *ModuleHandler) ListIssues(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	projectID, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}
	moduleID, err := uuid.Parse(c.Param("moduleId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid module ID"})
		return
	}
	ids, err := h.Module.ListModuleIssueIDs(c.Request.Context(), slug, projectID, moduleID, user.ID)
	if err != nil {
		if err == service.ErrModuleNotFound || err == service.ErrProjectForbidden || err == service.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list module issues"})
		return
	}
	c.JSON(http.StatusOK, ids)
}

// AddIssue links an issue to the module.
// POST /api/workspaces/:slug/projects/:projectId/modules/:moduleId/issues/
func (h *ModuleHandler) AddIssue(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	projectID, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}
	moduleID, err := uuid.Parse(c.Param("moduleId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid module ID"})
		return
	}
	var body struct {
		IssueID uuid.UUID `json:"issue_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	if err := h.Module.AddModuleIssue(c.Request.Context(), slug, projectID, moduleID, body.IssueID, user.ID); err != nil {
		if err == service.ErrModuleNotFound || err == service.ErrProjectForbidden || err == service.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to link module issue"})
		return
	}
	c.Status(http.StatusNoContent)
}

// RemoveIssue unlinks an issue from the module.
// DELETE /api/workspaces/:slug/projects/:projectId/modules/:moduleId/issues/:issueId/
func (h *ModuleHandler) RemoveIssue(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	projectID, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}
	moduleID, err := uuid.Parse(c.Param("moduleId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid module ID"})
		return
	}
	issueID, err := uuid.Parse(c.Param("issueId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid issue ID"})
		return
	}
	if err := h.Module.RemoveModuleIssue(c.Request.Context(), slug, projectID, moduleID, issueID, user.ID); err != nil {
		if err == service.ErrModuleNotFound || err == service.ErrProjectForbidden || err == service.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to unlink module issue"})
		return
	}
	c.Status(http.StatusNoContent)
}
