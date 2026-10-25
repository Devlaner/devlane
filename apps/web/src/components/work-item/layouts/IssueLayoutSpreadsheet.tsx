import { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Calendar, GripVertical } from 'lucide-react';
import { IssuePRBadge } from '../IssuePRBadge';
import {
  DueDateCell,
  LabelChips,
  PriorityIcon,
  StatePill,
  WorkItemAvatarGroup,
} from '../IssueRowCells';
import {
  EditableStateCell,
  EditablePriorityCell,
  EditableAssigneeCell,
  EditableLabelCell,
} from '../EditableCells';
import { DatePickerTrigger } from '../DatePickerTrigger';
import { isOverdue, membersFromAssigneeIds } from '../../../lib/issueRowHelpers';
import type { GroupedIssuesResult } from '../../../lib/issueListGroupAndSort';
import type { SavedViewDisplayPropertyId } from '../../../lib/projectSavedViewDisplay';
import type { IssueApiResponse, LabelApiResponse } from '../../../api/types';
import type { Priority } from '../../../types';
import { issueDisplayId, type IssueLayoutProps } from './IssueLayoutTypes';

type SpreadsheetColumnKey =
  | 'id'
  | 'title'
  | 'state'
  | 'priority'
  | 'assignee'
  | 'labels'
  | 'due_date'
  | 'start_date'
  | 'cycle'
  | 'module'
  | 'sub_work_count';

interface IssueLayoutSpreadsheetProps extends IssueLayoutProps {
  groupedIssues?: GroupedIssuesResult;
  hasCol?: (key: SavedViewDisplayPropertyId) => boolean;
  showEmptyGroups?: boolean;
  subWorkCountByParentId?: Map<string, number>;
  cycleName?: (issue: IssueApiResponse) => string;
  moduleName?: (issue: IssueApiResponse) => string;
}

const COLUMN_META: Record<
  SpreadsheetColumnKey,
  { label: string; width: number; minWidth: number; headerClassName?: string }
> = {
  id: { label: 'ID', width: 104, minWidth: 80 },
  title: { label: 'Title', width: 320, minWidth: 200 },
  state: { label: 'State', width: 160, minWidth: 120 },
  priority: { label: 'Priority', width: 92, minWidth: 72, headerClassName: 'text-center' },
  assignee: { label: 'Assignees', width: 144, minWidth: 104 },
  labels: { label: 'Labels', width: 184, minWidth: 128 },
  due_date: { label: 'Due', width: 132, minWidth: 104 },
  start_date: { label: 'Start', width: 132, minWidth: 104 },
  cycle: { label: 'Cycle', width: 148, minWidth: 104 },
  module: { label: 'Module', width: 148, minWidth: 104 },
  sub_work_count: { label: 'Subs', width: 92, minWidth: 72 },
};

const DEFAULT_COLUMN_ORDER: SpreadsheetColumnKey[] = [
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

const defaultHasCol = () => true;

/**
 * Spreadsheet layout — flat HTML table with sticky header. Display-property
 * choices drive the visible columns; grouped display settings render section
 * rows, and header interactions provide lightweight local resize/reorder.
 */
export function IssueLayoutSpreadsheet({
  project,
  states,
  labels,
  members,
  issues,
  prSummary,
  issueHref,
  now,
  projectsById,
  groupedIssues,
  hasCol: hasColProp,
  showEmptyGroups = false,
  subWorkCountByParentId,
  cycleName,
  moduleName,
  onUpdateIssue,
}: IssueLayoutSpreadsheetProps) {
  const { t } = useTranslation();
  const stateById = useMemo(() => new Map(states.map((s) => [s.id, s])), [states]);
  const labelById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);
  const hasCol = hasColProp ?? defaultHasCol;
  const columnLabels: Record<SpreadsheetColumnKey, string> = {
    id: t('common.columnId', 'ID'),
    title: t('common.title', 'Title'),
    state: t('common.state', 'State'),
    priority: t('common.priority', 'Priority'),
    assignee: t('common.assignees', 'Assignees'),
    labels: t('common.labels', 'Labels'),
    due_date: t('common.due', 'Due'),
    start_date: t('common.start', 'Start'),
    cycle: t('common.cycle', 'Cycle'),
    module: t('common.module', 'Module'),
    sub_work_count: t('workItem.spreadsheet.subs', 'Subs'),
  };
  const [openCell, setOpenCell] = useState<string | null>(null);
  const [columnOrder, setColumnOrder] = useState<SpreadsheetColumnKey[]>(DEFAULT_COLUMN_ORDER);
  const [dragColumn, setDragColumn] = useState<SpreadsheetColumnKey | null>(null);
  const [columnWidths, setColumnWidths] = useState<Partial<Record<SpreadsheetColumnKey, number>>>(
    {},
  );

  const enabledColumns = useMemo(
    () => DEFAULT_COLUMN_ORDER.filter((key) => key === 'title' || hasCol(key)),
    [hasCol],
  );
  const columns = [
    ...columnOrder.filter((key) => enabledColumns.includes(key)),
    ...enabledColumns.filter((key) => !columnOrder.includes(key)),
  ];

  const sections = groupedIssues
    ? groupedIssues.order
        .map((key) => ({
          key,
          title: groupedIssues.title(key),
          issues: groupedIssues.groups.get(key) ?? [],
        }))
        .filter((section) => groupedIssues.isFlat || showEmptyGroups || section.issues.length > 0)
    : [{ key: '__all__', title: '', issues }];
  const showGroupHeaders = Boolean(groupedIssues && !groupedIssues.isFlat);

  const moveColumn = (source: SpreadsheetColumnKey, target: SpreadsheetColumnKey) => {
    if (source === target) return;
    setColumnOrder((prev) => {
      const next = prev.filter((key) => key !== source);
      const targetIndex = next.indexOf(target);
      if (targetIndex === -1) return prev;
      next.splice(targetIndex, 0, source);
      return next;
    });
  };

  const startResize =
    (column: SpreadsheetColumnKey) => (event: React.PointerEvent<HTMLSpanElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const startWidth = columnWidths[column] ?? COLUMN_META[column].width;
      const onPointerMove = (moveEvent: PointerEvent) => {
        const nextWidth = Math.max(
          COLUMN_META[column].minWidth,
          startWidth + moveEvent.clientX - startX,
        );
        setColumnWidths((prev) => ({ ...prev, [column]: nextWidth }));
      };
      const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      };
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    };

  const renderCell = (column: SpreadsheetColumnKey, issue: IssueApiResponse) => {
    const displayId = issueDisplayId(issue, project, projectsById);
    const issueState = issue.state_id ? (stateById.get(issue.state_id) ?? null) : null;
    const issueLabels = (issue.label_ids ?? [])
      .map((id) => labelById.get(id))
      .filter((l): l is LabelApiResponse => Boolean(l));
    const issueAssignees = membersFromAssigneeIds(members, issue.assignee_ids ?? []);
    const subWorkCount = subWorkCountByParentId?.get(issue.id) ?? 0;
    const cycle = cycleName?.(issue) ?? '—';
    const module = moduleName?.(issue) ?? '—';

    switch (column) {
      case 'id':
        return (
          <Link to={issueHref(issue.id)} className="no-underline hover:underline">
            {displayId}
          </Link>
        );
      case 'title':
        return (
          <Link
            to={issueHref(issue.id)}
            className="flex min-w-0 items-center gap-1.5 truncate text-(--txt-primary) no-underline hover:text-(--txt-accent-primary)"
          >
            <span className="truncate">{issue.name}</span>
            <IssuePRBadge summary={prSummary[issue.id]} />
          </Link>
        );
      case 'state':
        return onUpdateIssue ? (
          <EditableStateCell
            issueId={issue.id}
            state={issueState}
            states={states}
            openId={openCell}
            onOpen={setOpenCell}
            onChange={(state_id) => onUpdateIssue(issue.id, { state_id })}
          />
        ) : (
          <StatePill state={issueState} />
        );
      case 'priority':
        return onUpdateIssue ? (
          <EditablePriorityCell
            issueId={issue.id}
            priority={issue.priority}
            openId={openCell}
            onOpen={setOpenCell}
            onChange={(priority) => onUpdateIssue(issue.id, { priority })}
          />
        ) : (
          <PriorityIcon priority={issue.priority as Priority | null | undefined} />
        );
      case 'assignee':
        return onUpdateIssue ? (
          <EditableAssigneeCell
            issueId={issue.id}
            assigneeIds={issue.assignee_ids ?? []}
            members={members}
            openId={openCell}
            onOpen={setOpenCell}
            onChange={(assignee_ids) => onUpdateIssue(issue.id, { assignee_ids })}
          />
        ) : (
          <WorkItemAvatarGroup members={issueAssignees} />
        );
      case 'labels':
        return onUpdateIssue ? (
          <EditableLabelCell
            issueId={issue.id}
            labelIds={issue.label_ids ?? []}
            labels={labels}
            openId={openCell}
            onOpen={setOpenCell}
            onChange={(label_ids) => onUpdateIssue(issue.id, { label_ids })}
          />
        ) : (
          <LabelChips labels={issueLabels} max={3} />
        );
      case 'due_date':
        return onUpdateIssue ? (
          <DatePickerTrigger
            label={t('common.dueDate', 'Due date')}
            icon={<Calendar />}
            value={issue.target_date ?? ''}
            placeholder="—"
            className={
              isOverdue(issue.target_date, issueState?.group, now)
                ? 'border-(--border-danger-strong) text-(--txt-danger-primary)'
                : undefined
            }
            onChange={(v) => onUpdateIssue(issue.id, { target_date: v || null })}
          />
        ) : (
          <DueDateCell issue={issue} state={issueState} now={now} />
        );
      case 'start_date':
        return onUpdateIssue ? (
          <DatePickerTrigger
            label={t('common.startDate', 'Start date')}
            icon={<Calendar />}
            value={issue.start_date ?? ''}
            placeholder="—"
            onChange={(v) => onUpdateIssue(issue.id, { start_date: v || null })}
          />
        ) : (
          (formatShort(issue.start_date) ?? '—')
        );
      case 'cycle':
        return cycle;
      case 'module':
        return module;
      case 'sub_work_count':
        return subWorkCount > 0 ? subWorkCount : '—';
    }
  };

  const renderRow = (issue: IssueApiResponse) => (
    <tr
      key={issue.id}
      className="border-t border-(--border-subtle) transition-colors hover:bg-(--bg-layer-1-hover)"
    >
      {columns.map((column) => (
        <Td
          key={column}
          className={
            column === 'id'
              ? 'font-medium text-(--txt-accent-primary)'
              : column === 'priority' || column === 'sub_work_count'
                ? 'text-center'
                : column === 'start_date' || column === 'cycle' || column === 'module'
                  ? 'text-[11px] text-(--txt-secondary)'
                  : undefined
          }
        >
          {renderCell(column, issue)}
        </Td>
      ))}
    </tr>
  );

  return (
    <div className="overflow-auto">
      <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
        <colgroup>
          {columns.map((column) => (
            <col
              key={column}
              style={{ width: `${columnWidths[column] ?? COLUMN_META[column].width}px` }}
            />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-10 bg-(--bg-surface-1)">
          <tr className="text-[11px] font-medium uppercase tracking-wide text-(--txt-tertiary)">
            {columns.map((column) => (
              <Th
                key={column}
                className={COLUMN_META[column].headerClassName}
                dragging={dragColumn === column}
                onDragStart={() => setDragColumn(column)}
                onDragOver={(event) => {
                  if (!dragColumn || dragColumn === column) return;
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragColumn) moveColumn(dragColumn, column);
                  setDragColumn(null);
                }}
                onDragEnd={() => setDragColumn(null)}
                onResizeStart={startResize(column)}
              >
                {columnLabels[column]}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => (
            <Fragment key={section.key}>
              {showGroupHeaders ? (
                <tr key={`${section.key}:heading`}>
                  <td
                    colSpan={columns.length}
                    className="border-y border-(--border-subtle) bg-(--bg-layer-1) px-3 py-2 text-xs font-semibold text-(--txt-primary)"
                  >
                    {section.title}
                    <span className="ml-2 font-normal text-(--txt-tertiary)">
                      {section.issues.length}
                    </span>
                  </td>
                </tr>
              ) : null}
              {section.issues.length > 0 ? (
                section.issues.map(renderRow)
              ) : showGroupHeaders ? (
                <tr key={`${section.key}:empty`}>
                  <td
                    colSpan={columns.length}
                    className="px-3 py-5 text-center text-xs text-(--txt-tertiary)"
                  >
                    {t('common.noWorkItems', 'No work items')}
                  </td>
                </tr>
              ) : null}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  className,
  dragging,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onResizeStart,
}: {
  children: React.ReactNode;
  className?: string;
  dragging: boolean;
  onDragStart: () => void;
  onDragOver: (event: React.DragEvent<HTMLTableCellElement>) => void;
  onDrop: (event: React.DragEvent<HTMLTableCellElement>) => void;
  onDragEnd: () => void;
  onResizeStart: (event: React.PointerEvent<HTMLSpanElement>) => void;
}) {
  return (
    <th
      className={`relative border-b border-(--border-subtle) px-3 py-2 text-left ${
        dragging ? 'bg-(--bg-layer-1-hover)' : ''
      } ${className ?? ''}`}
      scope="col"
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <GripVertical className="h-3.5 w-3.5 shrink-0 text-(--txt-icon-tertiary)" />
        <span className="truncate">{children}</span>
      </span>
      <span
        role="separator"
        aria-orientation="vertical"
        className="absolute right-0 top-1/2 h-5 w-2 -translate-y-1/2 cursor-col-resize"
        onPointerDown={onResizeStart}
      />
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-middle ${className ?? ''}`}>{children}</td>;
}

function formatShort(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleDateString();
}
