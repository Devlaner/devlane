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
	ByState    map[string]int64   `json:"by_state"`
	ByPriority map[string]int64   `json:"by_priority"`
	ByAssignee map[string]int64   `json:"by_assignee"`
	ByLabel    map[string]int64   `json:"by_label"`
	Trend      []model.TrendPoint `json:"trend"`
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

// ensureProjectAccess checks that the project belongs to the workspace in the
// URL, that the caller is a member of that workspace, and that the project is
// visible to them (secret projects are hidden from non-members).
func (s *AnalyticsService) ensureProjectAccess(ctx context.Context, slug string, projectID, userID uuid.UUID) (*model.Project, error) {
	wrk, err := s.ensureWorkspaceAccess(ctx, slug, userID)
	if err != nil {
		return nil, err
	}
	project, err := s.ps.GetByID(ctx, projectID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrProjectNotFound
		}
		return nil, err
	}
	if project.WorkspaceID != wrk.ID {
		return nil, ErrProjectNotFound
	}
	if err := enforceProjectVisibility(ctx, s.ps, s.ws, wrk.ID, project.ID, userID); err != nil {
		return nil, err
	}
	return project, nil
}

func (s *AnalyticsService) GetWorkspaceAnalytics(ctx context.Context, slug string, userID uuid.UUID) (*AnalyticsResponse, error) {
	wrk, err := s.ensureWorkspaceAccess(ctx, slug, userID)
	if err != nil {
		return nil, err
	}
	vis := projectVisibilityFor(ctx, s.ws, wrk.ID, userID)

	byState := make(map[string]int64)
	if stateResults, err := s.as.GetWorkspaceStateAnalytics(ctx, slug, vis); err == nil {
		for _, r := range stateResults {
			byState[r.State] = r.Count
		}
	} else {
		return nil, fmt.Errorf("fetch workspace state analytics: %w", err)
	}

	byPriority := make(map[string]int64)
	if priorityResults, err := s.as.GetWorkspacePriorityAnalytics(ctx, slug, vis); err == nil {
		for _, r := range priorityResults {
			byPriority[r.Priority] = r.Count
		}
	} else {
		return nil, fmt.Errorf("fetch workspace priority analytics: %w", err)
	}

	byAssignee := make(map[string]int64)
	if assigneeResults, err := s.as.GetWorkspaceAssigneeAnalytics(ctx, slug, vis); err == nil {
		for _, r := range assigneeResults {
			byAssignee[r.Email] = r.Count
		}
	} else if s.log != nil {
		return nil, fmt.Errorf("fetch workspace assignee analytics: %w", err)
	}

	byLabel := make(map[string]int64)
	if labelResults, err := s.as.GetWorkspaceLabelAnalytics(ctx, slug, vis); err == nil {
		for _, r := range labelResults {
			byLabel[r.Label] = r.Count
		}
	} else if s.log != nil {
		return nil, fmt.Errorf("fetch workspace labels analytics: %w", err)
	}

	trend, err := s.as.GetWorkspaceTrendAnalytics(ctx, slug, vis)
	if err != nil {
		return nil, fmt.Errorf("fetch workspace trend analytics: %w", err)
	}

	return &AnalyticsResponse{
		ByState:    byState,
		ByPriority: byPriority,
		ByAssignee: byAssignee,
		ByLabel:    byLabel,
		Trend:      trend,
	}, nil
}

func (s *AnalyticsService) GetProjectAnalytics(ctx context.Context, slug string, projectID, userID uuid.UUID) (*AnalyticsResponse, error) {
	if _, err := s.ensureProjectAccess(ctx, slug, projectID, userID); err != nil {
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
		return nil, fmt.Errorf("fetch project assignee analytics: %w", err)
	}

	byLabel := make(map[string]int64)
	if labelResults, err := s.as.GetProjectLabelAnalytics(ctx, projectID); err == nil {
		for _, r := range labelResults {
			byLabel[r.Label] = r.Count
		}
	} else if s.log != nil {
		return nil, fmt.Errorf("fetch project labels analytics: %w", err)
	}

	trend, err := s.as.GetProjectTrendAnalytics(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("fetch project trend analytics: %w", err)
	}

	return &AnalyticsResponse{
		ByState:    byState,
		ByPriority: byPriority,
		ByAssignee: byAssignee,
		ByLabel:    byLabel,
		Trend:      trend,
	}, nil
}

func (s *AnalyticsService) ExportWorkspaceCSV(
	ctx context.Context,
	slug string,
	userID uuid.UUID,
	fn func(model.WorkspaceIssueExport) error,
) error {
	wrk, err := s.ensureWorkspaceAccess(ctx, slug, userID)
	if err != nil {
		return err
	}

	return s.as.StreamWorkspaceIssuesForExport(ctx, slug, projectVisibilityFor(ctx, s.ws, wrk.ID, userID), fn)
}

func (s *AnalyticsService) ExportProjectCSV(
	ctx context.Context,
	slug string,
	projectID, userID uuid.UUID,
	fn func(model.ProjectIssueExport) error,
) error {
	if _, err := s.ensureProjectAccess(ctx, slug, projectID, userID); err != nil {
		return err
	}

	return s.as.StreamProjectIssuesForExport(ctx, projectID, fn)
}
