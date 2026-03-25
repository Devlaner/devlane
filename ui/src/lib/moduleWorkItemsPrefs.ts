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

export type ModuleDueDatePreset = 'none' | 'overdue' | 'this_week' | 'no_due' | 'custom';

export interface ModuleWorkItemsFiltersState {
  priorityKeys: string[];
  stateIds: string[];
  assigneeMemberIds: string[];
  duePreset: ModuleDueDatePreset;
  dueAfter: string | null;
  dueBefore: string | null;
  startAfter: string | null;
  startBefore: string | null;
}

export const DEFAULT_MODULE_WORK_ITEMS_FILTERS: ModuleWorkItemsFiltersState = {
  priorityKeys: [],
  stateIds: [],
  assigneeMemberIds: [],
  duePreset: 'none',
  dueAfter: null,
  dueBefore: null,
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
    const p = JSON.parse(raw) as PersistedModuleWorkItemsPrefs;
    if (!p || typeof p !== 'object') return null;
    const filters = { ...DEFAULT_MODULE_WORK_ITEMS_FILTERS, ...p.filters };
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
    f.duePreset !== 'none' ||
    Boolean(f.dueAfter) ||
    Boolean(f.dueBefore) ||
    Boolean(f.startAfter) ||
    Boolean(f.startBefore)
  );
}
