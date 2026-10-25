package store

import (
	"context"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AgentStore struct{ db *gorm.DB }

func NewAgentStore(db *gorm.DB) *AgentStore { return &AgentStore{db: db} }

func (s *AgentStore) CreateAgent(ctx context.Context, a *model.Agent, permissions []model.AgentToolPermission) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Omit("ToolPermissions").Create(a).Error; err != nil {
			return err
		}
		for i := range permissions {
			permissions[i].AgentID = a.ID
		}
		if len(permissions) > 0 {
			if err := tx.Create(&permissions).Error; err != nil {
				return err
			}
		}
		a.ToolPermissions = permissions
		return nil
	})
}

func (s *AgentStore) ListAgents(ctx context.Context, workspaceID uuid.UUID, projectID *uuid.UUID) ([]model.Agent, error) {
	var list []model.Agent
	q := s.db.WithContext(ctx).
		Preload("ToolPermissions", "deleted_at IS NULL").
		Where("workspace_id = ? AND deleted_at IS NULL", workspaceID)
	if projectID != nil {
		q = q.Where("(project_id IS NULL OR project_id = ?)", *projectID)
	}
	err := q.Order("project_id NULLS FIRST, name ASC, created_at ASC").Find(&list).Error
	return list, err
}

func (s *AgentStore) GetAgentByID(ctx context.Context, id uuid.UUID) (*model.Agent, error) {
	var a model.Agent
	err := s.db.WithContext(ctx).
		Preload("ToolPermissions", "deleted_at IS NULL").
		Where("id = ? AND deleted_at IS NULL", id).
		First(&a).Error
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (s *AgentStore) UpdateAgent(ctx context.Context, a *model.Agent, permissions []model.AgentToolPermission, replacePermissions bool) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Omit("ToolPermissions").Save(a).Error; err != nil {
			return err
		}
		if !replacePermissions {
			return nil
		}
		if err := tx.Where("agent_id = ?", a.ID).Delete(&model.AgentToolPermission{}).Error; err != nil {
			return err
		}
		for i := range permissions {
			permissions[i].AgentID = a.ID
		}
		if len(permissions) > 0 {
			if err := tx.Create(&permissions).Error; err != nil {
				return err
			}
		}
		a.ToolPermissions = permissions
		return nil
	})
}

func (s *AgentStore) DeleteAgent(ctx context.Context, id uuid.UUID) error {
	return s.db.WithContext(ctx).Where("id = ?", id).Delete(&model.Agent{}).Error
}

func (s *AgentStore) CreateOrUpdateAssignment(ctx context.Context, assignment *model.AgentIssueAssignment) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var existing model.AgentIssueAssignment
		err := tx.Where("issue_id = ? AND agent_id = ? AND deleted_at IS NULL", assignment.IssueID, assignment.AgentID).
			First(&existing).Error
		if err == nil {
			existing.Reason = assignment.Reason
			existing.Status = assignment.Status
			existing.AssignedByID = assignment.AssignedByID
			if err := tx.Save(&existing).Error; err != nil {
				return err
			}
			*assignment = existing
			return nil
		}
		if err != gorm.ErrRecordNotFound {
			return err
		}
		return tx.Create(assignment).Error
	})
}

func (s *AgentStore) ListAssignmentsByIssue(ctx context.Context, issueID uuid.UUID) ([]model.AgentIssueAssignment, error) {
	var list []model.AgentIssueAssignment
	err := s.db.WithContext(ctx).
		Where("issue_id = ? AND deleted_at IS NULL", issueID).
		Order("created_at ASC").
		Find(&list).Error
	return list, err
}

func (s *AgentStore) CreateRun(ctx context.Context, run *model.AgentRun) error {
	return s.db.WithContext(ctx).Create(run).Error
}

func (s *AgentStore) ListRunsByIssue(ctx context.Context, issueID uuid.UUID) ([]model.AgentRun, error) {
	var list []model.AgentRun
	err := s.db.WithContext(ctx).
		Where("issue_id = ? AND deleted_at IS NULL", issueID).
		Order("queued_at DESC, created_at DESC").
		Find(&list).Error
	return list, err
}
