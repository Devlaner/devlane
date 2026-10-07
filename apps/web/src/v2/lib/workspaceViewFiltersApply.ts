import type { IssueApiResponse, StateApiResponse } from '../../api/types';
import type { StateGroup, WorkspaceViewFilters } from '../../types/workspaceViewFilters';
import type { Priority } from '../../types';

/**
 * Applies a `WorkspaceViewFilters` set to a list of work items.
 *
 * `workspaceViewFilters.ts` parses and serializes the filter set but stops
 * there, so every page that reads one grew its own copy of this logic.
 * WorkspaceViewsPage and ViewDetailPage share this one instead: they show
 * the same records under the same filter names, and a filter that quietly
 * behaves differently between them would make the two previews impossible to
 * compare.
 *
 * The shipped pages keep their own copies — reworking them is a change to
 * shipped behaviour, not to the preview.
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

function presetEnd(preset: string, from: Date): Date | null {
  const addDays = (days: number) => new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
  if (preset === '1_week') return addDays(7);
  if (preset === '2_weeks') return addDays(14);
  if (preset === '1_month') return addDays(30);
  if (preset === '2_months') return addDays(60);
  return null;
}

function matchesDatePresets(
  value: string | null | undefined,
  presets: readonly string[],
  after: string | null | undefined,
  before: string | null | undefined,
  today: Date,
): boolean {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return false;
  return presets.some((preset) => {
    if (preset === 'custom') {
      if (!after || !before) return false;
      return date >= new Date(after) && date <= new Date(before);
    }
    const end = presetEnd(preset, today);
    return Boolean(end && date >= today && date <= end);
  });
}

export function applyWorkspaceViewFilters(
  issues: IssueApiResponse[],
  filters: WorkspaceViewFilters,
  states: Map<string, StateApiResponse>,
): IssueApiResponse[] {
  const groupOf = (stateId: string | null | undefined): StateGroup | undefined => {
    if (!stateId) return undefined;
    const group = states.get(stateId)?.group?.toLowerCase();
    return group ? STATE_GROUP_BY_NAME[group] : undefined;
  };

  let list = issues;
  if (filters.priority.length) {
    list = list.filter((i) => i.priority && filters.priority.includes(i.priority as Priority));
  }
  if (filters.stateGroup.length) {
    list = list.filter((i) => {
      const group = groupOf(i.state_id ?? undefined);
      return Boolean(group && filters.stateGroup.includes(group));
    });
  }
  if (filters.assigneeIds.length) {
    list = list.filter((i) => i.assignee_ids?.some((id) => filters.assigneeIds.includes(id)));
  }
  if (filters.createdByIds.length) {
    list = list.filter((i) => i.created_by_id && filters.createdByIds.includes(i.created_by_id));
  }
  if (filters.labelIds.length) {
    list = list.filter((i) => i.label_ids?.some((id) => filters.labelIds.includes(id)));
  }
  if (filters.projectIds.length) {
    list = list.filter((i) => filters.projectIds.includes(i.project_id));
  }
  if (filters.grouping !== 'all') {
    list = list.filter((i) => {
      const group = groupOf(i.state_id ?? undefined);
      if (filters.grouping === 'backlog') return group === 'backlog';
      return Boolean(group && !['backlog', 'completed', 'canceled'].includes(group));
    });
  }

  const today = new Date();
  /* A half-filled custom range would exclude everything, so the whole date
     filter is skipped until both ends are set. */
  const startEffective =
    filters.startDate.length &&
    !(filters.startDate.includes('custom') && (!filters.startAfter || !filters.startBefore));
  if (startEffective) {
    list = list.filter((i) =>
      matchesDatePresets(
        i.start_date,
        filters.startDate,
        filters.startAfter,
        filters.startBefore,
        today,
      ),
    );
  }

  const dueEffective =
    filters.dueDate.length &&
    !(filters.dueDate.includes('custom') && (!filters.dueAfter || !filters.dueBefore));
  if (dueEffective) {
    list = list.filter((i) =>
      matchesDatePresets(
        i.target_date,
        filters.dueDate,
        filters.dueAfter,
        filters.dueBefore,
        today,
      ),
    );
  }

  return list;
}
