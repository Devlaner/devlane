package service

import (
	"context"
	"errors"
	"strings"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
)

var (
	ErrAgentNotFound             = errors.New("agent not found")
	ErrAgentForbidden            = errors.New("agent forbidden")
	ErrAgentNameRequired         = errors.New("agent name is required")
	ErrAgentInvalidAutonomyLevel = errors.New("invalid agent autonomy level")
	ErrAgentInvalidTool          = errors.New("invalid agent tool permission")
	ErrAgentUnavailable          = errors.New("agent is not available for this issue")
)

type AgentToolPermissionParams struct {
	Tool   string
	Scope  string
	Config model.JSONMap
}

type AgentCreateParams struct {
	ProjectID       *uuid.UUID
	Name            string
	Description     string
	Avatar          string
	Instructions    string
	Model           string
	Enabled         *bool
	AutonomyLevel   string
	ToolPermissions []AgentToolPermissionParams
}

type AgentUpdateParams struct {
	Name             *string
	Description      *string
	Avatar           *string
	Instructions     *string
	Model            *string
	Enabled          *bool
	AutonomyLevel    *string
	ToolPermissions  []AgentToolPermissionParams
	ReplaceToolPerms bool
}

type AgentService struct {
	as       *store.AgentStore
	ps       *store.ProjectStore
	ws       *store.WorkspaceStore
	is       *store.IssueStore
	activity *store.IssueActivityStore
}

func NewAgentService(as *store.AgentStore, ps *store.ProjectStore, ws *store.WorkspaceStore, is *store.IssueStore) *AgentService {
	return &AgentService{as: as, ps: ps, ws: ws, is: is}
}

func (s *AgentService) SetActivityStore(a *store.IssueActivityStore) { s.activity = a }

func (s *AgentService) ensureWorkspaceAccess(ctx context.Context, workspaceSlug string, userID uuid.UUID) (*model.Workspace, error) {
	wrk, err := s.ws.GetBySlug(ctx, workspaceSlug)
	if err != nil {
		return nil, ErrProjectForbidden
	}
	ok, _ := s.ws.IsMember(ctx, wrk.ID, userID)
	if !ok {
		return nil, ErrProjectForbidden
	}
	return wrk, nil
}

func (s *AgentService) ensureWorkspaceAdmin(ctx context.Context, wrk *model.Workspace, userID uuid.UUID) error {
	m, err := s.ws.GetMember(ctx, wrk.ID, userID)
	if err != nil || m == nil || m.Role < model.RoleAdmin {
		return ErrAgentForbidden
	}
	return nil
}

func (s *AgentService) ensureProjectScope(ctx context.Context, workspaceID uuid.UUID, projectID *uuid.UUID) error {
	if projectID == nil {
		return nil
	}
	inWorkspace, _ := s.ps.IsInWorkspace(ctx, *projectID, workspaceID)
	if !inWorkspace {
		return ErrProjectNotFound
	}
	return nil
}

func (s *AgentService) ensureProjectAccess(ctx context.Context, workspaceSlug string, projectID, userID uuid.UUID) (*model.Workspace, error) {
	wrk, err := s.ensureWorkspaceAccess(ctx, workspaceSlug, userID)
	if err != nil {
		return nil, err
	}
	inWorkspace, _ := s.ps.IsInWorkspace(ctx, projectID, wrk.ID)
	if !inWorkspace {
		return nil, ErrProjectNotFound
	}
	return wrk, nil
}

func (s *AgentService) normalizePermissions(params []AgentToolPermissionParams) ([]model.AgentToolPermission, error) {
	out := make([]model.AgentToolPermission, 0, len(params))
	seen := map[string]bool{}
	for _, p := range params {
		tool := strings.TrimSpace(p.Tool)
		scope := strings.TrimSpace(p.Scope)
		if scope == "" {
			scope = "workspace"
		}
		if !validAgentTools[tool] {
			return nil, ErrAgentInvalidTool
		}
		key := tool + "\x00" + scope
		if seen[key] {
			continue
		}
		seen[key] = true
		cfg := p.Config
		if cfg == nil {
			cfg = model.JSONMap{}
		}
		out = append(out, model.AgentToolPermission{
			Tool:   tool,
			Scope:  scope,
			Config: cfg,
		})
	}
	return out, nil
}

var validAgentAutonomyLevels = map[string]bool{
	model.AgentAutonomySuggest:        true,
	model.AgentAutonomyComment:        true,
	model.AgentAutonomyModifyIssue:    true,
	model.AgentAutonomyGithubDraft:    true,
	model.AgentAutonomyGithubReviewed: true,
}

var validAgentTools = map[string]bool{
	"issue.read":         true,
	"issue.comment":      true,
	"issue.update":       true,
	"issue.create_child": true,
	"project.read":       true,
	"github.read":        true,
	"github.comment":     true,
	"github.draft_pr":    true,
}

func normalizeAutonomyLevel(level string) (string, error) {
	level = strings.TrimSpace(level)
	if level == "" {
		level = model.AgentAutonomySuggest
	}
	if !validAgentAutonomyLevels[level] {
		return "", ErrAgentInvalidAutonomyLevel
	}
	return level, nil
}

func (s *AgentService) ListAgents(ctx context.Context, workspaceSlug string, projectID *uuid.UUID, userID uuid.UUID) ([]model.Agent, error) {
	wrk, err := s.ensureWorkspaceAccess(ctx, workspaceSlug, userID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureProjectScope(ctx, wrk.ID, projectID); err != nil {
		return nil, err
	}
	return s.as.ListAgents(ctx, wrk.ID, projectID)
}

func (s *AgentService) CreateAgent(ctx context.Context, workspaceSlug string, userID uuid.UUID, params AgentCreateParams) (*model.Agent, error) {
	wrk, err := s.ensureWorkspaceAccess(ctx, workspaceSlug, userID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureWorkspaceAdmin(ctx, wrk, userID); err != nil {
		return nil, err
	}
	if err := s.ensureProjectScope(ctx, wrk.ID, params.ProjectID); err != nil {
		return nil, err
	}
	name := strings.TrimSpace(params.Name)
	if name == "" {
		return nil, ErrAgentNameRequired
	}
	level, err := normalizeAutonomyLevel(params.AutonomyLevel)
	if err != nil {
		return nil, err
	}
	permissions, err := s.normalizePermissions(params.ToolPermissions)
	if err != nil {
		return nil, err
	}
	enabled := true
	if params.Enabled != nil {
		enabled = *params.Enabled
	}
	actor := userID
	a := &model.Agent{
		WorkspaceID:   wrk.ID,
		ProjectID:     params.ProjectID,
		Name:          name,
		Description:   params.Description,
		Avatar:        params.Avatar,
		Instructions:  params.Instructions,
		Model:         params.Model,
		Enabled:       enabled,
		AutonomyLevel: level,
		CreatedByID:   &actor,
		UpdatedByID:   &actor,
	}
	if err := s.as.CreateAgent(ctx, a, permissions); err != nil {
		return nil, err
	}
	return s.as.GetAgentByID(ctx, a.ID)
}

func (s *AgentService) GetAgent(ctx context.Context, workspaceSlug string, agentID, userID uuid.UUID) (*model.Agent, error) {
	wrk, err := s.ensureWorkspaceAccess(ctx, workspaceSlug, userID)
	if err != nil {
		return nil, err
	}
	a, err := s.as.GetAgentByID(ctx, agentID)
	if err != nil || a.WorkspaceID != wrk.ID {
		return nil, ErrAgentNotFound
	}
	return a, nil
}

func (s *AgentService) UpdateAgent(ctx context.Context, workspaceSlug string, agentID, userID uuid.UUID, params AgentUpdateParams) (*model.Agent, error) {
	wrk, err := s.ensureWorkspaceAccess(ctx, workspaceSlug, userID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureWorkspaceAdmin(ctx, wrk, userID); err != nil {
		return nil, err
	}
	a, err := s.as.GetAgentByID(ctx, agentID)
	if err != nil || a.WorkspaceID != wrk.ID {
		return nil, ErrAgentNotFound
	}
	if params.Name != nil {
		name := strings.TrimSpace(*params.Name)
		if name == "" {
			return nil, ErrAgentNameRequired
		}
		a.Name = name
	}
	if params.Description != nil {
		a.Description = *params.Description
	}
	if params.Avatar != nil {
		a.Avatar = *params.Avatar
	}
	if params.Instructions != nil {
		a.Instructions = *params.Instructions
	}
	if params.Model != nil {
		a.Model = *params.Model
	}
	if params.Enabled != nil {
		a.Enabled = *params.Enabled
	}
	if params.AutonomyLevel != nil {
		level, err := normalizeAutonomyLevel(*params.AutonomyLevel)
		if err != nil {
			return nil, err
		}
		a.AutonomyLevel = level
	}
	var permissions []model.AgentToolPermission
	if params.ReplaceToolPerms {
		permissions, err = s.normalizePermissions(params.ToolPermissions)
		if err != nil {
			return nil, err
		}
	}
	actor := userID
	a.UpdatedByID = &actor
	if err := s.as.UpdateAgent(ctx, a, permissions, params.ReplaceToolPerms); err != nil {
		return nil, err
	}
	return s.as.GetAgentByID(ctx, a.ID)
}

func (s *AgentService) DeleteAgent(ctx context.Context, workspaceSlug string, agentID, userID uuid.UUID) error {
	wrk, err := s.ensureWorkspaceAccess(ctx, workspaceSlug, userID)
	if err != nil {
		return err
	}
	if err := s.ensureWorkspaceAdmin(ctx, wrk, userID); err != nil {
		return err
	}
	a, err := s.as.GetAgentByID(ctx, agentID)
	if err != nil || a.WorkspaceID != wrk.ID {
		return ErrAgentNotFound
	}
	return s.as.DeleteAgent(ctx, agentID)
}

func (s *AgentService) resolveIssue(ctx context.Context, workspaceSlug string, projectID, issueID, userID uuid.UUID) (*model.Workspace, *model.Issue, error) {
	wrk, err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID)
	if err != nil {
		return nil, nil, err
	}
	issue, err := s.is.GetByID(ctx, issueID)
	if err != nil || issue.ProjectID != projectID || issue.WorkspaceID != wrk.ID {
		return nil, nil, ErrIssueNotFound
	}
	return wrk, issue, nil
}

func (s *AgentService) resolveAvailableAgent(ctx context.Context, workspaceID, projectID, agentID uuid.UUID) (*model.Agent, error) {
	a, err := s.as.GetAgentByID(ctx, agentID)
	if err != nil || a.WorkspaceID != workspaceID {
		return nil, ErrAgentNotFound
	}
	if !a.Enabled {
		return nil, ErrAgentUnavailable
	}
	if a.ProjectID != nil && *a.ProjectID != projectID {
		return nil, ErrAgentUnavailable
	}
	return a, nil
}

func (s *AgentService) AssignIssue(ctx context.Context, workspaceSlug string, projectID, issueID, agentID, userID uuid.UUID, reason string) (*model.AgentIssueAssignment, error) {
	_, issue, err := s.resolveIssue(ctx, workspaceSlug, projectID, issueID, userID)
	if err != nil {
		return nil, err
	}
	a, err := s.resolveAvailableAgent(ctx, issue.WorkspaceID, issue.ProjectID, agentID)
	if err != nil {
		return nil, err
	}
	actor := userID
	assignment := &model.AgentIssueAssignment{
		IssueID:      issue.ID,
		AgentID:      a.ID,
		ProjectID:    issue.ProjectID,
		WorkspaceID:  issue.WorkspaceID,
		AssignedByID: &actor,
		Reason:       reason,
		Status:       model.AgentAssignmentActive,
	}
	if err := s.as.CreateOrUpdateAssignment(ctx, assignment); err != nil {
		return nil, err
	}
	s.recordIssueAgentActivity(ctx, issue, userID, "agent_assigned", a.ID, "Assigned to agent "+a.Name)
	return assignment, nil
}

func (s *AgentService) ListIssueAssignments(ctx context.Context, workspaceSlug string, projectID, issueID, userID uuid.UUID) ([]model.AgentIssueAssignment, error) {
	_, issue, err := s.resolveIssue(ctx, workspaceSlug, projectID, issueID, userID)
	if err != nil {
		return nil, err
	}
	return s.as.ListAssignmentsByIssue(ctx, issue.ID)
}

func (s *AgentService) CreateIssueRun(ctx context.Context, workspaceSlug string, projectID, issueID, agentID, userID uuid.UUID, trigger string, input model.JSONMap) (*model.AgentRun, error) {
	_, issue, err := s.resolveIssue(ctx, workspaceSlug, projectID, issueID, userID)
	if err != nil {
		return nil, err
	}
	a, err := s.resolveAvailableAgent(ctx, issue.WorkspaceID, issue.ProjectID, agentID)
	if err != nil {
		return nil, err
	}
	if trigger = strings.TrimSpace(trigger); trigger == "" {
		trigger = "manual"
	}
	if input == nil {
		input = model.JSONMap{}
	}
	actor := userID
	iid := issue.ID
	run := &model.AgentRun{
		AgentID:     a.ID,
		IssueID:     &iid,
		ProjectID:   issue.ProjectID,
		WorkspaceID: issue.WorkspaceID,
		Trigger:     trigger,
		Status:      model.AgentRunQueued,
		Input:       input,
		Output:      model.JSONMap{},
		CreatedByID: &actor,
	}
	if err := s.as.CreateRun(ctx, run); err != nil {
		return nil, err
	}
	s.recordIssueAgentActivity(ctx, issue, userID, "agent_run_queued", a.ID, "Queued agent run for "+a.Name)
	return run, nil
}

func (s *AgentService) ListIssueRuns(ctx context.Context, workspaceSlug string, projectID, issueID, userID uuid.UUID) ([]model.AgentRun, error) {
	_, issue, err := s.resolveIssue(ctx, workspaceSlug, projectID, issueID, userID)
	if err != nil {
		return nil, err
	}
	return s.as.ListRunsByIssue(ctx, issue.ID)
}

func (s *AgentService) recordIssueAgentActivity(ctx context.Context, issue *model.Issue, userID uuid.UUID, verb string, agentID uuid.UUID, comment string) {
	if s.activity == nil || issue == nil {
		return
	}
	field := "agent_id"
	newVal := agentID.String()
	actor := userID
	row := &model.IssueActivity{
		IssueID:     &issue.ID,
		ProjectID:   issue.ProjectID,
		WorkspaceID: issue.WorkspaceID,
		Verb:        verb,
		Field:       &field,
		NewValue:    &newVal,
		Comment:     &comment,
		CreatedByID: &actor,
		UpdatedByID: &actor,
		ActorID:     &actor,
	}
	_ = s.activity.Create(ctx, row)
}
