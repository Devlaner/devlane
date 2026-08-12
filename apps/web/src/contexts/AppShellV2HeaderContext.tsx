/* eslint-disable react-refresh/only-export-components -- Provider + read/write hooks live together by design; matches PageDetailHeaderContext */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * Lets a v2 detail page push its breadcrumb tail and header actions into
 * `AppShellV2Page`'s header, which otherwise names the page from the URL alone.
 *
 * The shell's URL-only derivation works for the list pages — the trailing path
 * segment *is* the page name. On a detail route the trailing segment is an id,
 * and the crumb wants the entity's name, which only the child has fetched.
 * Teaching the shell to fetch it would duplicate the child's request on every
 * detail route, so the child pushes it up instead.
 *
 * This mirrors `PageDetailHeaderContext`, which solves the same problem for the
 * shipped shell. A separate context rather than a shared one because that
 * provider is mounted only in `AppShell`, which the v2 tree deliberately sits
 * outside of — a page writing to it there would hit the no-op default and
 * silently do nothing.
 *
 * The state and the writer are split into two contexts for the same reason as
 * the shipped one:
 *   - `StateContext` carries the current slot; only the shell subscribes to it.
 *   - `ActionsContext` carries `setSlot`, whose identity is stable for the
 *     provider's lifetime.
 *
 * Without the split, the writing page would subscribe to slot-state changes,
 * and its own `setSlot` inside the write effect would loop (slot updates →
 * context value changes → page re-renders → new JSX identity → effect re-fires).
 */

/** The middle breadcrumb: where the detail page's list lives. */
export interface V2HeaderParent {
  label: string;
  to: string;
}

export interface V2HeaderState {
  /** Middle crumb, linking back to the list the entity came from. */
  parent: V2HeaderParent | null;
  /** Leaf crumb: the entity's own name. Null while it is still loading. */
  title: string | null;
  /** Right-aligned header controls, standing in for the list toolbars. */
  actions: ReactNode | null;
}

interface V2HeaderActions {
  setSlot: (next: V2HeaderState | null) => void;
}

const EMPTY_STATE: V2HeaderState = { parent: null, title: null, actions: null };
const NOOP_ACTIONS: V2HeaderActions = { setSlot: () => {} };

const V2HeaderStateContext = createContext<V2HeaderState>(EMPTY_STATE);
const V2HeaderActionsContext = createContext<V2HeaderActions>(NOOP_ACTIONS);

export function V2HeaderProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<V2HeaderState>(EMPTY_STATE);
  // setSlot has stable identity for the lifetime of the provider so consumers
  // of ActionsContext never see a value change.
  const actions = useState<V2HeaderActions>(() => ({
    setSlot: (next) => setState(next ?? EMPTY_STATE),
  }))[0];
  return (
    <V2HeaderActionsContext.Provider value={actions}>
      <V2HeaderStateContext.Provider value={state}>{children}</V2HeaderStateContext.Provider>
    </V2HeaderActionsContext.Provider>
  );
}

/** Read-side hook: used by the header in `AppShellV2Page`. */
export function useV2Header(): V2HeaderState {
  return useContext(V2HeaderStateContext);
}

/**
 * Write-side hook: used by the v2 detail pages. Replaces the slot whenever the
 * given nodes change, then clears on unmount.
 *
 * The two effects are intentional: the first updates the slot when its content
 * identity changes (every render of the caller), the second clears once on
 * unmount. Combining them would either flicker the header on every render
 * (cleanup → set) or fail to clear on unmount (no cleanup).
 */
export function useSetV2Header(slot: V2HeaderState): void {
  const { setSlot } = useContext(V2HeaderActionsContext);
  const { parent, title, actions } = slot;
  // Push latest slot whenever its content identity changes. setSlot has stable
  // identity (provider construction), so it's safe in deps.
  useEffect(() => {
    setSlot({ parent, title, actions });
  }, [setSlot, parent, title, actions]);
  // Clear once when the consuming component unmounts.
  useEffect(() => {
    return () => setSlot(null);
  }, [setSlot]);
}
