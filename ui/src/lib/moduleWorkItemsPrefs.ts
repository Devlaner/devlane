import type { DatePreset } from '../types/workspaceViewFilters';
import type { ProjectIssuesDisplayPayload } from './projectIssuesEvents';
import {
  cloneDefaultProjectIssuesDisplay,
  fromDisplayPayload,
  type ProjectIssuesDisplayState,
} from './projectIssuesDisplay';

export const MODULE_WORK_ITEMS_FILTER_EVENT = 'devlane:module-work-items-filter';
export const MODULE_WORK_ITEMS_DISPLAY_EVENT = 'devlane:module-work-items-display';
export const MODULE_WORK_ITEMS_COUNT_EVENT = 'devlane:module-work-items-count';
export const MODULE_WORK_ITEMS_OPEN_ADD_EXISTING_EVENT =
  'devlane:module-work-items-open-add-existing';

/** Due-date filter chips (multi-select, OR). Empty = no due-date constraint. */
export type ModuleDueDatePreset = 'overdue' | 'this_week' | 'no_due' | 'custom';

export interface ModuleWorkItemsFiltersState {
  priorityKeys: string[];
  stateIds: string[];
  assigneeMemberIds: string[];
  cycleIds: string[];
  mentionedUserIds: string[];
  createdByIds: string[];
  labelIds: string[];
  workItemGrouping: 'all' | 'active' | 'backlog';
  duePresets: ModuleDueDatePreset[];
  dueAfter: string | null;
  dueBefore: string | null;
  /** Relative + custom start filters (multi-select, OR). Same semantics as project issues. */
  startDatePresets: DatePreset[];
  startAfter: string | null;
  startBefore: string | null;
}

export const DEFAULT_MODULE_WORK_ITEMS_FILTERS: ModuleWorkItemsFiltersState = {
  priorityKeys: [],
  stateIds: [],
  assigneeMemberIds: [],
  cycleIds: [],
  mentionedUserIds: [],
  createdByIds: [],
  labelIds: [],
  workItemGrouping: 'all',
  duePresets: [],
  dueAfter: null,
  dueBefore: null,
  startDatePresets: [],
  startAfter: null,
  startBefore: null,
};

export type { ProjectIssuesDisplayState };

export interface PersistedModuleWorkItemsPrefs {
  filters: ModuleWorkItemsFiltersState;
  display: ProjectIssuesDisplayState;
}

export function moduleWorkItemsPrefsKey(
  workspaceSlug: string,
  projectId: string,
  moduleId: string,
): string {
  return `devlane:module-work-items:${workspaceSlug}:${projectId}:${moduleId}`;
}

function normalizeModuleFilters(blob: Record<string, unknown>): ModuleWorkItemsFiltersState {
  const legacyDue = blob.duePreset as string | undefined;
  const rawDuePresets = blob.duePresets;
  let duePresets: ModuleDueDatePreset[] = Array.isArray(rawDuePresets)
    ? (rawDuePresets.filter((x): x is ModuleDueDatePreset =>
        ['overdue', 'this_week', 'no_due', 'custom'].includes(String(x)),
      ) as ModuleDueDatePreset[])
    : [];
  if (duePresets.length === 0 && legacyDue && legacyDue !== 'none') {
    duePresets = [legacyDue as ModuleDueDatePreset];
  }

  const rawStartPresets = blob.startDatePresets;
  const startAfter = (blob.startAfter as string | null | undefined) ?? null;
  const startBefore = (blob.startBefore as string | null | undefined) ?? null;
  let startDatePresets: DatePreset[] = Array.isArray(rawStartPresets)
    ? (rawStartPresets.filter((x): x is DatePreset =>
        ['1_week', '2_weeks', '1_month', '2_months', 'custom'].includes(String(x)),
      ) as DatePreset[])
    : [];
  if (startDatePresets.length === 0 && (startAfter || startBefore)) {
    startDatePresets = ['custom'];
  }

  return {
    priorityKeys: Array.isArray(blob.priorityKeys) ? [...(blob.priorityKeys as string[])] : [],
    stateIds: Array.isArray(blob.stateIds) ? [...(blob.stateIds as string[])] : [],
    assigneeMemberIds: Array.isArray(blob.assigneeMemberIds)
      ? [...(blob.assigneeMemberIds as string[])]
      : [],
    cycleIds: Array.isArray(blob.cycleIds) ? [...(blob.cycleIds as string[])] : [],
    mentionedUserIds: Array.isArray(blob.mentionedUserIds)
      ? [...(blob.mentionedUserIds as string[])]
      : [],
    createdByIds: Array.isArray(blob.createdByIds) ? [...(blob.createdByIds as string[])] : [],
    labelIds: Array.isArray(blob.labelIds) ? [...(blob.labelIds as string[])] : [],
    workItemGrouping:
      blob.workItemGrouping === 'active' || blob.workItemGrouping === 'backlog'
        ? blob.workItemGrouping
        : 'all',
    duePresets,
    dueAfter: (blob.dueAfter as string | null | undefined) ?? null,
    dueBefore: (blob.dueBefore as string | null | undefined) ?? null,
    startDatePresets,
    startAfter,
    startBefore,
  };
}

function normalizeModuleDisplay(raw: unknown): ProjectIssuesDisplayState {
  if (!raw || typeof raw !== 'object') return cloneDefaultProjectIssuesDisplay();
  const o = raw as Record<string, unknown>;
  if (Array.isArray(o.displayProperties)) {
    return fromDisplayPayload({
      displayProperties: o.displayProperties as ProjectIssuesDisplayPayload['displayProperties'],
      groupBy: (o.groupBy as ProjectIssuesDisplayPayload['groupBy']) ?? 'none',
      orderBy: (o.orderBy as ProjectIssuesDisplayPayload['orderBy']) ?? 'last_created',
      showSubWorkItems: o.showSubWorkItems !== undefined ? Boolean(o.showSubWorkItems) : true,
      showEmptyGroups: o.showEmptyGroups !== undefined ? Boolean(o.showEmptyGroups) : true,
    });
  }
  return cloneDefaultProjectIssuesDisplay();
}

export function parseModuleWorkItemsPrefs(
  raw: string | null,
): PersistedModuleWorkItemsPrefs | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as PersistedModuleWorkItemsPrefs & {
      filters?: Record<string, unknown>;
    };
    if (!p || typeof p !== 'object') return null;
    const filters = normalizeModuleFilters(
      (p.filters && typeof p.filters === 'object' ? p.filters : {}) as Record<string, unknown>,
    );
    const display = normalizeModuleDisplay(p.display);
    return { filters, display };
  } catch {
    return null;
  }
}

export function serializeModuleWorkItemsPrefs(p: PersistedModuleWorkItemsPrefs): string {
  return JSON.stringify({
    filters: p.filters,
    display: {
      displayProperties: [...p.display.displayProperties],
      groupBy: p.display.groupBy,
      orderBy: p.display.orderBy,
      showSubWorkItems: p.display.showSubWorkItems,
      showEmptyGroups: p.display.showEmptyGroups,
    },
  });
}

export function isModuleFiltersActive(f: ModuleWorkItemsFiltersState): boolean {
  return (
    f.priorityKeys.length > 0 ||
    f.stateIds.length > 0 ||
    f.assigneeMemberIds.length > 0 ||
    f.cycleIds.length > 0 ||
    f.mentionedUserIds.length > 0 ||
    f.createdByIds.length > 0 ||
    f.labelIds.length > 0 ||
    f.workItemGrouping !== 'all' ||
    f.duePresets.length > 0 ||
    f.startDatePresets.length > 0 ||
    Boolean(f.dueAfter) ||
    Boolean(f.dueBefore) ||
    Boolean(f.startAfter) ||
    Boolean(f.startBefore)
  );
}
