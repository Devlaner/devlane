package handler

import (
	"errors"
	"net/http"

	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AgentHandler struct {
	Agent *service.AgentService
}

type agentToolPermissionBody struct {
	Tool   string                 `json:"tool"`
	Scope  string                 `json:"scope"`
	Config map[string]interface{} `json:"config"`
}

type agentCreateBody struct {
	ProjectID       *string                   `json:"project_id"`
	Name            string                    `json:"name" binding:"required"`
	Description     string                    `json:"description"`
	Avatar          string                    `json:"avatar"`
	Instructions    string                    `json:"instructions"`
	Model           string                    `json:"model"`
	Enabled         *bool                     `json:"enabled"`
	AutonomyLevel   string                    `json:"autonomy_level"`
	ToolPermissions []agentToolPermissionBody `json:"tool_permissions"`
}

type agentUpdateBody struct {
	Name            *string                    `json:"name"`
	Description     *string                    `json:"description"`
	Avatar          *string                    `json:"avatar"`
	Instructions    *string                    `json:"instructions"`
	Model           *string                    `json:"model"`
	Enabled         *bool                      `json:"enabled"`
	AutonomyLevel   *string                    `json:"autonomy_level"`
	ToolPermissions *[]agentToolPermissionBody `json:"tool_permissions"`
}

func parseUUIDParam(c *gin.Context, param, label string) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param(param))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid " + label})
		return uuid.Nil, false
	}
	return id, true
}

func agentPermissionsFromBody(body []agentToolPermissionBody) []service.AgentToolPermissionParams {
	out := make([]service.AgentToolPermissionParams, 0, len(body))
	for _, p := range body {
		cfg := model.JSONMap{}
		if p.Config != nil {
			cfg = model.JSONMap(p.Config)
		}
		out = append(out, service.AgentToolPermissionParams{
			Tool:   p.Tool,
			Scope:  p.Scope,
			Config: cfg,
		})
	}
	return out
}

func writeAgentError(c *gin.Context, err error, fallback string) {
	switch {
	case errors.Is(err, service.ErrProjectForbidden),
		errors.Is(err, service.ErrProjectNotFound),
		errors.Is(err, service.ErrIssueNotFound),
		errors.Is(err, service.ErrAgentNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
	case errors.Is(err, service.ErrAgentForbidden):
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
	case errors.Is(err, service.ErrAgentNameRequired),
		errors.Is(err, service.ErrAgentInvalidAutonomyLevel),
		errors.Is(err, service.ErrAgentInvalidTool),
		errors.Is(err, service.ErrAgentUnavailable):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": fallback})
	}
}

func (h *AgentHandler) List(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	var projectID *uuid.UUID
	if c.Param("projectId") != "" {
		id, ok := parseUUIDParam(c, "projectId", "project ID")
		if !ok {
			return
		}
		projectID = &id
	}
	list, err := h.Agent.ListAgents(c.Request.Context(), c.Param("slug"), projectID, user.ID)
	if err != nil {
		writeAgentError(c, err, "Failed to list agents")
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *AgentHandler) Create(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	var body agentCreateBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	var projectID *uuid.UUID
	if c.Param("projectId") != "" {
		id, ok := parseUUIDParam(c, "projectId", "project ID")
		if !ok {
			return
		}
		projectID = &id
	} else if body.ProjectID != nil && *body.ProjectID != "" {
		id, err := uuid.Parse(*body.ProjectID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project_id"})
			return
		}
		projectID = &id
	}
	agent, err := h.Agent.CreateAgent(c.Request.Context(), c.Param("slug"), user.ID, service.AgentCreateParams{
		ProjectID:       projectID,
		Name:            body.Name,
		Description:     body.Description,
		Avatar:          body.Avatar,
		Instructions:    body.Instructions,
		Model:           body.Model,
		Enabled:         body.Enabled,
		AutonomyLevel:   body.AutonomyLevel,
		ToolPermissions: agentPermissionsFromBody(body.ToolPermissions),
	})
	if err != nil {
		writeAgentError(c, err, "Failed to create agent")
		return
	}
	c.JSON(http.StatusCreated, agent)
}

func (h *AgentHandler) Get(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	agentID, ok := parseUUIDParam(c, "agentId", "agent ID")
	if !ok {
		return
	}
	agent, err := h.Agent.GetAgent(c.Request.Context(), c.Param("slug"), agentID, user.ID)
	if err != nil {
		writeAgentError(c, err, "Failed to get agent")
		return
	}
	c.JSON(http.StatusOK, agent)
}

func (h *AgentHandler) Update(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	agentID, ok := parseUUIDParam(c, "agentId", "agent ID")
	if !ok {
		return
	}
	var body agentUpdateBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	params := service.AgentUpdateParams{
		Name:          body.Name,
		Description:   body.Description,
		Avatar:        body.Avatar,
		Instructions:  body.Instructions,
		Model:         body.Model,
		Enabled:       body.Enabled,
		AutonomyLevel: body.AutonomyLevel,
	}
	if body.ToolPermissions != nil {
		params.ReplaceToolPerms = true
		params.ToolPermissions = agentPermissionsFromBody(*body.ToolPermissions)
	}
	agent, err := h.Agent.UpdateAgent(c.Request.Context(), c.Param("slug"), agentID, user.ID, params)
	if err != nil {
		writeAgentError(c, err, "Failed to update agent")
		return
	}
	c.JSON(http.StatusOK, agent)
}

func (h *AgentHandler) Delete(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	agentID, ok := parseUUIDParam(c, "agentId", "agent ID")
	if !ok {
		return
	}
	if err := h.Agent.DeleteAgent(c.Request.Context(), c.Param("slug"), agentID, user.ID); err != nil {
		writeAgentError(c, err, "Failed to delete agent")
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *AgentHandler) ListIssueAssignments(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	projectID, ok := parseUUIDParam(c, "projectId", "project ID")
	if !ok {
		return
	}
	issueID, ok := parseUUIDParam(c, "pk", "issue ID")
	if !ok {
		return
	}
	list, err := h.Agent.ListIssueAssignments(c.Request.Context(), c.Param("slug"), projectID, issueID, user.ID)
	if err != nil {
		writeAgentError(c, err, "Failed to list agent assignments")
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *AgentHandler) AssignIssue(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	projectID, ok := parseUUIDParam(c, "projectId", "project ID")
	if !ok {
		return
	}
	issueID, ok := parseUUIDParam(c, "pk", "issue ID")
	if !ok {
		return
	}
	var body struct {
		AgentID string `json:"agent_id" binding:"required"`
		Reason  string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	agentID, err := uuid.Parse(body.AgentID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid agent_id"})
		return
	}
	assignment, err := h.Agent.AssignIssue(c.Request.Context(), c.Param("slug"), projectID, issueID, agentID, user.ID, body.Reason)
	if err != nil {
		writeAgentError(c, err, "Failed to assign agent")
		return
	}
	c.JSON(http.StatusCreated, assignment)
}

func (h *AgentHandler) ListIssueRuns(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	projectID, ok := parseUUIDParam(c, "projectId", "project ID")
	if !ok {
		return
	}
	issueID, ok := parseUUIDParam(c, "pk", "issue ID")
	if !ok {
		return
	}
	list, err := h.Agent.ListIssueRuns(c.Request.Context(), c.Param("slug"), projectID, issueID, user.ID)
	if err != nil {
		writeAgentError(c, err, "Failed to list agent runs")
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *AgentHandler) CreateIssueRun(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	projectID, ok := parseUUIDParam(c, "projectId", "project ID")
	if !ok {
		return
	}
	issueID, ok := parseUUIDParam(c, "pk", "issue ID")
	if !ok {
		return
	}
	var body struct {
		AgentID string                 `json:"agent_id" binding:"required"`
		Trigger string                 `json:"trigger"`
		Input   map[string]interface{} `json:"input"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "detail": err.Error()})
		return
	}
	agentID, err := uuid.Parse(body.AgentID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid agent_id"})
		return
	}
	input := model.JSONMap{}
	if body.Input != nil {
		input = model.JSONMap(body.Input)
	}
	run, err := h.Agent.CreateIssueRun(c.Request.Context(), c.Param("slug"), projectID, issueID, agentID, user.ID, body.Trigger, input)
	if err != nil {
		writeAgentError(c, err, "Failed to create agent run")
		return
	}
	c.JSON(http.StatusCreated, run)
}
