package service

import (
	"context"
	"errors"
	"strings"

	"github.com/Devlaner/devlane/api/internal/model"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/google/uuid"
)

var (
	ErrFavoriteNotFound    = errors.New("favorite not found")
	ErrFavoriteBadEntity   = errors.New("unsupported favorite entity type")
	ErrFavoriteBadParent   = errors.New("parent must be one of your folders")
	ErrFavoriteBadName     = errors.New("name is required")
	ErrFavoriteWorkspace   = errors.New("workspace not found")
	ErrFavoriteForbidden   = errors.New("no access to this workspace")
	favoriteEntityTypesSet = map[string]bool{
		store.FavoriteEntityTypeCycle:  true,
		store.FavoriteEntityTypeModule: true,
	}
)

// FavoriteService handles the user's favorites tree: favoriting cycles/modules,
// grouping favorites into folders, and ordering them.
type FavoriteService struct {
	favs     *store.UserFavoriteStore
	ws       *store.WorkspaceStore
	projects *ProjectService
}

func NewFavoriteService(favs *store.UserFavoriteStore, ws *store.WorkspaceStore, projects *ProjectService) *FavoriteService {
	return &FavoriteService{favs: favs, ws: ws, projects: projects}
}

func (s *FavoriteService) workspace(ctx context.Context, slug string, userID uuid.UUID) (*model.Workspace, error) {
	wrk, err := s.ws.GetBySlug(ctx, slug)
	if err != nil {
		return nil, ErrFavoriteWorkspace
	}
	ok, err := s.ws.IsMember(ctx, wrk.ID, userID)
	if err != nil {
		return nil, err // surface infra failures as 500, not 404
	}
	if !ok {
		return nil, ErrFavoriteForbidden
	}
	return wrk, nil
}

// List returns all of the user's favorites (entities and folders) in a workspace.
func (s *FavoriteService) List(ctx context.Context, slug string, userID uuid.UUID) ([]model.UserFavorite, error) {
	wrk, err := s.workspace(ctx, slug, userID)
	if err != nil {
		return nil, err
	}
	return s.favs.ListByUserAndWorkspace(ctx, userID, wrk.ID)
}

// AddEntity favorites a cycle or module. The entity's project must be
// accessible to the caller.
func (s *FavoriteService) AddEntity(ctx context.Context, slug string, userID uuid.UUID, entityType string, entityID, projectID uuid.UUID, name string) (*model.UserFavorite, error) {
	if !favoriteEntityTypesSet[entityType] {
		return nil, ErrFavoriteBadEntity
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, ErrFavoriteBadName
	}
	wrk, err := s.workspace(ctx, slug, userID)
	if err != nil {
		return nil, err
	}
	// Confirm the caller can see the project the entity lives in. Access errors
	// map to forbidden; anything else (infra) propagates as a 500.
	if _, gerr := s.projects.GetByID(ctx, slug, projectID, userID); gerr != nil {
		if gerr == ErrProjectNotFound || gerr == ErrProjectForbidden {
			return nil, ErrFavoriteForbidden
		}
		return nil, gerr
	}
	pid := projectID
	fav := &model.UserFavorite{
		Name:             name,
		Type:             entityType,
		EntityType:       entityType,
		EntityIdentifier: entityID,
		WorkspaceID:      wrk.ID,
		ProjectID:        &pid,
		UserID:           userID,
		CreatedByID:      &userID,
		UpdatedByID:      &userID,
	}
	return s.favs.AddEntity(ctx, fav)
}

// RemoveEntity unfavorites a cycle or module.
func (s *FavoriteService) RemoveEntity(ctx context.Context, slug string, userID uuid.UUID, entityType string, entityID uuid.UUID) error {
	if !favoriteEntityTypesSet[entityType] {
		return ErrFavoriteBadEntity
	}
	if _, err := s.workspace(ctx, slug, userID); err != nil {
		return err
	}
	return s.favs.RemoveEntity(ctx, userID, entityType, entityID)
}

// CreateFolder makes a new folder to group favorites under.
func (s *FavoriteService) CreateFolder(ctx context.Context, slug string, userID uuid.UUID, name string) (*model.UserFavorite, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, ErrFavoriteBadName
	}
	wrk, err := s.workspace(ctx, slug, userID)
	if err != nil {
		return nil, err
	}
	f := &model.UserFavorite{
		Name:        name,
		WorkspaceID: wrk.ID,
		UserID:      userID,
		CreatedByID: &userID,
		UpdatedByID: &userID,
	}
	if err := s.favs.CreateFolder(ctx, f); err != nil {
		return nil, err
	}
	return f, nil
}

// Update renames, moves (into/out of a folder), and/or reorders a favorite.
func (s *FavoriteService) Update(ctx context.Context, slug string, userID, id uuid.UUID, name *string, parentSet bool, parentID *uuid.UUID, sortOrder *float64) (*model.UserFavorite, error) {
	if _, err := s.workspace(ctx, slug, userID); err != nil {
		return nil, err
	}
	fav, err := s.favs.GetOwnedByID(ctx, userID, id)
	if err != nil {
		return nil, err
	}
	if fav == nil {
		return nil, ErrFavoriteNotFound
	}
	fields := map[string]any{}
	if name != nil {
		fields["name"] = *name
	}
	if parentSet {
		if parentID != nil {
			// A parent must be one of the user's own folders, and not itself.
			if *parentID == id {
				return nil, ErrFavoriteBadParent
			}
			parent, perr := s.favs.GetOwnedByID(ctx, userID, *parentID)
			if perr != nil {
				return nil, perr
			}
			if parent == nil || !parent.IsFolder {
				return nil, ErrFavoriteBadParent
			}
		}
		fields["parent_id"] = parentID
	}
	if sortOrder != nil {
		fields["sort_order"] = *sortOrder
	}
	if err := s.favs.UpdateOwned(ctx, userID, id, fields); err != nil {
		return nil, err
	}
	return s.favs.GetOwnedByID(ctx, userID, id)
}

// Delete removes a favorite or folder (a folder's children move to the top level).
func (s *FavoriteService) Delete(ctx context.Context, slug string, userID, id uuid.UUID) error {
	if _, err := s.workspace(ctx, slug, userID); err != nil {
		return err
	}
	fav, err := s.favs.GetOwnedByID(ctx, userID, id)
	if err != nil {
		return err
	}
	if fav == nil {
		return ErrFavoriteNotFound
	}
	return s.favs.DeleteOwned(ctx, userID, id)
}
