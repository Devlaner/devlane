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
} from "react";
import { useLocation, useParams } from "react-router-dom";
import {
  type SavedViewDisplaySettings,
  cloneDefaultSettings,
  parsePersistedSavedViewDisplay,
  serializeSettings,
} from "../lib/projectSavedViewDisplay";

type ProjectSavedViewDisplayContextValue = {
  active: boolean;
  settings: SavedViewDisplaySettings;
  setSettings: Dispatch<SetStateAction<SavedViewDisplaySettings>>;
};

const ProjectSavedViewDisplayContext =
  createContext<ProjectSavedViewDisplayContextValue | null>(null);

export function ProjectSavedViewDisplayProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { workspaceSlug, projectId, viewId } = useParams<{
    workspaceSlug?: string;
    projectId?: string;
    viewId?: string;
  }>();
  const { pathname } = useLocation();
  const normalized = pathname.replace(/\/+$/, "");
  const expectedPath =
    workspaceSlug && projectId && viewId
      ? `/${workspaceSlug}/projects/${projectId}/views/${viewId}`
      : "";
  const active = Boolean(expectedPath && normalized === expectedPath);

  const storageKey =
    active && workspaceSlug && viewId
      ? `devlane:saved-view-display:${workspaceSlug}:${viewId}`
      : null;

  const [settings, setSettings] = useState<SavedViewDisplaySettings>(() =>
    cloneDefaultSettings(),
  );

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
      "useProjectSavedViewDisplay must be used within ProjectSavedViewDisplayProvider",
    );
  }
  return ctx;
}
