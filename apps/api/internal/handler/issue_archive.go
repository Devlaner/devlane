package handler

import (
	"net/http"
	"strconv"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Archive marks a work item as archived (hidden from active lists).
// POST /api/workspaces/:slug/projects/:projectId/issues/:pk/archive/
func (h *IssueHandler) Archive(c *gin.Context) {
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
	iid, ok := issueID(c)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid issue ID"})
		return
	}
	if err := h.Issue.Archive(c.Request.Context(), slug, projectID, iid, user.ID); err != nil {
		if issueAccessNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to archive work item"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "archived"})
}

// Restore un-archives a work item.
// DELETE /api/workspaces/:slug/projects/:projectId/issues/:pk/archive/
func (h *IssueHandler) Restore(c *gin.Context) {
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
	iid, ok := issueID(c)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid issue ID"})
		return
	}
	if err := h.Issue.Restore(c.Request.Context(), slug, projectID, iid, user.ID); err != nil {
		if issueAccessNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to restore work item"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "restored"})
}

// Convert promotes a work item to an epic or demotes an epic to a work item.
// POST /api/workspaces/:slug/projects/:projectId/issues/:pk/convert/
func (h *IssueHandler) Convert(c *gin.Context) {
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
	iid, ok := issueID(c)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid issue ID"})
		return
	}
	var body struct {
		IsEpic *bool `json:"is_epic"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.IsEpic == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "is_epic is required"})
		return
	}
	issue, err := h.Issue.Convert(c.Request.Context(), slug, projectID, iid, user.ID, *body.IsEpic)
	if err != nil {
		if err == service.ErrEpicHasChildren {
			c.JSON(http.StatusConflict, gin.H{"error": "Move or remove the epic's work items before converting it back."})
			return
		}
		if issueAccessNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to convert work item"})
		return
	}
	c.JSON(http.StatusOK, issue)
}

// ListArchived returns archived work items for a project.
// GET /api/workspaces/:slug/projects/:projectId/archived-issues/
func (h *IssueHandler) ListArchived(c *gin.Context) {
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
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	list, err := h.Issue.ListArchived(c.Request.Context(), slug, projectID, user.ID, limit, offset)
	if err != nil {
		if issueAccessNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list archived work items"})
		return
	}
	c.JSON(http.StatusOK, list)
}
