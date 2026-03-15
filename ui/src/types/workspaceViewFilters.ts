export const PRIORITIES = ["urgent", "high", "medium", "low", "none"] as const;
export const STATE_GROUPS = [
  "backlog",
  "unstarted",
  "started",
  "completed",
  "canceled",
] as const;
export const GROUPING_OPTIONS = ["all", "active", "backlog"] as const;
export const DATE_PRESETS = [
  "1_week",
  "2_weeks",
  "1_month",
  "2_months",
  "custom",
] as const;

export type Priority = (typeof PRIORITIES)[number];
export type StateGroup = (typeof STATE_GROUPS)[number];
export type GroupingOption = (typeof GROUPING_OPTIONS)[number];
export type DatePreset = (typeof DATE_PRESETS)[number];

export interface WorkspaceViewFilters {
  priority: Priority[];
  stateGroup: StateGroup[];
  assigneeIds: string[];
  createdByIds: string[];
  labelIds: string[];
  projectIds: string[];
  grouping: GroupingOption;
  startDate: DatePreset[];
  dueDate: DatePreset[];
  startAfter: string | null;
  startBefore: string | null;
  dueAfter: string | null;
  dueBefore: string | null;
}

export const DEFAULT_WORKSPACE_VIEW_FILTERS: WorkspaceViewFilters = {
  priority: [],
  stateGroup: [],
  assigneeIds: [],
  createdByIds: [],
  labelIds: [],
  projectIds: [],
  grouping: "all",
  startDate: [],
  dueDate: [],
  startAfter: null,
  startBefore: null,
  dueAfter: null,
  dueBefore: null,
};

const PARAM_KEYS = {
  priority: "priority",
  state_group: "state_group",
  assignee: "assignee",
  created_by: "created_by",
  label: "label",
  project: "project",
  grouping: "grouping",
  start_date: "start_date",
  due_date: "due_date",
  start_after: "start_after",
  start_before: "start_before",
  due_after: "due_after",
  due_before: "due_before",
} as const;

function parseList(value: string | null): string[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseEnumList<T extends string>(
  value: string | null,
  allowed: readonly T[],
): T[] {
  return parseList(value)
    .map((s) => s.toLowerCase())
    .filter((s): s is T => allowed.includes(s as T));
}

function parseSingle<T extends string>(
  value: string | null,
  allowed: readonly T[],
): T | undefined {
  if (!value?.trim()) return undefined;
  const v = value.trim().toLowerCase();
  return allowed.includes(v as T) ? (v as T) : undefined;
}

export function parseWorkspaceViewFiltersFromSearchParams(
  params: URLSearchParams,
): WorkspaceViewFilters {
  const priority = parseEnumList(params.get(PARAM_KEYS.priority), PRIORITIES);
  const stateGroup = parseEnumList(
    params.get(PARAM_KEYS.state_group),
    STATE_GROUPS,
  );
  const grouping =
    parseSingle(params.get(PARAM_KEYS.grouping), GROUPING_OPTIONS) ?? "all";
  const startDate = parseEnumList(
    params.get(PARAM_KEYS.start_date),
    DATE_PRESETS,
  );
  const dueDate = parseEnumList(params.get(PARAM_KEYS.due_date), DATE_PRESETS);

  const startAfter = params.get(PARAM_KEYS.start_after)?.trim() || null;
  const startBefore = params.get(PARAM_KEYS.start_before)?.trim() || null;
  const dueAfter = params.get(PARAM_KEYS.due_after)?.trim() || null;
  const dueBefore = params.get(PARAM_KEYS.due_before)?.trim() || null;

  return {
    priority,
    stateGroup,
    assigneeIds: parseList(params.get(PARAM_KEYS.assignee)),
    createdByIds: parseList(params.get(PARAM_KEYS.created_by)),
    labelIds: parseList(params.get(PARAM_KEYS.label)),
    projectIds: parseList(params.get(PARAM_KEYS.project)),
    grouping,
    startDate,
    dueDate,
    startAfter,
    startBefore,
    dueAfter,
    dueBefore,
  };
}

export function workspaceViewFiltersToSearchParams(
  f: WorkspaceViewFilters,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (f.priority.length) out[PARAM_KEYS.priority] = f.priority.join(",");
  if (f.stateGroup.length) out[PARAM_KEYS.state_group] = f.stateGroup.join(",");
  if (f.assigneeIds.length) out[PARAM_KEYS.assignee] = f.assigneeIds.join(",");
  if (f.createdByIds.length)
    out[PARAM_KEYS.created_by] = f.createdByIds.join(",");
  if (f.labelIds.length) out[PARAM_KEYS.label] = f.labelIds.join(",");
  if (f.projectIds.length) out[PARAM_KEYS.project] = f.projectIds.join(",");
  if (f.grouping !== "all") out[PARAM_KEYS.grouping] = f.grouping;
  if (f.startDate.length) out[PARAM_KEYS.start_date] = f.startDate.join(",");
  if (f.dueDate.length) out[PARAM_KEYS.due_date] = f.dueDate.join(",");
  if (f.startAfter) out[PARAM_KEYS.start_after] = f.startAfter;
  if (f.startBefore) out[PARAM_KEYS.start_before] = f.startBefore;
  if (f.dueAfter) out[PARAM_KEYS.due_after] = f.dueAfter;
  if (f.dueBefore) out[PARAM_KEYS.due_before] = f.dueBefore;
  return out;
}
