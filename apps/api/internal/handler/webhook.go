package handler

import (
	"net/http"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// WebhookHandler serves outbound workspace webhook management + delivery logs.
type WebhookHandler struct {
	Webhooks *service.WebhookService
}

type webhookBody struct {
	URL          string `json:"url"`
	IsActive     *bool  `json:"is_active"`
	Project      *bool  `json:"project"`
	Issue        *bool  `json:"issue"`
	Module       *bool  `json:"module"`
	Cycle        *bool  `json:"cycle"`
	IssueComment *bool  `json:"issue_comment"`
}

func (b webhookBody) toInput() service.WebhookInput {
	return service.WebhookInput{
		URL:          b.URL,
		IsActive:     b.IsActive,
		Project:      b.Project,
		Issue:        b.Issue,
		Module:       b.Module,
		Cycle:        b.Cycle,
		IssueComment: b.IssueComment,
	}
}

// List returns the workspace's webhooks.
// GET /api/workspaces/:slug/webhooks/
func (h *WebhookHandler) List(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	list, err := h.Webhooks.List(c.Request.Context(), c.Param("slug"), user.ID)
	if err != nil {
		h.webhookError(c, err)
		return
	}
	c.JSON(http.StatusOK, list)
}

// Create adds a webhook.
// POST /api/workspaces/:slug/webhooks/
func (h *WebhookHandler) Create(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	var body webhookBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	w, err := h.Webhooks.Create(c.Request.Context(), c.Param("slug"), user.ID, body.toInput())
	if err != nil {
		h.webhookError(c, err)
		return
	}
	// The signing secret is returned exactly once, here at creation. Every other
	// response omits it (model.Webhook.SecretKey is json:"-"), so it never leaks
	// on subsequent list/update fetches.
	c.JSON(http.StatusCreated, gin.H{
		"id":            w.ID,
		"url":           w.URL,
		"secret_key":    w.SecretKey,
		"is_active":     w.IsActive,
		"project":       w.Project,
		"issue":         w.Issue,
		"module":        w.Module,
		"cycle":         w.Cycle,
		"issue_comment": w.IssueComment,
		"version":       w.Version,
		"workspace_id":  w.WorkspaceID,
		"created_at":    w.CreatedAt,
		"updated_at":    w.UpdatedAt,
	})
}

// Update edits a webhook.
// PATCH /api/workspaces/:slug/webhooks/:webhookId/
func (h *WebhookHandler) Update(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	id, err := uuid.Parse(c.Param("webhookId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid webhook ID"})
		return
	}
	var body webhookBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	w, err := h.Webhooks.Update(c.Request.Context(), c.Param("slug"), user.ID, id, body.toInput())
	if err != nil {
		h.webhookError(c, err)
		return
	}
	c.JSON(http.StatusOK, w)
}

// Delete removes a webhook.
// DELETE /api/workspaces/:slug/webhooks/:webhookId/
func (h *WebhookHandler) Delete(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	id, err := uuid.Parse(c.Param("webhookId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid webhook ID"})
		return
	}
	if err := h.Webhooks.Delete(c.Request.Context(), c.Param("slug"), user.ID, id); err != nil {
		h.webhookError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// ListLogs returns a webhook's recent delivery logs.
// GET /api/workspaces/:slug/webhooks/:webhookId/logs/
func (h *WebhookHandler) ListLogs(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	id, err := uuid.Parse(c.Param("webhookId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid webhook ID"})
		return
	}
	logs, err := h.Webhooks.ListLogs(c.Request.Context(), c.Param("slug"), user.ID, id)
	if err != nil {
		h.webhookError(c, err)
		return
	}
	c.JSON(http.StatusOK, logs)
}

func (h *WebhookHandler) webhookError(c *gin.Context, err error) {
	switch err {
	case service.ErrWebhookForbidden:
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
	case service.ErrWebhookWorkspace, service.ErrWebhookNotFound:
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
	case service.ErrWebhookBadURL:
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Webhook request failed"})
	}
}
