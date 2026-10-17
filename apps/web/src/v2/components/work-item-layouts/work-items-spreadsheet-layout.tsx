import { Fragment, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Badge } from '@/v2/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/v2/components/ui/scroll-area';
import { IssuePRBadge } from '@/components/work-item/IssuePRBadge';
import { cn } from '@/lib/utils';
import {
  InlineAssigneeCell,
  InlineDateCell,
  InlineLabelsCell,
  InlinePriorityCell,
  InlineStateCell,
} from '../work-item-inline-cells';
import { stateDotStyle, workItemDisplayId } from '../../lib/project';
import type {
  GroupedIssuesResult,
  SubGroupedIssuesResult,
} from '../../../lib/issueListGroupAndSort';
import type { SavedViewDisplayPropertyId } from '../../../lib/projectSavedViewDisplay';
import type { IssueInlinePatch } from '../../../components/work-item/layouts/IssueLayoutTypes';
import type {
  GitHubIssueSummaryEntry,
  IssueApiResponse,
  LabelApiResponse,
  ProjectApiResponse,
  StateApiResponse,
  WorkspaceMemberApiResponse,
} from '../../../api/types';

type ColumnKey = SavedViewDisplayPropertyId | 'title';

/** Column order and default widths, matching the shipped spreadsheet. */
const COLUMN_META: Partial<Record<ColumnKey, { width: number; minWidth: number }>> = {
  id: { width: 110, minWidth: 80 },
  title: { width: 320, minWidth: 200 },
  state: { width: 180, minWidth: 120 },
  priority: { width: 150, minWidth: 110 },
  assignee: { width: 180, minWidth: 120 },
  labels: { width: 210, minWidth: 140 },
  due_date: { width: 160, minWidth: 120 },
  start_date: { width: 160, minWidth: 120 },
  cycle: { width: 160, minWidth: 110 },
  module: { width: 160, minWidth: 110 },
  sub_work_count: { width: 120, minWidth: 90 },
};

const DEFAULT_COLUMN_ORDER: ColumnKey[] = [
  'id',
  'title',
  'state',
  'priority',
  'assignee',
  'labels',
  'due_date',
  'start_date',
  'cycle',
  'module',
  'sub_work_count',
];

interface WorkItemsSpreadsheetLayoutProps {
  groupedIssues: GroupedIssuesResult;
  subGroupedIssues: SubGroupedIssuesResult | null;
  showEmptyGroups: boolean;
  project: ProjectApiResponse;
  states: StateApiResponse[];
  labels: LabelApiResponse[];
  members: WorkspaceMemberApiResponse[];
  prSummary: Record<string, GitHubIssueSummaryEntry>;
  hasCol: (id: SavedViewDisplayPropertyId) => boolean;
  subWorkCountByParentId: Map<string, number>;
  cycleName: (issue: IssueApiResponse) => string;
  moduleName: (issue: IssueApiResponse) => string;
  issueUrl: (issueId: string) => string;
  onUpdateIssue: (issueId: string, patch: IssueInlinePatch) => void;
}

/**
 * Dense spreadsheet view: every enabled display property gets a column that can
 * be dragged into a new position or resized from its right edge, and each cell
 * edits through the shared inline-update path.
 *
 * estimate, attachment_count and link have no column here for the same reason
 * the shipped spreadsheet omits them — the list endpoint returns nothing to put
 * in them — while staying togglable so both designs share one display state.
 */
export function WorkItemsSpreadsheetLayout({
  groupedIssues,
  subGroupedIssues,
  showEmptyGroups,
  project,
  states,
  labels,
  members,
  prSummary,
  hasCol,
  subWorkCountByParentId,
  cycleName,
  moduleName,
  issueUrl,
  onUpdateIssue,
}: WorkItemsSpreadsheetLayoutProps) {
  const { t } = useTranslation();
  const [columnOrder, setColumnOrder] = useState<ColumnKey[]>(DEFAULT_COLUMN_ORDER);
  const [columnWidths, setColumnWidths] = useState<Partial<Record<ColumnKey, number>>>({});
  const [dragColumn, setDragColumn] = useState<ColumnKey | null>(null);

  const stateById = useMemo(() => new Map(states.map((state) => [state.id, state])), [states]);

  const enabledColumns = DEFAULT_COLUMN_ORDER.filter(
    (key) => key === 'title' || hasCol(key as SavedViewDisplayPropertyId),
  );
  const columns = [
    ...columnOrder.filter((key) => enabledColumns.includes(key)),
    ...enabledColumns.filter((key) => !columnOrder.includes(key)),
  ];

  const columnLabels: Record<ColumnKey, string> = {
    id: t('display.property.id', 'ID'),
    title: t('views.workItems', 'Work items'),
    state: t('views.state', 'State'),
    priority: t('views.priority', 'Priority'),
    assignee: t('common.assignees', 'Assignees'),
    labels: t('common.labels', 'Labels'),
    due_date: t('issues.targetDate', 'Due'),
    start_date: t('filters.startDate', 'Start date'),
    cycle: t('display.groupCycle', 'Cycle'),
    module: t('display.groupModule', 'Module'),
    sub_work_count: t('display.property.sub_work_count', 'Sub-work item count'),
    estimate: t('display.property.estimate', 'Estimate'),
    attachment_count: t('display.property.attachment_count', 'Attachment count'),
    link: t('display.property.link', 'Link'),
  };

  const widthOf = (column: ColumnKey) => columnWidths[column] ?? COLUMN_META[column]?.width ?? 160;

  const moveColumn = (source: ColumnKey, target: ColumnKey) => {
    if (source === target) return;
    setColumnOrder((previous) => {
      const base = previous.length ? previous : DEFAULT_COLUMN_ORDER;
      const next = base.filter((key) => key !== source);
      const targetIndex = next.indexOf(target);
      if (targetIndex === -1) return previous;
      next.splice(targetIndex, 0, source);
      return next;
    });
  };

  /* Pointer-driven resize from the header's right edge; listeners live on the
     window so the drag survives leaving the 6px grip. */
  const startResize = (column: ColumnKey) => (event: ReactPointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = widthOf(column);
    const minWidth = COLUMN_META[column]?.minWidth ?? 90;
    const onPointerMove = (moveEvent: PointerEvent) => {
      setColumnWidths((previous) => ({
        ...previous,
        [column]: Math.max(minWidth, startWidth + moveEvent.clientX - startX),
      }));
    };
    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const cell = (issue: IssueApiResponse, column: ColumnKey) => {
    switch (column) {
      case 'id':
        return (
          <span className="text-muted-foreground font-mono text-xs">
            {workItemDisplayId(issue, project)}
          </span>
        );
      case 'title':
        return (
          <span className="flex min-w-0 items-center gap-2">
            <Link to={issueUrl(issue.id)} className="truncate text-sm font-medium hover:underline">
              {issue.name}
            </Link>
            <IssuePRBadge summary={prSummary[issue.id]} />
          </span>
        );
      case 'state':
        return (
          <InlineStateCell
            issue={issue}
            states={states}
            onUpdate={(patch) => onUpdateIssue(issue.id, patch)}
          />
        );
      case 'priority':
        return (
          <InlinePriorityCell issue={issue} onUpdate={(patch) => onUpdateIssue(issue.id, patch)} />
        );
      case 'assignee':
        return (
          <InlineAssigneeCell
            issue={issue}
            members={members}
            onUpdate={(patch) => onUpdateIssue(issue.id, patch)}
          />
        );
      case 'labels':
        return (
          <InlineLabelsCell
            issue={issue}
            labels={labels}
            onUpdate={(patch) => onUpdateIssue(issue.id, patch)}
          />
        );
      case 'due_date':
        return (
          <InlineDateCell
            issue={issue}
            field="target_date"
            onUpdate={(patch) => onUpdateIssue(issue.id, patch)}
          />
        );
      case 'start_date':
        return (
          <InlineDateCell
            issue={issue}
            field="start_date"
            onUpdate={(patch) => onUpdateIssue(issue.id, patch)}
          />
        );
      case 'cycle':
        return <span className="truncate text-sm">{cycleName(issue)}</span>;
      case 'module':
        return <span className="truncate text-sm">{moduleName(issue)}</span>;
      case 'sub_work_count':
        return (
          <span className="text-sm tabular-nums">{subWorkCountByParentId.get(issue.id) ?? 0}</span>
        );
      default:
        return null;
    }
  };

  const totalWidth = columns.reduce((sum, column) => sum + widthOf(column), 0);

  const sectionHeader = (key: string, title: string, count: number, depth = 0) => (
    <tr className="bg-muted/30" key={`section-${depth}-${key}`}>
      <th
        scope="rowgroup"
        colSpan={columns.length}
        className="px-3 py-2 text-left"
        style={{ paddingLeft: 12 + depth * 16 }}
      >
        <span className="flex items-center gap-2 text-xs font-medium">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full"
            style={stateDotStyle(stateById.get(key))}
          />
          {title}
          <Badge variant="secondary" className="tabular-nums">
            {count}
          </Badge>
        </span>
      </th>
    </tr>
  );

  const issueRow = (issue: IssueApiResponse) => (
    <tr key={issue.id} className="hover:bg-muted/50 border-b transition-colors">
      {columns.map((column) => (
        <td key={column} className="truncate px-3 py-1.5" style={{ width: widthOf(column) }}>
          {cell(issue, column)}
        </td>
      ))}
    </tr>
  );

  return (
    <ScrollArea className="w-full rounded-xl border">
      <table
        className="w-full caption-bottom border-collapse text-sm"
        style={{ width: totalWidth }}
      >
        <thead className="bg-muted/50">
          <tr className="border-b">
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                draggable
                onDragStart={() => setDragColumn(column)}
                onDragEnd={() => setDragColumn(null)}
                onDragOver={(event) => {
                  if (dragColumn && dragColumn !== column) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragColumn) moveColumn(dragColumn, column);
                  setDragColumn(null);
                }}
                className={cn(
                  'text-muted-foreground relative h-10 cursor-grab px-3 text-left align-middle font-medium select-none',
                  dragColumn === column && 'opacity-50',
                )}
                style={{ width: widthOf(column) }}
                title={t('spreadsheet.columnHint', 'Drag to reorder, drag the edge to resize')}
              >
                <span className="truncate">{columnLabels[column]}</span>
                <span
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={t('spreadsheet.resizeColumn', 'Resize column')}
                  onPointerDown={startResize(column)}
                  className="hover:bg-border absolute top-0 right-0 h-full w-1.5 cursor-col-resize"
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {subGroupedIssues
            ? subGroupedIssues.primaryOrder.map((primaryKey) => {
                const cells = subGroupedIssues.cells.get(primaryKey);
                const primaryCount = subGroupedIssues.subOrder.reduce(
                  (sum, subKey) => sum + (cells?.get(subKey)?.length ?? 0),
                  0,
                );
                return (
                  <Fragment key={primaryKey}>
                    {sectionHeader(
                      primaryKey,
                      subGroupedIssues.primaryTitle(primaryKey),
                      primaryCount,
                    )}
                    {subGroupedIssues.subOrder.map((subKey) => {
                      const items = cells?.get(subKey) ?? [];
                      if (items.length === 0 && !showEmptyGroups) return null;
                      return (
                        <Fragment key={`${primaryKey}:${subKey}`}>
                          {sectionHeader(
                            subKey,
                            subGroupedIssues.subTitle(subKey),
                            items.length,
                            1,
                          )}
                          {items.map(issueRow)}
                        </Fragment>
                      );
                    })}
                  </Fragment>
                );
              })
            : groupedIssues.order.map((groupKey) => {
                const items = groupedIssues.groups.get(groupKey) ?? [];
                return (
                  <Fragment key={groupKey}>
                    {!groupedIssues.isFlat &&
                      sectionHeader(groupKey, groupedIssues.title(groupKey), items.length)}
                    {items.map(issueRow)}
                  </Fragment>
                );
              })}
        </tbody>
      </table>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
