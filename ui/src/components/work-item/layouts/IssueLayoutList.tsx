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
}: IssueLayoutListProps) {
  const stateById = useMemo(() => new Map(states.map((s) => [s.id, s])), [states]);
  const labelById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);

  const renderRow = (issue: IssueApiResponse) => {
    const displayId = `${project.identifier ?? project.id.slice(0, 8)}-${issue.sequence_id ?? issue.id.slice(-4)}`;
    const subN = subWorkCountByParentId.get(issue.id) ?? 0;
    const issueState = issue.state_id ? (stateById.get(issue.state_id) ?? null) : null;
    const issueLabels = (issue.label_ids ?? [])
      .map((id) => labelById.get(id))
      .filter((l): l is LabelApiResponse => Boolean(l));
    const issueAssignees = membersFromAssigneeIds(members, issue.assignee_ids ?? []);
    const prInfo = prSummary[issue.id];
    const startStr = formatShort(issue.start_date);

    return (
      <li key={issue.id}>
        <Link
          to={issueHref(issue.id)}
          className="flex min-h-12 items-center gap-3 px-4 py-2.5 no-underline transition-colors hover:bg-(--bg-layer-1-hover)"
        >
          <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm">
            {hasCol('priority') ? (
              <span className="shrink-0">
                <PriorityIcon priority={issue.priority as Priority | null | undefined} />
              </span>
            ) : null}
            {hasCol('id') ? (
              <span className="shrink-0 font-medium text-(--txt-accent-primary)">{displayId}</span>
            ) : null}
            <span className="ml-1 truncate text-(--txt-primary)">{issue.name}</span>
            <IssuePRBadge summary={prInfo} />
          </span>
          <div className="flex shrink-0 flex-wrap items-center gap-2 text-(--txt-icon-tertiary)">
            {hasCol('state') ? <StatePill state={issueState} /> : null}
            {hasCol('start_date') ? (
              <span
                className="max-w-[5rem] truncate text-[11px] text-(--txt-secondary)"
                title={issue.start_date ?? ''}
              >
                {startStr ?? '—'}
              </span>
            ) : null}
            {hasCol('due_date') ? <DueDateCell issue={issue} state={issueState} now={now} /> : null}
            {hasCol('assignee') ? <WorkItemAvatarGroup members={issueAssignees} /> : null}
            {hasCol('labels') ? <LabelChips labels={issueLabels} /> : null}
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
        </Link>
      </li>
    );
  };

  if (groupedIssues.isFlat) {
    return (
      <ul className="w-full divide-y divide-(--border-subtle)">
        {(groupedIssues.groups.get(groupedIssues.order[0]) ?? []).map((issue) => renderRow(issue))}
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
