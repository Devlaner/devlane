import type { IssueApiResponse, StateApiResponse } from '../api/types';
import type { ModuleDueDatePreset, ModuleWorkItemsFiltersState } from './moduleWorkItemsPrefs';
import type { ProjectIssuesDisplayState } from './projectIssuesDisplay';
import { normalizeUuidKey } from './utils';

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
  states: StateApiResponse[],
): IssueApiResponse[] {
  const priorityKeys = f.priorityKeys ?? [];
  const stateIds = f.stateIds ?? [];
  const assigneeMemberIds = f.assigneeMemberIds ?? [];
  const cycleIds = f.cycleIds ?? [];
  const mentionedUserIds = f.mentionedUserIds ?? [];
  const createdByIds = f.createdByIds ?? [];
  const labelIds = f.labelIds ?? [];
  const workItemGrouping = f.workItemGrouping ?? 'all';
  let duePresets = f.duePresets ?? [];
  const startDatePresets = f.startDatePresets ?? [];
  const legacyDue = (f as ModuleWorkItemsFiltersState & { duePreset?: string }).duePreset;
  if (duePresets.length === 0 && legacyDue && legacyDue !== 'none') {
    duePresets = [legacyDue as ModuleDueDatePreset];
  }

  const cycleKeySet = new Set(cycleIds.map((x) => normalizeUuidKey(x)));
  const labelKeySet = new Set(labelIds.map((x) => normalizeUuidKey(x)));
  const assigneeKeySet = new Set(assigneeMemberIds.map((x) => normalizeUuidKey(x)));
  const createdByKeySet = new Set(createdByIds.map((x) => normalizeUuidKey(x)));
  const mentionedKeySet = new Set(mentionedUserIds.map((x) => normalizeUuidKey(x)));

  const now = new Date();
  const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const addDays = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const duePresetsEff =
    duePresets.length > 0 ? duePresets : f.dueAfter || f.dueBefore ? (['custom'] as const) : [];
  const startPresetsEff =
    startDatePresets.length > 0
      ? startDatePresets
      : f.startAfter || f.startBefore
        ? (['custom'] as const)
        : [];

  const stateGroupMap: Record<string, string> = {
    backlog: 'backlog',
    unstarted: 'unstarted',
    started: 'started',
    completed: 'completed',
    canceled: 'canceled',
    cancelled: 'canceled',
  };

  const getStateGroup = (stateId: string | null | undefined): string | undefined => {
    if (!stateId) return undefined;
    const s = states.find((x) => x.id === stateId);
    const g = s?.group?.toLowerCase();
    return g ? stateGroupMap[g] : undefined;
  };

  const issueMentionSearchBlob = (issue: IssueApiResponse): string => {
    const parts: string[] = [];
    if (issue.name) parts.push(issue.name);
    if (issue.description_html) parts.push(issue.description_html);
    if (issue.description && typeof issue.description === 'object') {
      try {
        parts.push(JSON.stringify(issue.description));
      } catch {
        // ignore
      }
    }
    return parts.join('\n').toLowerCase();
  };

  const issueMentionsUserId = (issue: IssueApiResponse, userId: string): boolean => {
    const blob = issueMentionSearchBlob(issue);
    const uRaw = userId.trim().toLowerCase();
    if (!uRaw) return false;
    const uNorm = normalizeUuidKey(userId);
    if (blob.includes(`@${uRaw}`)) return true;
    if (blob.includes(uRaw)) return true;
    if (uNorm && blob.includes(uNorm)) return true;
    return false;
  };

  return issues.filter((issue) => {
    if (priorityKeys.length > 0) {
      const p = issue.priority ?? 'none';
      if (!priorityKeys.includes(p)) return false;
    }
    if (stateIds.length > 0) {
      const sid = issue.state_id ?? '';
      const wantNone = stateIds.includes('__none__');
      const inList = Boolean(sid) && stateIds.includes(sid);
      const isNone = !sid;
      if (!inList && !(isNone && wantNone)) return false;
    }
    if (assigneeMemberIds.length > 0) {
      const aids = issue.assignee_ids ?? [];
      if (!aids.some((id) => assigneeKeySet.has(normalizeUuidKey(id)))) return false;
    }

    if (cycleKeySet.size > 0) {
      const cids = issue.cycle_ids ?? [];
      if (!cids.some((id) => cycleKeySet.has(normalizeUuidKey(id)))) return false;
    }

    if (labelKeySet.size > 0) {
      const lids = issue.label_ids ?? [];
      if (!lids.some((id) => labelKeySet.has(normalizeUuidKey(id)))) return false;
    }

    if (createdByKeySet.size > 0) {
      if (!createdByKeySet.has(normalizeUuidKey(issue.created_by_id))) return false;
    }

    if (mentionedKeySet.size > 0) {
      if (
        !mentionedUserIds.some((uid) => {
          if (!uid) return false;
          return issueMentionsUserId(issue, uid);
        })
      ) {
        return false;
      }
    }

    if (workItemGrouping === 'active') {
      const g = getStateGroup(issue.state_id);
      if (!(g === 'unstarted' || g === 'started')) return false;
    } else if (workItemGrouping === 'backlog') {
      const g = getStateGroup(issue.state_id);
      if (g !== 'backlog') return false;
    }

    const dueEffective =
      duePresetsEff.length && !(duePresetsEff.includes('custom') && (!f.dueAfter || !f.dueBefore));

    if (dueEffective) {
      const td =
        issue.target_date != null && issue.target_date !== ''
          ? new Date(issue.target_date).getTime()
          : null;
      const ok = duePresetsEff.some((preset) => {
        if (preset === 'no_due') return !issue.target_date;
        if (preset === 'overdue') return td != null && td < sod;
        if (preset === 'this_week') {
          if (issue.target_date == null || issue.target_date === '') return false;
          const t = new Date(issue.target_date);
          return t >= startOfWeek(now) && t <= endOfWeek(now);
        }
        if (preset === 'custom') {
          if (!f.dueAfter || !f.dueBefore) return false;
          if (td == null) return false;
          const a = new Date(f.dueAfter).getTime();
          const b = new Date(f.dueBefore).getTime();
          return td >= a && td <= b;
        }
        return false;
      });
      if (!ok) return false;
    }

    const startEffective =
      startPresetsEff.length &&
      !(startPresetsEff.includes('custom') && (!f.startAfter || !f.startBefore));

    if (startEffective) {
      const sd = issue.start_date ? new Date(issue.start_date) : null;
      if (!sd) return false;
      const ok = startPresetsEff.some((preset) => {
        if (preset === 'custom' && f.startAfter && f.startBefore) {
          const after = new Date(f.startAfter);
          const before = new Date(f.startBefore);
          return sd >= after && sd <= before;
        }
        if (preset === 'custom') return false;
        const end =
          preset === '1_week'
            ? addDays(7)
            : preset === '2_weeks'
              ? addDays(14)
              : preset === '1_month'
                ? addDays(30)
                : preset === '2_months'
                  ? addDays(60)
                  : null;
        return Boolean(end && sd >= now && sd <= end);
      });
      if (!ok) return false;
    }

    return true;
  });
}

export function applyModuleSubWorkFilter(
  issues: IssueApiResponse[],
  display: Pick<ProjectIssuesDisplayState, 'showSubWorkItems'>,
): IssueApiResponse[] {
  if (display.showSubWorkItems) return issues;
  return issues.filter((i) => !i.parent_id);
}
