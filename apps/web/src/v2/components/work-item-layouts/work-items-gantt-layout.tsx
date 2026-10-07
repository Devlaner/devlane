import { useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/v2/components/ui/button';
import { ScrollArea, ScrollBar } from '@/v2/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/v2/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatDate, stateDotStyle } from '../../lib/project';
import type { IssueInlinePatch } from '../../../components/work-item/layouts/IssueLayoutTypes';
import type { IssueApiResponse, StateApiResponse } from '../../../api/types';

const DAY_MS = 24 * 3600 * 1000;
const ZOOM_LEVELS = [14, 20, 28, 40, 56];
const DEFAULT_ZOOM = 2;
const ROW_HEIGHT = 36;

interface WorkItemsGanttLayoutProps {
  issues: IssueApiResponse[];
  states: StateApiResponse[];
  issueUrl: (issueId: string) => string;
  onUpdateIssue: (issueId: string, patch: IssueInlinePatch) => void;
  now: number;
}

/** A bar being dragged: whole-bar move, or one edge being pulled. */
interface BarDrag {
  issueId: string;
  mode: 'move' | 'start' | 'end';
  startX: number;
  deltaDays: number;
  moved: boolean;
}

function isoDay(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function parseDay(value: string): Date {
  return startOfDay(new Date(value));
}

/**
 * Timeline of the items that have both a start and a due date, over the same
 * filtered, ordered list the other layouts draw. Items missing either date are
 * listed underneath rather than silently dropped.
 */
export function WorkItemsGanttLayout({
  issues,
  states,
  issueUrl,
  onUpdateIssue,
  now,
}: WorkItemsGanttLayoutProps) {
  const { t, i18n } = useTranslation();
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM);
  const dayPx = ZOOM_LEVELS[zoomIndex];
  const stateById = useMemo(() => new Map(states.map((state) => [state.id, state])), [states]);

  const dated = useMemo(
    () =>
      issues.filter(
        (issue) =>
          issue.start_date &&
          issue.target_date &&
          !Number.isNaN(Date.parse(issue.start_date)) &&
          !Number.isNaN(Date.parse(issue.target_date)),
      ),
    [issues],
  );
  const undated = useMemo(() => issues.filter((issue) => !dated.includes(issue)), [issues, dated]);

  /* The window spans every bar plus a week of padding, or a month around today
     when nothing is scheduled. */
  const { windowStart, dayCount } = useMemo(() => {
    if (dated.length === 0) {
      const today = startOfDay(new Date(now));
      const start = new Date(today.getTime() - 7 * DAY_MS);
      return { windowStart: start, dayCount: 30 };
    }
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const issue of dated) {
      min = Math.min(min, parseDay(issue.start_date!).getTime());
      max = Math.max(max, parseDay(issue.target_date!).getTime());
    }
    const start = new Date(min - 3 * DAY_MS);
    const days = Math.max(14, Math.round((max - min) / DAY_MS) + 7);
    return { windowStart: start, dayCount: days };
  }, [dated, now]);

  const days = useMemo(
    () =>
      Array.from(
        { length: dayCount },
        (_, index) => new Date(windowStart.getTime() + index * DAY_MS),
      ),
    [windowStart, dayCount],
  );

  const [drag, setDrag] = useState<BarDrag | null>(null);

  /* Dragging a bar moves both dates; dragging an edge moves one. The preview
     follows the pointer in whole days and only commits on release, so a drag
     costs one PATCH through the shared inline-update path. */
  const startBarDrag =
    (issue: IssueApiResponse, mode: BarDrag['mode']) => (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const origin = event.clientX;
      let deltaDays = 0;
      let moved = false;
      setDrag({ issueId: issue.id, mode, startX: origin, deltaDays: 0, moved: false });

      const onPointerMove = (moveEvent: PointerEvent) => {
        const next = Math.round((moveEvent.clientX - origin) / dayPx);
        if (next === deltaDays) return;
        deltaDays = next;
        moved = moved || Math.abs(moveEvent.clientX - origin) > 3;
        setDrag((current) =>
          current && current.issueId === issue.id ? { ...current, deltaDays, moved } : current,
        );
      };

      const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        setDrag(null);
        if (!moved || deltaDays === 0) return;
        const start = parseDay(issue.start_date!);
        const end = parseDay(issue.target_date!);
        const shifted = (date: Date) => new Date(date.getTime() + deltaDays * DAY_MS);
        if (mode === 'move') {
          onUpdateIssue(issue.id, {
            start_date: isoDay(shifted(start)),
            target_date: isoDay(shifted(end)),
          });
          return;
        }
        if (mode === 'start') {
          const nextStart = shifted(start);
          if (nextStart.getTime() > end.getTime()) return;
          onUpdateIssue(issue.id, { start_date: isoDay(nextStart) });
          return;
        }
        const nextEnd = shifted(end);
        if (nextEnd.getTime() < start.getTime()) return;
        onUpdateIssue(issue.id, { target_date: isoDay(nextEnd) });
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    };

  const dayFormatter = new Intl.DateTimeFormat(i18n.language, { day: 'numeric' });
  const monthFormatter = new Intl.DateTimeFormat(i18n.language, { month: 'short' });
  const todayOffset = Math.round(
    (startOfDay(new Date(now)).getTime() - windowStart.getTime()) / DAY_MS,
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          disabled={zoomIndex === 0}
          onClick={() => setZoomIndex((index) => Math.max(0, index - 1))}
          aria-label={t('gantt.zoomOut', 'Zoom out')}
        >
          <ZoomOut aria-hidden="true" />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          disabled={zoomIndex === ZOOM_LEVELS.length - 1}
          onClick={() => setZoomIndex((index) => Math.min(ZOOM_LEVELS.length - 1, index + 1))}
          aria-label={t('gantt.zoomIn', 'Zoom in')}
        >
          <ZoomIn aria-hidden="true" />
        </Button>
        <span className="text-muted-foreground text-xs">
          {t('gantt.scheduledCount', '{{count}} scheduled work items', { count: dated.length })}
        </span>
      </div>

      <div className="flex overflow-hidden rounded-xl border">
        <div className="w-56 shrink-0 border-r">
          <div className="bg-muted/50 text-muted-foreground h-10 border-b px-3 py-2 text-xs font-medium">
            {t('views.workItems', 'Work items')}
          </div>
          {dated.map((issue) => (
            <div
              key={issue.id}
              className="flex items-center gap-2 border-b px-3 last:border-b-0"
              style={{ height: ROW_HEIGHT }}
            >
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={stateDotStyle(issue.state_id ? stateById.get(issue.state_id) : undefined)}
              />
              <Link to={issueUrl(issue.id)} className="truncate text-sm hover:underline">
                {issue.name}
              </Link>
            </div>
          ))}
        </div>

        <ScrollArea className="flex-1">
          <div style={{ width: dayCount * dayPx }}>
            <div className="bg-muted/50 flex h-10 border-b">
              {days.map((day, index) => (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'text-muted-foreground shrink-0 border-r text-center text-[10px] leading-tight',
                    day.getDay() === 0 || day.getDay() === 6 ? 'bg-muted/60' : '',
                  )}
                  style={{ width: dayPx }}
                >
                  {(index === 0 || day.getDate() === 1) && (
                    <div className="text-foreground pt-1 font-medium">
                      {monthFormatter.format(day)}
                    </div>
                  )}
                  <div className={index === 0 || day.getDate() === 1 ? '' : 'pt-4'}>
                    {dayFormatter.format(day)}
                  </div>
                </div>
              ))}
            </div>

            <div className="relative">
              {todayOffset >= 0 && todayOffset < dayCount && (
                <div
                  aria-hidden="true"
                  className="bg-primary/60 absolute top-0 bottom-0 w-px"
                  style={{ left: todayOffset * dayPx + dayPx / 2 }}
                />
              )}
              {dated.map((issue) => {
                const start = parseDay(issue.start_date!);
                const end = parseDay(issue.target_date!);
                const active = drag?.issueId === issue.id ? drag : null;
                const moveDelta = active?.mode === 'move' ? active.deltaDays : 0;
                const startDelta = active?.mode === 'start' ? active.deltaDays : 0;
                const endDelta = active?.mode === 'end' ? active.deltaDays : 0;
                const offset =
                  Math.round((start.getTime() - windowStart.getTime()) / DAY_MS) +
                  moveDelta +
                  startDelta;
                const span = Math.max(
                  1,
                  Math.round((end.getTime() - start.getTime()) / DAY_MS) +
                    1 +
                    endDelta -
                    startDelta,
                );
                const state = issue.state_id ? stateById.get(issue.state_id) : undefined;
                return (
                  <div
                    key={issue.id}
                    className="relative border-b last:border-b-0"
                    style={{ height: ROW_HEIGHT }}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            'group absolute top-1.5 flex h-6 items-center rounded-md text-xs font-medium text-white select-none',
                            active ? 'cursor-grabbing' : 'cursor-grab',
                          )}
                          style={{
                            left: offset * dayPx,
                            width: span * dayPx - 4,
                            backgroundColor: state?.color || 'var(--primary)',
                          }}
                          onPointerDown={startBarDrag(issue, 'move')}
                        >
                          <span
                            role="separator"
                            aria-label={t('gantt.dragStart', 'Change start date')}
                            className="h-full w-2 shrink-0 cursor-ew-resize rounded-l-md bg-black/20 opacity-0 group-hover:opacity-100"
                            onPointerDown={startBarDrag(issue, 'start')}
                          />
                          <Link
                            to={issueUrl(issue.id)}
                            className="min-w-0 flex-1 truncate px-1 text-white no-underline"
                            onClick={(event) => {
                              if (active?.moved) event.preventDefault();
                            }}
                          >
                            {issue.name}
                          </Link>
                          <span
                            role="separator"
                            aria-label={t('gantt.dragEnd', 'Change due date')}
                            className="h-full w-2 shrink-0 cursor-ew-resize rounded-r-md bg-black/20 opacity-0 group-hover:opacity-100"
                            onPointerDown={startBarDrag(issue, 'end')}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        {formatDate(issue.start_date)} – {formatDate(issue.target_date)}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                );
              })}
            </div>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {undated.length > 0 && (
        <div className="rounded-xl border p-3">
          <p className="text-muted-foreground mb-2 text-xs font-medium">
            {t('gantt.unscheduled', 'Missing a start or due date')}
          </p>
          <ul className="flex flex-wrap gap-2">
            {undated.map((issue) => (
              <li key={issue.id}>
                <Link
                  to={issueUrl(issue.id)}
                  className="bg-card hover:bg-accent block max-w-64 truncate rounded-md border px-2 py-1 text-xs"
                >
                  {issue.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
