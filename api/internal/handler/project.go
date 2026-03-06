package handler

import (
	"net/http"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ProjectHandler serves project and project-member/invite endpoints.
type ProjectHandler struct {
	Project *service.ProjectService
}

func projectID(c *gin.Context) (uuid.UUID, bool) {
	idStr := c.Param("projectId")
	if idStr == "" {
		idStr = c.Param("pk")
	}
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return uuid.Nil, false
	}
	return id, true
}

// List returns projects in the workspace.
// GET /api/workspaces/:slug/projects/
func (h *ProjectHandler) List(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	list, err := h.Project.ListByWorkspace(c.Request.Context(), slug, user.ID)
	if err != nil {
		if err == service.ErrProjectForbidden || err == service.ErrProjectNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list projects"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// Get returns a project by id.
// GET /api/workspaces/:slug/projects/:projectId/
func (h *ProjectHandler) Get(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	projectID, ok := projectID(c)
	if !ok {
		return
	}
	p, err := h.Project.GetByID(c.Request.Context(), slug, projectID, user.ID)
	if err != nil {
		if err == service.ErrProjectNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get project"})
		return
	}
	c.JSON(http.StatusOK, p)
}

// Create creates a project in the workspace.
// POST /api/workspaces/:slug/projects/
func (h *ProjectHandler) Create(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	var body struct {
		Name        string `json:"name" binding:"required"`
		Identifier  string `json:"identifier"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	p, err := h.Project.Create(c.Request.Context(), slug, body.Name, body.Identifier, user.ID)
	if err != nil {
		if err == service.ErrProjectNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create project"})
		return
	}
	c.JSON(http.StatusCreated, p)
}

// Update updates project name or identifier.
// PATCH /api/workspaces/:slug/projects/:projectId/
func (h *ProjectHandler) Update(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	projectID, ok := projectID(c)
	if !ok {
		return
	}
	var body struct {
		Name       string `json:"name"`
		Identifier string `json:"identifier"`
	}
	_ = c.ShouldBindJSON(&body)
	var name, identifier *string
	if body.Name != "" {
		name = &body.Name
	}
	if body.Identifier != "" {
		identifier = &body.Identifier
	}
	p, err := h.Project.Update(c.Request.Context(), slug, projectID, user.ID, name, identifier)
	if err != nil {
		if err == service.ErrProjectNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update project"})
		return
	}
	c.JSON(http.StatusOK, p)
}

// Delete deletes the project.
// DELETE /api/workspaces/:slug/projects/:projectId/
func (h *ProjectHandler) Delete(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	projectID, ok := projectID(c)
	if !ok {
		return
	}
	if err := h.Project.Delete(c.Request.Context(), slug, projectID, user.ID); err != nil {
		if err == service.ErrProjectNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete project"})
		return
	}
	c.Status(http.StatusNoContent)
}

// ListMembers returns project members.
// GET /api/workspaces/:slug/projects/:projectId/members/
func (h *ProjectHandler) ListMembers(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	projectID, ok := projectID(c)
	if !ok {
		return
	}
	list, err := h.Project.ListMembers(c.Request.Context(), slug, projectID, user.ID)
	if err != nil {
		if err == service.ErrProjectNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list members"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// GetMember returns a project member by id.
// GET /api/workspaces/:slug/projects/:projectId/members/:pk/
func (h *ProjectHandler) GetMember(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	projectID, ok := projectID(c)
	if !ok {
		return
	}
	pk, err := uuid.Parse(c.Param("pk"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid member id"})
		return
	}
	m, err := h.Project.GetMember(c.Request.Context(), slug, projectID, pk, user.ID)
	if err != nil {
		if err == service.ErrProjectNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
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
// PATCH /api/workspaces/:slug/projects/:projectId/members/:pk/
func (h *ProjectHandler) UpdateMember(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	projectID, ok := projectID(c)
	if !ok {
		return
	}
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
	m, err := h.Project.UpdateMemberRole(c.Request.Context(), slug, projectID, pk, user.ID, *body.Role)
	if err != nil {
		if err == service.ErrProjectNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
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

// DeleteMember removes a member from the project.
// DELETE /api/workspaces/:slug/projects/:projectId/members/:pk/
func (h *ProjectHandler) DeleteMember(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	projectID, ok := projectID(c)
	if !ok {
		return
	}
	pk, err := uuid.Parse(c.Param("pk"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid member id"})
		return
	}
	if err := h.Project.DeleteMember(c.Request.Context(), slug, projectID, pk, user.ID); err != nil {
		if err == service.ErrProjectNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
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

// Leave removes the current user from the project.
// POST /api/workspaces/:slug/projects/:projectId/members/leave/
func (h *ProjectHandler) Leave(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	projectID, ok := projectID(c)
	if !ok {
		return
	}
	if err := h.Project.Leave(c.Request.Context(), slug, projectID, user.ID); err != nil {
		if err == service.ErrProjectNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to leave project"})
		return
	}
	c.Status(http.StatusNoContent)
}

// ListInvites returns project invitations.
// GET /api/workspaces/:slug/projects/:projectId/invitations/
func (h *ProjectHandler) ListInvites(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	projectID, ok := projectID(c)
	if !ok {
		return
	}
	list, err := h.Project.ListInvites(c.Request.Context(), slug, projectID, user.ID)
	if err != nil {
		if err == service.ErrProjectNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list invitations"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// CreateInvite creates a project invitation.
// POST /api/workspaces/:slug/projects/:projectId/invitations/
func (h *ProjectHandler) CreateInvite(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	projectID, ok := projectID(c)
	if !ok {
		return
	}
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
	inv, err := h.Project.CreateInvite(c.Request.Context(), slug, projectID, user.ID, body.Email, body.Role)
	if err != nil {
		if err == service.ErrProjectNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create invite"})
		return
	}
	c.JSON(http.StatusCreated, inv)
}

// GetInvite returns a project invitation by id.
// GET /api/workspaces/:slug/projects/:projectId/invitations/:pk/
func (h *ProjectHandler) GetInvite(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	projectID, ok := projectID(c)
	if !ok {
		return
	}
	pk, err := uuid.Parse(c.Param("pk"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid invite id"})
		return
	}
	inv, err := h.Project.GetInvite(c.Request.Context(), slug, projectID, pk, user.ID)
	if err != nil {
		if err == service.ErrProjectNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
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

// DeleteInvite deletes a project invitation.
// DELETE /api/workspaces/:slug/projects/:projectId/invitations/:pk/
func (h *ProjectHandler) DeleteInvite(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	projectID, ok := projectID(c)
	if !ok {
		return
	}
	pk, err := uuid.Parse(c.Param("pk"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid invite id"})
		return
	}
	if err := h.Project.DeleteInvite(c.Request.Context(), slug, projectID, pk, user.ID); err != nil {
		if err == service.ErrProjectNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
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

// JoinByInvite accepts an invitation and adds the user to the project.
// POST /api/workspaces/:slug/projects/:projectId/invitations/:pk/join/
func (h *ProjectHandler) JoinByInvite(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	projectID, ok := projectID(c)
	if !ok {
		return
	}
	pk, err := uuid.Parse(c.Param("pk"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid invite id"})
		return
	}
	p, err := h.Project.JoinByInviteID(c.Request.Context(), slug, projectID, pk, user.ID)
	if err != nil {
		if err == service.ErrProjectNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
			return
		}
		if err == service.ErrInviteNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Invite not found or already accepted"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to join project"})
		return
	}
	c.JSON(http.StatusOK, p)
}

// JoinByToken accepts an invitation by token and adds the user to the project.
// POST /api/workspaces/:slug/projects/join/
func (h *ProjectHandler) JoinByToken(c *gin.Context) {
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
	p, err := h.Project.JoinByToken(c.Request.Context(), body.Token, user.ID)
	if err != nil {
		if err == service.ErrInviteNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Invite not found or already accepted"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to join project"})
		return
	}
	c.JSON(http.StatusOK, p)
}

// ListUserProjectInvitations returns the current user's pending project invitations in the workspace.
// GET /api/users/me/workspaces/:slug/projects/invitations/
func (h *ProjectHandler) ListUserProjectInvitations(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	slug := c.Param("slug")
	list, err := h.Project.ListUserProjectInvitations(c.Request.Context(), slug, user.ID)
	if err != nil {
		if err == service.ErrProjectNotFound || err == service.ErrProjectForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list invitations"})
		return
	}
	c.JSON(http.StatusOK, list)
}
