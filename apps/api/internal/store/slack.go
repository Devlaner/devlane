package store

import (
	"context"
	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SlackChannelLinkStore struct {
	db *gorm.DB
}

func NewSlackChannelLinkStore(db *gorm.DB) *SlackChannelLinkStore {
	return &SlackChannelLinkStore{db: db}

}

/*
Create links a new Slack channel to a project
*/
func (s *SlackChannelLinkStore) Create(ctx context.Context, link *model.SlackChannelLink) error {
	return s.db.WithContext(ctx).Create(link).Error
}

/*
Update saves changes (like event toggles)
*/
func (s *SlackChannelLinkStore) Update(ctx context.Context, link *model.SlackChannelLink) error {
	return s.db.WithContext(ctx).Save(link).Error
}

/*
GetByProject fetches the linked Slack channel for a specific project
*/
func (s *SlackChannelLinkStore) GetByProject(ctx context.Context, projectID uuid.UUID) (*model.SlackChannelLink, error) {
	var link model.SlackChannelLink
	err := s.db.WithContext(ctx).Where("project_id = ? AND deleted_at IS NULL", projectID).First(&link).Error
	if err != nil {
		return nil, err
	}

	return &link, nil
}

/*
ListByWorkspaceIntegration find all linked channels for a specific Slack installation
*/
func (s *SlackChannelLinkStore) ListByWorkspaceIntegration(ctx context.Context, workspaceIntegrationID uuid.UUID) ([]model.SlackChannelLink, error) {
	var list []model.SlackChannelLink
	err := s.db.WithContext(ctx).Where("workspace_integration_id = ? AND deleted_at IS NULL", workspaceIntegrationID).Find(&list).Error
	return list, err
}

/*
SoftDelete unlinks a channel from a project by setting deleted_at
*/
func (s *SlackChannelLinkStore) SoftDelete(ctx context.Context, projectID uuid.UUID) error {
	return s.db.WithContext(ctx).Where("project_id = ? AND deleted_at IS NULL", projectID).Delete(&model.SlackChannelLink{}).Error
}

/*
DeleteByWorkspaceIntegration cascading delete when a user unistalls the Slack app
*/
func (s *SlackChannelLinkStore) DeleteByWorkspaceIntegration(ctx context.Context, WorkspaceIntegratonID uuid.UUID) error {
	return s.db.WithContext(ctx).Where("workspace_integration_id = ?", WorkspaceIntegratonID).Delete(&model.SlackChannelLink{}).Error
}
