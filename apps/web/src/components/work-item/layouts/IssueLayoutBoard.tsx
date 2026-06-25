import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { IssuePRBadge } from '../IssuePRBadge';
import {
  DueDateCell,
  LabelChips,
  PriorityIcon,
  StatePill,
  WorkItemAvatarGroup,
} from '../IssueRowCells';
import { membersFromAssigneeIds } from '../../../lib/issueRowHelpers';
import type { IssueApiResponse, LabelApiResponse } from '../../../api/types';
import type { Priority } from '../../../types';
import {
  issueDisplayId,
  STATE_GROUP_LABELS,
  STATE_GROUP_ORDER,
  type IssueLayoutProps,
} from './IssueLayoutTypes';

/**
 * Kanban board grouped by state. One column per state, ordered by `sequence`,
 * cards reuse the same cells the list rows use.
 *
 * Issues with no state_id (or whose state was deleted) bucket into a synthetic
 * "No state" column at the end.
 */
export function IssueLayoutBoard({
  project,
  states,
  labels,
  members,
  issues,
  prSummary,
  issueHref,
  now,
  projectsById,
  groupByStateGroup,
  onCardMove,
}: IssueLayoutProps) {
  const labelById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);
  const stateById = useMemo(() => new Map(states.map((s) => [s.id, s])), [states]);
  const issueById = useMemo(() => new Map(issues.map((i) => [i.id, i])), [issues]);

  const dndEnabled = Boolean(onCardMove);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);

  // Map a column to the concrete state an issue should land in. For per-state
  // columns the key is already a state id; for grouped columns we pick a state
  // in the issue's own project that belongs to that group (default first).
  const resolveTargetStateId = (columnKey: string, issue: IssueApiResponse): string | null => {
    if (!groupByStateGroup) return columnKey;
    const candidates = states.filter(
      (s) => s.group === columnKey && s.project_id === issue.project_id,
    );
    if (candidates.length === 0) return null;
    const ordered = [...candidates].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
    return (candidates.find((s) => s.default) ?? ordered[0]).id;
  };

  const handleDrop = (columnKey: string) => {
    const issue = draggingId ? issueById.get(draggingId) : null;
    setDraggingId(null);
    setDropKey(null);
    if (!issue || !onCardMove) return;
    const target = resolveTargetStateId(columnKey, issue);
    if (!target || target === issue.state_id) return;
    onCardMove(issue.id, target);
  };

  // Build the columns + the leftover "No state" bucket. In group mode columns
  // are the canonical state groups present in the workspace (so a multi-project
  // board doesn't repeat "Todo/In Progress/Done" once per project); otherwise
  // one column per individual state.
  const { columns, orphans } = useMemo(() => {
    const orphans: IssueApiResponse[] = [];

    if (groupByStateGroup) {
      const buckets = new Map<string, IssueApiResponse[]>();
      for (const issue of issues) {
        const group = issue.state_id ? stateById.get(issue.state_id)?.group : undefined;
        if (group && STATE_GROUP_ORDER.includes(group as (typeof STATE_GROUP_ORDER)[number])) {
          const arr = buckets.get(group) ?? [];
          arr.push(issue);
          buckets.set(group, arr);
        } else {
          orphans.push(issue);
        }
      }
      const presentGroups = new Set(states.map((s) => s.group).filter(Boolean) as string[]);
      const columns = STATE_GROUP_ORDER.filter(
        (g) => presentGroups.has(g) || (buckets.get(g)?.length ?? 0) > 0,
      ).map((g) => ({
        key: g,
        title: STATE_GROUP_LABELS[g] ?? g,
        color: undefined as string | undefined,
        items: buckets.get(g) ?? [],
      }));
      return { columns, orphans };
    }

    const orderedStates = [...states].sort(
      (a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || a.name.localeCompare(b.name),
    );
    const buckets = new Map<string, IssueApiResponse[]>();
    for (const s of orderedStates) buckets.set(s.id, []);
    for (const issue of issues) {
      if (issue.state_id && buckets.has(issue.state_id)) {
        buckets.get(issue.state_id)!.push(issue);
      } else {
        orphans.push(issue);
      }
    }
    const columns = orderedStates.map((s) => ({
      key: s.id,
      title: s.name,
      color: s.color ?? undefined,
      items: buckets.get(s.id) ?? [],
    }));
    return { columns, orphans };
  }, [groupByStateGroup, states, issues, stateById]);

  const renderCard = (issue: IssueApiResponse) => (
    <BoardCard
      key={issue.id}
      issue={issue}
      project={project}
      projectsById={projectsById}
      state={issue.state_id ? (stateById.get(issue.state_id) ?? null) : null}
      labels={(issue.label_ids ?? [])
        .map((id) => labelById.get(id))
        .filter((l): l is LabelApiResponse => Boolean(l))}
      assignees={membersFromAssigneeIds(members, issue.assignee_ids ?? [])}
      prSummary={prSummary[issue.id]}
      href={issueHref(issue.id)}
      now={now}
      draggable={dndEnabled}
      isDragging={draggingId === issue.id}
      onDragStart={() => setDraggingId(issue.id)}
      onDragEnd={() => {
        setDraggingId(null);
        setDropKey(null);
      }}
    />
  );

  // Whether a column accepts the in-flight card (skip its current column).
  const canDropOn = (columnKey: string): boolean => {
    if (!dndEnabled || !draggingId) return false;
    const issue = issueById.get(draggingId);
    if (!issue) return false;
    const target = resolveTargetStateId(columnKey, issue);
    return Boolean(target) && target !== issue.state_id;
  };

  return (
    <div className="flex gap-3 overflow-x-auto px-4 py-4">
      {columns.map((col) => (
        <BoardColumn
          key={col.key}
          title={col.title}
          color={col.color}
          count={col.items.length}
          isDropTarget={dropKey === col.key && canDropOn(col.key)}
          onDragOver={
            dndEnabled
              ? (e) => {
                  if (!canDropOn(col.key)) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dropKey !== col.key) setDropKey(col.key);
                }
              : undefined
          }
          onDragLeave={dndEnabled ? () => setDropKey((k) => (k === col.key ? null : k)) : undefined}
          onDrop={
            dndEnabled
              ? (e) => {
                  e.preventDefault();
                  handleDrop(col.key);
                }
              : undefined
          }
        >
          {col.items.map(renderCard)}
          {col.items.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-(--txt-tertiary)">No work items</p>
          )}
        </BoardColumn>
      ))}

      {orphans.length > 0 && (
        <BoardColumn title="No state" color={undefined} count={orphans.length}>
          {orphans.map(renderCard)}
        </BoardColumn>
      )}
    </div>
  );
}

function BoardColumn({
  title,
  color,
  count,
  children,
  isDropTarget,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  title: string;
  color?: string | null;
  count: number;
  children: React.ReactNode;
  isDropTarget?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}) {
  return (
    <div
      className={`flex w-72 shrink-0 flex-col rounded-(--radius-lg) border bg-(--bg-layer-1) transition-colors ${
        isDropTarget
          ? 'border-(--border-accent-strong) bg-(--bg-layer-1-hover)'
          : 'border-(--border-subtle)'
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div
        className="flex items-center gap-2 border-b border-(--border-subtle) px-3 py-2"
        style={{
          borderLeftWidth: '3px',
          borderLeftColor: color ?? 'var(--border-subtle)',
          borderTopLeftRadius: 'var(--radius-lg)',
          borderBottomLeftRadius: 0,
        }}
      >
        <h3 className="truncate text-sm font-medium text-(--txt-primary)">{title}</h3>
        <span className="ml-auto text-[11px] text-(--txt-tertiary)">{count}</span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2">{children}</div>
    </div>
  );
}

interface BoardCardProps {
  issue: IssueApiResponse;
  project: IssueLayoutProps['project'];
  projectsById?: IssueLayoutProps['projectsById'];
  state: IssueLayoutProps['states'][number] | null;
  labels: LabelApiResponse[];
  assignees: ReturnType<typeof membersFromAssigneeIds>;
  prSummary?: IssueLayoutProps['prSummary'][string];
  href: string;
  now: number;
  draggable?: boolean;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

function BoardCard({
  issue,
  project,
  projectsById,
  state,
  labels,
  assignees,
  prSummary,
  href,
  now,
  draggable,
  isDragging,
  onDragStart,
  onDragEnd,
}: BoardCardProps) {
  const displayId = issueDisplayId(issue, project, projectsById);
  return (
    <Link
      to={href}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', issue.id);
        onDragStart?.(e);
      }}
      onDragEnd={onDragEnd}
      className={`block rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) p-2.5 no-underline transition-colors hover:border-(--border-strong) hover:bg-(--bg-layer-1-hover) ${
        draggable ? 'cursor-grab active:cursor-grabbing' : ''
      } ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start gap-2">
        <PriorityIcon priority={issue.priority as Priority | null | undefined} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[11px] text-(--txt-tertiary)">
            <span className="font-medium text-(--txt-accent-primary)">{displayId}</span>
            <IssuePRBadge summary={prSummary} />
          </div>
          <p className="mt-0.5 line-clamp-2 text-sm font-medium text-(--txt-primary)">
            {issue.name}
          </p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {labels.length > 0 && <LabelChips labels={labels} max={2} />}
        <DueDateCell issue={issue} state={state} now={now} />
        {state && <StatePill state={state} />}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <WorkItemAvatarGroup members={assignees} max={3} />
      </div>
    </Link>
  );
}
