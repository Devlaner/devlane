package handler

import (
	"net/http"
	"strings"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// WorkspaceHandler serves workspace and member/invite endpoints.
type WorkspaceHandler struct {
	Workspace *service.WorkspaceService
	Settings  *store.InstanceSettingStore
}

// List returns the current user's workspaces.
// GET /api/users/me/workspaces/
func (h *WorkspaceHandler) List(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	list, err := h.Workspace.ListForUser(c.Request.Context(), user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list workspaces"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// Create creates a workspace; instance setting may restrict to admin only.
// POST /api/workspaces/
func (h *WorkspaceHandler) Create(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	if h.Settings != nil {
		general, _ := h.Settings.Get(c.Request.Context(), "general")
		if general != nil {
			if onlyAdmin, _ := general.Value["only_admin_can_create_workspace"].(bool); onlyAdmin {
				adminEmail, _ := general.Value["admin_email"].(string)
				adminEmail = strings.TrimSpace(strings.ToLower(adminEmail))
				userEmail := ""
				if user.Email != nil {
					userEmail = strings.TrimSpace(strings.ToLower(*user.Email))
				}
				if adminEmail != "" && userEmail != adminEmail {
					c.JSON(http.StatusForbidden, gin.H{"error": "Only the instance admin can create workspaces"})
					return
				}
			}
		}
	}
	var body struct {
		Name string `json:"name" binding:"required"`
		Slug string `json:"slug"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	w, err := h.Workspace.Create(c.Request.Context(), body.Name, body.Slug, user.ID)
	if err != nil {
		if err == service.ErrSlugInvalid {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid slug"})
			return
		}
		if err == service.ErrSlugTaken {
			c.JSON(http.StatusConflict, gin.H{"error": "Slug already in use"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create workspace"})
		return
	}
	c.JSON(http.StatusCreated, w)
}

// GetBySlug returns the workspace by slug.
// GET /api/workspaces/:slug/
func (h *WorkspaceHandler) GetBySlug(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	w, err := h.Workspace.GetBySlug(c.Request.Context(), slug, user.ID)
	if err != nil {
		if err == service.ErrWorkspaceNotFound || err == service.ErrWorkspaceForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get workspace"})
		return
	}
	c.JSON(http.StatusOK, w)
}

// Update updates workspace name or slug.
// PATCH /api/workspaces/:slug/
func (h *WorkspaceHandler) Update(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	var body struct {
		Name string  `json:"name"`
		Slug string  `json:"slug"`
		Logo *string `json:"logo"`
	}
	_ = c.ShouldBindJSON(&body)
	var name, newSlug *string
	if body.Name != "" {
		name = &body.Name
	}
	if body.Slug != "" {
		newSlug = &body.Slug
	}
	w, err := h.Workspace.Update(c.Request.Context(), slug, user.ID, name, newSlug, body.Logo)
	if err != nil {
		if err == service.ErrWorkspaceNotFound || err == service.ErrWorkspaceForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
			return
		}
		if err == service.ErrSlugInvalid {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid slug"})
			return
		}
		if err == service.ErrSlugTaken {
			c.JSON(http.StatusConflict, gin.H{"error": "Slug already in use"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update workspace"})
		return
	}
	c.JSON(http.StatusOK, w)
}

// Delete deletes the workspace.
// DELETE /api/workspaces/:slug/
func (h *WorkspaceHandler) Delete(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	if err := h.Workspace.Delete(c.Request.Context(), slug, user.ID); err != nil {
		if err == service.ErrWorkspaceNotFound || err == service.ErrWorkspaceForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete workspace"})
		return
	}
	c.Status(http.StatusNoContent)
}

// SlugCheck reports whether a slug is available.
// GET /api/workspace-slug-check/
func (h *WorkspaceHandler) SlugCheck(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Query("slug")
	exists, err := h.Workspace.SlugCheck(c.Request.Context(), slug, uuid.Nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Check failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": !exists})
}

// ListMembers returns workspace members.
// GET /api/workspaces/:slug/members/
func (h *WorkspaceHandler) ListMembers(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	list, err := h.Workspace.ListMembers(c.Request.Context(), slug, user.ID)
	if err != nil {
		if err == service.ErrWorkspaceNotFound || err == service.ErrWorkspaceForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list members"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// GetMember returns a workspace member by id.
// GET /api/workspaces/:slug/members/:pk/
func (h *WorkspaceHandler) GetMember(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	pk, err := uuid.Parse(c.Param("pk"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid member id"})
		return
	}
	m, err := h.Workspace.GetMember(c.Request.Context(), slug, pk, user.ID)
	if err != nil {
		if err == service.ErrWorkspaceNotFound || err == service.ErrWorkspaceForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
			return
		}
		if err == service.ErrMemberNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Member not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get member"})
		return
	}
	c.JSON(http.StatusOK, m)
}

// UpdateMember updates a member's role.
// PATCH /api/workspaces/:slug/members/:pk/
func (h *WorkspaceHandler) UpdateMember(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	pk, err := uuid.Parse(c.Param("pk"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid member id"})
		return
	}
	var body struct {
		Role *int16 `json:"role"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.Role == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": "role required"})
		return
	}
	m, err := h.Workspace.UpdateMemberRole(c.Request.Context(), slug, pk, user.ID, *body.Role)
	if err != nil {
		if err == service.ErrWorkspaceNotFound || err == service.ErrWorkspaceForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
			return
		}
		if err == service.ErrMemberNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Member not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update member"})
		return
	}
	c.JSON(http.StatusOK, m)
}

// DeleteMember removes a member from the workspace.
// DELETE /api/workspaces/:slug/members/:pk/
func (h *WorkspaceHandler) DeleteMember(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	pk, err := uuid.Parse(c.Param("pk"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid member id"})
		return
	}
	if err := h.Workspace.DeleteMember(c.Request.Context(), slug, pk, user.ID); err != nil {
		if err == service.ErrWorkspaceNotFound || err == service.ErrWorkspaceForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
			return
		}
		if err == service.ErrMemberNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Member not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove member"})
		return
	}
	c.Status(http.StatusNoContent)
}

// Leave removes the current user from the workspace.
// POST /api/workspaces/:slug/members/leave/
func (h *WorkspaceHandler) Leave(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	if err := h.Workspace.Leave(c.Request.Context(), slug, user.ID); err != nil {
		if err == service.ErrWorkspaceNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
			return
		}
		if err == service.ErrWorkspaceForbidden {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Owner cannot leave"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to leave workspace"})
		return
	}
	c.Status(http.StatusNoContent)
}

// ListInvites returns workspace invitations.
// GET /api/workspaces/:slug/invitations/
func (h *WorkspaceHandler) ListInvites(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	list, err := h.Workspace.ListInvites(c.Request.Context(), slug, user.ID)
	if err != nil {
		if err == service.ErrWorkspaceNotFound || err == service.ErrWorkspaceForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list invitations"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// CreateInvite creates a workspace invitation.
// POST /api/workspaces/:slug/invitations/
func (h *WorkspaceHandler) CreateInvite(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	var body struct {
		Email string `json:"email" binding:"required"`
		Role  int16  `json:"role"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	if body.Role == 0 {
		body.Role = 10
	}
	inv, err := h.Workspace.CreateInvite(c.Request.Context(), slug, user.ID, body.Email, body.Role)
	if err != nil {
		if err == service.ErrWorkspaceNotFound || err == service.ErrWorkspaceForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create invite"})
		return
	}
	c.JSON(http.StatusCreated, inv)
}

// GetInvite returns an invitation by id.
// GET /api/workspaces/:slug/invitations/:pk/
func (h *WorkspaceHandler) GetInvite(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	pk, err := uuid.Parse(c.Param("pk"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid invite id"})
		return
	}
	inv, err := h.Workspace.GetInvite(c.Request.Context(), slug, pk, user.ID)
	if err != nil {
		if err == service.ErrWorkspaceNotFound || err == service.ErrWorkspaceForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
			return
		}
		if err == service.ErrInviteNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Invite not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get invite"})
		return
	}
	c.JSON(http.StatusOK, inv)
}

// DeleteInvite deletes an invitation.
// DELETE /api/workspaces/:slug/invitations/:pk/
func (h *WorkspaceHandler) DeleteInvite(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	pk, err := uuid.Parse(c.Param("pk"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid invite id"})
		return
	}
	if err := h.Workspace.DeleteInvite(c.Request.Context(), slug, pk, user.ID); err != nil {
		if err == service.ErrWorkspaceNotFound || err == service.ErrWorkspaceForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
			return
		}
		if err == service.ErrInviteNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Invite not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete invite"})
		return
	}
	c.Status(http.StatusNoContent)
}

// JoinByInvite accepts an invitation and adds the user to the workspace.
// POST /api/workspaces/:slug/invitations/:pk/join/
func (h *WorkspaceHandler) JoinByInvite(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	pk, err := uuid.Parse(c.Param("pk"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid invite id"})
		return
	}
	w, err := h.Workspace.JoinByInviteID(c.Request.Context(), slug, pk, user.ID)
	if err != nil {
		if err == service.ErrWorkspaceNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
			return
		}
		if err == service.ErrInviteNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Invite not found or already accepted"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to join workspace"})
		return
	}
	c.JSON(http.StatusOK, w)
}

// JoinByToken accepts an invitation by token and adds the user to the workspace.
// POST /api/workspaces/join/
func (h *WorkspaceHandler) JoinByToken(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	var body struct {
		Token string `json:"token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	w, err := h.Workspace.JoinByToken(c.Request.Context(), body.Token, user.ID)
	if err != nil {
		if err == service.ErrInviteNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Invite not found or already accepted"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to join workspace"})
		return
	}
	c.JSON(http.StatusOK, w)
}

// ListUserInvitations returns the current user's pending workspace invitations.
// GET /api/users/me/workspaces/invitations/
func (h *WorkspaceHandler) ListUserInvitations(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	list, err := h.Workspace.ListUserInvitations(c.Request.Context(), user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list invitations"})
		return
	}
	c.JSON(http.StatusOK, list)
}
