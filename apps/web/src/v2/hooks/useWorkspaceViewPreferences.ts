import { useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWorkspaceViewsState } from '../../contexts/WorkspaceViewsStateContext';
import {
  parseWorkspaceViewFiltersFromSearchParams,
  workspaceViewFiltersToSearchParams,
} from '../../types/workspaceViewFilters';
import { usePersistedSearchParams } from './usePersistedSearchParams';
import {
  V2_WORKSPACE_VIEW_DISPLAY,
  WORKSPACE_VIEW_PARAM_KEYS,
  parseWorkspaceViewDisplayFromParams,
  pickWorkspaceViewParams,
  serializeWorkspaceViewParams,
  workspaceViewDisplayToParams,
} from '../lib/workspaceViewParams';

function storageKeyFor(workspaceSlug: string | undefined, viewId: string): string | null {
  return workspaceSlug ? `devlane-v2-workspace-view:${workspaceSlug}:${viewId}` : null;
}

/**
 * Keeps the workspace views page's table, display and filters across visits.
 *
 * The state itself lives in WorkspaceViewsState, which the page and its toolbar
 * share and which resets on every mount. This hook mirrors that state into the
 * URL and back, and hands the owned params to usePersistedSearchParams so they
 * are reapplied when the page is entered without them.
 *
 * The URL wins over both the stored preference and the page's own state: a
 * shared link lands on the table it describes. Only a state change that the URL
 * has not seen is written outward, so the two cannot chase each other.
 *
 * `persist` is false for a saved view, whose filters and layout are server
 * state — remembering a local copy would quietly hide a later edit to the view.
 * The URL mirroring still applies, so a link into a saved view carrying params
 * shows what it says.
 *
 * Returns a stable predicate for "the URL currently carries view params", which
 * the page uses to decide whether a saved view's own definition should still
 * overwrite what the reader arrived with.
 */
export function useWorkspaceViewPreferences(
  workspaceSlug: string | undefined,
  viewId: string,
  persist: boolean,
): () => boolean {
  usePersistedSearchParams(
    persist ? storageKeyFor(workspaceSlug, viewId) : null,
    WORKSPACE_VIEW_PARAM_KEYS,
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, setFilters, display, setDisplay } = useWorkspaceViewsState();

  const urlSerialized = pickWorkspaceViewParams(searchParams);
  const stateSerialized = serializeWorkspaceViewParams({
    ...workspaceViewFiltersToSearchParams(filters),
    ...workspaceViewDisplayToParams(display, V2_WORKSPACE_VIEW_DISPLAY),
  });

  /* Both start empty because the defaults serialize to nothing: an untouched
     page neither reads from the URL nor writes to it. */
  const lastUrl = useRef('');
  const lastState = useRef('');

  /* Read from a callback that runs long after render — a saved view's fetch
     resolving — so it is recorded rather than returned. */
  const hasUrlParams = useRef(false);
  useEffect(() => {
    hasUrlParams.current = urlSerialized !== '';
  }, [urlSerialized]);

  /** State a URL read is replacing, until the state setters take effect. */
  const stateBeforeUrlRead = useRef<string | null>(null);

  useEffect(() => {
    if (urlSerialized !== lastUrl.current) {
      lastUrl.current = urlSerialized;
      lastState.current = urlSerialized;
      if (urlSerialized === stateSerialized) return;
      stateBeforeUrlRead.current = stateSerialized;
      const params = new URLSearchParams(urlSerialized);
      setFilters(parseWorkspaceViewFiltersFromSearchParams(params));
      setDisplay(parseWorkspaceViewDisplayFromParams(params, V2_WORKSPACE_VIEW_DISPLAY));
      return;
    }

    /* The read above is asynchronous: this effect can run again — under
       StrictMode it always does — while the state is still the value the URL is
       replacing. Writing it back out would erase the params the reader arrived
       with, so wait until the state has actually moved. */
    if (stateBeforeUrlRead.current !== null) {
      if (stateSerialized === stateBeforeUrlRead.current) return;
      stateBeforeUrlRead.current = null;
    }

    if (stateSerialized === lastState.current) return;
    lastState.current = stateSerialized;
    lastUrl.current = stateSerialized;
    const next = new URLSearchParams(searchParams);
    WORKSPACE_VIEW_PARAM_KEYS.forEach((key) => next.delete(key));
    new URLSearchParams(stateSerialized).forEach((value, key) => next.set(key, value));
    /* Replaced rather than pushed: narrowing a list is not a place to go back to. */
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, setDisplay, setFilters, stateSerialized, urlSerialized]);

  return useCallback(() => hasUrlParams.current, []);
}
