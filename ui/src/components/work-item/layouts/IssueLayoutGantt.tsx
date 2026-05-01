import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PriorityIcon } from '../IssueRowCells';
import type { Priority } from '../../../types';
import type { IssueLayoutProps } from './IssueLayoutTypes';

const DAY_MS = 24 * 3600 * 1000;
const DAY_PX = 28; // width per day on the timeline; pannable, not zoomable yet

/**
 * Lightweight Gantt — horizontal timeline of bars positioned by start_date and
 * target_date. Issues without both dates fall into a sidebar "Undated" list.
 *
 * Implementation notes:
 *   - We compute the visible window from min(start_date) to max(target_date)
 *     across all dated issues, with a one-week padding either side. That keeps
 *     the chart compact for short-running projects.
 *   - The user can shift the window by ±7 days with the prev/next controls.
 *     Real zoom + drag-to-reschedule are deferred.
 *   - Bar color comes from `state.color`.
 *   - Sidebar (left) shows id + name; the chart (right) is horizontally
 *     scrollable for projects whose range exceeds the viewport.
 */
export function IssueLayoutGantt({ project, states, issues, issueHref, now }: IssueLayoutProps) {
  const stateById = useMemo(() => new Map(states.map((s) => [s.id, s])), [states]);

  const dated = useMemo(
    () => issues.filter((i) => Boolean(i.start_date) && Boolean(i.target_date)),
    [issues],
  );
  const undated = useMemo(() => issues.filter((i) => !i.start_date || !i.target_date), [issues]);

  const [shiftDays, setShiftDays] = useState(0);

  const window = useMemo(() => {
    if (dated.length === 0) {
      const today = startOfDay(new Date(now));
      return { start: today.getTime(), end: today.getTime() + 21 * DAY_MS };
    }
    let min = Infinity;
    let max = -Infinity;
    for (const i of dated) {
      const s = parseDay(i.start_date!);
      const e = parseDay(i.target_date!);
      if (s !== null && s < min) min = s;
      if (e !== null && e > max) max = e;
    }
    if (min === Infinity || max === -Infinity) {
      const today = startOfDay(new Date(now));
      return { start: today.getTime(), end: today.getTime() + 21 * DAY_MS };
    }
    const pad = 7 * DAY_MS;
    return { start: min - pad + shiftDays * DAY_MS, end: max + pad + shiftDays * DAY_MS };
  }, [dated, now, shiftDays]);

  const totalDays = Math.max(1, Math.round((window.end - window.start) / DAY_MS) + 1);
  const days = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i < totalDays; i++) arr.push(window.start + i * DAY_MS);
    return arr;
  }, [window.start, totalDays]);

  const todayMs = startOfDay(new Date(now)).getTime();
  const todayOffset = Math.round((todayMs - window.start) / DAY_MS);

  return (
    <div className="space-y-3 px-4 py-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShiftDays((s) => s - 7)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-(--radius-md) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
          aria-label="Earlier"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setShiftDays((s) => s + 7)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-(--radius-md) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
          aria-label="Later"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <h2 className="text-sm font-semibold text-(--txt-primary)">
          {fmtRange(window.start, window.end)}
        </h2>
        <button
          type="button"
          className="ml-2 rounded-(--radius-md) border border-(--border-subtle) px-2 py-0.5 text-[11px] text-(--txt-secondary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
          onClick={() => setShiftDays(0)}
        >
          Reset
        </button>
        <span className="ml-auto text-[11px] text-(--txt-tertiary)">
          {dated.length} dated · {undated.length} undated
        </span>
      </div>

      {dated.length === 0 ? (
        <p className="rounded-(--radius-md) border border-dashed border-(--border-subtle) bg-(--bg-surface-1) px-3 py-6 text-center text-sm text-(--txt-tertiary)">
          No work items have both a start and a target date. Add dates to plot bars on the timeline.
        </p>
      ) : (
        <div className="overflow-auto rounded-(--radius-md) border border-(--border-subtle)">
          <div className="flex min-w-max">
            {/* Sticky sidebar: id + name */}
            <div className="sticky left-0 z-10 w-64 shrink-0 border-r border-(--border-subtle) bg-(--bg-surface-1)">
              <div className="h-9 border-b border-(--border-subtle) px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-(--txt-tertiary)">
                Work item
              </div>
              <ul>
                {dated.map((issue) => (
                  <li
                    key={issue.id}
                    className="flex h-8 items-center gap-1.5 border-b border-(--border-subtle) px-3"
                  >
                    <PriorityIcon
                      priority={issue.priority as Priority | null | undefined}
                      variant="icon"
                    />
                    <Link
                      to={issueHref(issue.id)}
                      className="flex min-w-0 items-center gap-1.5 text-xs text-(--txt-primary) no-underline hover:text-(--txt-accent-primary)"
                    >
                      <span className="font-medium text-(--txt-accent-primary)">
                        {project.identifier ?? project.id.slice(0, 8)}-
                        {issue.sequence_id ?? issue.id.slice(-4)}
                      </span>
                      <span className="truncate">{issue.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Timeline */}
            <div className="relative" style={{ width: `${totalDays * DAY_PX}px` }}>
              {/* Day-cell header */}
              <div className="flex h-9 border-b border-(--border-subtle) bg-(--bg-surface-1)">
                {days.map((ms, i) => {
                  const d = new Date(ms);
                  const isMonthStart = d.getDate() === 1 || i === 0;
                  return (
                    <div
                      key={ms}
                      className="flex flex-col items-center justify-center border-r border-(--border-subtle) text-[10px] text-(--txt-tertiary)"
                      style={{ width: `${DAY_PX}px` }}
                    >
                      {isMonthStart && (
                        <span className="text-(--txt-secondary)">
                          {d.toLocaleDateString(undefined, { month: 'short' })}
                        </span>
                      )}
                      <span>{d.getDate()}</span>
                    </div>
                  );
                })}
              </div>

              {/* Today line */}
              {todayOffset >= 0 && todayOffset < totalDays && (
                <div
                  className="pointer-events-none absolute top-9 z-10 h-[calc(100%-2.25rem)] w-px bg-(--txt-accent-primary) opacity-60"
                  style={{ left: `${todayOffset * DAY_PX + DAY_PX / 2}px` }}
                  aria-hidden
                />
              )}

              {/* Bars */}
              <ul>
                {dated.map((issue) => {
                  const start = parseDay(issue.start_date!) ?? window.start;
                  const end = parseDay(issue.target_date!) ?? start;
                  const offset = Math.max(0, Math.round((start - window.start) / DAY_MS));
                  const span = Math.max(1, Math.round((end - start) / DAY_MS) + 1);
                  const state = issue.state_id ? (stateById.get(issue.state_id) ?? null) : null;
                  const color = state?.color || '#6b7280';
                  return (
                    <li key={issue.id} className="relative h-8 border-b border-(--border-subtle)">
                      <Link
                        to={issueHref(issue.id)}
                        className="absolute top-1.5 flex h-5 items-center overflow-hidden rounded-(--radius-md) px-2 text-[11px] font-medium text-white shadow-sm no-underline transition-opacity hover:opacity-80"
                        style={{
                          left: `${offset * DAY_PX + 2}px`,
                          width: `${span * DAY_PX - 4}px`,
                          backgroundColor: color,
                        }}
                        title={`${issue.name} · ${issue.start_date} → ${issue.target_date}`}
                      >
                        <span className="truncate">{issue.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}

      {undated.length > 0 && (
        <details className="rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1)">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-(--txt-secondary)">
            Undated · {undated.length}
          </summary>
          <ul className="border-t border-(--border-subtle) divide-y divide-(--border-subtle)">
            {undated.map((issue) => (
              <li key={issue.id}>
                <Link
                  to={issueHref(issue.id)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-(--txt-primary) no-underline hover:bg-(--bg-layer-1-hover)"
                >
                  <PriorityIcon priority={issue.priority as Priority | null | undefined} />
                  <span className="truncate">{issue.name}</span>
                  <span className="ml-auto text-[11px] text-(--txt-tertiary)">
                    {issue.start_date ? '' : 'no start · '}
                    {issue.target_date ? '' : 'no target'}
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

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseDay(input: string): number | null {
  const t = Date.parse(input);
  if (Number.isNaN(t)) return null;
  return startOfDay(new Date(t)).getTime();
}

function fmtRange(start: number, end: number): string {
  const s = new Date(start);
  const e = new Date(end);
  const sameYear = s.getFullYear() === e.getFullYear();
  const sStr = s.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const eStr = e.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${sStr} – ${eStr}`;
}
