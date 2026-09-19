import { normalizeUuidKey } from '../../lib/utils';
import type { ProjectIssuesFiltersState } from '../../lib/projectIssuesEvents';
import type { Priority } from '../../types';
import type { StateGroup } from '../../types/workspaceViewFilters';
import type { IssueApiResponse, StateApiResponse } from '../../api/types';

/**
 * Applies a `ProjectIssuesFiltersState` (plus the toolbar's free-text query) to
 * a list of work items.
 *
 * useProjectIssuesController owned this logic while the project list was the
 * only page holding that filter state. CycleDetailPage now holds one too, and a
 * cycle whose "Priority: Urgent" meant something subtly different from the
 * project list's would make the two impossible to reason about together — so
 * both call this.
 *
 * The shipped pages keep their own filtering; reworking them is a change to
 * shipped behaviour, not to the v2 surface.
 */

/** The API spells cancelled both ways depending on the endpoint. */
const STATE_GROUP_BY_NAME: Record<string, StateGroup> = {
  backlog: 'backlog',
  unstarted: 'unstarted',
  started: 'started',
  completed: 'completed',
  canceled: 'canceled',
  cancelled: 'canceled',
};

function issueMentionSearchBlob(issue: IssueApiResponse): string {
  const parts: string[] = [];
  if (issue.name) parts.push(issue.name);
  if (issue.description_html) parts.push(issue.description_html);
  if (issue.description && typeof issue.description === 'object') {
    try {
      parts.push(JSON.stringify(issue.description));
    } catch {
      /* non-serializable rich text */
    }
  }
  return parts.join('\n').toLowerCase();
}

/** Best-effort: match user id (or @-prefixed) in title / description HTML / JSON description. */
function issueMentionsUserId(issue: IssueApiResponse, userId: string): boolean {
  const blob = issueMentionSearchBlob(issue);
  if (!blob) return false;
  const u = userId.toLowerCase().trim();
  if (!u) return false;
  if (blob.includes(`@${u}`)) return true;
  return blob.includes(u);
}

function presetEnd(preset: string, from: Date): Date | null {
  const addDays = (days: number) => new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
  if (preset === '1_week') return addDays(7);
  if (preset === '2_weeks') return addDays(14);
  if (preset === '1_month') return addDays(30);
  if (preset === '2_months') return addDays(60);
  return null;
}

/**
 * A date filter is only worth applying once it can decide something: a `custom`
 * range without both ends selected would otherwise hide every row while the
 * reader is still picking the second date.
 */
function datePresetsEffective(
  presets: readonly string[],
  after: string | null | undefined,
  before: string | null | undefined,
): boolean {
  return Boolean(presets.length && !(presets.includes('custom') && (!after || !before)));
}

function matchesDatePresets(
  value: string | null | undefined,
  presets: readonly string[],
  after: string | null | undefined,
  before: string | null | undefined,
  now: Date,
): boolean {
  const date = value ? new Date(value) : null;
  if (!date) return false;
  return presets.some((preset) => {
    if (preset === 'custom') {
      if (!after || !before) return false;
      return date >= new Date(after) && date <= new Date(before);
    }
    const end = presetEnd(preset, now);
    return Boolean(end && date >= now && date <= end);
  });
}

export interface ApplyProjectIssuesFiltersArgs {
  issues: IssueApiResponse[];
  states: StateApiResponse[];
  filters: ProjectIssuesFiltersState;
  /** Free text matched against the title and the work item's number. */
  searchQuery?: string;
}

export function applyProjectIssuesFilters({
  issues,
  states,
  filters,
  searchQuery = '',
}: ApplyProjectIssuesFiltersArgs): IssueApiResponse[] {
  const getStateGroup = (stateId: string | null | undefined): StateGroup | undefined => {
    if (!stateId) return undefined;
    const group = states.find((state) => state.id === stateId)?.group?.toLowerCase();
    return group ? STATE_GROUP_BY_NAME[group] : undefined;
  };

  /** Any of the filter's ids matches any of the row's ids, uuid form aside. */
  const matchesAnyId = (
    rowIds: readonly string[] | null | undefined,
    filterIds: readonly string[],
  ): boolean => {
    const keys = new Set(filterIds.map((id) => normalizeUuidKey(id)));
    return Boolean(rowIds?.some((id) => keys.has(normalizeUuidKey(id))));
  };

  let list = issues;

  if (filters.priorities.length) {
    list = list.filter((issue) =>
      filters.priorities.includes((issue.priority as Priority) ?? 'none'),
    );
  }
  if (filters.stateGroups.length) {
    list = list.filter((issue) => {
      const group = getStateGroup(issue.state_id ?? undefined);
      return group !== undefined && filters.stateGroups.includes(group);
    });
  }
  if (filters.assigneeIds.length) {
    list = list.filter((issue) => matchesAnyId(issue.assignee_ids, filters.assigneeIds));
  }
  if (filters.createdByIds.length) {
    list = list.filter((issue) =>
      matchesAnyId(issue.created_by_id ? [issue.created_by_id] : [], filters.createdByIds),
    );
  }
  if (filters.cycleIds.length) {
    list = list.filter((issue) => matchesAnyId(issue.cycle_ids, filters.cycleIds));
  }
  if (filters.labelIds.length) {
    list = list.filter((issue) => matchesAnyId(issue.label_ids, filters.labelIds));
  }
  if (filters.mentionedUserIds.length) {
    list = list.filter((issue) =>
      filters.mentionedUserIds.some((userId) => issueMentionsUserId(issue, userId)),
    );
  }

  if (filters.workItemGrouping === 'active') {
    list = list.filter((issue) => {
      const group = getStateGroup(issue.state_id ?? undefined);
      return group === 'unstarted' || group === 'started';
    });
  } else if (filters.workItemGrouping === 'backlog') {
    list = list.filter((issue) => getStateGroup(issue.state_id ?? undefined) === 'backlog');
  }

  const now = new Date();
  if (datePresetsEffective(filters.startDate, filters.startAfter, filters.startBefore)) {
    list = list.filter((issue) =>
      matchesDatePresets(
        issue.start_date,
        filters.startDate,
        filters.startAfter,
        filters.startBefore,
        now,
      ),
    );
  }
  if (datePresetsEffective(filters.dueDate, filters.dueAfter, filters.dueBefore)) {
    list = list.filter((issue) =>
      matchesDatePresets(
        issue.target_date,
        filters.dueDate,
        filters.dueAfter,
        filters.dueBefore,
        now,
      ),
    );
  }

  const needle = searchQuery.trim().toLowerCase();
  if (needle) {
    list = list.filter((issue) => {
      const sequence = issue.sequence_id != null ? String(issue.sequence_id) : '';
      return issue.name.toLowerCase().includes(needle) || sequence.includes(needle);
    });
  }

  return list;
}
