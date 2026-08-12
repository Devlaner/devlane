/* eslint-disable react-refresh/only-export-components -- Context file exports hooks + provider */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { useLocation } from 'react-router-dom';
import {
  type SavedViewDisplaySettings,
  cloneDefaultSettings,
  parsePersistedSavedViewDisplay,
  serializeSettings,
} from '../lib/projectSavedViewDisplay';

type ProjectSavedViewDisplayContextValue = {
  active: boolean;
  settings: SavedViewDisplaySettings;
  setSettings: Dispatch<SetStateAction<SavedViewDisplaySettings>>;
};

const ProjectSavedViewDisplayContext = createContext<ProjectSavedViewDisplayContextValue | null>(
  null,
);

/**
 * Matches a project saved-view detail path in either tree, returning the slug
 * and view id it names.
 *
 * The two trees are `/:slug/projects/:id/views/:viewId` (shipped) and the same
 * shape under `/:slug/app-v2/…` (the design preview). Both are read here rather
 * than from `useParams`: in the preview this provider is mounted on the shell
 * layout, whose own route stops short of the child's `:viewId`.
 *
 * Both trees resolve to the same storage key, so a saved view's grouping and
 * columns follow the reader between them — which is the point of a preview you
 * compare side by side.
 */
const SAVED_VIEW_PATH = /^\/([^/]+)\/(?:app-v2\/)?projects\/([^/]+)\/views\/([^/]+)$/;

export function ProjectSavedViewDisplayProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const normalized = pathname.replace(/\/+$/, '');
  const match = SAVED_VIEW_PATH.exec(normalized);
  const workspaceSlug = match?.[1];
  const viewId = match?.[3];
  const active = Boolean(match);

  const storageKey =
    active && workspaceSlug && viewId
      ? `devlane:saved-view-display:${workspaceSlug}:${viewId}`
      : null;

  const [settings, setSettings] = useState<SavedViewDisplaySettings>(() => cloneDefaultSettings());

  useEffect(() => {
    if (!storageKey) {
      queueMicrotask(() => setSettings(cloneDefaultSettings()));
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = parsePersistedSavedViewDisplay(raw);
      queueMicrotask(() => setSettings(parsed ?? cloneDefaultSettings()));
    } catch {
      queueMicrotask(() => setSettings(cloneDefaultSettings()));
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, serializeSettings(settings));
    } catch {
      // ignore quota / private mode
    }
  }, [storageKey, settings]);

  const value = useMemo<ProjectSavedViewDisplayContextValue>(
    () => ({
      active,
      settings,
      setSettings,
    }),
    [active, settings],
  );

  return (
    <ProjectSavedViewDisplayContext.Provider value={value}>
      {children}
    </ProjectSavedViewDisplayContext.Provider>
  );
}

export function useProjectSavedViewDisplay(): ProjectSavedViewDisplayContextValue {
  const ctx = useContext(ProjectSavedViewDisplayContext);
  if (!ctx) {
    throw new Error(
      'useProjectSavedViewDisplay must be used within ProjectSavedViewDisplayProvider',
    );
  }
  return ctx;
}
