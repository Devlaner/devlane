package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AnalyticsResponse struct {
	ByState    map[string]int64 `json:"by_state"`
	ByPriority map[string]int64 `json:"by_priority"`
	ByAssignee map[string]int64 `json:"by_assignee"`
	ByLabel    map[string]int64 `json:"by_label"`
}

type AnalyticsService struct {
	as  *store.AnalyticsStore
	ws  *store.WorkspaceStore
	ps  *store.ProjectStore
	log *slog.Logger
}

func NewAnalyticsService(as *store.AnalyticsStore, ws *store.WorkspaceStore, ps *store.ProjectStore, log *slog.Logger) *AnalyticsService {
	return &AnalyticsService{
		as:  as,
		ws:  ws,
		ps:  ps,
		log: log,
	}
}

func (s *AnalyticsService) ensureWorkspaceAccess(ctx context.Context, slug string, userID uuid.UUID) (*model.Workspace, error) {
	wrk, err := s.ws.GetBySlug(ctx, slug)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrWorkspaceNotFound
		}
		return nil, err
	}
	ok, err := s.ws.IsMember(ctx, wrk.ID, userID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrWorkspaceForbidden
	}
	return wrk, nil
}

func (s *AnalyticsService) ensureProjectAccess(ctx context.Context, projectID, userID uuid.UUID) (*model.Project, error) {
	project, err := s.ps.GetByID(ctx, projectID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrProjectNotFound
		}
		return nil, err
	}
	ok, err := s.ws.IsMember(ctx, project.WorkspaceID, userID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrProjectForbidden
	}
	return project, nil
}

func (s *AnalyticsService) GetWorkspaceAnalytics(ctx context.Context, slug string, userID uuid.UUID) (*AnalyticsResponse, error) {
	if _, err := s.ensureWorkspaceAccess(ctx, slug, userID); err != nil {
		return nil, err
	}

	byState := make(map[string]int64)
	if stateResults, err := s.as.GetWorkspaceStateAnalytics(ctx, slug); err == nil {
		for _, r := range stateResults {
			byState[r.State] = r.Count
		}
	} else {
		return nil, fmt.Errorf("fetch workspace state analytics: %w", err)
	}

	byPriority := make(map[string]int64)
	if priorityResults, err := s.as.GetWorkspacePriorityAnalytics(ctx, slug); err == nil {
		for _, r := range priorityResults {
			byPriority[r.Priority] = r.Count
		}
	} else {
		return nil, fmt.Errorf("fetch workspace priority analytics: %w", err)
	}

	byAssignee := make(map[string]int64)
	if assigneeResults, err := s.as.GetWorkspaceAssigneeAnalytics(ctx, slug); err == nil {
		for _, r := range assigneeResults {
			byAssignee[r.Email] = r.Count
		}
	} else if s.log != nil {
		s.log.Warn("failed to fetch workspace assignee analytics", "error", err, "slug", slug)
	}

	byLabel := make(map[string]int64)
	if labelResults, err := s.as.GetWorkspaceLabelAnalytics(ctx, slug); err == nil {
		for _, r := range labelResults {
			byLabel[r.Label] = r.Count
		}
	} else if s.log != nil {
		s.log.Warn("failed to fetch workspace label analytics", "error", err, "slug", slug)
	}

	return &AnalyticsResponse{
		ByState:    byState,
		ByPriority: byPriority,
		ByAssignee: byAssignee,
		ByLabel:    byLabel,
	}, nil
}

func (s *AnalyticsService) GetProjectAnalytics(ctx context.Context, projectID, userID uuid.UUID) (*AnalyticsResponse, error) {
	if _, err := s.ensureProjectAccess(ctx, projectID, userID); err != nil {
		return nil, err
	}

	byState := make(map[string]int64)
	if stateResults, err := s.as.GetProjectStateAnalytics(ctx, projectID); err == nil {
		for _, r := range stateResults {
			byState[r.State] = r.Count
		}
	} else {
		return nil, fmt.Errorf("fetch project state analytics: %w", err)
	}

	byPriority := make(map[string]int64)
	if priorityResults, err := s.as.GetProjectPriorityAnalytics(ctx, projectID); err == nil {
		for _, r := range priorityResults {
			byPriority[r.Priority] = r.Count
		}
	} else {
		return nil, fmt.Errorf("fetch project priority analytics: %w", err)
	}

	byAssignee := make(map[string]int64)
	if assigneeResults, err := s.as.GetProjectAssigneeAnalytics(ctx, projectID); err == nil {
		for _, r := range assigneeResults {
			byAssignee[r.Email] = r.Count
		}
	} else if s.log != nil {
		s.log.Warn("failed to fetch project assignee analytics", "error", err, "project_id", projectID)
	}

	byLabel := make(map[string]int64)
	if labelResults, err := s.as.GetProjectLabelAnalytics(ctx, projectID); err == nil {
		for _, r := range labelResults {
			byLabel[r.Label] = r.Count
		}
	} else if s.log != nil {
		s.log.Warn("failed to fetch project label analytics", "error", err, "project_id", projectID)
	}

	return &AnalyticsResponse{
		ByState:    byState,
		ByPriority: byPriority,
		ByAssignee: byAssignee,
		ByLabel:    byLabel,
	}, nil
}

func (s *AnalyticsService) ExportWorkspaceCSV(ctx context.Context, slug string, userID uuid.UUID) ([]model.WorkspaceIssueExport, error) {
	if _, err := s.ensureWorkspaceAccess(ctx, slug, userID); err != nil {
		return nil, err
	}
	return s.as.GetWorkspaceIssuesForExport(ctx, slug)
}

func (s *AnalyticsService) ExportProjectCSV(ctx context.Context, projectID, userID uuid.UUID) ([]model.ProjectIssueExport, error) {
	if _, err := s.ensureProjectAccess(ctx, projectID, userID); err != nil {
		return nil, err
	}
	return s.as.GetProjectIssuesForExport(ctx, projectID)
}
