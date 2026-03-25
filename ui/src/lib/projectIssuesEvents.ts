import type { DatePreset, Priority, StateGroup } from '../types/workspaceViewFilters';
import type {
  SavedViewDisplayPropertyId,
  SavedViewGroupBy,
  SavedViewOrderBy,
} from './projectSavedViewDisplay';

/** Dispatched from PageHeader when project work-items filters change; IssueListPage listens. */
export const PROJECT_ISSUES_FILTER_EVENT = 'project-issues-filter-change';

export const PROJECT_ISSUES_DISPLAY_EVENT = 'project-issues-display-change';

export interface ProjectIssuesDisplayPayload {
  displayProperties: SavedViewDisplayPropertyId[];
  groupBy: SavedViewGroupBy;
  orderBy: SavedViewOrderBy;
  showSubWorkItems: boolean;
  showEmptyGroups: boolean;
}

export interface ProjectIssuesFiltersState {
  priorities: Priority[];
  stateGroups: StateGroup[];
  assigneeIds: string[];
  createdByIds: string[];
  workItemGrouping: 'all' | 'active' | 'backlog';
  startDate: DatePreset[];
  dueDate: DatePreset[];
  startAfter: string | null;
  startBefore: string | null;
  dueAfter: string | null;
  dueBefore: string | null;
}

export const DEFAULT_PROJECT_ISSUES_FILTERS: ProjectIssuesFiltersState = {
  priorities: [],
  stateGroups: [],
  assigneeIds: [],
  createdByIds: [],
  workItemGrouping: 'all',
  startDate: [],
  dueDate: [],
  startAfter: null,
  startBefore: null,
  dueAfter: null,
  dueBefore: null,
};
