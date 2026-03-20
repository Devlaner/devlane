import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY_PREFIX = 'module_favorites';
const MODULE_FAVORITES_CHANGED_EVENT = 'module-favorites-changed';

function storageKey(workspaceId: string, projectId: string): string {
  return `${STORAGE_KEY_PREFIX}_${workspaceId}_${projectId}`;
}

function loadFavorites(workspaceId: string, projectId: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(workspaceId, projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function useModuleFavorites(workspaceId: string | undefined, projectId: string | undefined) {
  const [favoriteModuleIds, setFavoriteModuleIds] = useState<string[]>([]);

  useEffect(() => {
    const next = workspaceId && projectId ? loadFavorites(workspaceId, projectId) : [];
    queueMicrotask(() => setFavoriteModuleIds(next));
  }, [workspaceId, projectId]);

  const toggleFavorite = useCallback(
    (moduleId: string) => {
      if (!workspaceId || !projectId) return false;
      setFavoriteModuleIds((prev) => {
        const next = prev.includes(moduleId)
          ? prev.filter((id) => id !== moduleId)
          : [...prev, moduleId];
        try {
          localStorage.setItem(storageKey(workspaceId, projectId), JSON.stringify(next));
        } catch {
          // ignore
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent(MODULE_FAVORITES_CHANGED_EVENT, {
              detail: {
                workspaceId,
                projectId,
                moduleId,
                isFavorite: next.includes(moduleId),
              },
            }),
          );
        }
        return next;
      });
      return true;
    },
    [workspaceId, projectId],
  );

  const isFavorite = useCallback(
    (moduleId: string) => favoriteModuleIds.includes(moduleId),
    [favoriteModuleIds],
  );

  return { favoriteModuleIds, toggleFavorite, isFavorite };
}
