package store

import (
	"context"
	"time"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// IntakeStore handles intake ("inbox") persistence: the per-project default
// intake and the intake_issues triage rows.
type IntakeStore struct{ db *gorm.DB }

func NewIntakeStore(db *gorm.DB) *IntakeStore { return &IntakeStore{db: db} }

// GetOrCreateDefault returns the project's default intake, creating it on first
// use so callers never have to seed it explicitly.
func (s *IntakeStore) GetOrCreateDefault(ctx context.Context, projectID, workspaceID uuid.UUID, userID *uuid.UUID) (*model.Intake, error) {
	var in model.Intake
	err := s.db.WithContext(ctx).
		Where("project_id = ? AND is_default = TRUE AND deleted_at IS NULL", projectID).
		First(&in).Error
	if err == nil {
		return &in, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}
	in = model.Intake{
		Name:        "Intake",
		IsDefault:   true,
		ProjectID:   projectID,
		WorkspaceID: workspaceID,
		CreatedByID: userID,
		UpdatedByID: userID,
	}
	if cerr := s.db.WithContext(ctx).Create(&in).Error; cerr != nil {
		// A concurrent caller won the unique default-intake index; re-read the
		// row it created rather than returning the conflict error.
		var existing model.Intake
		if rerr := s.db.WithContext(ctx).
			Where("project_id = ? AND is_default = TRUE AND deleted_at IS NULL", projectID).
			First(&existing).Error; rerr == nil {
			return &existing, nil
		}
		return nil, cerr
	}
	return &in, nil
}

// AcceptTx atomically clears the work item's draft flag and marks the intake
// item accepted, so the two tables never disagree on a half-applied accept. If
// either row no longer matches (e.g. soft-deleted between the caller's check
// and here) the whole transaction rolls back.
func (s *IntakeStore) AcceptTx(ctx context.Context, itemID, issueID, userID uuid.UUID) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		issueRes := tx.Model(&model.Issue{}).
			Where("id = ?", issueID).
			UpdateColumn("is_draft", false)
		if issueRes.Error != nil {
			return issueRes.Error
		}
		if issueRes.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		itemRes := tx.Model(&model.IntakeIssue{}).
			Where("id = ?", itemID).
			Updates(map[string]any{
				"status":        model.IntakeStatusAccepted,
				"snoozed_till":  nil,
				"updated_by_id": userID,
			})
		if itemRes.Error != nil {
			return itemRes.Error
		}
		if itemRes.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return nil
	})
}

// BackfillDraftIssues creates a pending intake_issues row for every draft issue
// in the project that doesn't already have one, so drafts created through the
// existing flow surface in the triage queue. Idempotent.
func (s *IntakeStore) BackfillDraftIssues(ctx context.Context, intakeID, projectID, workspaceID uuid.UUID) error {
	var drafts []model.Issue
	if err := s.db.WithContext(ctx).
		Where(`project_id = ? AND is_draft = TRUE AND deleted_at IS NULL
			AND id NOT IN (SELECT issue_id FROM intake_issues WHERE project_id = ? AND deleted_at IS NULL)`,
			projectID, projectID).
		Find(&drafts).Error; err != nil {
		return err
	}
	if len(drafts) == 0 {
		return nil
	}
	rows := make([]model.IntakeIssue, 0, len(drafts))
	for i := range drafts {
		rows = append(rows, model.IntakeIssue{
			IntakeID:    intakeID,
			IssueID:     drafts[i].ID,
			Status:      model.IntakeStatusPending,
			Source:      "IN_APP",
			ProjectID:   projectID,
			WorkspaceID: workspaceID,
		})
	}
	return s.db.WithContext(ctx).Create(&rows).Error
}

// WakeSnoozed flips snoozed items whose snooze time has passed back to pending.
func (s *IntakeStore) WakeSnoozed(ctx context.Context, projectID uuid.UUID) error {
	return s.db.WithContext(ctx).
		Model(&model.IntakeIssue{}).
		Where("project_id = ? AND deleted_at IS NULL AND status = ? AND snoozed_till IS NOT NULL AND snoozed_till <= ?",
			projectID, model.IntakeStatusSnoozed, time.Now()).
		Updates(map[string]any{"status": model.IntakeStatusPending, "snoozed_till": nil}).Error
}

// ListByProject returns the project's intake_issues, optionally filtered to the
// given statuses, newest first.
func (s *IntakeStore) ListByProject(ctx context.Context, projectID uuid.UUID, statuses []int) ([]model.IntakeIssue, error) {
	q := s.db.WithContext(ctx).
		Where("project_id = ? AND deleted_at IS NULL", projectID)
	if len(statuses) > 0 {
		q = q.Where("status IN ?", statuses)
	}
	var list []model.IntakeIssue
	err := q.Order("created_at DESC").Find(&list).Error
	return list, err
}

// GetByID returns an intake_issue by id (nil when missing).
func (s *IntakeStore) GetByID(ctx context.Context, id uuid.UUID) (*model.IntakeIssue, error) {
	var in model.IntakeIssue
	err := s.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&in).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &in, nil
}

// Update persists changed columns of an intake_issue via a map so status
// transitions to zero-values (e.g. status = 0 "snoozed") are written.
func (s *IntakeStore) Update(ctx context.Context, id uuid.UUID, fields map[string]any) error {
	return s.db.WithContext(ctx).
		Model(&model.IntakeIssue{}).
		Where("id = ?", id).
		Updates(fields).Error
}

// CountPending returns how many items are awaiting triage (pending, plus
// snoozed items already due). Used for the sidebar badge.
func (s *IntakeStore) CountPending(ctx context.Context, projectID uuid.UUID) (int64, error) {
	var n int64
	err := s.db.WithContext(ctx).
		Model(&model.IntakeIssue{}).
		Where(`project_id = ? AND deleted_at IS NULL AND (status = ? OR (status = ? AND snoozed_till IS NOT NULL AND snoozed_till <= ?))`,
			projectID, model.IntakeStatusPending, model.IntakeStatusSnoozed, time.Now()).
		Count(&n).Error
	return n, err
}
