/**
 * The view the reader was last on, per workspace.
 *
 * The sidebar's Views entry is one link, so it has to name a view. Pointing it
 * at "all issues" means a saved view is left behind the moment the reader
 * navigates anywhere else; pointing it at the last one they opened makes the
 * entry lead back to the list they were working in. Each view's own table and
 * filters are remembered separately, keyed by view id.
 */
const STORAGE_PREFIX = 'devlane-v2-workspace-view-last:';

/** The view every workspace starts on, and the fallback when nothing is stored. */
export const DEFAULT_WORKSPACE_VIEW_ID = 'all-issues';

function storageKey(workspaceSlug: string | undefined): string | null {
  return workspaceSlug ? `${STORAGE_PREFIX}${workspaceSlug}` : null;
}

export function readLastWorkspaceView(workspaceSlug: string | undefined): string {
  const key = storageKey(workspaceSlug);
  if (!key) return DEFAULT_WORKSPACE_VIEW_ID;
  try {
    return localStorage.getItem(key) || DEFAULT_WORKSPACE_VIEW_ID;
  } catch {
    return DEFAULT_WORKSPACE_VIEW_ID;
  }
}

export function writeLastWorkspaceView(workspaceSlug: string | undefined, viewId: string): void {
  const key = storageKey(workspaceSlug);
  if (!key) return;
  try {
    if (viewId && viewId !== DEFAULT_WORKSPACE_VIEW_ID) localStorage.setItem(key, viewId);
    else localStorage.removeItem(key);
  } catch {
    /* Private mode or a full quota: the sidebar just keeps its default target. */
  }
}
