package handler

import (
	"net/http"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// CommentHandler serves issue comments.
type CommentHandler struct {
	Comment *service.CommentService
}

// List returns comments for the issue.
// GET /api/workspaces/:slug/projects/:projectId/issues/:pk/comments/
func (h *CommentHandler) List(c *gin.Context) {
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
	issueID, err := uuid.Parse(c.Param("pk"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid issue ID"})
		return
	}
	list, err := h.Comment.List(c.Request.Context(), slug, projectID, issueID, user.ID)
	if err != nil {
		if err == service.ErrProjectForbidden || err == service.ErrProjectNotFound || err == service.ErrCommentNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list comments"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// Create creates a comment on the issue.
// POST /api/workspaces/:slug/projects/:projectId/issues/:pk/comments/
func (h *CommentHandler) Create(c *gin.Context) {
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
	issueID, err := uuid.Parse(c.Param("pk"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid issue ID"})
		return
	}
	var body struct {
		Comment string `json:"comment" binding:"required"`
		Access  string `json:"access"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	comment, err := h.Comment.Create(c.Request.Context(), slug, projectID, issueID, user.ID, body.Comment, body.Access)
	if err != nil {
		if err == service.ErrProjectForbidden || err == service.ErrProjectNotFound || err == service.ErrCommentNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create comment"})
		return
	}
	c.JSON(http.StatusCreated, comment)
}

// Update updates a comment.
// PATCH /api/workspaces/:slug/projects/:projectId/issues/:issueId/comments/:commentId/
func (h *CommentHandler) Update(c *gin.Context) {
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
	commentID, err := uuid.Parse(c.Param("commentId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid comment ID"})
		return
	}
	slug := c.Param("slug")
	var body struct {
		Comment string `json:"comment" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	comment, err := h.Comment.Update(c.Request.Context(), slug, projectID, commentID, user.ID, body.Comment)
	if err != nil {
		if err == service.ErrCommentNotFound || err == service.ErrProjectForbidden || err == service.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update comment"})
		return
	}
	c.JSON(http.StatusOK, comment)
}

// Delete deletes a comment.
// DELETE /api/workspaces/:slug/projects/:projectId/issues/:issueId/comments/:commentId/
func (h *CommentHandler) Delete(c *gin.Context) {
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
	commentID, err := uuid.Parse(c.Param("commentId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid comment ID"})
		return
	}
	if err := h.Comment.Delete(c.Request.Context(), slug, projectID, commentID, user.ID); err != nil {
		if err == service.ErrCommentNotFound || err == service.ErrProjectForbidden || err == service.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete comment"})
		return
	}
	c.Status(http.StatusNoContent)
}

// ListReactions returns all reactions on a comment.
// GET /api/workspaces/:slug/projects/:projectId/issues/:pk/comments/:commentId/reactions/
func (h *CommentHandler) ListReactions(c *gin.Context) {
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
	commentID, err := uuid.Parse(c.Param("commentId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid comment ID"})
		return
	}
	list, err := h.Comment.ListReactions(c.Request.Context(), slug, projectID, commentID, user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list reactions"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// AddReaction adds an emoji reaction to a comment.
// POST /api/workspaces/:slug/projects/:projectId/issues/:pk/comments/:commentId/reactions/
type addReactionRequest struct {
	Reaction string `json:"reaction" binding:"required"`
}

func (h *CommentHandler) AddReaction(c *gin.Context) {
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
	commentID, err := uuid.Parse(c.Param("commentId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid comment ID"})
		return
	}
	var body addReactionRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	r, err := h.Comment.AddReaction(c.Request.Context(), slug, projectID, commentID, user.ID, body.Reaction)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, r)
}

// RemoveReaction removes a user's emoji reaction.
// DELETE /api/workspaces/:slug/projects/:projectId/issues/:pk/comments/:commentId/reactions/:reaction/
func (h *CommentHandler) RemoveReaction(c *gin.Context) {
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
	commentID, err := uuid.Parse(c.Param("commentId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid comment ID"})
		return
	}
	reaction := c.Param("reaction")
	if reaction == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Reaction is required"})
		return
	}
	if err := h.Comment.RemoveReaction(c.Request.Context(), slug, projectID, commentID, user.ID, reaction); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove reaction"})
		return
	}
	c.Status(http.StatusNoContent)
}
