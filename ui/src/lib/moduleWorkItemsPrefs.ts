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

export interface ModuleWorkItemsDisplayState {
  groupByState: boolean;
  showSubWorkItems: boolean;
  showState: boolean;
  showPriority: boolean;
  showStartDate: boolean;
  showDueDate: boolean;
  showAssignee: boolean;
  showModule: boolean;
  showLabels: boolean;
  showVisibility: boolean;
}

export const DEFAULT_MODULE_WORK_ITEMS_DISPLAY: ModuleWorkItemsDisplayState = {
  groupByState: false,
  showSubWorkItems: true,
  showState: true,
  showPriority: true,
  showStartDate: true,
  showDueDate: true,
  showAssignee: true,
  showModule: true,
  showLabels: true,
  showVisibility: true,
};

export interface PersistedModuleWorkItemsPrefs {
  filters: ModuleWorkItemsFiltersState;
  display: ModuleWorkItemsDisplayState;
}

export function moduleWorkItemsPrefsKey(
  workspaceSlug: string,
  projectId: string,
  moduleId: string,
): string {
  return `devlane:module-work-items:${workspaceSlug}:${projectId}:${moduleId}`;
}

export function parseModuleWorkItemsPrefs(
  raw: string | null,
): PersistedModuleWorkItemsPrefs | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as PersistedModuleWorkItemsPrefs;
    if (!p || typeof p !== 'object') return null;
    const filters = { ...DEFAULT_MODULE_WORK_ITEMS_FILTERS, ...p.filters };
    const display = { ...DEFAULT_MODULE_WORK_ITEMS_DISPLAY, ...p.display };
    return { filters, display };
  } catch {
    return null;
  }
}

export function serializeModuleWorkItemsPrefs(p: PersistedModuleWorkItemsPrefs): string {
  return JSON.stringify(p);
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
