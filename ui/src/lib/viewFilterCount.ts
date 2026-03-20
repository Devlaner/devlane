import type { IssueViewApiResponse } from '../api/types';
import { parseWorkspaceViewFiltersFromSearchParams } from '../types/workspaceViewFilters';

/**
 * Counts how many distinct filter "dimensions" a saved view applies (Plane-style “N filters” pill).
 * Uses the same filter shape as `workspaceViewFiltersToSearchParams` / workspace views.
 */
export function countSavedViewFilters(view: IssueViewApiResponse): number {
  let count = 0;

  const raw = view.filters;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (v == null) continue;
      const s = String(v).trim();
      if (s !== '') params.set(k, s);
    }
    if ([...params.keys()].length > 0) {
      const f = parseWorkspaceViewFiltersFromSearchParams(params);
      if (f.priority.length) count++;
      if (f.stateGroup.length) count++;
      if (f.assigneeIds.length) count++;
      if (f.createdByIds.length) count++;
      if (f.labelIds.length) count++;
      if (f.projectIds.length) count++;
      if (f.grouping !== 'all') count++;

      const startEffective =
        f.startDate.length > 0 &&
        !(f.startDate.includes('custom') && (!f.startAfter || !f.startBefore));
      if (startEffective) count++;

      const dueEffective =
        f.dueDate.length > 0 && !(f.dueDate.includes('custom') && (!f.dueAfter || !f.dueBefore));
      if (dueEffective) count++;
    }
  }

  const query = view.query;
  if (query && typeof query === 'object') {
    const search = (query as Record<string, unknown>).search;
    if (typeof search === 'string' && search.trim()) count++;
  }

  return count;
}
