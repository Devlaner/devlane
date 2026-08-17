/* eslint-disable react-refresh/only-export-components -- Context file exports hooks + provider */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
} from '../../lib/projectSavedViewDisplay';

type ProjectSavedViewDisplayContextValue = {
  active: boolean;
  settings: SavedViewDisplaySettings;
  setSettings: Dispatch<SetStateAction<SavedViewDisplaySettings>>;
};

const ProjectSavedViewDisplayContext = createContext<ProjectSavedViewDisplayContextValue | null>(
  null,
);

/**
 * Matches a project saved-view detail path, returning the slug and view id it
 * names. Read from the path rather than from `useParams`: both shells mount
 * this provider on the layout, whose own route stops short of the child's
 * `:viewId`.
 *
 * Both interfaces answer to this one path, so a saved view's grouping and
 * columns follow the reader across an interface switch.
 */
const SAVED_VIEW_PATH = /^\/([^/]+)\/projects\/([^/]+)\/views\/([^/]+)$/;

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
  /* Storage key whose stored settings have already been read back into state;
     null while a view's restore is still pending. The restore is deferred, so
     without this the write effect below would save the defaults over the stored
     settings before they land. */
  const restoredFor = useRef<string | null>(null);

  useEffect(() => {
    if (!storageKey) {
      queueMicrotask(() => setSettings(cloneDefaultSettings()));
      return;
    }
    let parsed: SavedViewDisplaySettings | null = null;
    try {
      parsed = parsePersistedSavedViewDisplay(localStorage.getItem(storageKey));
    } catch {
      parsed = null;
    }
    queueMicrotask(() => {
      setSettings(parsed ?? cloneDefaultSettings());
      restoredFor.current = storageKey;
    });
    return () => {
      if (restoredFor.current === storageKey) restoredFor.current = null;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || restoredFor.current !== storageKey) return;
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
