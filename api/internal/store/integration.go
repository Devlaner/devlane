package store

import (
	"context"
	"time"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// IntegrationStore handles the integration provider registry.
type IntegrationStore struct{ db *gorm.DB }

func NewIntegrationStore(db *gorm.DB) *IntegrationStore { return &IntegrationStore{db: db} }

func (s *IntegrationStore) List(ctx context.Context) ([]model.Integration, error) {
	var list []model.Integration
	err := s.db.WithContext(ctx).Order("title ASC").Find(&list).Error
	return list, err
}

func (s *IntegrationStore) GetByProvider(ctx context.Context, provider string) (*model.Integration, error) {
	var i model.Integration
	err := s.db.WithContext(ctx).Where("provider = ?", provider).First(&i).Error
	if err != nil {
		return nil, err
	}
	return &i, nil
}

// WorkspaceIntegrationStore handles workspace-scoped integration installations.
type WorkspaceIntegrationStore struct{ db *gorm.DB }

func NewWorkspaceIntegrationStore(db *gorm.DB) *WorkspaceIntegrationStore {
	return &WorkspaceIntegrationStore{db: db}
}

func (s *WorkspaceIntegrationStore) Create(ctx context.Context, w *model.WorkspaceIntegration) error {
	return s.db.WithContext(ctx).Create(w).Error
}

func (s *WorkspaceIntegrationStore) Update(ctx context.Context, w *model.WorkspaceIntegration) error {
	return s.db.WithContext(ctx).Save(w).Error
}

func (s *WorkspaceIntegrationStore) GetByID(ctx context.Context, id uuid.UUID) (*model.WorkspaceIntegration, error) {
	var w model.WorkspaceIntegration
	err := s.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&w).Error
	if err != nil {
		return nil, err
	}
	return &w, nil
}

func (s *WorkspaceIntegrationStore) GetByInstallationID(ctx context.Context, installationID int64) (*model.WorkspaceIntegration, error) {
	var w model.WorkspaceIntegration
	err := s.db.WithContext(ctx).Where("installation_id = ? AND deleted_at IS NULL", installationID).First(&w).Error
	if err != nil {
		return nil, err
	}
	return &w, nil
}

func (s *WorkspaceIntegrationStore) GetByWorkspaceAndProvider(ctx context.Context, workspaceID uuid.UUID, provider string) (*model.WorkspaceIntegration, error) {
	var w model.WorkspaceIntegration
	err := s.db.WithContext(ctx).
		Table("workspace_integrations AS wi").
		Select("wi.*, integrations.provider AS provider").
		Joins("INNER JOIN integrations ON integrations.id = wi.integration_id").
		Where("wi.workspace_id = ? AND integrations.provider = ? AND wi.deleted_at IS NULL", workspaceID, provider).
		First(&w).Error
	if err != nil {
		return nil, err
	}
	return &w, nil
}

func (s *WorkspaceIntegrationStore) ListByWorkspaceID(ctx context.Context, workspaceID uuid.UUID) ([]model.WorkspaceIntegration, error) {
	var list []model.WorkspaceIntegration
	err := s.db.WithContext(ctx).
		Table("workspace_integrations AS wi").
		Select("wi.*, integrations.provider AS provider").
		Joins("INNER JOIN integrations ON integrations.id = wi.integration_id").
		Where("wi.workspace_id = ? AND wi.deleted_at IS NULL", workspaceID).
		Order("wi.created_at DESC").
		Find(&list).Error
	return list, err
}

func (s *WorkspaceIntegrationStore) Delete(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&model.WorkspaceIntegration{}).Error
}

// MarkSuspended toggles suspension state (GitHub fires installation.suspend / unsuspend).
func (s *WorkspaceIntegrationStore) MarkSuspended(ctx context.Context, id uuid.UUID, suspended bool) error {
	updates := map[string]interface{}{}
	if suspended {
		now := time.Now().UTC()
		updates["suspended_at"] = &now
	} else {
		updates["suspended_at"] = nil
	}
	return s.db.WithContext(ctx).Model(&model.WorkspaceIntegration{}).
		Where("id = ?", id).
		Updates(updates).Error
}

// GithubRepositoryStore handles github_repositories rows.
type GithubRepositoryStore struct{ db *gorm.DB }

func NewGithubRepositoryStore(db *gorm.DB) *GithubRepositoryStore {
	return &GithubRepositoryStore{db: db}
}

func (s *GithubRepositoryStore) Create(ctx context.Context, r *model.GithubRepository) error {
	return s.db.WithContext(ctx).Create(r).Error
}

func (s *GithubRepositoryStore) GetByID(ctx context.Context, id uuid.UUID) (*model.GithubRepository, error) {
	var r model.GithubRepository
	err := s.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&r).Error
	if err != nil {
		return nil, err
	}
	return &r, nil
}

func (s *GithubRepositoryStore) GetByRepositoryID(ctx context.Context, workspaceID uuid.UUID, repositoryID int64) ([]model.GithubRepository, error) {
	var list []model.GithubRepository
	err := s.db.WithContext(ctx).
		Where("workspace_id = ? AND repository_id = ? AND deleted_at IS NULL", workspaceID, repositoryID).
		Find(&list).Error
	return list, err
}

func (s *GithubRepositoryStore) Update(ctx context.Context, r *model.GithubRepository) error {
	return s.db.WithContext(ctx).Save(r).Error
}

func (s *GithubRepositoryStore) Delete(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&model.GithubRepository{}).Error
}

// GithubRepositorySyncStore handles github_repository_syncs rows.
type GithubRepositorySyncStore struct{ db *gorm.DB }

func NewGithubRepositorySyncStore(db *gorm.DB) *GithubRepositorySyncStore {
	return &GithubRepositorySyncStore{db: db}
}

func (s *GithubRepositorySyncStore) Create(ctx context.Context, r *model.GithubRepositorySync) error {
	return s.db.WithContext(ctx).Create(r).Error
}

func (s *GithubRepositorySyncStore) GetByID(ctx context.Context, id uuid.UUID) (*model.GithubRepositorySync, error) {
	var r model.GithubRepositorySync
	err := s.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&r).Error
	if err != nil {
		return nil, err
	}
	return &r, nil
}

func (s *GithubRepositorySyncStore) GetByProjectID(ctx context.Context, projectID uuid.UUID) (*model.GithubRepositorySync, error) {
	var r model.GithubRepositorySync
	err := s.db.WithContext(ctx).Where("project_id = ? AND deleted_at IS NULL", projectID).First(&r).Error
	if err != nil {
		return nil, err
	}
	return &r, nil
}

// ListByWorkspaceIntegrationID returns all repo syncs for an installed integration.
// Used to fan webhook events out across linked projects.
func (s *GithubRepositorySyncStore) ListByWorkspaceIntegrationID(ctx context.Context, integrationID uuid.UUID) ([]model.GithubRepositorySync, error) {
	var list []model.GithubRepositorySync
	err := s.db.WithContext(ctx).
		Where("workspace_integration_id = ? AND deleted_at IS NULL", integrationID).
		Find(&list).Error
	return list, err
}

// ListByGithubRepoID returns syncs across projects within a workspace pointing
// at the same GitHub repository_id. We join to github_repositories so the
// caller can find every Devlane project linked to a given repo.
func (s *GithubRepositorySyncStore) ListByGithubRepoID(ctx context.Context, workspaceID uuid.UUID, repositoryID int64) ([]model.GithubRepositorySync, error) {
	var list []model.GithubRepositorySync
	err := s.db.WithContext(ctx).
		Table("github_repository_syncs AS s").
		Select("s.*").
		Joins("INNER JOIN github_repositories AS r ON r.id = s.repository_id AND r.deleted_at IS NULL").
		Where("s.workspace_id = ? AND r.repository_id = ? AND s.deleted_at IS NULL", workspaceID, repositoryID).
		Find(&list).Error
	return list, err
}

func (s *GithubRepositorySyncStore) Update(ctx context.Context, r *model.GithubRepositorySync) error {
	return s.db.WithContext(ctx).Save(r).Error
}

func (s *GithubRepositorySyncStore) Delete(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&model.GithubRepositorySync{}).Error
}

// GithubIssueSyncStore handles github_issue_syncs rows (PR↔issue links).
type GithubIssueSyncStore struct{ db *gorm.DB }

func NewGithubIssueSyncStore(db *gorm.DB) *GithubIssueSyncStore {
	return &GithubIssueSyncStore{db: db}
}

func (s *GithubIssueSyncStore) Create(ctx context.Context, g *model.GithubIssueSync) error {
	return s.db.WithContext(ctx).Create(g).Error
}

func (s *GithubIssueSyncStore) Update(ctx context.Context, g *model.GithubIssueSync) error {
	return s.db.WithContext(ctx).Save(g).Error
}

func (s *GithubIssueSyncStore) GetByID(ctx context.Context, id uuid.UUID) (*model.GithubIssueSync, error) {
	var g model.GithubIssueSync
	err := s.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&g).Error
	if err != nil {
		return nil, err
	}
	return &g, nil
}

// GetByPR returns the link for a (repository_sync, repo_issue_id, kind) tuple.
func (s *GithubIssueSyncStore) GetByPR(ctx context.Context, repositorySyncID uuid.UUID, repoIssueID int64, kind string) (*model.GithubIssueSync, error) {
	var g model.GithubIssueSync
	err := s.db.WithContext(ctx).
		Where("repository_sync_id = ? AND repo_issue_id = ? AND kind = ? AND deleted_at IS NULL", repositorySyncID, repoIssueID, kind).
		First(&g).Error
	if err != nil {
		return nil, err
	}
	return &g, nil
}

// ListByPR returns every link for a (repository_sync, repo_issue_id, kind) — a
// PR may reference multiple issues.
func (s *GithubIssueSyncStore) ListByPR(ctx context.Context, repositorySyncID uuid.UUID, repoIssueID int64, kind string) ([]model.GithubIssueSync, error) {
	var list []model.GithubIssueSync
	err := s.db.WithContext(ctx).
		Where("repository_sync_id = ? AND repo_issue_id = ? AND kind = ? AND deleted_at IS NULL", repositorySyncID, repoIssueID, kind).
		Find(&list).Error
	return list, err
}

// ListByIssueID returns all GitHub PR links for a Devlane issue (for the issue
// detail sidebar).
func (s *GithubIssueSyncStore) ListByIssueID(ctx context.Context, issueID uuid.UUID) ([]model.GithubIssueSync, error) {
	var list []model.GithubIssueSync
	err := s.db.WithContext(ctx).
		Where("issue_id = ? AND deleted_at IS NULL", issueID).
		Order("updated_at DESC").
		Find(&list).Error
	return list, err
}

// UpsertByPRAndIssue creates or updates the link for a (sync, repo_issue, issue) tuple.
func (s *GithubIssueSyncStore) UpsertByPRAndIssue(ctx context.Context, g *model.GithubIssueSync) (*model.GithubIssueSync, error) {
	var existing model.GithubIssueSync
	err := s.db.WithContext(ctx).
		Where("repository_sync_id = ? AND repo_issue_id = ? AND issue_id = ? AND kind = ? AND deleted_at IS NULL",
			g.RepositorySyncID, g.RepoIssueID, g.IssueID, g.Kind).
		First(&existing).Error
	if err == gorm.ErrRecordNotFound {
		if err := s.db.WithContext(ctx).Create(g).Error; err != nil {
			return nil, err
		}
		return g, nil
	}
	if err != nil {
		return nil, err
	}
	// Preserve identity of existing row, copy mutable fields.
	existing.GithubIssueID = g.GithubIssueID
	existing.IssueURL = g.IssueURL
	existing.State = g.State
	existing.Title = g.Title
	existing.Draft = g.Draft
	existing.MergedAt = g.MergedAt
	existing.ClosedAt = g.ClosedAt
	existing.AuthorLogin = g.AuthorLogin
	existing.BaseBranch = g.BaseBranch
	existing.HeadBranch = g.HeadBranch
	if g.DetectionSource != "" {
		existing.DetectionSource = g.DetectionSource
	}
	if err := s.db.WithContext(ctx).Save(&existing).Error; err != nil {
		return nil, err
	}
	return &existing, nil
}

func (s *GithubIssueSyncStore) Delete(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&model.GithubIssueSync{}).Error
}

// IssueSummary aggregates PR counts per issue, used by the issues list page
// to show a small badge next to each row. The map only includes issues that
// have at least one link; absent IDs in the map mean "no PRs".
type IssueSummary struct {
	IssueID     uuid.UUID `json:"issue_id"`
	Total       int       `json:"total"`
	Open        int       `json:"open"`
	Merged      int       `json:"merged"`
	Closed      int       `json:"closed"`
	Draft       int       `json:"draft"`
	LatestState string    `json:"latest_state"` // state of the most recently updated link
}

// SummaryForIssues runs one aggregate query per project for a slice of issue IDs.
func (s *GithubIssueSyncStore) SummaryForIssues(ctx context.Context, projectID uuid.UUID, issueIDs []uuid.UUID) (map[uuid.UUID]IssueSummary, error) {
	out := make(map[uuid.UUID]IssueSummary)
	if len(issueIDs) == 0 {
		return out, nil
	}
	type row struct {
		IssueID uuid.UUID
		Total   int
		Open    int
		Merged  int
		Closed  int
		Draft   int
	}
	var rows []row
	err := s.db.WithContext(ctx).
		Table("github_issue_syncs").
		Select(`issue_id,
			COUNT(*)                                                AS total,
			SUM(CASE WHEN state = 'open'   THEN 1 ELSE 0 END)       AS open,
			SUM(CASE WHEN state = 'merged' THEN 1 ELSE 0 END)       AS merged,
			SUM(CASE WHEN state = 'closed' THEN 1 ELSE 0 END)       AS closed,
			SUM(CASE WHEN draft = TRUE     THEN 1 ELSE 0 END)       AS draft`).
		Where("project_id = ? AND issue_id IN ? AND deleted_at IS NULL AND kind = 'pull_request'", projectID, issueIDs).
		Group("issue_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	// Latest state per issue (newest updated_at wins).
	type latest struct {
		IssueID uuid.UUID
		State   string
	}
	var latestRows []latest
	err = s.db.WithContext(ctx).Raw(`
		SELECT DISTINCT ON (issue_id) issue_id, state
		FROM github_issue_syncs
		WHERE project_id = ? AND issue_id IN ? AND deleted_at IS NULL AND kind = 'pull_request'
		ORDER BY issue_id, updated_at DESC
	`, projectID, issueIDs).Scan(&latestRows).Error
	if err != nil {
		return nil, err
	}
	latestByID := make(map[uuid.UUID]string, len(latestRows))
	for _, l := range latestRows {
		latestByID[l.IssueID] = l.State
	}

	for _, r := range rows {
		out[r.IssueID] = IssueSummary{
			IssueID:     r.IssueID,
			Total:       r.Total,
			Open:        r.Open,
			Merged:      r.Merged,
			Closed:      r.Closed,
			Draft:       r.Draft,
			LatestState: latestByID[r.IssueID],
		}
	}
	return out, nil
}

// GithubWebhookEventStore handles inbound webhook log rows.
type GithubWebhookEventStore struct{ db *gorm.DB }

func NewGithubWebhookEventStore(db *gorm.DB) *GithubWebhookEventStore {
	return &GithubWebhookEventStore{db: db}
}

func (s *GithubWebhookEventStore) Create(ctx context.Context, e *model.GithubWebhookEvent) error {
	return s.db.WithContext(ctx).Create(e).Error
}

func (s *GithubWebhookEventStore) MarkProcessed(ctx context.Context, id uuid.UUID, status, errMsg string) error {
	now := time.Now().UTC()
	return s.db.WithContext(ctx).Model(&model.GithubWebhookEvent{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"status":       status,
			"error":        errMsg,
			"processed_at": &now,
		}).Error
}

// ExistsByDeliveryID returns true if a webhook delivery has already been recorded.
// Used for idempotency — GitHub may retry deliveries.
func (s *GithubWebhookEventStore) ExistsByDeliveryID(ctx context.Context, deliveryID string) (bool, error) {
	var count int64
	err := s.db.WithContext(ctx).Model(&model.GithubWebhookEvent{}).
		Where("delivery_id = ?", deliveryID).
		Count(&count).Error
	return count > 0, err
}
