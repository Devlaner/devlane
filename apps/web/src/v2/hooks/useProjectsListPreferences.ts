import { usePersistedSearchParams } from './usePersistedSearchParams';

/**
 * Search params that describe how the projects list is shown rather than what
 * the user is looking for right now. The free-text query (`q`) is deliberately
 * excluded: coming back to the page with a stale search applied reads as data
 * loss, while a remembered view/sort/filter reads as a preference.
 */
const PERSISTED_KEYS = [
  'view',
  'sortField',
  'sortDir',
  'access',
  'lead',
  'members',
  'myProjects',
  'createdDate',
  'createdAfter',
  'createdBefore',
  'filter',
] as const;

/** Keeps the projects list view mode, sorting and filters across visits. */
export function useProjectsListPreferences(workspaceSlug: string | undefined): void {
  usePersistedSearchParams(
    workspaceSlug ? `devlane-v2-projects-list:${workspaceSlug}` : null,
    PERSISTED_KEYS,
  );
}
