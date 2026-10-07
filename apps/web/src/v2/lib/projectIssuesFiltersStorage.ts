/**
 * Persistence for a project's work-item filters.
 *
 * The shipped list keeps its filters in memory and drops them on reload, so a
 * narrowed list is lost the moment the project is reopened from the sidebar.
 * The v2 list treats a filter the same way it treats a display setting: a
 * choice about how the reader wants to see this project, not a one-off query.
 *
 * Only v2 reads and writes this key — the shipped list is left exactly as it
 * is, which is also why the key is separate from `devlane:project-issues-*`.
 *
 * Everything is re-validated on read: the value survives releases that add or
 * rename a filter, and an unknown entry is dropped rather than fed into the
 * filter predicates.
 */
import {
  DATE_PRESETS,
  GROUPING_OPTIONS,
  PRIORITIES,
  STATE_GROUPS,
  type DatePreset,
  type Priority,
  type StateGroup,
} from '../../types/workspaceViewFilters';
import {
  DEFAULT_PROJECT_ISSUES_FILTERS,
  type ProjectIssuesFiltersState,
} from '../../lib/projectIssuesEvents';

export function projectIssuesFiltersStorageKey(workspaceSlug: string, projectId: string): string {
  return `devlane-v2:project-issues-filters:${workspaceSlug}:${projectId}`;
}

/** Keeps only the members of `allowed`, de-duplicated and in the stored order. */
function readEnumList<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<T>();
  for (const entry of value) {
    if (typeof entry === 'string' && (allowed as readonly string[]).includes(entry)) {
      seen.add(entry as T);
    }
  }
  return [...seen];
}

/** Ids are opaque to us, so the only rule is that they are non-empty strings. */
function readIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry === 'string' && entry.trim()) seen.add(entry);
  }
  return [...seen];
}

/** Custom date bounds are only meaningful if they still parse as dates. */
function readDateBound(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  return Number.isFinite(Date.parse(value)) ? value : null;
}

export function parseProjectIssuesFilters(raw: string | null): ProjectIssuesFiltersState | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const p = parsed as Record<string, unknown>;

  const workItemGrouping = (GROUPING_OPTIONS as readonly string[]).includes(
    p.workItemGrouping as string,
  )
    ? (p.workItemGrouping as ProjectIssuesFiltersState['workItemGrouping'])
    : DEFAULT_PROJECT_ISSUES_FILTERS.workItemGrouping;

  return {
    priorities: readEnumList<Priority>(p.priorities, PRIORITIES),
    stateGroups: readEnumList<StateGroup>(p.stateGroups, STATE_GROUPS),
    assigneeIds: readIdList(p.assigneeIds),
    cycleIds: readIdList(p.cycleIds),
    mentionedUserIds: readIdList(p.mentionedUserIds),
    createdByIds: readIdList(p.createdByIds),
    labelIds: readIdList(p.labelIds),
    workItemGrouping,
    startDate: readEnumList<DatePreset>(p.startDate, DATE_PRESETS),
    dueDate: readEnumList<DatePreset>(p.dueDate, DATE_PRESETS),
    startAfter: readDateBound(p.startAfter),
    startBefore: readDateBound(p.startBefore),
    dueAfter: readDateBound(p.dueAfter),
    dueBefore: readDateBound(p.dueBefore),
  };
}

export function serializeProjectIssuesFilters(filters: ProjectIssuesFiltersState): string {
  return JSON.stringify(filters);
}

/** True when nothing is filtered, so the cleared state is removed, not stored. */
export function isDefaultProjectIssuesFilters(filters: ProjectIssuesFiltersState): boolean {
  return (
    filters.priorities.length === 0 &&
    filters.stateGroups.length === 0 &&
    filters.assigneeIds.length === 0 &&
    filters.cycleIds.length === 0 &&
    filters.mentionedUserIds.length === 0 &&
    filters.createdByIds.length === 0 &&
    filters.labelIds.length === 0 &&
    filters.workItemGrouping === DEFAULT_PROJECT_ISSUES_FILTERS.workItemGrouping &&
    filters.startDate.length === 0 &&
    filters.dueDate.length === 0 &&
    !filters.startAfter &&
    !filters.startBefore &&
    !filters.dueAfter &&
    !filters.dueBefore
  );
}
