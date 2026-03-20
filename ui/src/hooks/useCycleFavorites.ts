import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY_PREFIX = 'cycle_favorites';
export const CYCLE_FAVORITES_CHANGED_EVENT = 'cycle-favorites-changed';

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

export function useCycleFavorites(workspaceId: string | undefined, projectId: string | undefined) {
  const [favoriteCycleIds, setFavoriteCycleIds] = useState<string[]>([]);

  useEffect(() => {
    const next = workspaceId && projectId ? loadFavorites(workspaceId, projectId) : [];
    queueMicrotask(() => setFavoriteCycleIds(next));
  }, [workspaceId, projectId]);

  const toggleFavorite = useCallback(
    (cycleId: string) => {
      if (!workspaceId || !projectId) return false;
      setFavoriteCycleIds((prev) => {
        const next = prev.includes(cycleId)
          ? prev.filter((id) => id !== cycleId)
          : [...prev, cycleId];
        try {
          localStorage.setItem(storageKey(workspaceId, projectId), JSON.stringify(next));
        } catch {
          // ignore
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent(CYCLE_FAVORITES_CHANGED_EVENT, {
              detail: {
                workspaceId,
                projectId,
                cycleId,
                isFavorite: next.includes(cycleId),
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
    (cycleId: string) => favoriteCycleIds.includes(cycleId),
    [favoriteCycleIds],
  );

  return { favoriteCycleIds, toggleFavorite, isFavorite };
}
