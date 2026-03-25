import type { IssueApiResponse } from '../api/types';
import type { ModuleWorkItemsDisplayState, ModuleWorkItemsFiltersState } from './moduleWorkItemsPrefs';

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfWeek(d: Date): Date {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}

export function filterModuleIssues(
  issues: IssueApiResponse[],
  f: ModuleWorkItemsFiltersState,
): IssueApiResponse[] {
  const now = new Date();
  const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  return issues.filter((issue) => {
    if (f.priorityKeys.length > 0) {
      const p = issue.priority ?? 'none';
      if (!f.priorityKeys.includes(p)) return false;
    }
    if (f.stateIds.length > 0) {
      const sid = issue.state_id ?? '';
      const wantNone = f.stateIds.includes('__none__');
      const inList = Boolean(sid) && f.stateIds.includes(sid);
      const isNone = !sid;
      if (!inList && !(isNone && wantNone)) return false;
    }
    if (f.assigneeMemberIds.length > 0) {
      const aids = issue.assignee_ids ?? [];
      if (!aids.some((id) => f.assigneeMemberIds.includes(id))) return false;
    }

    if (f.duePreset !== 'none') {
      const td =
        issue.target_date != null && issue.target_date !== ''
          ? new Date(issue.target_date).getTime()
          : null;
      if (f.duePreset === 'no_due') {
        if (issue.target_date) return false;
      } else if (f.duePreset === 'overdue') {
        if (td == null || td >= sod) return false;
      } else if (f.duePreset === 'this_week') {
        if (issue.target_date == null || issue.target_date === '') return false;
        const t = new Date(issue.target_date);
        if (t < startOfWeek(now) || t > endOfWeek(now)) return false;
      } else if (f.duePreset === 'custom') {
        if (f.dueAfter) {
          const a = new Date(f.dueAfter).getTime();
          if (td == null || td < a) return false;
        }
        if (f.dueBefore) {
          const b = new Date(f.dueBefore).getTime();
          if (td == null || td > b) return false;
        }
      }
    }

    if (f.startAfter || f.startBefore) {
      const sd =
        issue.start_date != null && issue.start_date !== ''
          ? new Date(issue.start_date).getTime()
          : null;
      if (f.startAfter) {
        const a = new Date(f.startAfter).getTime();
        if (sd == null || sd < a) return false;
      }
      if (f.startBefore) {
        const b = new Date(f.startBefore).getTime();
        if (sd == null || sd > b) return false;
      }
    }

    return true;
  });
}

export function applyModuleSubWorkFilter(
  issues: IssueApiResponse[],
  display: ModuleWorkItemsDisplayState,
): IssueApiResponse[] {
  if (display.showSubWorkItems) return issues;
  return issues.filter((i) => !i.parent_id);
}

export function sortModuleIssuesDefault(
  issues: IssueApiResponse[],
  stateOrder: Map<string, number>,
): IssueApiResponse[] {
  return [...issues].sort((a, b) => {
    const sa = a.state_id ? (stateOrder.get(a.state_id) ?? 999) : 999;
    const sb = b.state_id ? (stateOrder.get(b.state_id) ?? 999) : 999;
    if (sa !== sb) return sa - sb;
    const na = a.sequence_id ?? 0;
    const nb = b.sequence_id ?? 0;
    if (na !== nb) return na - nb;
    return (a.name || '').localeCompare(b.name || '');
  });
}
