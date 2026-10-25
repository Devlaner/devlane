import { useCallback, useEffect } from 'react';
import { useFavorites } from '../contexts/FavoritesContext';
import { workspaceFavoriteService } from '../services/workspaceFavoriteService';
import type { FavoriteApiResponse } from '../api/types';

export type FavoriteEntityType = 'cycle' | 'module';

/**
 * Loads and mutates the workspace favorites tree (cycle/module favorites +
 * folders + ordering), sharing state through FavoritesContext so the sidebar
 * and pages stay in sync.
 */
export function useWorkspaceFavorites(workspaceSlug: string | undefined) {
  const { workspaceFavorites, setWorkspaceFavorites } = useFavorites();

  const reload = useCallback(() => {
    if (!workspaceSlug) return;
    workspaceFavoriteService
      .list(workspaceSlug)
      .then(setWorkspaceFavorites)
      .catch(() => setWorkspaceFavorites([]));
  }, [workspaceSlug, setWorkspaceFavorites]);

  useEffect(() => {
    reload();
  }, [reload]);

  const favoriteFor = useCallback(
    (entityType: string, entityId: string): FavoriteApiResponse | undefined =>
      workspaceFavorites.find(
        (f) => f.entity_type === entityType && f.entity_identifier === entityId,
      ),
    [workspaceFavorites],
  );

  const isFavorited = useCallback(
    (entityType: string, entityId: string) => Boolean(favoriteFor(entityType, entityId)),
    [favoriteFor],
  );

  const toggleEntity = useCallback(
    async (payload: {
      entity_type: FavoriteEntityType;
      entity_id: string;
      project_id: string;
      name: string;
    }) => {
      if (!workspaceSlug) return;
      const existing = favoriteFor(payload.entity_type, payload.entity_id);
      try {
        if (existing) {
          await workspaceFavoriteService.remove(workspaceSlug, existing.id);
        } else {
          await workspaceFavoriteService.addEntity(workspaceSlug, payload);
        }
      } finally {
        reload();
      }
    },
    [workspaceSlug, favoriteFor, reload],
  );

  const createFolder = useCallback(
    async (name: string) => {
      if (!workspaceSlug) return;
      await workspaceFavoriteService.createFolder(workspaceSlug, name);
      reload();
    },
    [workspaceSlug, reload],
  );

  const updateFavorite = useCallback(
    async (
      id: string,
      payload: { name?: string; parent_id?: string | null; sort_order?: number },
    ) => {
      if (!workspaceSlug) return;
      await workspaceFavoriteService.update(workspaceSlug, id, payload);
      reload();
    },
    [workspaceSlug, reload],
  );

  const removeById = useCallback(
    async (id: string) => {
      if (!workspaceSlug) return;
      await workspaceFavoriteService.remove(workspaceSlug, id);
      reload();
    },
    [workspaceSlug, reload],
  );

  return {
    favorites: workspaceFavorites,
    isFavorited,
    favoriteFor,
    toggleEntity,
    createFolder,
    updateFavorite,
    removeById,
    reload,
  };
}
