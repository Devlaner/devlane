import { createContext } from "react";
import type { WorkspaceViewFilters } from "../types/workspaceViewFilters";
import type { WorkspaceViewDisplay } from "../types/workspaceViewDisplay";

export interface WorkspaceViewsStateContextValue {
  filters: WorkspaceViewFilters;
  setFilters: (
    f:
      | WorkspaceViewFilters
      | ((prev: WorkspaceViewFilters) => WorkspaceViewFilters),
  ) => void;
  display: WorkspaceViewDisplay;
  setDisplay: (
    d:
      | WorkspaceViewDisplay
      | ((prev: WorkspaceViewDisplay) => WorkspaceViewDisplay),
  ) => void;
}

export const WorkspaceViewsStateContext =
  createContext<WorkspaceViewsStateContextValue | null>(null);
