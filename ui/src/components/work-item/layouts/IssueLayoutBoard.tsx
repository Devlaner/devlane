import { useMemo } from 'react';
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
import type { IssueLayoutProps } from './IssueLayoutTypes';

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
}: IssueLayoutProps) {
  const labelById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);
  const orderedStates = useMemo(
    () =>
      [...states].sort(
        (a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || a.name.localeCompare(b.name),
      ),
    [states],
  );

  const groups = useMemo(() => {
    const buckets = new Map<string, IssueApiResponse[]>();
    for (const s of orderedStates) buckets.set(s.id, []);
    const orphans: IssueApiResponse[] = [];
    for (const issue of issues) {
      if (issue.state_id && buckets.has(issue.state_id)) {
        buckets.get(issue.state_id)!.push(issue);
      } else {
        orphans.push(issue);
      }
    }
    return { buckets, orphans };
  }, [orderedStates, issues]);

  return (
    <div className="flex gap-3 overflow-x-auto px-4 py-4">
      {orderedStates.map((state) => {
        const colIssues = groups.buckets.get(state.id) ?? [];
        return (
          <BoardColumn
            key={state.id}
            title={state.name}
            color={state.color}
            count={colIssues.length}
          >
            {colIssues.map((issue) => (
              <BoardCard
                key={issue.id}
                issue={issue}
                project={project}
                state={state}
                labels={(issue.label_ids ?? [])
                  .map((id) => labelById.get(id))
                  .filter((l): l is LabelApiResponse => Boolean(l))}
                assignees={membersFromAssigneeIds(members, issue.assignee_ids ?? [])}
                prSummary={prSummary[issue.id]}
                href={issueHref(issue.id)}
                now={now}
              />
            ))}
            {colIssues.length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-(--txt-tertiary)">No work items</p>
            )}
          </BoardColumn>
        );
      })}

      {groups.orphans.length > 0 && (
        <BoardColumn title="No state" color={undefined} count={groups.orphans.length}>
          {groups.orphans.map((issue) => (
            <BoardCard
              key={issue.id}
              issue={issue}
              project={project}
              state={null}
              labels={(issue.label_ids ?? [])
                .map((id) => labelById.get(id))
                .filter((l): l is LabelApiResponse => Boolean(l))}
              assignees={membersFromAssigneeIds(members, issue.assignee_ids ?? [])}
              prSummary={prSummary[issue.id]}
              href={issueHref(issue.id)}
              now={now}
            />
          ))}
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
}: {
  title: string;
  color?: string | null;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-72 shrink-0 flex-col rounded-(--radius-lg) border border-(--border-subtle) bg-(--bg-layer-1)">
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
  state: IssueLayoutProps['states'][number] | null;
  labels: LabelApiResponse[];
  assignees: ReturnType<typeof membersFromAssigneeIds>;
  prSummary?: IssueLayoutProps['prSummary'][string];
  href: string;
  now: number;
}

function BoardCard({
  issue,
  project,
  state,
  labels,
  assignees,
  prSummary,
  href,
  now,
}: BoardCardProps) {
  const displayId = `${project.identifier ?? project.id.slice(0, 8)}-${issue.sequence_id ?? issue.id.slice(-4)}`;
  return (
    <Link
      to={href}
      className="block rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) p-2.5 no-underline transition-colors hover:border-(--border-strong) hover:bg-(--bg-layer-1-hover)"
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
