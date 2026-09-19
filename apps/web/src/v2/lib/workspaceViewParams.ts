/**
 * Search-param shape for the v2 workspace views page.
 *
 * The shipped page keeps its filters and display state in memory only, so a
 * reload starts over. v2 puts the same state in the URL — which makes it
 * shareable — and remembers it per view, so reopening the page from the sidebar
 * lands on the table the reader left.
 *
 * The v1 serializers in `types/workspaceViewDisplay` omit whatever equals the
 * *shipped* defaults, which cannot round-trip the v2 defaults: v2 opens on the
 * list layout, so "spreadsheet" would serialize to nothing and read back as
 * "list". These helpers take the baseline as an argument instead, and mark an
 * empty property set explicitly, so parse(serialize(x)) is x for every state
 * the controls can produce.
 */
import {
  DISPLAY_PROPERTY_KEYS,
  SORTABLE_COLUMNS,
  VIEW_LAYOUTS,
  type DisplayPropertyKey,
  type SortableColumn,
  type ViewLayout,
  type WorkspaceViewDisplay,
} from '../../types/workspaceViewDisplay';

const DISPLAY_PARAM = 'display';
const SHOW_SUB_PARAM = 'show_sub';
const LAYOUT_PARAM = 'layout';
const SORT_BY_PARAM = 'sort_by';
const SORT_ORDER_PARAM = 'order';

/** Says "every property is off", which an empty value cannot say. */
const NO_PROPERTIES = 'none';

/**
 * What the v2 views page opens on: the list layout with the properties its
 * table renders as columns.
 */
export const V2_WORKSPACE_VIEW_DISPLAY: WorkspaceViewDisplay = {
  properties: ['id', 'state', 'priority', 'assignee', 'labels', 'due_date'],
  showSubWorkItems: true,
  layout: 'list',
  sortBy: 'created_at',
  sortOrder: 'desc',
};

/**
 * Every param the page's filter and display controls own, in the order they are
 * written. `q` is deliberately absent: a remembered filter reads as a
 * preference, a remembered search term reads as lost data.
 */
export const WORKSPACE_VIEW_PARAM_KEYS = [
  'priority',
  'state_group',
  'assignee',
  'created_by',
  'label',
  'project',
  'grouping',
  'start_date',
  'due_date',
  'start_after',
  'start_before',
  'due_after',
  'due_before',
  DISPLAY_PARAM,
  SHOW_SUB_PARAM,
  LAYOUT_PARAM,
  SORT_BY_PARAM,
  SORT_ORDER_PARAM,
] as const;

/** Serialises the owned params in a fixed order, so two states compare as strings. */
export function serializeWorkspaceViewParams(entries: Record<string, string>): string {
  const params = new URLSearchParams();
  WORKSPACE_VIEW_PARAM_KEYS.forEach((key) => {
    if (entries[key]) params.set(key, entries[key]);
  });
  return params.toString();
}

/** The owned params of a URL, in the same fixed order. */
export function pickWorkspaceViewParams(searchParams: URLSearchParams): string {
  const entries: Record<string, string> = {};
  WORKSPACE_VIEW_PARAM_KEYS.forEach((key) => {
    const value = searchParams.get(key);
    if (value) entries[key] = value;
  });
  return serializeWorkspaceViewParams(entries);
}

/** Writes only what differs from `fallback`, so an untouched page has a clean URL. */
export function workspaceViewDisplayToParams(
  display: WorkspaceViewDisplay,
  fallback: WorkspaceViewDisplay,
): Record<string, string> {
  const out: Record<string, string> = {};
  const properties = display.properties.length ? display.properties.join(',') : NO_PROPERTIES;
  const fallbackProperties = fallback.properties.length
    ? fallback.properties.join(',')
    : NO_PROPERTIES;
  if (properties !== fallbackProperties) out[DISPLAY_PARAM] = properties;
  if (display.showSubWorkItems !== fallback.showSubWorkItems) {
    out[SHOW_SUB_PARAM] = display.showSubWorkItems ? '1' : '0';
  }
  if (display.layout !== fallback.layout) out[LAYOUT_PARAM] = display.layout;
  if (display.sortBy !== fallback.sortBy) out[SORT_BY_PARAM] = display.sortBy;
  if (display.sortOrder !== fallback.sortOrder) out[SORT_ORDER_PARAM] = display.sortOrder;
  return out;
}

/** Reads back what `workspaceViewDisplayToParams` wrote; anything absent or unknown is `fallback`. */
export function parseWorkspaceViewDisplayFromParams(
  params: URLSearchParams,
  fallback: WorkspaceViewDisplay,
): WorkspaceViewDisplay {
  const rawProperties = params.get(DISPLAY_PARAM);
  const properties =
    rawProperties === null
      ? fallback.properties
      : rawProperties.trim().toLowerCase() === NO_PROPERTIES
        ? []
        : rawProperties
            .split(',')
            .map((entry) => entry.trim().toLowerCase())
            .filter((key): key is DisplayPropertyKey =>
              DISPLAY_PROPERTY_KEYS.includes(key as DisplayPropertyKey),
            );

  const showSub = params.get(SHOW_SUB_PARAM)?.trim().toLowerCase();
  const layout = params.get(LAYOUT_PARAM)?.trim().toLowerCase();
  const sortBy = params.get(SORT_BY_PARAM)?.trim().toLowerCase();
  const sortOrder = params.get(SORT_ORDER_PARAM)?.trim().toLowerCase();

  return {
    properties,
    showSubWorkItems:
      showSub === undefined ? fallback.showSubWorkItems : showSub === '1' || showSub === 'true',
    layout: VIEW_LAYOUTS.includes(layout as ViewLayout) ? (layout as ViewLayout) : fallback.layout,
    sortBy: SORTABLE_COLUMNS.includes(sortBy as SortableColumn)
      ? (sortBy as SortableColumn)
      : fallback.sortBy,
    sortOrder: sortOrder === 'asc' ? 'asc' : sortOrder === 'desc' ? 'desc' : fallback.sortOrder,
  };
}
