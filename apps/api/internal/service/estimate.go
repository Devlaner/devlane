package service

import (
	"context"
	"errors"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
)

var ErrEstimateNotFound = errors.New("estimate not found")

// EstimatePointInput is a single point supplied when creating/updating an estimate.
type EstimatePointInput struct {
	Key         int
	Value       string
	Description string
}

// EstimateService handles estimate business logic.
type EstimateService struct {
	es *store.EstimateStore
	ps *store.ProjectStore
	ws *store.WorkspaceStore
}

func NewEstimateService(es *store.EstimateStore, ps *store.ProjectStore, ws *store.WorkspaceStore) *EstimateService {
	return &EstimateService{es: es, ps: ps, ws: ws}
}

func (s *EstimateService) ensureProjectAccess(ctx context.Context, workspaceSlug string, projectID, userID uuid.UUID) (*model.Workspace, error) {
	wrk, err := s.ws.GetBySlug(ctx, workspaceSlug)
	if err != nil {
		return nil, ErrProjectForbidden
	}
	ok, _ := s.ws.IsMember(ctx, wrk.ID, userID)
	if !ok {
		return nil, ErrProjectForbidden
	}
	inWorkspace, _ := s.ps.IsInWorkspace(ctx, projectID, wrk.ID)
	if !inWorkspace {
		return nil, ErrProjectNotFound
	}
	return wrk, nil
}

func (s *EstimateService) buildPoints(e *model.Estimate, in []EstimatePointInput, userID uuid.UUID) []model.EstimatePoint {
	pts := make([]model.EstimatePoint, 0, len(in))
	for _, p := range in {
		pts = append(pts, model.EstimatePoint{
			EstimateID:  e.ID,
			Key:         p.Key,
			Value:       p.Value,
			Description: p.Description,
			ProjectID:   e.ProjectID,
			WorkspaceID: e.WorkspaceID,
			CreatedByID: &userID,
			UpdatedByID: &userID,
		})
	}
	return pts
}

func (s *EstimateService) ListByProject(ctx context.Context, workspaceSlug string, projectID, userID uuid.UUID) ([]model.Estimate, error) {
	if _, err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return nil, err
	}
	list, err := s.es.ListByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	ids := make([]uuid.UUID, 0, len(list))
	for _, e := range list {
		ids = append(ids, e.ID)
	}
	pointsByEstimate, err := s.es.ListPointsByEstimateIDs(ctx, ids)
	if err != nil {
		return nil, err
	}
	for i := range list {
		if p := pointsByEstimate[list[i].ID]; p != nil {
			list[i].Points = p
		} else {
			list[i].Points = []model.EstimatePoint{}
		}
	}
	return list, nil
}

func (s *EstimateService) Get(ctx context.Context, workspaceSlug string, projectID, estimateID, userID uuid.UUID) (*model.Estimate, error) {
	if _, err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID); err != nil {
		return nil, err
	}
	e, err := s.es.GetByID(ctx, estimateID)
	if err != nil || e.ProjectID != projectID {
		return nil, ErrEstimateNotFound
	}
	pts, err := s.es.ListPointsByEstimateID(ctx, e.ID)
	if err != nil {
		return nil, err
	}
	e.Points = pts
	return e, nil
}

func (s *EstimateService) Create(ctx context.Context, workspaceSlug string, projectID, userID uuid.UUID, name, description, etype string, lastUsed bool, points []EstimatePointInput) (*model.Estimate, error) {
	wrk, err := s.ensureProjectAccess(ctx, workspaceSlug, projectID, userID)
	if err != nil {
		return nil, err
	}
	if etype == "" {
		etype = "categories"
	}
	e := &model.Estimate{
		Name:        name,
		Description: description,
		Type:        etype,
		LastUsed:    lastUsed,
		ProjectID:   projectID,
		WorkspaceID: wrk.ID,
		CreatedByID: &userID,
		UpdatedByID: &userID,
	}
	if err := s.es.Create(ctx, e); err != nil {
		return nil, err
	}
	if err := s.es.ReplacePoints(ctx, e.ID, s.buildPoints(e, points, userID)); err != nil {
		return nil, err
	}
	if lastUsed {
		if err := s.es.ClearLastUsedExcept(ctx, projectID, e.ID); err != nil {
			return nil, err
		}
	}
	pts, err := s.es.ListPointsByEstimateID(ctx, e.ID)
	if err != nil {
		return nil, err
	}
	e.Points = pts
	return e, nil
}

func (s *EstimateService) Update(ctx context.Context, workspaceSlug string, projectID, estimateID, userID uuid.UUID, name, description, etype *string, lastUsed *bool, points *[]EstimatePointInput) (*model.Estimate, error) {
	e, err := s.Get(ctx, workspaceSlug, projectID, estimateID, userID)
	if err != nil {
		return nil, err
	}
	if name != nil {
		e.Name = *name
	}
	if description != nil {
		e.Description = *description
	}
	if etype != nil && *etype != "" {
		e.Type = *etype
	}
	if lastUsed != nil {
		e.LastUsed = *lastUsed
	}
	e.UpdatedByID = &userID
	if err := s.es.Update(ctx, e); err != nil {
		return nil, err
	}
	if points != nil {
		if err := s.es.ReplacePoints(ctx, e.ID, s.buildPoints(e, *points, userID)); err != nil {
			return nil, err
		}
	}
	if lastUsed != nil && *lastUsed {
		if err := s.es.ClearLastUsedExcept(ctx, projectID, e.ID); err != nil {
			return nil, err
		}
	}
	pts, err := s.es.ListPointsByEstimateID(ctx, e.ID)
	if err != nil {
		return nil, err
	}
	e.Points = pts
	return e, nil
}

func (s *EstimateService) Delete(ctx context.Context, workspaceSlug string, projectID, estimateID, userID uuid.UUID) error {
	if _, err := s.Get(ctx, workspaceSlug, projectID, estimateID, userID); err != nil {
		return err
	}
	return s.es.Delete(ctx, estimateID)
}
