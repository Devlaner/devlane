import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY_PREFIX = "module_favorites";

function storageKey(workspaceId: string, projectId: string): string {
  return `${STORAGE_KEY_PREFIX}_${workspaceId}_${projectId}`;
}

function loadFavorites(workspaceId: string, projectId: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(workspaceId, projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

export function useModuleFavorites(
  workspaceId: string | undefined,
  projectId: string | undefined,
) {
  const [favoriteModuleIds, setFavoriteModuleIds] = useState<string[]>([]);

  useEffect(() => {
    if (!workspaceId || !projectId) {
      setFavoriteModuleIds([]);
      return;
    }
    setFavoriteModuleIds(loadFavorites(workspaceId, projectId));
  }, [workspaceId, projectId]);

  const toggleFavorite = useCallback(
    (moduleId: string) => {
      if (!workspaceId || !projectId) return;
      setFavoriteModuleIds((prev) => {
        const next = prev.includes(moduleId)
          ? prev.filter((id) => id !== moduleId)
          : [...prev, moduleId];
        try {
          localStorage.setItem(
            storageKey(workspaceId, projectId),
            JSON.stringify(next),
          );
        } catch {
          // ignore
        }
        return next;
      });
    },
    [workspaceId, projectId],
  );

  const isFavorite = useCallback(
    (moduleId: string) => favoriteModuleIds.includes(moduleId),
    [favoriteModuleIds],
  );

  return { favoriteModuleIds, toggleFavorite, isFavorite };
}
