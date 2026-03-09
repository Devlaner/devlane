package handler

import (
	"net/http"
	"strings"

	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/gin-gonic/gin"
)

// InvitationHandler serves public invite-by-token endpoints (no auth).
type InvitationHandler struct {
	Winv *store.WorkspaceInviteStore
	Ws   *store.WorkspaceStore
}

// GetInviteByToken returns workspace invite details by token for the invite landing page.
// GET /api/invitations/by-token/?token=...
func (h *InvitationHandler) GetInviteByToken(c *gin.Context) {
	token := strings.TrimSpace(c.Query("token"))
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "token required"})
		return
	}
	inv, err := h.Winv.GetByToken(c.Request.Context(), token)
	if err != nil || inv == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invite not found or expired"})
		return
	}
	w, err := h.Ws.GetByID(c.Request.Context(), inv.WorkspaceID)
	if err != nil || w == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"workspace_name": w.Name,
		"workspace_slug": w.Slug,
		"email":          inv.Email,
		"invitation_id":  inv.ID.String(),
	})
}

// DeclineInviteByToken removes the invitation (Ignore flow). No auth required.
// POST /api/invitations/decline/ body: { "token": "..." }
func (h *InvitationHandler) DeclineInviteByToken(c *gin.Context) {
	var body struct {
		Token string `json:"token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "token required"})
		return
	}
	token := strings.TrimSpace(body.Token)
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "token required"})
		return
	}
	inv, err := h.Winv.GetByToken(c.Request.Context(), token)
	if err != nil || inv == nil {
		c.Status(http.StatusNoContent)
		return
	}
	if err := h.Winv.Delete(c.Request.Context(), inv.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decline invite"})
		return
	}
	c.Status(http.StatusNoContent)
}
