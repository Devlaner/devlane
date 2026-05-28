package handler

import (
	"net/http"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// IssueLinkHandler serves external URL links for issues and epics.
type IssueLinkHandler struct {
	Issue *service.IssueService
}

func (h *IssueLinkHandler) parseIssueContext(c *gin.Context) (slug string, projectID, issueID uuid.UUID, user *model.User, ok bool) {
	user = middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug = c.Param("slug")
	var err error
	if projectID, err = uuid.Parse(c.Param("projectId")); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}
	// Support both :pk (issue routes) and :epicId (epic routes).
	pkStr := c.Param("pk")
	if pkStr == "" {
		pkStr = c.Param("epicId")
	}
	if issueID, err = uuid.Parse(pkStr); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid issue ID"})
		return
	}
	ok = true
	return
}

// ListLinks returns links for the issue/epic.
// GET /api/workspaces/:slug/projects/:projectId/issues/:pk/issue-links/
// GET /api/workspaces/:slug/projects/:projectId/epics/:pk/links/
func (h *IssueLinkHandler) ListLinks(c *gin.Context) {
	slug, projectID, issueID, user, ok := h.parseIssueContext(c)
	if !ok {
		return
	}
	links, err := h.Issue.ListLinks(c.Request.Context(), slug, projectID, issueID, user.ID)
	if err != nil {
		if err == service.ErrIssueNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list links"})
		return
	}
	if links == nil {
		c.JSON(http.StatusOK, []interface{}{})
		return
	}
	c.JSON(http.StatusOK, links)
}

// CreateLink adds a link to the issue/epic.
// POST /api/workspaces/:slug/projects/:projectId/issues/:pk/issue-links/
// POST /api/workspaces/:slug/projects/:projectId/epics/:pk/links/
func (h *IssueLinkHandler) CreateLink(c *gin.Context) {
	slug, projectID, issueID, user, ok := h.parseIssueContext(c)
	if !ok {
		return
	}
	var body struct {
		Title string `json:"title"`
		URL   string `json:"url" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	l, err := h.Issue.CreateLink(c.Request.Context(), slug, projectID, issueID, user.ID, body.Title, body.URL)
	if err != nil {
		if err == service.ErrIssueNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create link"})
		return
	}
	c.JSON(http.StatusCreated, l)
}

// UpdateLink edits a link's title or URL.
// PATCH /api/workspaces/:slug/projects/:projectId/issues/:pk/issue-links/:linkId/
// PATCH /api/workspaces/:slug/projects/:projectId/epics/:pk/links/:linkId/
func (h *IssueLinkHandler) UpdateLink(c *gin.Context) {
	slug, projectID, issueID, user, ok := h.parseIssueContext(c)
	if !ok {
		return
	}
	linkID, err := uuid.Parse(c.Param("linkId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid link ID"})
		return
	}
	var body struct {
		Title string `json:"title"`
		URL   string `json:"url"`
	}
	_ = c.ShouldBindJSON(&body)
	l, err := h.Issue.UpdateLink(c.Request.Context(), slug, projectID, issueID, linkID, user.ID, body.Title, body.URL)
	if err != nil {
		if err == service.ErrIssueNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update link"})
		return
	}
	c.JSON(http.StatusOK, l)
}

// DeleteLink removes a link.
// DELETE /api/workspaces/:slug/projects/:projectId/issues/:pk/issue-links/:linkId/
// DELETE /api/workspaces/:slug/projects/:projectId/epics/:pk/links/:linkId/
func (h *IssueLinkHandler) DeleteLink(c *gin.Context) {
	slug, projectID, issueID, user, ok := h.parseIssueContext(c)
	if !ok {
		return
	}
	linkID, err := uuid.Parse(c.Param("linkId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid link ID"})
		return
	}
	if err := h.Issue.DeleteLink(c.Request.Context(), slug, projectID, issueID, linkID, user.ID); err != nil {
		if err == service.ErrIssueNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete link"})
		return
	}
	c.Status(http.StatusNoContent)
}
