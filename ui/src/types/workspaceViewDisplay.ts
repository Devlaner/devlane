export const DISPLAY_PROPERTY_KEYS = [
  'id',
  'assignee',
  'start_date',
  'due_date',
  'labels',
  'priority',
  'state',
  'sub_work_item_count',
  'attachment_count',
  'link',
  'estimate',
  'module',
  'cycle',
] as const;

export type DisplayPropertyKey = (typeof DISPLAY_PROPERTY_KEYS)[number];

export const DISPLAY_PROPERTY_LABELS: Record<DisplayPropertyKey, string> = {
  id: 'ID',
  assignee: 'Assignees',
  start_date: 'Start date',
  due_date: 'Due date',
  labels: 'Labels',
  priority: 'Priority',
  state: 'State',
  sub_work_item_count: 'Sub-work item',
  attachment_count: 'Attachment',
  link: 'Link',
  estimate: 'Estimate',
  module: 'Module',
  cycle: 'Cycle',
};

/** Plane-style column order for spreadsheet view: Work items (sticky) then these (horizontal scroll). */
export const SPREADSHEET_COLUMN_ORDER: (DisplayPropertyKey | 'created_at' | 'updated_at')[] = [
  'priority',
  'assignee',
  'labels',
  'module',
  'cycle',
  'start_date',
  'due_date',
  'estimate',
  'created_at',
  'updated_at',
  'link',
  'attachment_count',
  'sub_work_item_count',
];

/** Plane-style layout options for workspace views. */
export const VIEW_LAYOUTS = ['list', 'kanban', 'calendar', 'spreadsheet', 'gantt_chart'] as const;
export type ViewLayout = (typeof VIEW_LAYOUTS)[number];

export const VIEW_LAYOUT_LABELS: Record<ViewLayout, string> = {
  list: 'List',
  kanban: 'Kanban',
  calendar: 'Calendar',
  spreadsheet: 'Spreadsheet',
  gantt_chart: 'Gantt chart',
};

export interface WorkspaceViewDisplay {
  properties: DisplayPropertyKey[];
  showSubWorkItems: boolean;
  layout: ViewLayout;
  sortBy: SortableColumn;
  sortOrder: SortOrder;
}

/** Sortable columns for workspace view table (Plane-style). */
export const SORTABLE_COLUMNS = [
  'name',
  'created_at',
  'updated_at',
  'priority',
  'state',
  'assignee',
  'start_date',
  'due_date',
] as const;
export type SortableColumn = (typeof SORTABLE_COLUMNS)[number];
export type SortOrder = 'asc' | 'desc';

const DISPLAY_PARAM = 'display';
const SHOW_SUB_PARAM = 'show_sub';
const LAYOUT_PARAM = 'layout';
const SORT_BY_PARAM = 'sort_by';
const SORT_ORDER_PARAM = 'order';

/** All display properties; ID is shown in the Work items column when enabled. */
export const DEFAULT_WORKSPACE_VIEW_DISPLAY: WorkspaceViewDisplay = {
  properties: [...DISPLAY_PROPERTY_KEYS],
  showSubWorkItems: false,
  layout: 'spreadsheet',
  sortBy: 'created_at',
  sortOrder: 'desc',
};

function parseDisplayList(value: string | null): DisplayPropertyKey[] {
  if (!value?.trim()) return [];
  return value
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((k): k is DisplayPropertyKey =>
      DISPLAY_PROPERTY_KEYS.includes(k as DisplayPropertyKey),
    );
}

function parseLayout(value: string | null): ViewLayout {
  if (!value?.trim()) return 'spreadsheet';
  const v = value.trim().toLowerCase();
  return VIEW_LAYOUTS.includes(v as ViewLayout) ? (v as ViewLayout) : 'spreadsheet';
}

function parseSortBy(value: string | null): SortableColumn {
  if (!value?.trim()) return 'created_at';
  const v = value.trim().toLowerCase();
  return SORTABLE_COLUMNS.includes(v as SortableColumn) ? (v as SortableColumn) : 'created_at';
}

function parseSortOrder(value: string | null): SortOrder {
  if (!value?.trim()) return 'desc';
  const v = value.trim().toLowerCase();
  return v === 'asc' ? 'asc' : 'desc';
}

export function parseWorkspaceViewDisplayFromSearchParams(
  params: URLSearchParams,
): WorkspaceViewDisplay {
  const properties = parseDisplayList(params.get(DISPLAY_PARAM));
  const showSub = params.get(SHOW_SUB_PARAM)?.toLowerCase();
  const layout = parseLayout(params.get(LAYOUT_PARAM));
  const sortBy = parseSortBy(params.get(SORT_BY_PARAM));
  const sortOrder = parseSortOrder(params.get(SORT_ORDER_PARAM));
  return {
    properties,
    showSubWorkItems: showSub === '1' || showSub === 'true',
    layout,
    sortBy,
    sortOrder,
  };
}

export function workspaceViewDisplayToSearchParams(
  d: WorkspaceViewDisplay,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (d.properties.length) out[DISPLAY_PARAM] = d.properties.join(',');
  if (d.showSubWorkItems) out[SHOW_SUB_PARAM] = '1';
  if (d.layout && d.layout !== 'spreadsheet') out[LAYOUT_PARAM] = d.layout;
  if (d.sortBy && d.sortBy !== 'created_at') out[SORT_BY_PARAM] = d.sortBy;
  if (d.sortOrder && d.sortOrder !== 'desc') out[SORT_ORDER_PARAM] = d.sortOrder;
  return out;
}
