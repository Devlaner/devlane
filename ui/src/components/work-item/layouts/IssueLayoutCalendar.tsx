import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PriorityIcon } from '../IssueRowCells';
import type { IssueApiResponse } from '../../../api/types';
import type { Priority } from '../../../types';
import type { IssueLayoutProps } from './IssueLayoutTypes';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const MAX_PER_CELL = 3;

/**
 * Month-grid calendar. Issues placed on their `target_date` cell.
 *
 * Issues without a target_date are bucketed into a "No due date" footer panel
 * so they aren't silently dropped.
 *
 * Navigation: prev/next month. "Today" jumps to current month. The "viewMonth"
 * is local UI state so switching layout doesn't lose the user's place.
 */
export function IssueLayoutCalendar({ project, states, issues, issueHref, now }: IssueLayoutProps) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date(now)));

  const stateById = useMemo(() => new Map(states.map((s) => [s.id, s])), [states]);

  // Issues bucketed by ISO date string (YYYY-MM-DD).
  const issuesByDate = useMemo(() => {
    const map = new Map<string, IssueApiResponse[]>();
    const undated: IssueApiResponse[] = [];
    for (const issue of issues) {
      if (!issue.target_date) {
        undated.push(issue);
        continue;
      }
      const key = isoDate(issue.target_date);
      if (!key) {
        undated.push(issue);
        continue;
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(issue);
    }
    return { map, undated };
  }, [issues]);

  const cells = buildMonthCells(viewMonth);

  return (
    <div className="space-y-3 px-4 py-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setViewMonth(addMonths(viewMonth, -1))}
          className="inline-flex h-7 w-7 items-center justify-center rounded-(--radius-md) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setViewMonth(addMonths(viewMonth, 1))}
          className="inline-flex h-7 w-7 items-center justify-center rounded-(--radius-md) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <h2 className="text-sm font-semibold text-(--txt-primary)">
          {viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </h2>
        <button
          type="button"
          className="ml-2 rounded-(--radius-md) border border-(--border-subtle) px-2 py-0.5 text-[11px] text-(--txt-secondary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
          onClick={() => setViewMonth(startOfMonth(new Date(now)))}
        >
          Today
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-(--radius-md) border border-(--border-subtle) bg-(--border-subtle)">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="bg-(--bg-surface-1) px-2 py-1 text-[11px] font-medium text-(--txt-tertiary)"
          >
            {d}
          </div>
        ))}

        {/* Day cells */}
        {cells.map(({ date, inMonth }) => {
          const key = isoDate(date.toISOString().slice(0, 10))!;
          const dayIssues = issuesByDate.map.get(key) ?? [];
          const isToday = sameDay(date, new Date(now));
          const visible = dayIssues.slice(0, MAX_PER_CELL);
          const overflow = dayIssues.length - visible.length;
          return (
            <div
              key={key}
              className={`min-h-24 bg-(--bg-surface-1) px-1.5 py-1 text-[11px] ${
                inMonth ? '' : 'opacity-40'
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full font-medium ${
                    isToday
                      ? 'bg-(--bg-accent-primary) text-(--txt-on-color)'
                      : 'text-(--txt-secondary)'
                  }`}
                >
                  {date.getDate()}
                </span>
                {dayIssues.length > 0 && (
                  <span className="text-[10px] text-(--txt-tertiary)">{dayIssues.length}</span>
                )}
              </div>
              <div className="space-y-1">
                {visible.map((issue) => (
                  <CalendarPill
                    key={issue.id}
                    issue={issue}
                    href={issueHref(issue.id)}
                    state={issue.state_id ? (stateById.get(issue.state_id) ?? null) : null}
                  />
                ))}
                {overflow > 0 && (
                  <p className="px-1 text-[10px] text-(--txt-tertiary)">+{overflow} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {issuesByDate.undated.length > 0 && (
        <details className="rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1)">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-(--txt-secondary)">
            No due date · {issuesByDate.undated.length}
          </summary>
          <ul className="border-t border-(--border-subtle) divide-y divide-(--border-subtle)">
            {issuesByDate.undated.map((issue) => (
              <li key={issue.id}>
                <Link
                  to={issueHref(issue.id)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-(--txt-primary) no-underline hover:bg-(--bg-layer-1-hover)"
                >
                  <PriorityIcon priority={issue.priority as Priority | null | undefined} />
                  <span className="truncate">{issue.name}</span>
                  <span className="ml-auto text-[11px] text-(--txt-tertiary)">
                    {project.identifier ?? project.id.slice(0, 8)}-
                    {issue.sequence_id ?? issue.id.slice(-4)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function CalendarPill({
  issue,
  href,
  state,
}: {
  issue: IssueApiResponse;
  href: string;
  state: IssueLayoutProps['states'][number] | null;
}) {
  const dotColor = state?.color || 'var(--neutral-500)';
  return (
    <Link
      to={href}
      className="flex items-center gap-1 truncate rounded-(--radius-sm) px-1 py-0.5 no-underline hover:bg-(--bg-layer-1-hover)"
      title={issue.name}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: dotColor }}
        aria-hidden
      />
      <span className="truncate text-(--txt-primary)">{issue.name}</span>
    </Link>
  );
}

// ---------- date helpers ----------

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function isoDate(input: string | null | undefined): string | null {
  if (!input) return null;
  // Accept "YYYY-MM-DD" or full ISO. Truncate to date only.
  const t = Date.parse(input);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Build a 6-week grid (42 cells) starting from the Monday on or before the
 * 1st of the given month. Each cell knows whether it falls inside the month.
 */
function buildMonthCells(viewMonth: Date): { date: Date; inMonth: boolean }[] {
  const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  // Monday-first week. Date#getDay() returns 0 (Sun) … 6 (Sat).
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);

  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({ date: d, inMonth: d.getMonth() === viewMonth.getMonth() });
  }
  return cells;
}
