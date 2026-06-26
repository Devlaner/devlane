import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar } from 'lucide-react';
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
import type { LabelApiResponse } from '../../../api/types';
import type { Priority } from '../../../types';
import type { IssueLayoutProps } from './IssueLayoutTypes';

/**
 * Spreadsheet layout — flat HTML table with sticky header. Each column reuses
 * the same cells the list/board use, so visuals stay consistent.
 *
 * Columns (in order): ID • Title • State • Priority • Assignees • Labels • Due • Start.
 * Property cells are editable in place when `onUpdateIssue` is provided.
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
  onUpdateIssue,
}: IssueLayoutProps) {
  const stateById = useMemo(() => new Map(states.map((s) => [s.id, s])), [states]);
  const labelById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);
  const [openCell, setOpenCell] = useState<string | null>(null);

  return (
    <div className="overflow-auto">
      <table className="w-full min-w-[920px] border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 z-10 bg-(--bg-surface-1)">
          <tr className="text-[11px] font-medium uppercase tracking-wide text-(--txt-tertiary)">
            <Th className="w-24">ID</Th>
            <Th className="min-w-[260px]">Title</Th>
            <Th className="w-40">State</Th>
            <Th className="w-12 text-center">!</Th>
            <Th className="w-32">Assignees</Th>
            <Th className="w-44">Labels</Th>
            <Th className="w-32">Due</Th>
            <Th className="w-28">Start</Th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => {
            const displayId = `${project.identifier ?? project.id.slice(0, 8)}-${issue.sequence_id ?? issue.id.slice(-4)}`;
            const issueState = issue.state_id ? (stateById.get(issue.state_id) ?? null) : null;
            const issueLabels = (issue.label_ids ?? [])
              .map((id) => labelById.get(id))
              .filter((l): l is LabelApiResponse => Boolean(l));
            const issueAssignees = membersFromAssigneeIds(members, issue.assignee_ids ?? []);
            const startStr = formatShort(issue.start_date);

            return (
              <tr
                key={issue.id}
                className="border-t border-(--border-subtle) transition-colors hover:bg-(--bg-layer-1-hover)"
              >
                <Td className="font-medium text-(--txt-accent-primary)">
                  <Link to={issueHref(issue.id)} className="no-underline hover:underline">
                    {displayId}
                  </Link>
                </Td>
                <Td className="min-w-0">
                  <Link
                    to={issueHref(issue.id)}
                    className="flex min-w-0 items-center gap-1.5 truncate text-(--txt-primary) no-underline hover:text-(--txt-accent-primary)"
                  >
                    <span className="truncate">{issue.name}</span>
                    <IssuePRBadge summary={prSummary[issue.id]} />
                  </Link>
                </Td>
                <Td>
                  {onUpdateIssue ? (
                    <EditableStateCell
                      issueId={issue.id}
                      state={issueState}
                      states={states}
                      openId={openCell}
                      onOpen={setOpenCell}
                      onChange={(state_id) => onUpdateIssue(issue.id, { state_id })}
                    />
                  ) : issueState ? (
                    <StatePill state={issueState} />
                  ) : null}
                </Td>
                <Td className="text-center">
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
                </Td>
                <Td>
                  {onUpdateIssue ? (
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
                  )}
                </Td>
                <Td>
                  {onUpdateIssue ? (
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
                  )}
                </Td>
                <Td>
                  {onUpdateIssue ? (
                    <DatePickerTrigger
                      label="Due date"
                      icon={<Calendar />}
                      value={issue.target_date ?? ''}
                      placeholder="—"
                      onChange={(v) => onUpdateIssue(issue.id, { target_date: v || null })}
                    />
                  ) : (
                    <DueDateCell issue={issue} state={issueState} now={now} />
                  )}
                </Td>
                <Td className="text-[11px] text-(--txt-secondary)">
                  {onUpdateIssue ? (
                    <DatePickerTrigger
                      label="Start date"
                      icon={<Calendar />}
                      value={issue.start_date ?? ''}
                      placeholder="—"
                      onChange={(v) => onUpdateIssue(issue.id, { start_date: v || null })}
                    />
                  ) : (
                    (startStr ?? '—')
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`border-b border-(--border-subtle) px-3 py-2 text-left ${className ?? ''}`}
      scope="col"
    >
      {children}
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
