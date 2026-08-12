import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/shadcn/ui/badge';
import { Button } from '@/components/shadcn/ui/button';
import { Checkbox } from '@/components/shadcn/ui/checkbox';
import { Label } from '@/components/shadcn/ui/label';
import { cn } from '@/lib/utils';
import { priorityVariant, stateDotStyle } from '../../../lib/projectV2';
import type { IssueInlinePatch } from '../../work-item/layouts/IssueLayoutTypes';
import type { IssueApiResponse, StateApiResponse } from '../../../api/types';

const MAX_PER_CELL = 3;

interface WorkItemsCalendarLayoutProps {
  issues: IssueApiResponse[];
  states: StateApiResponse[];
  issueUrl: (issueId: string) => string;
  onUpdateIssue: (issueId: string, patch: IssueInlinePatch) => void;
  now: number;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isoDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/**
 * Month grid keyed on the due date. Dragging a card onto a day sets that date
 * through the shared inline-update path, so the change is chained and reconciled
 * exactly as an edit made from the table would be.
 */
export function WorkItemsCalendarLayout({
  issues,
  states,
  issueUrl,
  onUpdateIssue,
  now,
}: WorkItemsCalendarLayoutProps) {
  const { t, i18n } = useTranslation();
  const [viewDate, setViewDate] = useState(() => startOfDay(new Date(now)));
  const [showWeekends, setShowWeekends] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropDate, setDropDate] = useState<string | null>(null);

  const stateById = useMemo(() => new Map(states.map((state) => [state.id, state])), [states]);

  const issuesByDate = useMemo(() => {
    const map = new Map<string, IssueApiResponse[]>();
    for (const issue of issues) {
      if (!issue.target_date || Number.isNaN(Date.parse(issue.target_date))) continue;
      const key = isoDate(issue.target_date);
      const bucket = map.get(key);
      if (bucket) bucket.push(issue);
      else map.set(key, [issue]);
    }
    return map;
  }, [issues]);

  const undated = useMemo(
    () =>
      issues.filter((issue) => !issue.target_date || Number.isNaN(Date.parse(issue.target_date))),
    [issues],
  );

  /* Weeks start on Monday, matching the shipped calendar. */
  const cells = useMemo(() => {
    const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [viewDate]);

  const weekdayFormatter = new Intl.DateTimeFormat(i18n.language, { weekday: 'short' });
  const monthFormatter = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' });
  const weekdayLabels = cells.slice(0, 7).map((day) => weekdayFormatter.format(day));
  const visibleColumns = showWeekends ? 7 : 5;
  const todayKey = isoDate(new Date(now));

  const shiftMonth = (delta: number) =>
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          onClick={() => shiftMonth(-1)}
          aria-label={t('calendar.previousMonth', 'Previous month')}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <span className="min-w-40 text-sm font-medium">{monthFormatter.format(viewDate)}</span>
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          onClick={() => shiftMonth(1)}
          aria-label={t('calendar.nextMonth', 'Next month')}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setViewDate(startOfDay(new Date(now)))}
        >
          {t('common.today', 'Today')}
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Checkbox
            id="calendar-show-weekends"
            checked={showWeekends}
            onCheckedChange={(checked) => setShowWeekends(checked === true)}
          />
          <Label htmlFor="calendar-show-weekends" className="font-normal">
            {t('calendar.showWeekends', 'Show weekends')}
          </Label>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <div
          className="bg-muted/50 grid border-b"
          style={{ gridTemplateColumns: `repeat(${visibleColumns}, minmax(0, 1fr))` }}
        >
          {weekdayLabels.slice(0, visibleColumns).map((label) => (
            <div key={label} className="text-muted-foreground px-2 py-1.5 text-xs font-medium">
              {label}
            </div>
          ))}
        </div>
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${visibleColumns}, minmax(0, 1fr))` }}
        >
          {cells
            .filter((day) => showWeekends || (day.getDay() + 6) % 7 < 5)
            .map((day) => {
              const key = isoDate(day);
              const dayIssues = issuesByDate.get(key) ?? [];
              const inMonth = day.getMonth() === viewDate.getMonth();
              return (
                <div
                  key={key}
                  className={cn(
                    'min-h-28 border-r border-b p-1.5 last:border-r-0',
                    !inMonth && 'bg-muted/20',
                    dropDate === key && 'bg-accent',
                  )}
                  onDragOver={(event) => {
                    if (!draggingId) return;
                    event.preventDefault();
                    setDropDate(key);
                  }}
                  onDragLeave={() => setDropDate((current) => (current === key ? null : current))}
                  onDrop={(event) => {
                    event.preventDefault();
                    const issueId = event.dataTransfer.getData('text/plain') || draggingId;
                    setDraggingId(null);
                    setDropDate(null);
                    if (issueId) onUpdateIssue(issueId, { target_date: key });
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'text-xs tabular-nums',
                        inMonth ? 'text-foreground' : 'text-muted-foreground',
                        key === todayKey && 'bg-primary text-primary-foreground rounded px-1.5',
                      )}
                    >
                      {day.getDate()}
                    </span>
                    {dayIssues.length > MAX_PER_CELL && (
                      <span className="text-muted-foreground text-[10px] tabular-nums">
                        +{dayIssues.length - MAX_PER_CELL}
                      </span>
                    )}
                  </div>
                  <ul className="mt-1 space-y-1">
                    {dayIssues.slice(0, MAX_PER_CELL).map((issue) => (
                      <li key={issue.id}>
                        <Link
                          to={issueUrl(issue.id)}
                          draggable
                          onDragStart={(event) => {
                            setDraggingId(issue.id);
                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData('text/plain', issue.id);
                          }}
                          onDragEnd={() => {
                            setDraggingId(null);
                            setDropDate(null);
                          }}
                          className="bg-card hover:bg-accent flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-xs"
                        >
                          <span
                            aria-hidden="true"
                            className="size-2 shrink-0 rounded-full"
                            style={stateDotStyle(
                              issue.state_id ? stateById.get(issue.state_id) : undefined,
                            )}
                          />
                          <span className="truncate">{issue.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
        </div>
      </div>

      {undated.length > 0 && (
        <div className="rounded-xl border p-3">
          <p className="text-muted-foreground mb-2 text-xs font-medium">
            {t('calendar.undated', 'No due date')}
          </p>
          <ul className="flex flex-wrap gap-2">
            {undated.map((issue) => (
              <li key={issue.id}>
                <Link
                  to={issueUrl(issue.id)}
                  draggable
                  onDragStart={(event) => {
                    setDraggingId(issue.id);
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', issue.id);
                  }}
                  onDragEnd={() => setDraggingId(null)}
                  className="bg-card hover:bg-accent flex max-w-64 items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
                >
                  <Badge variant={priorityVariant(issue.priority)} className="shrink-0">
                    {issue.priority ?? 'none'}
                  </Badge>
                  <span className="truncate">{issue.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
