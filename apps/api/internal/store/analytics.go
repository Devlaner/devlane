package store

import (
	"context"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AnalyticsStore struct {
	db *gorm.DB
}

func NewAnalyticsStore(db *gorm.DB) *AnalyticsStore {
	return &AnalyticsStore{db: db}
}

func (s *AnalyticsStore) GetWorkspaceStateAnalytics(ctx context.Context, slug string) ([]model.StateCount, error) {
	var results []model.StateCount
	err := s.db.WithContext(ctx).
		Table("issues").
		Select("issues.state, COUNT(*) as count").
		Joins("JOIN workspaces ON issues.workspace_id = workspaces.id").
		Joins("JOIN projects ON issues.project_id = projects.id").
		Where("workspaces.slug = ? AND issues.deleted_at IS NULL AND workspaces.deleted_at IS NULL AND projects.deleted_at IS NULL", slug).
		Group("issues.state").
		Scan(&results).Error

	return results, err
}

func (s *AnalyticsStore) GetWorkspacePriorityAnalytics(ctx context.Context, slug string) ([]model.PriorityCount, error) {
	var results []model.PriorityCount
	err := s.db.WithContext(ctx).
		Table("issues").
		Select("issues.priority, COUNT(*) as count").
		Joins("JOIN workspaces ON issues.workspace_id = workspaces.id").
		Joins("JOIN projects ON issues.project_id = projects.id").
		Where("workspaces.slug = ? AND issues.deleted_at IS NULL AND workspaces.deleted_at IS NULL AND projects.deleted_at IS NULL", slug).
		Group("issues.priority").
		Scan(&results).Error

	return results, err
}

func (s *AnalyticsStore) GetWorkspaceAssigneeAnalytics(ctx context.Context, slug string) ([]model.AssigneeCount, error) {
	var results []model.AssigneeCount
	err := s.db.WithContext(ctx).
		Table("issues").
		Select("users.email, COUNT(*) as count").
		Joins("JOIN workspaces ON issues.workspace_id = workspaces.id").
		Joins("JOIN projects ON issues.project_id = projects.id").
		Joins("JOIN users ON issues.assignee_id = users.id").
		Where("workspaces.slug = ? AND issues.deleted_at IS NULL AND workspaces.deleted_at IS NULL AND projects.deleted_at IS NULL", slug).
		Group("users.email").
		Scan(&results).Error

	return results, err
}

func (s *AnalyticsStore) GetWorkspaceLabelAnalytics(ctx context.Context, slug string) ([]model.LabelCount, error) {
	var results []model.LabelCount
	err := s.db.WithContext(ctx).
		Table("issue_labels").
		Select("labels.name as label, COUNT(*) as count").
		Joins("JOIN issues ON issue_labels.issue_id = issues.id").
		Joins("JOIN labels ON issue_labels.label_id = labels.id").
		Joins("JOIN workspaces ON issues.workspace_id = workspaces.id").
		Joins("JOIN projects ON issues.project_id = projects.id").
		Where("workspaces.slug = ? AND issues.deleted_at IS NULL AND workspaces.deleted_at IS NULL AND projects.deleted_at IS NULL", slug).
		Group("labels.name").
		Scan(&results).Error

	return results, err
}

func (s *AnalyticsStore) GetProjectStateAnalytics(ctx context.Context, projectID uuid.UUID) ([]model.StateCount, error) {
	var results []model.StateCount
	err := s.db.WithContext(ctx).
		Table("issues").
		Select("state, COUNT(*) as count").
		Where("project_id = ? AND deleted_at IS NULL", projectID).
		Group("state").
		Scan(&results).Error

	return results, err
}

func (s *AnalyticsStore) GetProjectPriorityAnalytics(ctx context.Context, projectID uuid.UUID) ([]model.PriorityCount, error) {
	var results []model.PriorityCount
	err := s.db.WithContext(ctx).
		Table("issues").
		Select("priority, COUNT(*) as count").
		Where("project_id = ? AND deleted_at IS NULL", projectID).
		Group("priority").
		Scan(&results).Error

	return results, err
}

func (s *AnalyticsStore) GetProjectAssigneeAnalytics(ctx context.Context, projectID uuid.UUID) ([]model.AssigneeCount, error) {
	var results []model.AssigneeCount
	err := s.db.WithContext(ctx).
		Table("issues").
		Select("users.email, COUNT(*) as count").
		Joins("JOIN users ON issues.assignee_id = users.id").
		Where("issues.project_id = ? AND issues.deleted_at IS NULL", projectID).
		Group("users.email").
		Scan(&results).Error

	return results, err
}

func (s *AnalyticsStore) GetProjectLabelAnalytics(ctx context.Context, projectID uuid.UUID) ([]model.LabelCount, error) {
	var results []model.LabelCount
	err := s.db.WithContext(ctx).
		Table("issue_labels").
		Select("labels.name as label, COUNT(*) as count").
		Joins("JOIN issues ON issue_labels.issue_id = issues.id").
		Joins("JOIN labels ON issue_labels.label_id = labels.id").
		Where("issues.project_id = ? AND issues.deleted_at IS NULL", projectID).
		Group("labels.name").
		Scan(&results).Error

	return results, err
}

func (s *AnalyticsStore) StreamWorkspaceIssuesForExport(ctx context.Context, slug string, fn func(model.WorkspaceIssueExport) error) error {
	rows, err := s.db.WithContext(ctx).
		Table("issues").
		Select("issues.id AS id, issues.name AS name, issues.state AS state, issues.priority AS priority").
		Joins("JOIN workspaces ON issues.workspace_id = workspaces.id").
		Joins("JOIN projects ON issues.project_id = projects.id").
		Where("workspaces.slug = ? AND issues.deleted_at IS NULL AND workspaces.deleted_at IS NULL AND projects.deleted_at IS NULL", slug).
		Rows()
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var item model.WorkspaceIssueExport
		if err := s.db.ScanRows(rows, &item); err != nil {
			return err
		}
		if err := fn(item); err != nil {
			return err
		}
	}
	return rows.Err()
}

func (s *AnalyticsStore) StreamProjectIssuesForExport(ctx context.Context, projectID uuid.UUID, fn func(model.ProjectIssueExport) error) error {
	rows, err := s.db.WithContext(ctx).
		Table("issues").
		Select("issues.id AS id, issues.name AS name, issues.state AS state").
		Where("project_id = ? AND deleted_at IS NULL", projectID).
		Rows()
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var item model.ProjectIssueExport
		if err := s.db.ScanRows(rows, &item); err != nil {
			return err
		}
		if err := fn(item); err != nil {
			return err
		}
	}
	return rows.Err()
}

func (s *AnalyticsStore) GetWorkspaceTrendAnalytics(ctx context.Context, slug string) ([]model.TrendPoint, error) {
	var results []model.TrendPoint
	err := s.db.WithContext(ctx).
		Table("issues").
		Select("DATE(issues.created_at) AS date, "+
			"COUNT(CASE WHEN issues.created_at IS NOT NULL THEN 1 END) AS created, "+
			"COUNT(CASE WHEN issues.state = 'resolved' THEN 1 END) AS resolved").
		Joins("JOIN workspaces ON issues.workspace_id = workspaces.id").
		Joins("JOIN projects ON issues.project_id = projects.id").
		Where("workspaces.slug = ? AND issues.deleted_at IS NULL AND workspaces.deleted_at IS NULL AND projects.deleted_at IS NULL", slug).
		Group("DATE(issues.created_at)").
		Order("date ASC").
		Scan(&results).Error

	return results, err
}

func (s *AnalyticsStore) GetProjectTrendAnalytics(ctx context.Context, projectID uuid.UUID) ([]model.TrendPoint, error) {
	var results []model.TrendPoint
	err := s.db.WithContext(ctx).
		Table("issues").
		Select("DATE(created_at) AS date, "+
			"COUNT(CASE WHEN created_at IS NOT NULL THEN 1 END) AS created, "+
			"COUNT(CASE WHEN state = 'resolved' THEN 1 END) AS resolved").
		Where("project_id = ? AND deleted_at IS NULL", projectID).
		Group("DATE(created_at)").
		Order("date ASC").
		Scan(&results).Error

	return results, err
}
