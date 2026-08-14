/**
 * Per-page view preferences for the v2 list pages.
 *
 * Each hook names the search params that describe *how* a list is shown —
 * layout, sort, scope, filters — and hands them to usePersistedSearchParams so
 * they are still applied when the page is reopened from the sidebar. The URL
 * stays authoritative: a shared link carrying any of these wins.
 *
 * `q` is never in these lists. A remembered filter reads as a preference; a
 * remembered search term reads as the page having lost the reader's data.
 *
 * Keys are scoped to the narrowest thing the choice belongs to — a project for
 * a project-scoped list, the workspace for a workspace-scoped one — so two
 * projects don't inherit each other's filters.
 */
import { usePersistedSearchParams } from './usePersistedSearchParams';

const MODULES_KEYS = ['status', 'sort', 'dir'] as const;
const EPICS_KEYS = ['state', 'priority', 'sort', 'dir'] as const;
const PAGES_KEYS = ['scope', 'access', 'flag', 'sort', 'dir'] as const;
const VIEWS_KEYS = ['access', 'flag', 'sort', 'dir'] as const;
const INTAKE_KEYS = ['status', 'priority', 'sort', 'dir'] as const;
const ARCHIVES_KEYS = ['scope', 'project'] as const;
const DRAFTS_KEYS = ['project'] as const;
const LAYOUT_KEYS = ['layout'] as const;

function projectScopedKey(
  page: string,
  workspaceSlug: string | undefined,
  projectId: string | undefined,
): string | null {
  return workspaceSlug && projectId ? `devlane-v2-${page}:${workspaceSlug}:${projectId}` : null;
}

function workspaceScopedKey(page: string, workspaceSlug: string | undefined): string | null {
  return workspaceSlug ? `devlane-v2-${page}:${workspaceSlug}` : null;
}

/** Keeps the modules list status filter and sorting across visits. */
export function useModulesListPreferences(
  workspaceSlug: string | undefined,
  projectId: string | undefined,
): void {
  usePersistedSearchParams(
    projectScopedKey('modules-list', workspaceSlug, projectId),
    MODULES_KEYS,
  );
}

/** Keeps the epics list state/priority filters and sorting across visits. */
export function useEpicsListPreferences(
  workspaceSlug: string | undefined,
  projectId: string | undefined,
): void {
  usePersistedSearchParams(projectScopedKey('epics-list', workspaceSlug, projectId), EPICS_KEYS);
}

/** Keeps the live/archived split, filters and sorting of the pages list. */
export function usePagesListPreferences(
  workspaceSlug: string | undefined,
  projectId: string | undefined,
): void {
  usePersistedSearchParams(projectScopedKey('pages-list', workspaceSlug, projectId), PAGES_KEYS);
}

/** Keeps the views list filters and sorting across visits. */
export function useViewsListPreferences(
  workspaceSlug: string | undefined,
  projectId: string | undefined,
): void {
  usePersistedSearchParams(projectScopedKey('views-list', workspaceSlug, projectId), VIEWS_KEYS);
}

/** Keeps the intake status tab, priority filter and sorting across visits. */
export function useIntakeListPreferences(
  workspaceSlug: string | undefined,
  projectId: string | undefined,
): void {
  usePersistedSearchParams(projectScopedKey('intake-list', workspaceSlug, projectId), INTAKE_KEYS);
}

/** Keeps the archives scope and project narrowing across visits. */
export function useArchivesPreferences(workspaceSlug: string | undefined): void {
  usePersistedSearchParams(workspaceScopedKey('archives', workspaceSlug), ARCHIVES_KEYS);
}

/** Keeps the drafts project narrowing across visits. */
export function useDraftsPreferences(workspaceSlug: string | undefined): void {
  usePersistedSearchParams(workspaceScopedKey('drafts', workspaceSlug), DRAFTS_KEYS);
}

/**
 * Keeps a work-item layout across visits.
 *
 * Scoped to the project rather than to the individual cycle or module: picking
 * "board" is a habit about how the reader works, not a statement about one
 * cycle, and re-picking it for every cycle in a project is the annoyance.
 */
export function useWorkItemLayoutPreference(
  page: string,
  workspaceSlug: string | undefined,
  projectId: string | undefined,
): void {
  usePersistedSearchParams(projectScopedKey(page, workspaceSlug, projectId), LAYOUT_KEYS);
}
