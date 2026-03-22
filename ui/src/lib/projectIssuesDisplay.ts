import {
  ALL_SAVED_VIEW_DISPLAY_PROPERTIES,
  type SavedViewDisplayPropertyId,
  type SavedViewGroupBy,
  type SavedViewOrderBy,
} from './projectSavedViewDisplay';
import type { ProjectIssuesDisplayPayload } from './projectIssuesEvents';

export type {
  SavedViewDisplayPropertyId,
  SavedViewGroupBy,
  SavedViewOrderBy,
} from './projectSavedViewDisplay';

export { SAVED_VIEW_DISPLAY_PROPERTY_LABELS } from './projectSavedViewDisplay';

const GROUP_BY_OPTIONS: SavedViewGroupBy[] = [
  'states',
  'priority',
  'cycle',
  'module',
  'labels',
  'assignees',
  'created_by',
  'none',
];

const ORDER_BY_OPTIONS: SavedViewOrderBy[] = [
  'manual',
  'last_created',
  'last_updated',
  'start_date',
  'due_date',
  'priority',
];

export interface ProjectIssuesDisplayState {
  displayProperties: Set<SavedViewDisplayPropertyId>;
  groupBy: SavedViewGroupBy;
  orderBy: SavedViewOrderBy;
  showSubWorkItems: boolean;
  showEmptyGroups: boolean;
}

export const DEFAULT_PROJECT_ISSUES_DISPLAY: ProjectIssuesDisplayState = {
  displayProperties: new Set(ALL_SAVED_VIEW_DISPLAY_PROPERTIES),
  groupBy: 'none',
  orderBy: 'last_created',
  showSubWorkItems: true,
  showEmptyGroups: true,
};

export function cloneDefaultProjectIssuesDisplay(): ProjectIssuesDisplayState {
  return {
    displayProperties: new Set(DEFAULT_PROJECT_ISSUES_DISPLAY.displayProperties),
    groupBy: DEFAULT_PROJECT_ISSUES_DISPLAY.groupBy,
    orderBy: DEFAULT_PROJECT_ISSUES_DISPLAY.orderBy,
    showSubWorkItems: DEFAULT_PROJECT_ISSUES_DISPLAY.showSubWorkItems,
    showEmptyGroups: DEFAULT_PROJECT_ISSUES_DISPLAY.showEmptyGroups,
  };
}

function isValidPropertyId(x: string): x is SavedViewDisplayPropertyId {
  return (ALL_SAVED_VIEW_DISPLAY_PROPERTIES as string[]).includes(x);
}

export interface PersistedProjectIssuesDisplay {
  displayProperties: string[];
  groupBy: string;
  orderBy: string;
  showSubWorkItems: boolean;
  showEmptyGroups?: boolean;
}

export function parseProjectIssuesDisplay(raw: string | null): ProjectIssuesDisplayState | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as PersistedProjectIssuesDisplay;
    const props = new Set<SavedViewDisplayPropertyId>();
    if (Array.isArray(p.displayProperties)) {
      for (const id of p.displayProperties) {
        if (typeof id === 'string' && isValidPropertyId(id)) props.add(id);
      }
    }
    const groupBy = GROUP_BY_OPTIONS.includes(p.groupBy as SavedViewGroupBy)
      ? (p.groupBy as SavedViewGroupBy)
      : DEFAULT_PROJECT_ISSUES_DISPLAY.groupBy;
    const orderBy = ORDER_BY_OPTIONS.includes(p.orderBy as SavedViewOrderBy)
      ? (p.orderBy as SavedViewOrderBy)
      : DEFAULT_PROJECT_ISSUES_DISPLAY.orderBy;
    return {
      displayProperties: props.size > 0 ? props : new Set(ALL_SAVED_VIEW_DISPLAY_PROPERTIES),
      groupBy,
      orderBy,
      showSubWorkItems: p.showSubWorkItems !== undefined ? Boolean(p.showSubWorkItems) : true,
      showEmptyGroups: p.showEmptyGroups !== undefined ? Boolean(p.showEmptyGroups) : true,
    };
  } catch {
    return null;
  }
}

export function serializeProjectIssuesDisplay(s: ProjectIssuesDisplayState): string {
  return JSON.stringify({
    displayProperties: [...s.displayProperties],
    groupBy: s.groupBy,
    orderBy: s.orderBy,
    showSubWorkItems: s.showSubWorkItems,
    showEmptyGroups: s.showEmptyGroups,
  });
}

export function projectIssuesDisplayStorageKey(workspaceSlug: string, projectId: string): string {
  return `devlane:project-issues-display:${workspaceSlug}:${projectId}`;
}

export function toDisplayPayload(s: ProjectIssuesDisplayState): ProjectIssuesDisplayPayload {
  return {
    displayProperties: [...s.displayProperties],
    groupBy: s.groupBy,
    orderBy: s.orderBy,
    showSubWorkItems: s.showSubWorkItems,
    showEmptyGroups: s.showEmptyGroups,
  };
}

export function fromDisplayPayload(p: ProjectIssuesDisplayPayload): ProjectIssuesDisplayState {
  const props = new Set<SavedViewDisplayPropertyId>();
  for (const id of p.displayProperties) {
    if (isValidPropertyId(id)) props.add(id);
  }
  return {
    displayProperties: props.size > 0 ? props : new Set(ALL_SAVED_VIEW_DISPLAY_PROPERTIES),
    groupBy: GROUP_BY_OPTIONS.includes(p.groupBy)
      ? p.groupBy
      : DEFAULT_PROJECT_ISSUES_DISPLAY.groupBy,
    orderBy: ORDER_BY_OPTIONS.includes(p.orderBy)
      ? p.orderBy
      : DEFAULT_PROJECT_ISSUES_DISPLAY.orderBy,
    showSubWorkItems: p.showSubWorkItems,
    showEmptyGroups: p.showEmptyGroups,
  };
}
