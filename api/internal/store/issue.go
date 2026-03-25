package store

import (
	"context"
	"encoding/binary"

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
	q := s.db.WithContext(ctx).Where("project_id = ? AND deleted_at IS NULL", projectID).Order("sort_order ASC, created_at DESC")
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
