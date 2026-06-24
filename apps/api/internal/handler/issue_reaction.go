package handler

import (
	"net/http"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// reactionNotFound maps service access errors to a 404.
func reactionIsNotFound(err error) bool {
	return err == service.ErrProjectForbidden || err == service.ErrProjectNotFound || err == service.ErrIssueNotFound
}

// ListReactions returns all emoji reactions on an issue.
// GET /api/workspaces/:slug/projects/:projectId/issues/:pk/reactions/
func (h *IssueHandler) ListReactions(c *gin.Context) {
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
	list, err := h.Issue.ListReactions(c.Request.Context(), slug, projectID, iid, user.ID)
	if err != nil {
		if reactionIsNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list reactions"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// AddReaction adds an emoji reaction to an issue.
// POST /api/workspaces/:slug/projects/:projectId/issues/:pk/reactions/
func (h *IssueHandler) AddReaction(c *gin.Context) {
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
	var body addReactionRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	r, err := h.Issue.AddReaction(c.Request.Context(), slug, projectID, iid, user.ID, body.Reaction)
	if err != nil {
		if reactionIsNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		// Unique-constraint violation = the user already reacted with this emoji.
		c.JSON(http.StatusConflict, gin.H{"error": "Already reacted"})
		return
	}
	c.JSON(http.StatusCreated, r)
}

// RemoveReaction removes a user's emoji reaction from an issue.
// DELETE /api/workspaces/:slug/projects/:projectId/issues/:pk/reactions/:reaction/
func (h *IssueHandler) RemoveReaction(c *gin.Context) {
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
	reaction := c.Param("reaction")
	if reaction == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Reaction is required"})
		return
	}
	if err := h.Issue.RemoveReaction(c.Request.Context(), slug, projectID, iid, user.ID, reaction); err != nil {
		if reactionIsNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove reaction"})
		return
	}
	c.Status(http.StatusNoContent)
}
