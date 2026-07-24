package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
)

var (
	ErrAnalyticsForbidden = errors.New("unauthorized workspace/project access")
	ErrAnalyticsNotFound  = errors.New("workspace or project not found")
)

type AnalyticsService interface {
	GetWorkspaceAnalytics(ctx context.Context, userID uuid.UUID, slug string) (*AnalyticsResponse, error)
	GetProjectAnalytics(ctx context.Context, userID uuid.UUID, projectID uuid.UUID) (*AnalyticsResponse, error)
	ExportWorkspaceCSV(ctx context.Context, userID uuid.UUID, slug string) ([]WorkspaceIssueExport, error)
	ExportProjectCSV(ctx context.Context, userID uuid.UUID, projectID uuid.UUID) ([]ProjectIssueExport, error)
}

type analyticsService struct {
	store store.AnalyticsStore
	ws    *store.WorkspaceStore
	ps    *store.ProjectStore
	log   *slog.Logger
}

func NewAnalyticsService(store store.AnalyticsStore, ws *store.WorkspaceStore, ps *store.ProjectStore, log *slog.Logger) AnalyticsService {
	return &analyticsService{
		store: store,
		ws:    ws,
		ps:    ps,
		log:   log,
	}
}

func (s *analyticsService) ensureWorkspaceAccess(ctx context.Context, userID uuid.UUID, slug string) error {
	wrk, err := s.ws.GetBySlug(ctx, slug)
	if err != nil || wrk == nil {
		return ErrAnalyticsNotFound
	}
	ok, err := s.ws.IsMember(ctx, wrk.ID, userID)
	if err != nil || !ok {
		return ErrAnalyticsForbidden
	}
	return nil
}

func (s *analyticsService) ensureProjectAccess(ctx context.Context, userID uuid.UUID, projectID uuid.UUID) error {
	project, err := s.ps.GetByID(ctx, projectID)
	if err != nil || project == nil {
		return ErrAnalyticsNotFound
	}
	ok, err := s.ws.IsMember(ctx, project.WorkspaceID, userID)
	if err != nil || !ok {
		return ErrAnalyticsForbidden
	}
	return nil
}

func (s *analyticsService) GetWorkspaceAnalytics(ctx context.Context, userID uuid.UUID, slug string) (*AnalyticsResponse, error) {
	if err := s.ensureWorkspaceAccess(ctx, userID, slug); err != nil {
		return nil, err
	}

	byState := make(map[string]int64)
	if stateResults, err := s.store.GetWorkspaceStateAnalytics(ctx, slug); err == nil {
		for _, r := range stateResults {
			byState[r.State] = r.Count
		}
	} else {
		return nil, fmt.Errorf("fetch workspace state analytics: %w", err)
	}

	byPriority := make(map[string]int64)
	if priorityResults, err := s.store.GetWorkspacePriorityAnalytics(ctx, slug); err == nil {
		for _, r := range priorityResults {
			byPriority[r.Priority] = r.Count
		}
	} else {
		return nil, fmt.Errorf("fetch workspace priority analytics: %w", err)
	}

	byAssignee := make(map[string]int64)
	if assigneeResults, err := s.store.GetWorkspaceAssigneeAnalytics(ctx, slug); err == nil {
		for _, r := range assigneeResults {
			byAssignee[r.Email] = r.Count
		}
	} else if s.log != nil {
		s.log.Warn("failed to fetch workspace assignee analytics", "error", err, "slug", slug)
	}

	byLabel := make(map[string]int64)
	if labelResults, err := s.store.GetWorkspaceLabelAnalytics(ctx, slug); err == nil {
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

func (s *analyticsService) GetProjectAnalytics(ctx context.Context, userID uuid.UUID, projectID uuid.UUID) (*AnalyticsResponse, error) {
	if err := s.ensureProjectAccess(ctx, userID, projectID); err != nil {
		return nil, err
	}

	byState := make(map[string]int64)
	if stateResults, err := s.store.GetProjectStateAnalytics(ctx, projectID); err == nil {
		for _, r := range stateResults {
			byState[r.State] = r.Count
		}
	} else {
		return nil, fmt.Errorf("fetch project state analytics: %w", err)
	}

	byPriority := make(map[string]int64)
	if priorityResults, err := s.store.GetProjectPriorityAnalytics(ctx, projectID); err == nil {
		for _, r := range priorityResults {
			byPriority[r.Priority] = r.Count
		}
	}

	byAssignee := make(map[string]int64)
	if assigneeResults, err := s.store.GetProjectAssigneeAnalytics(ctx, projectID); err == nil {
		for _, r := range assigneeResults {
			byAssignee[r.Email] = r.Count
		}
	}

	byLabel := make(map[string]int64)
	if labelResults, err := s.store.GetProjectLabelAnalytics(ctx, projectID); err == nil {
		for _, r := range labelResults {
			byLabel[r.Label] = r.Count
		}
	}

	return &AnalyticsResponse{
		ByState:    byState,
		ByPriority: byPriority,
		ByAssignee: byAssignee,
		ByLabel:    byLabel,
	}, nil
}

func (s *analyticsService) ExportWorkspaceCSV(ctx context.Context, userID uuid.UUID, slug string) ([]WorkspaceIssueExport, error) {
	if err := s.ensureWorkspaceAccess(ctx, userID, slug); err != nil {
		return nil, err
	}
	return s.store.GetWorkspaceIssuesForExport(ctx, slug)
}

func (s *analyticsService) ExportProjectCSV(ctx context.Context, userID uuid.UUID, projectID uuid.UUID) ([]ProjectIssueExport, error) {
	if err := s.ensureProjectAccess(ctx, userID, projectID); err != nil {
		return nil, err
	}
	return s.store.GetProjectIssuesForExport(ctx, projectID)
}
