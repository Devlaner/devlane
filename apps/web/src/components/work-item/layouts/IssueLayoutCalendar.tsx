import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PriorityIcon } from '../IssueRowCells';
import type { IssueApiResponse } from '../../../api/types';
import type { Priority } from '../../../types';
import { issueDisplayId, type IssueLayoutProps } from './IssueLayoutTypes';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const WEEKDAYS_NO_WEEKEND = WEEKDAYS.slice(0, 5);
const MAX_PER_CELL = 3;

type CalendarMode = 'month' | 'week';

/**
 * Calendar layout. Issues are placed on their `target_date` cell, with optional
 * month/week views and drag-to-reschedule when inline updates are available.
 *
 * Issues without a target_date are bucketed into a "No due date" footer panel
 * so they are not silently dropped.
 */
export function IssueLayoutCalendar({
  project,
  states,
  issues,
  issueHref,
  now,
  projectsById,
  onUpdateIssue,
}: IssueLayoutProps) {
  const { t } = useTranslation();
  const [viewDate, setViewDate] = useState(() => startOfDay(new Date(now)));
  const [mode, setMode] = useState<CalendarMode>('month');
  const [showWeekends, setShowWeekends] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropDate, setDropDate] = useState<string | null>(null);

  const stateById = useMemo(() => new Map(states.map((s) => [s.id, s])), [states]);
  const issueById = useMemo(() => new Map(issues.map((i) => [i.id, i])), [issues]);

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

  const cells = useMemo(() => {
    const allCells =
      mode === 'month' ? buildMonthCells(startOfMonth(viewDate)) : buildWeekCells(viewDate);
    return showWeekends ? allCells : allCells.filter(({ date }) => !isWeekend(date));
  }, [mode, showWeekends, viewDate]);
  const weekdays = showWeekends ? WEEKDAYS : WEEKDAYS_NO_WEEKEND;
  const gridColsClass = showWeekends ? 'grid-cols-7' : 'grid-cols-5';
  const canDrag = Boolean(onUpdateIssue);

  const clearDrag = () => {
    setDraggingId(null);
    setDropDate(null);
  };

  const handleDropOnDate = (targetDate: string) => {
    const issue = draggingId ? issueById.get(draggingId) : null;
    clearDrag();
    if (!issue || !onUpdateIssue) return;
    if (isoDate(issue.target_date) === targetDate) return;
    onUpdateIssue(issue.id, { target_date: targetDate });
  };

  const moveView = (amount: number) => {
    setViewDate((current) =>
      mode === 'month' ? addMonths(current, amount) : addDays(current, amount * 7),
    );
  };

  return (
    <div className="space-y-3 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => moveView(-1)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-(--radius-md) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
          aria-label={
            mode === 'month'
              ? t('workItem.calendar.prevMonth', 'Previous month')
              : t('workItem.calendar.prevWeek', 'Previous week')
          }
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => moveView(1)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-(--radius-md) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
          aria-label={
            mode === 'month'
              ? t('workItem.calendar.nextMonth', 'Next month')
              : t('workItem.calendar.nextWeek', 'Next week')
          }
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <h2 className="text-sm font-semibold text-(--txt-primary)">
          {calendarTitle(viewDate, mode)}
        </h2>
        <button
          type="button"
          className="ml-2 rounded-(--radius-md) border border-(--border-subtle) px-2 py-0.5 text-[11px] text-(--txt-secondary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
          onClick={() => setViewDate(startOfDay(new Date(now)))}
        >
          {t('common.today', 'Today')}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-(--radius-md) border border-(--border-subtle)">
            {(['month', 'week'] as const).map((nextMode) => (
              <button
                key={nextMode}
                type="button"
                className={`px-2 py-1 text-[11px] font-medium capitalize ${
                  mode === nextMode
                    ? 'bg-(--bg-accent-primary) text-(--txt-on-color)'
                    : 'bg-(--bg-surface-1) text-(--txt-secondary) hover:bg-(--bg-layer-1-hover)'
                }`}
                onClick={() => setMode(nextMode)}
              >
                {nextMode === 'month'
                  ? t('workItem.calendar.month', 'month')
                  : t('workItem.calendar.week', 'week')}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-[11px] text-(--txt-secondary)">
            <input
              type="checkbox"
              className="h-3.5 w-3.5"
              checked={showWeekends}
              onChange={(event) => setShowWeekends(event.target.checked)}
            />
            {t('workItem.calendar.weekends', 'Weekends')}
          </label>
        </div>
      </div>

      <div
        className={`grid ${gridColsClass} gap-px overflow-hidden rounded-(--radius-md) border border-(--border-subtle) bg-(--border-subtle)`}
      >
        {weekdays.map((day) => (
          <div
            key={day}
            className="bg-(--bg-surface-1) px-2 py-1 text-[11px] font-medium text-(--txt-tertiary)"
          >
            {day}
          </div>
        ))}

        {cells.map(({ date, inMonth }) => {
          const key = localKey(date);
          const dayIssues = issuesByDate.map.get(key) ?? [];
          const isToday = sameDay(date, new Date(now));
          const visible = dayIssues.slice(0, MAX_PER_CELL);
          const overflow = dayIssues.length - visible.length;
          const isDropTarget = dropDate === key && Boolean(draggingId);
          return (
            <div
              key={key}
              className={`min-h-24 bg-(--bg-surface-1) px-1.5 py-1 text-[11px] transition-colors ${
                inMonth || mode === 'week' ? '' : 'opacity-40'
              } ${isDropTarget ? 'outline outline-2 outline-(--border-focus)' : ''}`}
              onDragOver={
                canDrag
                  ? (event) => {
                      if (!draggingId) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                      if (dropDate !== key) setDropDate(key);
                    }
                  : undefined
              }
              onDragLeave={
                canDrag
                  ? () => setDropDate((current) => (current === key ? null : current))
                  : undefined
              }
              onDrop={
                canDrag
                  ? (event) => {
                      event.preventDefault();
                      handleDropOnDate(key);
                    }
                  : undefined
              }
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
                    draggable={canDrag}
                    onDragStart={() => setDraggingId(issue.id)}
                    onDragEnd={clearDrag}
                  />
                ))}
                {overflow > 0 && (
                  <p className="px-1 text-[10px] text-(--txt-tertiary)">
                    {t('workItem.calendar.moreCount', '+{{count}} more', { count: overflow })}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {issuesByDate.undated.length > 0 && (
        <details className="rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1)">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-(--txt-secondary)">
            {t('workItem.calendar.noDueDate', 'No due date - {{count}}', {
              count: issuesByDate.undated.length,
            })}
          </summary>
          <ul className="divide-y divide-(--border-subtle) border-t border-(--border-subtle)">
            {issuesByDate.undated.map((issue) => (
              <li key={issue.id}>
                <Link
                  to={issueHref(issue.id)}
                  draggable={canDrag}
                  onDragStart={(event) => {
                    if (!canDrag) return;
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', issue.id);
                    setDraggingId(issue.id);
                  }}
                  onDragEnd={clearDrag}
                  className={`flex items-center gap-2 px-3 py-2 text-sm text-(--txt-primary) no-underline hover:bg-(--bg-layer-1-hover) ${
                    canDrag ? 'cursor-grab active:cursor-grabbing' : ''
                  }`}
                >
                  <PriorityIcon priority={issue.priority as Priority | null | undefined} />
                  <span className="truncate">{issue.name}</span>
                  <span className="ml-auto text-[11px] text-(--txt-tertiary)">
                    {issueDisplayId(issue, project, projectsById)}
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
  draggable,
  onDragStart,
  onDragEnd,
}: {
  issue: IssueApiResponse;
  href: string;
  state: IssueLayoutProps['states'][number] | null;
  draggable: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const dotColor = state?.color || 'var(--neutral-500)';
  return (
    <Link
      to={href}
      draggable={draggable}
      onDragStart={(event) => {
        if (!draggable) return;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', issue.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-1 truncate rounded-(--radius-sm) px-1 py-0.5 no-underline hover:bg-(--bg-layer-1-hover) ${
        draggable ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
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

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfWeek(d: Date): Date {
  const out = startOfDay(d);
  const offset = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - offset);
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function calendarTitle(viewDate: Date, mode: CalendarMode): string {
  if (mode === 'month') {
    return startOfMonth(viewDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  const start = startOfWeek(viewDate);
  const end = addDays(start, 6);
  return `${formatDay(start)} - ${formatDay(end)}`;
}

function formatDay(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// target_date/start_date arrive as a UTC-midnight ISO timestamp (or a bare
// "YYYY-MM-DD"). The calendar day is the date portion itself; routing it through
// a Date reads local components and shifts the day for non-UTC clients, so take
// the leading date directly. Keys line up with the cell keys built by localKey.
function isoDate(input: string | null | undefined): string | null {
  if (!input) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(input);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

// Local calendar day (Y-M-D) of a Date built from local components.
function localKey(d: Date): string {
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
  // Monday-first week. Date#getDay() returns 0 (Sun) ... 6 (Sat).
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

function buildWeekCells(viewDate: Date): { date: Date; inMonth: boolean }[] {
  const start = startOfWeek(viewDate);
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 7; i++) {
    cells.push({ date: addDays(start, i), inMonth: true });
  }
  return cells;
}
