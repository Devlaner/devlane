import { useEffect, useMemo, useRef, useState } from 'react';
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
import { membersFromAssigneeIds } from '../../../lib/issueRowHelpers';
import { cn } from '../../../lib/utils';
import type { IssueApiResponse, LabelApiResponse } from '../../../api/types';
import type { Priority } from '../../../types';
import type { GroupedIssuesResult } from '../../../lib/issueListGroupAndSort';
import type { IssueLayoutProps } from './IssueLayoutTypes';

interface IssueLayoutListProps extends IssueLayoutProps {
  /** Pre-built grouping result from the parent (state/priority/cycle/etc. groupings). */
  groupedIssues: GroupedIssuesResult;
  /**
   * Filter columns (display properties) — true means render. Accepts the same
   * narrow `SavedViewDisplayPropertyId` keys the parent's `hasCol` checks; we
   * cast at the call site since this component only checks a known subset.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- column key narrowing lives in the parent
  hasCol: (key: any) => boolean;
  /** Whether to render empty groups (display option). */
  showEmptyGroups: boolean;
  /** Sub-issue counts keyed by parent issue id. */
  subWorkCountByParentId: Map<string, number>;
  /** Resolves the issue's first cycle to a display name; '—' when none. */
  cycleName: (issue: IssueApiResponse) => string;
  /** Resolves the issue's first module to a display name; '—' when none. */
  moduleName: (issue: IssueApiResponse) => string;
  /** Optional multi-select support for bulk actions. */
  selection?: {
    selectedIds: Set<string>;
    onToggle: (id: string) => void;
  };
  /**
   * Optional manual reorder (drag-and-drop). Only active for the flat
   * (ungrouped) list; the parent persists the new order. `after` indicates the
   * dragged item should land below the drop target rather than above.
   */
  onReorder?: (activeId: string, overId: string, after: boolean) => void;
}

export function IssueLayoutList({
  project,
  states,
  labels,
  members,
  prSummary,
  issueHref,
  now,
  groupedIssues,
  hasCol,
  showEmptyGroups,
  subWorkCountByParentId,
  cycleName,
  moduleName,
  selection,
  onReorder,
  onUpdateIssue,
}: IssueLayoutListProps) {
  const stateById = useMemo(() => new Map(states.map((s) => [s.id, s])), [states]);
  const labelById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);
  const [openCell, setOpenCell] = useState<string | null>(null);

  // Drag-to-reorder is only offered on the flat list (the parent decides whether
  // manual ordering is active by passing onReorder).
  const reorderable = Boolean(onReorder && groupedIssues.isFlat);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; after: boolean } | null>(null);
  const clearDrag = () => {
    setDraggingId(null);
    setDropTarget(null);
  };

  // Keyboard reorder: keep focus on the moved row's handle across the re-render
  // so repeated Arrow presses keep working.
  const handleRefs = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocusId = useRef<string | null>(null);
  useEffect(() => {
    const id = pendingFocusId.current;
    if (!id) return;
    pendingFocusId.current = null;
    handleRefs.current.get(id)?.focus();
  });
  const keyboardMove =
    (issue: IssueApiResponse, idx: number, list: IssueApiResponse[]) =>
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowUp' && idx > 0) {
        e.preventDefault();
        pendingFocusId.current = issue.id;
        onReorder!(issue.id, list[idx - 1]!.id, false);
      } else if (e.key === 'ArrowDown' && idx < list.length - 1) {
        e.preventDefault();
        pendingFocusId.current = issue.id;
        onReorder!(issue.id, list[idx + 1]!.id, true);
      }
    };

  const renderRow = (issue: IssueApiResponse, idx?: number, list?: IssueApiResponse[]) => {
    const displayId = `${project.identifier ?? project.id.slice(0, 8)}-${issue.sequence_id ?? issue.id.slice(-4)}`;
    const subN = subWorkCountByParentId.get(issue.id) ?? 0;
    const issueState = issue.state_id ? (stateById.get(issue.state_id) ?? null) : null;
    const issueLabels = (issue.label_ids ?? [])
      .map((id) => labelById.get(id))
      .filter((l): l is LabelApiResponse => Boolean(l));
    const issueAssignees = membersFromAssigneeIds(members, issue.assignee_ids ?? []);
    const prInfo = prSummary[issue.id];
    const startStr = formatShort(issue.start_date);

    const isDropTarget = reorderable && dropTarget?.id === issue.id && draggingId !== issue.id;

    return (
      <li
        key={issue.id}
        className={cn(
          'group/row flex items-center transition-colors hover:bg-(--bg-layer-1-hover)',
          draggingId === issue.id && 'opacity-50',
          isDropTarget &&
            (dropTarget!.after
              ? 'shadow-[inset_0_-2px_0_0_var(--border-focus)]'
              : 'shadow-[inset_0_2px_0_0_var(--border-focus)]'),
        )}
        onDragOver={
          reorderable
            ? (e) => {
                if (!draggingId) return;
                e.preventDefault();
                const r = e.currentTarget.getBoundingClientRect();
                setDropTarget({ id: issue.id, after: e.clientY > r.top + r.height / 2 });
              }
            : undefined
        }
        onDrop={
          reorderable
            ? (e) => {
                e.preventDefault();
                const after = dropTarget?.after ?? false;
                if (draggingId && draggingId !== issue.id) onReorder!(draggingId, issue.id, after);
                clearDrag();
              }
            : undefined
        }
      >
        {reorderable ? (
          <button
            type="button"
            draggable
            ref={(el) => {
              if (el) handleRefs.current.set(issue.id, el);
              else handleRefs.current.delete(issue.id);
            }}
            onDragStart={(e) => {
              setDraggingId(issue.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={clearDrag}
            onKeyDown={
              list !== undefined && idx !== undefined ? keyboardMove(issue, idx, list) : undefined
            }
            className="flex shrink-0 cursor-grab items-center rounded-sm pl-2 text-(--txt-icon-tertiary) opacity-0 transition-opacity hover:text-(--txt-icon-secondary) focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--border-focus) active:cursor-grabbing group-hover/row:opacity-100"
            aria-label={`Reorder ${displayId}. Use Arrow Up or Arrow Down to move.`}
            title="Drag, or focus and use arrow keys, to reorder"
          >
            <GripVertical className="size-4" />
          </button>
        ) : null}
        {selection ? (
          <span className="shrink-0 pl-4">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 cursor-pointer align-middle"
              checked={selection.selectedIds.has(issue.id)}
              onChange={() => selection.onToggle(issue.id)}
              aria-label={`Select ${displayId}`}
            />
          </span>
        ) : null}
        {hasCol('priority') ? (
          <span className="shrink-0 pl-4">
            {onUpdateIssue ? (
              <EditablePriorityCell
                issueId={issue.id}
                priority={issue.priority}
                openId={openCell}
                onOpen={setOpenCell}
                onChange={(priority) => onUpdateIssue(issue.id, { priority })}
              />
            ) : (
              <PriorityIcon priority={issue.priority as Priority | null | undefined} />
            )}
          </span>
        ) : null}
        <Link
          draggable={false}
          to={issueHref(issue.id)}
          className="flex min-h-12 min-w-0 flex-1 items-center gap-1.5 truncate px-3 py-2.5 text-sm no-underline"
        >
          {hasCol('id') ? (
            <span className="shrink-0 font-medium text-(--txt-accent-primary)">{displayId}</span>
          ) : null}
          <span className="ml-1 truncate text-(--txt-primary)">{issue.name}</span>
          <IssuePRBadge summary={prInfo} />
        </Link>
        <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 text-(--txt-icon-tertiary)">
          {hasCol('state') ? (
            onUpdateIssue ? (
              <EditableStateCell
                issueId={issue.id}
                state={issueState}
                states={states}
                openId={openCell}
                onOpen={setOpenCell}
                align="right"
                onChange={(state_id) => onUpdateIssue(issue.id, { state_id })}
              />
            ) : (
              <StatePill state={issueState} />
            )
          ) : null}
          {hasCol('start_date') ? (
            onUpdateIssue ? (
              <DatePickerTrigger
                label="Start date"
                icon={<Calendar />}
                value={issue.start_date ?? ''}
                placeholder="Start"
                onChange={(v) => onUpdateIssue(issue.id, { start_date: v || null })}
              />
            ) : (
              <span
                className="max-w-[5rem] truncate text-[11px] text-(--txt-secondary)"
                title={issue.start_date ?? ''}
              >
                {startStr ?? '—'}
              </span>
            )
          ) : null}
          {hasCol('due_date') ? (
            onUpdateIssue ? (
              <DatePickerTrigger
                label="Due date"
                icon={<Calendar />}
                value={issue.target_date ?? ''}
                placeholder="Due"
                onChange={(v) => onUpdateIssue(issue.id, { target_date: v || null })}
              />
            ) : (
              <DueDateCell issue={issue} state={issueState} now={now} />
            )
          ) : null}
          {hasCol('assignee') ? (
            onUpdateIssue ? (
              <EditableAssigneeCell
                issueId={issue.id}
                assigneeIds={issue.assignee_ids ?? []}
                members={members}
                openId={openCell}
                onOpen={setOpenCell}
                align="right"
                onChange={(assignee_ids) => onUpdateIssue(issue.id, { assignee_ids })}
              />
            ) : (
              <WorkItemAvatarGroup members={issueAssignees} />
            )
          ) : null}
          {hasCol('labels') ? (
            onUpdateIssue ? (
              <EditableLabelCell
                issueId={issue.id}
                labelIds={issue.label_ids ?? []}
                labels={labels}
                openId={openCell}
                onOpen={setOpenCell}
                align="right"
                onChange={(label_ids) => onUpdateIssue(issue.id, { label_ids })}
              />
            ) : (
              <LabelChips labels={issueLabels} />
            )
          ) : null}
          {hasCol('sub_work_count') && subN > 0 ? (
            <span
              className="inline-flex h-5 items-center gap-1 rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-1.5 text-[11px] text-(--txt-secondary)"
              title="Sub-work items"
            >
              {subN}
            </span>
          ) : null}
          {hasCol('cycle') && cycleName(issue) !== '—' ? (
            <span
              className="max-w-[6rem] truncate text-[11px] text-(--txt-secondary)"
              title={`Cycle: ${cycleName(issue)}`}
            >
              {cycleName(issue)}
            </span>
          ) : null}
          {hasCol('module') && moduleName(issue) !== '—' ? (
            <span
              className="max-w-[6rem] truncate text-[11px] text-(--txt-secondary)"
              title={`Module: ${moduleName(issue)}`}
            >
              {moduleName(issue)}
            </span>
          ) : null}
        </div>
      </li>
    );
  };

  if (groupedIssues.isFlat) {
    const flatList = groupedIssues.groups.get(groupedIssues.order[0]) ?? [];
    return (
      <ul className="w-full divide-y divide-(--border-subtle)">
        {flatList.map((issue, idx) => renderRow(issue, idx, flatList))}
      </ul>
    );
  }

  return (
    <div className="space-y-6 px-4 py-4">
      {groupedIssues.order.map((sectionKey) => {
        const sectionIssues = groupedIssues.groups.get(sectionKey) ?? [];
        if (sectionIssues.length === 0 && !showEmptyGroups) return null;
        const title = groupedIssues.title(sectionKey);
        return (
          <section key={sectionKey} className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-(--txt-primary)">
              {title}
              <span className="font-normal text-(--txt-tertiary)">{sectionIssues.length}</span>
            </h3>
            <ul className="w-full divide-y divide-(--border-subtle) rounded-md border border-(--border-subtle) bg-(--bg-surface-1)">
              {sectionIssues.map((issue) => renderRow(issue))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function formatShort(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleDateString();
}
