package service

import (
	"context"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
)

// NotificationService handles notification business logic.
type NotificationService struct {
	ns *store.NotificationStore
	ws *store.WorkspaceStore
}

func NewNotificationService(ns *store.NotificationStore, ws *store.WorkspaceStore) *NotificationService {
	return &NotificationService{ns: ns, ws: ws}
}

func (s *NotificationService) List(ctx context.Context, workspaceSlug string, userID uuid.UUID, unreadOnly bool) ([]model.Notification, error) {
	var workspaceID *uuid.UUID
	if workspaceSlug != "" {
		wrk, err := s.ws.GetBySlug(ctx, workspaceSlug)
		if err != nil {
			return nil, ErrProjectForbidden
		}
		ok, _ := s.ws.IsMember(ctx, wrk.ID, userID)
		if !ok {
			return nil, ErrProjectForbidden
		}
		workspaceID = &wrk.ID
	}
	return s.ns.ListByReceiverID(ctx, userID, workspaceID, unreadOnly)
}

func (s *NotificationService) MarkRead(ctx context.Context, notificationID uuid.UUID, userID uuid.UUID) error {
	n, err := s.ns.GetByID(ctx, notificationID)
	if err != nil {
		return err
	}
	if n.ReceiverID != userID {
		return ErrProjectForbidden
	}
	return s.ns.MarkRead(ctx, notificationID, userID)
}

func (s *NotificationService) MarkAllRead(ctx context.Context, workspaceSlug string, userID uuid.UUID) error {
	var workspaceID *uuid.UUID
	if workspaceSlug != "" {
		wrk, err := s.ws.GetBySlug(ctx, workspaceSlug)
		if err != nil {
			return ErrProjectForbidden
		}
		ok, _ := s.ws.IsMember(ctx, wrk.ID, userID)
		if !ok {
			return ErrProjectForbidden
		}
		workspaceID = &wrk.ID
	}
	return s.ns.MarkAllRead(ctx, userID, workspaceID)
}
