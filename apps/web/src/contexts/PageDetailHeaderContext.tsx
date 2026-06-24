/* eslint-disable react-refresh/only-export-components -- Provider + read/write hooks live together by design; matches WorkspaceViewsStateContext */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * Lets the route-rendered `PageDetailPage` push its breadcrumb + actions
 * into the global `PageHeader` slot so the page-detail view uses the same
 * top header bar as every other route — there is only one header row, not two
 * stacked.
 *
 * The state and the writer are intentionally split into two contexts:
 *   - `StateContext` carries the current slot; only the header renderer
 *     subscribes to it.
 *   - `ActionsContext` carries `setSlot`, whose identity is stable across
 *     state changes (useCallback with no deps).
 *
 * Without this split, `PageDetailPage` would subscribe to slot-state changes
 * via `useContext`, and its own `setSlot` call inside the write effect would
 * trigger an infinite re-render loop (slot updates → context value changes →
 * page re-renders → new JSX identity → effect re-fires).
 */
type PageDetailHeaderState = {
  breadcrumb: ReactNode | null;
  actions: ReactNode | null;
};

type PageDetailHeaderActions = {
  setSlot: (next: PageDetailHeaderState | null) => void;
};

const EMPTY_STATE: PageDetailHeaderState = { breadcrumb: null, actions: null };
const NOOP_ACTIONS: PageDetailHeaderActions = { setSlot: () => {} };

const PageDetailHeaderStateContext = createContext<PageDetailHeaderState>(EMPTY_STATE);
const PageDetailHeaderActionsContext = createContext<PageDetailHeaderActions>(NOOP_ACTIONS);

export function PageDetailHeaderProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PageDetailHeaderState>(EMPTY_STATE);
  // setSlot has stable identity for the lifetime of the provider so consumers
  // of ActionsContext never see a value change.
  const actions = useState<PageDetailHeaderActions>(() => ({
    setSlot: (next) => setState(next ?? EMPTY_STATE),
  }))[0];
  return (
    <PageDetailHeaderActionsContext.Provider value={actions}>
      <PageDetailHeaderStateContext.Provider value={state}>
        {children}
      </PageDetailHeaderStateContext.Provider>
    </PageDetailHeaderActionsContext.Provider>
  );
}

/** Read-side hook: used by the header renderer in `PageHeader`. */
export function usePageDetailHeader(): PageDetailHeaderState {
  return useContext(PageDetailHeaderStateContext);
}

/**
 * Write-side hook: used by `PageDetailPage`. Replaces the slot with the given
 * nodes whenever they change, then clears on unmount.
 *
 * The two effects are intentional: the first updates the slot when JSX
 * identity changes (every render of the caller), the second clears once on
 * unmount. Combining them would either flicker the header on every render
 * (cleanup → set) or fail to clear on unmount (no cleanup).
 */
export function useSetPageDetailHeader(slot: PageDetailHeaderState): void {
  const { setSlot } = useContext(PageDetailHeaderActionsContext);
  const { breadcrumb, actions } = slot;
  // Push latest slot whenever its content identity changes. setSlot has
  // stable identity (provider construction), so it's safe in deps.
  useEffect(() => {
    setSlot({ breadcrumb, actions });
  }, [setSlot, breadcrumb, actions]);
  // Clear once when the consuming component unmounts.
  useEffect(() => {
    return () => setSlot(null);
  }, [setSlot]);
}
