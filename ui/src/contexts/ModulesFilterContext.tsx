/* eslint-disable react-refresh/only-export-components -- Context file exports hooks + provider */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type ModulesLayout = 'list' | 'gallery' | 'timeline';

export interface ModulesFilterState {
  search: string;
  layout: ModulesLayout;
  sort: string;
  order: 'asc' | 'desc';
  favorites: boolean;
  status: string[];
  lead: string[];
  members: string[];
  startDateList: string[];
  dueDateList: string[];
  startAfter: string | null;
  startBefore: string | null;
  dueAfter: string | null;
  dueBefore: string | null;
}

export interface ModulesFilterContextValue extends ModulesFilterState {
  setSearch: (v: string) => void;
  setLayout: (v: ModulesLayout) => void;
  setSort: (v: string) => void;
  setOrder: (v: 'asc' | 'desc') => void;
  setFavorites: (v: boolean) => void;
  setStatus: (v: string[] | ((prev: string[]) => string[])) => void;
  setLead: (v: string[] | ((prev: string[]) => string[])) => void;
  setMembers: (v: string[] | ((prev: string[]) => string[])) => void;
  setStartDateList: (v: string[] | ((prev: string[]) => string[])) => void;
  setDueDateList: (v: string[] | ((prev: string[]) => string[])) => void;
  setStartAfter: (v: string | null) => void;
  setStartBefore: (v: string | null) => void;
  setDueAfter: (v: string | null) => void;
  setDueBefore: (v: string | null) => void;
  updateFilter: (updater: (prev: ModulesFilterState) => Partial<ModulesFilterState>) => void;
}

const defaultState: ModulesFilterState = {
  search: '',
  layout: 'list',
  sort: 'progress',
  order: 'asc',
  favorites: false,
  status: [],
  lead: [],
  members: [],
  startDateList: [],
  dueDateList: [],
  startAfter: null,
  startBefore: null,
  dueAfter: null,
  dueBefore: null,
};

const ModulesFilterContext = createContext<ModulesFilterContextValue | null>(null);

export function ModulesFilterProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ModulesFilterState>(defaultState);

  const updateFilter = useCallback(
    (updater: (prev: ModulesFilterState) => Partial<ModulesFilterState>) => {
      setState((prev) => ({ ...prev, ...updater(prev) }));
    },
    [],
  );

  const setSearch = useCallback((v: string) => {
    setState((prev) => ({ ...prev, search: v }));
  }, []);
  const setLayout = useCallback((v: ModulesLayout) => {
    setState((prev) => ({ ...prev, layout: v }));
  }, []);
  const setSort = useCallback((v: string) => {
    setState((prev) => ({ ...prev, sort: v }));
  }, []);
  const setOrder = useCallback((v: 'asc' | 'desc') => {
    setState((prev) => ({ ...prev, order: v }));
  }, []);
  const setFavorites = useCallback((v: boolean) => {
    setState((prev) => ({ ...prev, favorites: v }));
  }, []);
  const setStatus = useCallback((v: string[] | ((prev: string[]) => string[])) => {
    setState((prev) => ({
      ...prev,
      status: typeof v === 'function' ? v(prev.status) : v,
    }));
  }, []);
  const setLead = useCallback((v: string[] | ((prev: string[]) => string[])) => {
    setState((prev) => ({
      ...prev,
      lead: typeof v === 'function' ? v(prev.lead) : v,
    }));
  }, []);
  const setMembers = useCallback((v: string[] | ((prev: string[]) => string[])) => {
    setState((prev) => ({
      ...prev,
      members: typeof v === 'function' ? v(prev.members) : v,
    }));
  }, []);
  const setStartDateList = useCallback((v: string[] | ((prev: string[]) => string[])) => {
    setState((prev) => ({
      ...prev,
      startDateList: typeof v === 'function' ? v(prev.startDateList) : v,
    }));
  }, []);
  const setDueDateList = useCallback((v: string[] | ((prev: string[]) => string[])) => {
    setState((prev) => ({
      ...prev,
      dueDateList: typeof v === 'function' ? v(prev.dueDateList) : v,
    }));
  }, []);
  const setStartAfter = useCallback((v: string | null) => {
    setState((prev) => ({ ...prev, startAfter: v }));
  }, []);
  const setStartBefore = useCallback((v: string | null) => {
    setState((prev) => ({ ...prev, startBefore: v }));
  }, []);
  const setDueAfter = useCallback((v: string | null) => {
    setState((prev) => ({ ...prev, dueAfter: v }));
  }, []);
  const setDueBefore = useCallback((v: string | null) => {
    setState((prev) => ({ ...prev, dueBefore: v }));
  }, []);

  const value = useMemo<ModulesFilterContextValue>(
    () => ({
      ...state,
      setSearch,
      setLayout,
      setSort,
      setOrder,
      setFavorites,
      setStatus,
      setLead,
      setMembers,
      setStartDateList,
      setDueDateList,
      setStartAfter,
      setStartBefore,
      setDueAfter,
      setDueBefore,
      updateFilter,
    }),
    [
      state,
      setSearch,
      setLayout,
      setSort,
      setOrder,
      setFavorites,
      setStatus,
      setLead,
      setMembers,
      setStartDateList,
      setDueDateList,
      setStartAfter,
      setStartBefore,
      setDueAfter,
      setDueBefore,
      updateFilter,
    ],
  );

  return <ModulesFilterContext.Provider value={value}>{children}</ModulesFilterContext.Provider>;
}

export function useModulesFilter(): ModulesFilterContextValue {
  const ctx = useContext(ModulesFilterContext);
  if (!ctx) {
    throw new Error('useModulesFilter must be used within ModulesFilterProvider');
  }
  return ctx;
}

export function useModulesFilterOrNull(): ModulesFilterContextValue | null {
  return useContext(ModulesFilterContext);
}
