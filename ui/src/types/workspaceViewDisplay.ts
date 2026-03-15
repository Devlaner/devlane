export const DISPLAY_PROPERTY_KEYS = [
  "id",
  "assignee",
  "start_date",
  "due_date",
  "labels",
  "priority",
  "state",
  "sub_work_item_count",
  "attachment_count",
  "link",
  "estimate",
  "module",
  "cycle",
] as const;

export type DisplayPropertyKey = (typeof DISPLAY_PROPERTY_KEYS)[number];

export const DISPLAY_PROPERTY_LABELS: Record<DisplayPropertyKey, string> = {
  id: "ID",
  assignee: "Assignee",
  start_date: "Start date",
  due_date: "Due date",
  labels: "Labels",
  priority: "Priority",
  state: "State",
  sub_work_item_count: "Sub-work item count",
  attachment_count: "Attachment count",
  link: "Link",
  estimate: "Estimate",
  module: "Module",
  cycle: "Cycle",
};

export interface WorkspaceViewDisplay {
  properties: DisplayPropertyKey[];
  showSubWorkItems: boolean;
}

const DISPLAY_PARAM = "display";
const SHOW_SUB_PARAM = "show_sub";

export const DEFAULT_WORKSPACE_VIEW_DISPLAY: WorkspaceViewDisplay = {
  properties: [],
  showSubWorkItems: false,
};

function parseDisplayList(value: string | null): DisplayPropertyKey[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((k): k is DisplayPropertyKey =>
      DISPLAY_PROPERTY_KEYS.includes(k as DisplayPropertyKey)
    );
}

export function parseWorkspaceViewDisplayFromSearchParams(
  params: URLSearchParams
): WorkspaceViewDisplay {
  const properties = parseDisplayList(params.get(DISPLAY_PARAM));
  const showSub = params.get(SHOW_SUB_PARAM)?.toLowerCase();
  return {
    properties,
    showSubWorkItems: showSub === "1" || showSub === "true",
  };
}

export function workspaceViewDisplayToSearchParams(
  d: WorkspaceViewDisplay
): Record<string, string> {
  const out: Record<string, string> = {};
  if (d.properties.length)
    out[DISPLAY_PARAM] = d.properties.join(",");
  if (d.showSubWorkItems) out[SHOW_SUB_PARAM] = "1";
  return out;
}
