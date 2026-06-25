package store

import (
	"context"
	"encoding/binary"
	"time"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// IssueStore handles issue persistence.
type IssueStore struct{ db *gorm.DB }

func NewIssueStore(db *gorm.DB) *IssueStore { return &IssueStore{db: db} }

func (s *IssueStore) Create(ctx context.Context, i *model.Issue) error {
	return s.db.WithContext(ctx).Create(i).Error
}

// Transaction runs fn inside a DB transaction (same connection).
func (s *IssueStore) Transaction(ctx context.Context, fn func(tx *gorm.DB) error) error {
	return s.db.WithContext(ctx).Transaction(fn)
}

// NextSequenceID returns the next per-project issue number (1-based), serialized with an advisory lock.
func (s *IssueStore) NextSequenceID(ctx context.Context, tx *gorm.DB, projectID uuid.UUID) (int, error) {
	k1 := int32(binary.BigEndian.Uint32(projectID[0:4]))
	k2 := int32(binary.BigEndian.Uint32(projectID[4:8]))
	if err := tx.Exec("SELECT pg_advisory_xact_lock(?, ?)", k1, k2).Error; err != nil {
		return 0, err
	}
	var max int
	err := tx.WithContext(ctx).Raw(
		`SELECT COALESCE(MAX(sequence_id), 0) FROM issues WHERE project_id = ? AND deleted_at IS NULL`,
		projectID,
	).Scan(&max).Error
	if err != nil {
		return 0, err
	}
	return max + 1, nil
}

func (s *IssueStore) GetByID(ctx context.Context, id uuid.UUID) (*model.Issue, error) {
	var i model.Issue
	err := s.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&i).Error
	if err != nil {
		return nil, err
	}
	return &i, nil
}

// GetByProjectAndSequence resolves the per-project sequence number to an issue.
// Used by the GitHub integration to map "DEV-42" → an issue.
func (s *IssueStore) GetByProjectAndSequence(ctx context.Context, projectID uuid.UUID, sequenceID int) (*model.Issue, error) {
	var i model.Issue
	err := s.db.WithContext(ctx).
		Where("project_id = ? AND sequence_id = ? AND deleted_at IS NULL", projectID, sequenceID).
		First(&i).Error
	if err != nil {
		return nil, err
	}
	return &i, nil
}

// ListByIDs returns issues by IDs (order not preserved).
func (s *IssueStore) ListByIDs(ctx context.Context, ids []uuid.UUID) ([]model.Issue, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	var list []model.Issue
	err := s.db.WithContext(ctx).Where("id IN ? AND deleted_at IS NULL", ids).Find(&list).Error
	return list, err
}

func (s *IssueStore) ListByProjectID(ctx context.Context, projectID uuid.UUID, limit, offset int) ([]model.Issue, error) {
	var list []model.Issue
	q := s.db.WithContext(ctx).
		Where("project_id = ? AND deleted_at IS NULL AND archived_at IS NULL", projectID).
		Order("sort_order ASC, created_at DESC")
	if limit > 0 {
		q = q.Limit(limit)
	}
	if offset > 0 {
		q = q.Offset(offset)
	}
	err := q.Find(&list).Error
	return list, err
}

// ListArchivedByProjectID returns archived (non-deleted) issues for a project.
func (s *IssueStore) ListArchivedByProjectID(ctx context.Context, projectID uuid.UUID, limit, offset int) ([]model.Issue, error) {
	var list []model.Issue
	q := s.db.WithContext(ctx).
		Where("project_id = ? AND deleted_at IS NULL AND archived_at IS NOT NULL", projectID).
		Order("archived_at DESC")
	if limit > 0 {
		q = q.Limit(limit)
	}
	if offset > 0 {
		q = q.Offset(offset)
	}
	err := q.Find(&list).Error
	return list, err
}

// ListArchivedByWorkspaceID lists archived (non-deleted) issues across all
// projects in a workspace, most-recently-archived first.
func (s *IssueStore) ListArchivedByWorkspaceID(ctx context.Context, workspaceID uuid.UUID, limit, offset int) ([]model.Issue, error) {
	var list []model.Issue
	q := s.db.WithContext(ctx).
		Where("workspace_id = ? AND deleted_at IS NULL AND archived_at IS NOT NULL", workspaceID).
		Order("archived_at DESC")
	if limit > 0 {
		q = q.Limit(limit)
	}
	if offset > 0 {
		q = q.Offset(offset)
	}
	err := q.Find(&list).Error
	return list, err
}

// SetArchived archives (sets archived_at) or restores (clears archived_at) an
// issue. archived_at is the source of truth for archived state.
func (s *IssueStore) SetArchived(ctx context.Context, id uuid.UUID, archived bool) error {
	updates := map[string]any{"archived_at": nil}
	if archived {
		updates["archived_at"] = time.Now()
	}
	return s.db.WithContext(ctx).
		Model(&model.Issue{}).
		Where("id = ? AND deleted_at IS NULL", id).
		Updates(updates).Error
}

func (s *IssueStore) ListDraftsByWorkspaceID(ctx context.Context, workspaceID uuid.UUID, limit, offset int) ([]model.Issue, error) {
	var list []model.Issue
	q := s.db.WithContext(ctx).Where(
		"workspace_id = ? AND is_draft = ? AND deleted_at IS NULL",
		workspaceID, true,
	).Order("updated_at DESC")
	if limit > 0 {
		q = q.Limit(limit)
	}
	if offset > 0 {
		q = q.Offset(offset)
	}
	err := q.Find(&list).Error
	return list, err
}

func (s *IssueStore) Update(ctx context.Context, i *model.Issue) error {
	return s.db.WithContext(ctx).Save(i).Error
}

func (s *IssueStore) Delete(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&model.Issue{}).Error
}

// BulkUpdateFields updates the given columns for many issues scoped to a
// project. Returns the number of rows affected.
func (s *IssueStore) BulkUpdateFields(ctx context.Context, projectID uuid.UUID, ids []uuid.UUID, updates map[string]any) (int64, error) {
	if len(ids) == 0 || len(updates) == 0 {
		return 0, nil
	}
	res := s.db.WithContext(ctx).
		Model(&model.Issue{}).
		Where("project_id = ? AND id IN ? AND deleted_at IS NULL", projectID, ids).
		Updates(updates)
	return res.RowsAffected, res.Error
}

// ReorderIssues renumbers sort_order for the given issues to match the order of
// `ids` (evenly spaced), in a single transaction. This makes manual drag-order
// deterministic even when issues currently share the default sort_order.
func (s *IssueStore) ReorderIssues(ctx context.Context, projectID uuid.UUID, ids []uuid.UUID) error {
	if len(ids) == 0 {
		return nil
	}
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for i, id := range ids {
			if err := tx.Model(&model.Issue{}).
				Where("id = ? AND project_id = ? AND deleted_at IS NULL", id, projectID).
				Update("sort_order", float64((i+1)*1024)).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// BulkSetArchived archives or restores many issues scoped to a project.
func (s *IssueStore) BulkSetArchived(ctx context.Context, projectID uuid.UUID, ids []uuid.UUID, archived bool) (int64, error) {
	updates := map[string]any{"archived_at": nil}
	if archived {
		updates["archived_at"] = time.Now()
	}
	return s.BulkUpdateFields(ctx, projectID, ids, updates)
}

// EpicStateDistributionBulk returns, for every epic in the project, the count of
// its (non-deleted, non-epic) child issues grouped by state group. The result is
// keyed by epic id; epics with no children are absent (callers default to zero).
func (s *IssueStore) EpicStateDistributionBulk(ctx context.Context, projectID uuid.UUID) (map[uuid.UUID]map[string]int, error) {
	var rows []struct {
		Epic  uuid.UUID `gorm:"column:epic"`
		Group string    `gorm:"column:grp"`
		Count int       `gorm:"column:count"`
	}
	err := s.db.WithContext(ctx).Raw(`
		SELECT i.parent_id AS epic, COALESCE(st."group", 'backlog') AS grp, COUNT(i.id) AS count
		FROM issues i
		JOIN issues p ON p.id = i.parent_id AND p.is_epic = TRUE AND p.deleted_at IS NULL
		LEFT JOIN states st ON st.id = i.state_id
		WHERE i.project_id = ? AND i.deleted_at IS NULL AND i.is_epic = FALSE
		GROUP BY i.parent_id, COALESCE(st."group", 'backlog')
	`, projectID).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make(map[uuid.UUID]map[string]int)
	for _, r := range rows {
		m := out[r.Epic]
		if m == nil {
			m = map[string]int{"backlog": 0, "unstarted": 0, "started": 0, "completed": 0, "cancelled": 0}
			out[r.Epic] = m
		}
		if _, ok := m[r.Group]; ok {
			m[r.Group] += r.Count
		} else {
			m["backlog"] += r.Count
		}
	}
	return out, nil
}

func (s *IssueStore) AddAssignee(ctx context.Context, a *model.IssueAssignee) error {
	return s.db.WithContext(ctx).Create(a).Error
}

func (s *IssueStore) RemoveAssignee(ctx context.Context, issueID, assigneeID uuid.UUID) error {
	return s.db.WithContext(ctx).Where("issue_id = ? AND assignee_id = ?", issueID, assigneeID).Delete(&model.IssueAssignee{}).Error
}

func (s *IssueStore) ClearAssigneesForIssue(ctx context.Context, issueID uuid.UUID) error {
	return s.db.WithContext(ctx).Where("issue_id = ?", issueID).Delete(&model.IssueAssignee{}).Error
}

func (s *IssueStore) AddLabel(ctx context.Context, l *model.IssueLabel) error {
	return s.db.WithContext(ctx).Create(l).Error
}

func (s *IssueStore) RemoveLabel(ctx context.Context, issueID, labelID uuid.UUID) error {
	return s.db.WithContext(ctx).Where("issue_id = ? AND label_id = ?", issueID, labelID).Delete(&model.IssueLabel{}).Error
}

func (s *IssueStore) ClearLabelsForIssue(ctx context.Context, issueID uuid.UUID) error {
	return s.db.WithContext(ctx).Where("issue_id = ?", issueID).Delete(&model.IssueLabel{}).Error
}

// ListAssigneesForIssue returns assignee IDs for an issue.
func (s *IssueStore) ListAssigneesForIssue(ctx context.Context, issueID uuid.UUID) ([]uuid.UUID, error) {
	var ids []uuid.UUID
	err := s.db.WithContext(ctx).Model(&model.IssueAssignee{}).Where("issue_id = ?", issueID).Pluck("assignee_id", &ids).Error
	return ids, err
}

// ListLabelsForIssue returns label IDs for an issue.
func (s *IssueStore) ListLabelsForIssue(ctx context.Context, issueID uuid.UUID) ([]uuid.UUID, error) {
	var ids []uuid.UUID
	err := s.db.WithContext(ctx).Model(&model.IssueLabel{}).Where("issue_id = ?", issueID).Pluck("label_id", &ids).Error
	return ids, err
}

func (s *IssueStore) ListCycleIDsForIssue(ctx context.Context, issueID uuid.UUID) ([]uuid.UUID, error) {
	var ids []uuid.UUID
	err := s.db.WithContext(ctx).Model(&model.CycleIssue{}).Where("issue_id = ?", issueID).Pluck("cycle_id", &ids).Error
	return ids, err
}

func (s *IssueStore) ListModuleIDsForIssue(ctx context.Context, issueID uuid.UUID) ([]uuid.UUID, error) {
	var ids []uuid.UUID
	err := s.db.WithContext(ctx).Model(&model.ModuleIssue{}).Where("issue_id = ?", issueID).Pluck("module_id", &ids).Error
	return ids, err
}

// ListRelationsForIssue returns all relation rows where issue_id = issueID.
// Because both directions are stored, a simple WHERE issue_id = ? is enough.
func (s *IssueStore) ListRelationsForIssue(ctx context.Context, issueID uuid.UUID) ([]model.IssueRelation, error) {
	var rows []model.IssueRelation
	err := s.db.WithContext(ctx).Where("issue_id = ?", issueID).Find(&rows).Error
	return rows, err
}

// CreateRelation inserts one relation row.
func (s *IssueStore) CreateRelation(ctx context.Context, r *model.IssueRelation) error {
	return s.db.WithContext(ctx).Create(r).Error
}

// RelationExists reports whether a row with the given (issue_id, related_issue_id, relation_type) already exists.
func (s *IssueStore) RelationExists(ctx context.Context, issueID, relatedIssueID uuid.UUID, relationType string) (bool, error) {
	var count int64
	err := s.db.WithContext(ctx).Model(&model.IssueRelation{}).
		Where("issue_id = ? AND related_issue_id = ? AND relation_type = ?", issueID, relatedIssueID, relationType).
		Count(&count).Error
	return count > 0, err
}

// DeleteRelation removes the relation row matching (issue_id, related_issue_id, relation_type).
func (s *IssueStore) DeleteRelation(ctx context.Context, issueID, relatedIssueID uuid.UUID, relationType string) error {
	return s.db.WithContext(ctx).
		Where("issue_id = ? AND related_issue_id = ? AND relation_type = ?", issueID, relatedIssueID, relationType).
		Delete(&model.IssueRelation{}).Error
}

// --- Issue Links ---

func (s *IssueStore) ListLinksForIssue(ctx context.Context, issueID uuid.UUID) ([]model.IssueLink, error) {
	var rows []model.IssueLink
	err := s.db.WithContext(ctx).Where("issue_id = ?", issueID).Order("created_at ASC").Find(&rows).Error
	return rows, err
}

func (s *IssueStore) CreateLink(ctx context.Context, l *model.IssueLink) error {
	return s.db.WithContext(ctx).Create(l).Error
}

func (s *IssueStore) GetLinkByID(ctx context.Context, linkID uuid.UUID) (*model.IssueLink, error) {
	var l model.IssueLink
	err := s.db.WithContext(ctx).Where("id = ?", linkID).First(&l).Error
	if err != nil {
		return nil, err
	}
	return &l, nil
}

func (s *IssueStore) UpdateLink(ctx context.Context, l *model.IssueLink) error {
	return s.db.WithContext(ctx).Save(l).Error
}

func (s *IssueStore) DeleteLink(ctx context.Context, linkID uuid.UUID) error {
	return s.db.WithContext(ctx).Where("id = ?", linkID).Delete(&model.IssueLink{}).Error
}

// --- File Assets & Attachments ---

func (s *IssueStore) CreateFileAsset(ctx context.Context, a *model.FileAsset) error {
	return s.db.WithContext(ctx).Create(a).Error
}

func (s *IssueStore) GetFileAssetByID(ctx context.Context, assetID uuid.UUID) (*model.FileAsset, error) {
	var a model.FileAsset
	err := s.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", assetID).First(&a).Error
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (s *IssueStore) MarkFileAssetUploaded(ctx context.Context, assetID uuid.UUID, objectPath string) error {
	return s.db.WithContext(ctx).Model(&model.FileAsset{}).
		Where("id = ?", assetID).
		Updates(map[string]interface{}{"is_uploaded": true, "asset": objectPath}).Error
}

func (s *IssueStore) SoftDeleteFileAsset(ctx context.Context, assetID uuid.UUID) error {
	return s.db.WithContext(ctx).Where("id = ?", assetID).Delete(&model.FileAsset{}).Error
}

func (s *IssueStore) CreateAttachment(ctx context.Context, a *model.IssueAttachment) error {
	return s.db.WithContext(ctx).Create(a).Error
}

// ListAttachmentsWithAssets returns attachments + their file asset for an issue.
func (s *IssueStore) ListAttachmentsWithAssets(ctx context.Context, issueID uuid.UUID) ([]model.IssueAttachment, []model.FileAsset, error) {
	var attachments []model.IssueAttachment
	if err := s.db.WithContext(ctx).
		Where("issue_id = ? AND deleted_at IS NULL", issueID).
		Order("created_at ASC").Find(&attachments).Error; err != nil {
		return nil, nil, err
	}
	if len(attachments) == 0 {
		return nil, nil, nil
	}
	assetIDs := make([]uuid.UUID, 0, len(attachments))
	for _, a := range attachments {
		assetIDs = append(assetIDs, a.AssetID)
	}
	var assets []model.FileAsset
	err := s.db.WithContext(ctx).Where("id IN ? AND is_uploaded = true AND deleted_at IS NULL", assetIDs).Find(&assets).Error
	return attachments, assets, err
}

func (s *IssueStore) GetAttachmentByAssetID(ctx context.Context, assetID, issueID uuid.UUID) (*model.IssueAttachment, error) {
	var a model.IssueAttachment
	err := s.db.WithContext(ctx).
		Where("asset_id = ? AND issue_id = ? AND deleted_at IS NULL", assetID, issueID).First(&a).Error
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (s *IssueStore) SoftDeleteAttachment(ctx context.Context, assetID, issueID uuid.UUID) error {
	return s.db.WithContext(ctx).
		Where("asset_id = ? AND issue_id = ?", assetID, issueID).
		Delete(&model.IssueAttachment{}).Error
}

// --- Epics ---

func (s *IssueStore) ListEpicsByProjectID(ctx context.Context, projectID uuid.UUID) ([]model.Issue, error) {
	var list []model.Issue
	err := s.db.WithContext(ctx).
		Where("project_id = ? AND is_epic = true AND deleted_at IS NULL", projectID).
		Order("sort_order ASC, created_at DESC").Find(&list).Error
	return list, err
}

func (s *IssueStore) ListIssuesByEpicID(ctx context.Context, epicID uuid.UUID) ([]model.Issue, error) {
	var list []model.Issue
	err := s.db.WithContext(ctx).
		Where("parent_id = ? AND is_epic = false AND deleted_at IS NULL", epicID).
		Order("sort_order ASC, created_at DESC").Find(&list).Error
	return list, err
}
