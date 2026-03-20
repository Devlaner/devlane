import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_WORKSPACE_VIEW_FILTERS,
  type WorkspaceViewFilters,
} from '../types/workspaceViewFilters';
import {
  DEFAULT_WORKSPACE_VIEW_DISPLAY,
  type WorkspaceViewDisplay,
} from '../types/workspaceViewDisplay';
import { WorkspaceViewsStateContext } from './workspaceViewsStateContextRef';

export function WorkspaceViewsStateProvider({ children }: { children: ReactNode }) {
  const [filters, setFiltersState] = useState<WorkspaceViewFilters>(DEFAULT_WORKSPACE_VIEW_FILTERS);
  const [display, setDisplayState] = useState<WorkspaceViewDisplay>(DEFAULT_WORKSPACE_VIEW_DISPLAY);

  const setFilters = useCallback(
    (f: WorkspaceViewFilters | ((prev: WorkspaceViewFilters) => WorkspaceViewFilters)) => {
      setFiltersState((prev) => (typeof f === 'function' ? f(prev) : f));
    },
    [],
  );
  const setDisplay = useCallback(
    (d: WorkspaceViewDisplay | ((prev: WorkspaceViewDisplay) => WorkspaceViewDisplay)) => {
      setDisplayState((prev) => (typeof d === 'function' ? d(prev) : d));
    },
    [],
  );

  const value = useMemo(
    () => ({ filters, setFilters, display, setDisplay }),
    [filters, setFilters, display, setDisplay],
  );

  return (
    <WorkspaceViewsStateContext.Provider value={value}>
      {children}
    </WorkspaceViewsStateContext.Provider>
  );
}
