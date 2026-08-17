import type { IssueApiResponse, ProjectApiResponse, StateApiResponse } from '../../api/types';

/**
 * Shared helpers for the v2 project pages. They exist so the seven pages agree
 * on how a work item id, a date or a progress percentage is rendered — the
 * shipped pages each grew their own copy, and the previews are meant to be
 * compared against one another as much as against the shipped app.
 */

/** Counts of child work items by state group, as the progress endpoints return them. */
export interface ProgressCounts {
  backlog: number;
  unstarted: number;
  started: number;
  completed: number;
  cancelled: number;
  total: number;
}

export const EMPTY_PROGRESS: ProgressCounts = {
  backlog: 0,
  unstarted: 0,
  started: 0,
  completed: 0,
  cancelled: 0,
  total: 0,
};

/** Percent of a progress bucket that is done, 0 when nothing is tracked. */
export function completionPercent(progress: ProgressCounts | undefined): number {
  if (!progress || progress.total <= 0) return 0;
  return Math.round((progress.completed / progress.total) * 100);
}

/** `ABC-12`, matching the identifier the shipped work item pages show. */
export function workItemDisplayId(
  issue: Pick<IssueApiResponse, 'id' | 'project_id' | 'sequence_id'>,
  project: Pick<ProjectApiResponse, 'id' | 'identifier'> | undefined,
): string {
  const prefix = project?.identifier ?? project?.id.slice(0, 8) ?? issue.project_id.slice(0, 8);
  return `${prefix}-${issue.sequence_id ?? issue.id.slice(-4)}`;
}

/** Short date, or an em dash when the value is missing or unparseable. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return '—';
  return new Date(parsed).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

/**
 * Coarse relative time — "3 days ago". The shipped inbox and profile pages each
 * grew their own copy of this; the v2 pages share one so a timestamp reads the
 * same wherever it appears.
 */
export function formatTimeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return '—';
  const seconds = Math.floor((Date.now() - parsed) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} day${days === 1 ? '' : 's'} ago`;
  if (hours > 0) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  if (minutes > 0) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  return 'just now';
}

export const PRIORITIES = ['urgent', 'high', 'medium', 'low', 'none'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  none: 'None',
};

/** Badge variants keep urgent visually distinct without a custom palette. */
export function priorityVariant(priority: string | undefined): 'destructive' | 'secondary' {
  return priority === 'urgent' ? 'destructive' : 'secondary';
}

export const STATE_GROUP_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  unstarted: 'Todo',
  started: 'In Progress',
  completed: 'Done',
  cancelled: 'Cancelled',
  /* The API spells this group both ways depending on the endpoint. */
  canceled: 'Cancelled',
};

/** Dot colour for a state, falling back to the muted token when unset. */
export function stateDotStyle(state: StateApiResponse | undefined) {
  return { backgroundColor: state?.color || 'var(--muted-foreground)' };
}

/** Case-insensitive substring match over the given fields. */
export function matchesQuery(query: string, ...fields: (string | undefined | null)[]): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((field) => field?.toLowerCase().includes(needle));
}
