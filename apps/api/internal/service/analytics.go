package service

import (
	"fmt"
	"log/slog"

	"gorm.io/gorm"
)

type analyticsService struct {
	store AnalyticsStore
	log   *slog.Logger
	// DB handles authorization / existence checks inside the service
}

func NewAnalyticsService(store AnalyticsStore, log *slog.Logger, db *gorm.DB) AnalyticsService {
	return &analyticsService{
		store: store,
		log:   log,
		db:    db,
	}
}

// checkWorkspaceAccess handles validation of workspace membership & workspace existence
func (s *analyticsService) checkWorkspaceAccess(userID string, slug string) error {
	var count int64
	// Simple validation to verify the workspace exists and the user is an active member
	err := s.db.Table("workspaces").
		Joins("INNER JOIN workspace_members ON workspaces.id = workspace_members.workspace_id").
		Where("workspaces.slug = ? AND workspace_members.user_id = ? AND workspaces.deleted_at IS NULL", slug, userID).
		Count(&count).Error

	if err != nil || count == 0 {
		return fmt.Errorf("unauthorized workspace access or workspace does not exist")
	}
	return nil
}

// checkProjectAccess validates project presence, project slugs/IDs, and membership
func (s *analyticsService) checkProjectAccess(userID string, projectID string) error {
	var count int64
	// Validates whether the project exists, and whether the user is authorized to access it
	err := s.db.Table("projects").
		Joins("INNER JOIN workspaces ON projects.workspace_id = workspaces.id").
		Joins("INNER JOIN workspace_members ON workspaces.id = workspace_members.workspace_id").
		Where("projects.id = ? AND workspace_members.user_id = ? AND projects.deleted_at IS NULL", projectID, userID).
		Count(&count).Error

	if err != nil || count == 0 {
		return fmt.Errorf("unauthorized project access or project does not exist")
	}
	return nil
}

func (s *analyticsService) GetWorkspaceAnalytics(userID string, slug string) (*AnalyticsResponse, error) {
	if err := s.checkWorkspaceAccess(userID, slug); err != nil {
		return nil, err
	}

	byState := make(map[string]int64)
	if stateResults, err := s.store.GetWorkspaceStateAnalytics(slug); err == nil {
		for _, r := range stateResults {
			byState[r.State] = r.Count
		}
	} else {
		return nil, err
	}

	byPriority := make(map[string]int64)
	if priorityResults, err := s.store.GetWorkspacePriorityAnalytics(slug); err == nil {
		for _, r := range priorityResults {
			byPriority[r.Priority] = r.Count
		}
	} else {
		return nil, err
	}

	byAssignee := make(map[string]int64)
	if assigneeResults, err := s.store.GetWorkspaceAssigneeAnalytics(slug); err == nil {
		for _, r := range assigneeResults {
			byAssignee[r.Email] = r.Count
		}
	} else {
		s.log.Warn("failed to fetch workspace assignee analytics", "error", err)
	}

	byLabel := make(map[string]int64)
	if labelResults, err := s.store.GetWorkspaceLabelAnalytics(slug); err == nil {
		for _, r := range labelResults {
			byLabel[r.Label] = r.Count
		}
	} else {
		s.log.Warn("failed to fetch workspace label analytics", "error", err)
	}

	return &AnalyticsResponse{
		ByState:    byState,
		ByPriority: byPriority,
		ByAssignee: byAssignee,
		ByLabel:    byLabel,
	}, nil
}

func (s *analyticsService) GetProjectAnalytics(userID string, projectID string) (*AnalyticsResponse, error) {
	if err := s.checkProjectAccess(userID, projectID); err != nil {
		return nil, err
	}

	byState := make(map[string]int64)
	if stateResults, err := s.store.GetProjectStateAnalytics(projectID); err == nil {
		for _, r := range stateResults {
			byState[r.State] = r.Count
		}
	} else {
		return nil, err
	}

	byPriority := make(map[string]int64)
	if priorityResults, err := s.store.GetProjectPriorityAnalytics(projectID); err == nil {
		for _, r := range priorityResults {
			byPriority[r.Priority] = r.Count
		}
	}

	byAssignee := make(map[string]int64)
	if assigneeResults, err := s.store.GetProjectAssigneeAnalytics(projectID); err == nil {
		for _, r := range assigneeResults {
			byAssignee[r.Email] = r.Count
		}
	}

	byLabel := make(map[string]int64)
	if labelResults, err := s.store.GetProjectLabelAnalytics(projectID); err == nil {
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

func (s *analyticsService) ExportWorkspaceCSV(userID string, slug string) ([]WorkspaceIssueExport, error) {
	if err := s.checkWorkspaceAccess(userID, slug); err != nil {
		return nil, err
	}
	return s.store.GetWorkspaceIssuesForExport(slug)
}

func (s *analyticsService) ExportProjectCSV(userID string, projectID string) ([]ProjectIssueExport, error) {
	if err := s.checkProjectAccess(userID, projectID); err != nil {
		return nil, err
	}
	return s.store.GetProjectIssuesForExport(projectID)
}
