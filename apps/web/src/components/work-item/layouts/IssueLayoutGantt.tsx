import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { PriorityIcon } from '../IssueRowCells';
import type { Priority } from '../../../types';
import type { IssueApiResponse } from '../../../api/types';
import { issueDisplayId, type IssueLayoutProps } from './IssueLayoutTypes';

const DAY_MS = 24 * 3600 * 1000;
// Zoom levels: pixels per day. The middle value matches the previous fixed size.
const ZOOM_LEVELS = [14, 20, 28, 40, 56];
const DEFAULT_ZOOM = 2;
// Pointer movement (px) beyond which a gesture counts as a drag, not a click.
const DRAG_THRESHOLD_PX = 4;

type DragMode = 'move' | 'start' | 'end';
interface DragState {
  id: string;
  mode: DragMode;
  startClientX: number;
  origStart: number;
  origEnd: number;
  deltaDays: number;
  moved: boolean;
}

/**
 * Interactive Gantt — a horizontal timeline of bars positioned by start_date and
 * target_date. Issues without both dates fall into a sidebar "Undated" list.
 *
 * Interactions (#180):
 *   - Zoom the day scale in/out with the toolbar controls.
 *   - Pan the window by ±7 days with the prev/next controls.
 *   - Drag a bar to reschedule (moves start + target together); drag either edge
 *     to change just the start or the target. Commits via onUpdateIssue on drop.
 *     Dependency lines are a planned follow-up.
 */
export function IssueLayoutGantt({
  project,
  states,
  issues,
  issueHref,
  now,
  projectsById,
  onUpdateIssue,
}: IssueLayoutProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const stateById = useMemo(() => new Map(states.map((s) => [s.id, s])), [states]);

  const dated = useMemo(
    () => issues.filter((i) => Boolean(i.start_date) && Boolean(i.target_date)),
    [issues],
  );
  const undated = useMemo(() => issues.filter((i) => !i.start_date || !i.target_date), [issues]);

  const [shiftDays, setShiftDays] = useState(0);
  const [zoomIdx, setZoomIdx] = useState(DEFAULT_ZOOM);
  const dayPx = ZOOM_LEVELS[zoomIdx];
  const canEdit = Boolean(onUpdateIssue);

  const viewWindow = useMemo(() => {
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

  const totalDays = Math.max(1, Math.round((viewWindow.end - viewWindow.start) / DAY_MS) + 1);
  const days = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i < totalDays; i++) arr.push(viewWindow.start + i * DAY_MS);
    return arr;
  }, [viewWindow.start, totalDays]);

  const todayMs = startOfDay(new Date(now)).getTime();
  const todayOffset = Math.round((todayMs - viewWindow.start) / DAY_MS);

  // The active drag lives in a ref (so the window listeners read live values
  // without re-subscribing), mirrored into state so the render — which must not
  // read a ref — can preview the bar's new position.
  const dragRef = useRef<DragState | null>(null);
  const [dragPreview, setDragPreview] = useState<{
    id: string;
    mode: DragMode;
    deltaDays: number;
  } | null>(null);
  // issueHref is captured in a ref so the pointer-up navigation doesn't force the
  // window listeners to re-subscribe when the prop's identity changes.
  const issueHrefRef = useRef(issueHref);
  useEffect(() => {
    issueHrefRef.current = issueHref;
  }, [issueHref]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      // "moved" is a pixel threshold on the whole gesture, independent of the
      // day-snap, so a small drag is still treated as a drag (not a click) and
      // a sub-day drag doesn't navigate.
      if (Math.abs(e.clientX - d.startClientX) > DRAG_THRESHOLD_PX) d.moved = true;
      const deltaDays = Math.round((e.clientX - d.startClientX) / dayPx);
      if (deltaDays !== d.deltaDays) {
        d.deltaDays = deltaDays;
        setDragPreview({ id: d.id, mode: d.mode, deltaDays });
      }
    };
    const onUp = () => {
      const d = dragRef.current;
      if (!d) return;
      dragRef.current = null;
      if (d.moved) {
        // A real drag: commit the reschedule (if it landed on a different day).
        if (onUpdateIssue && d.deltaDays !== 0) {
          const { start, end } = applyDragDelta(d.mode, d.deltaDays, d.origStart, d.origEnd);
          const patch: { start_date?: string; target_date?: string } = {};
          if (d.mode !== 'end') patch.start_date = fmtDay(start);
          if (d.mode !== 'start') patch.target_date = fmtDay(end);
          onUpdateIssue(d.id, patch);
        }
      } else {
        // A click (no meaningful movement): open the work item. Handling it here,
        // in the same gesture, avoids a lingering suppress-click flag.
        navigate(issueHrefRef.current(d.id));
      }
      setDragPreview(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dayPx, onUpdateIssue, navigate]);

  const beginDrag = (e: React.PointerEvent, issue: IssueApiResponse, mode: DragMode) => {
    if (!canEdit || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const origStart = parseDay(issue.start_date!) ?? viewWindow.start;
    const origEnd = parseDay(issue.target_date!) ?? origStart;
    dragRef.current = {
      id: issue.id,
      mode,
      startClientX: e.clientX,
      origStart,
      origEnd,
      deltaDays: 0,
      moved: false,
    };
    setDragPreview({ id: issue.id, mode, deltaDays: 0 });
  };

  return (
    <div className="space-y-3 px-4 py-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShiftDays((s) => s - 7)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-(--radius-md) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
          aria-label={t('workItem.gantt.earlier', 'Earlier')}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setShiftDays((s) => s + 7)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-(--radius-md) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
          aria-label={t('workItem.gantt.later', 'Later')}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <h2 className="text-sm font-semibold text-(--txt-primary)">
          {fmtRange(viewWindow.start, viewWindow.end)}
        </h2>
        <button
          type="button"
          className="ml-2 rounded-(--radius-md) border border-(--border-subtle) px-2 py-0.5 text-[11px] text-(--txt-secondary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
          onClick={() => setShiftDays(0)}
        >
          {t('common.reset', 'Reset')}
        </button>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoomIdx((z) => Math.max(0, z - 1))}
            disabled={zoomIdx === 0}
            className="inline-flex h-7 w-7 items-center justify-center rounded-(--radius-md) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary) disabled:opacity-40"
            aria-label={t('common.zoomOut', 'Zoom out')}
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoomIdx((z) => Math.min(ZOOM_LEVELS.length - 1, z + 1))}
            disabled={zoomIdx === ZOOM_LEVELS.length - 1}
            className="inline-flex h-7 w-7 items-center justify-center rounded-(--radius-md) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary) disabled:opacity-40"
            aria-label={t('common.zoomIn', 'Zoom in')}
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <span className="ml-1 text-[11px] text-(--txt-tertiary)">
            {t('workItem.gantt.datedUndated', '{{dated}} dated · {{undated}} undated', {
              dated: dated.length,
              undated: undated.length,
            })}
          </span>
        </div>
      </div>

      {dated.length === 0 ? (
        <p className="rounded-(--radius-md) border border-dashed border-(--border-subtle) bg-(--bg-surface-1) px-3 py-6 text-center text-sm text-(--txt-tertiary)">
          {t(
            'workItem.gantt.empty',
            'No work items have both a start and a target date. Add dates to plot bars on the timeline.',
          )}
        </p>
      ) : (
        <div className="overflow-auto rounded-(--radius-md) border border-(--border-subtle)">
          <div className="flex min-w-max">
            {/* Sticky sidebar: id + name */}
            <div className="sticky left-0 z-10 w-64 shrink-0 border-r border-(--border-subtle) bg-(--bg-surface-1)">
              <div className="h-9 border-b border-(--border-subtle) px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-(--txt-tertiary)">
                {t('common.workItem', 'Work item')}
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
                        {issueDisplayId(issue, project, projectsById)}
                      </span>
                      <span className="truncate">{issue.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Timeline */}
            <div className="relative" style={{ width: `${totalDays * dayPx}px` }}>
              {/* Day-cell header */}
              <div className="flex h-9 border-b border-(--border-subtle) bg-(--bg-surface-1)">
                {days.map((ms, i) => {
                  const d = new Date(ms);
                  const isMonthStart = d.getDate() === 1 || i === 0;
                  return (
                    <div
                      key={ms}
                      className="flex flex-col items-center justify-center border-r border-(--border-subtle) text-[10px] text-(--txt-tertiary)"
                      style={{ width: `${dayPx}px` }}
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
                  style={{ left: `${todayOffset * dayPx + dayPx / 2}px` }}
                  aria-hidden
                />
              )}

              {/* Bars */}
              <ul>
                {dated.map((issue) => {
                  let start = parseDay(issue.start_date!) ?? viewWindow.start;
                  let end = parseDay(issue.target_date!) ?? start;
                  const dragging = dragPreview?.id === issue.id;
                  if (dragging && dragPreview.deltaDays !== 0) {
                    const preview = applyDragDelta(
                      dragPreview.mode,
                      dragPreview.deltaDays,
                      start,
                      end,
                    );
                    start = preview.start;
                    end = preview.end;
                  }
                  // Intersect the bar with the visible window. A bar with no
                  // overlap renders as an empty row (keeping alignment with the
                  // sidebar) rather than being pinned to the first column.
                  const visible = end >= viewWindow.start && start <= viewWindow.end;
                  const clippedStart = Math.max(start, viewWindow.start);
                  const clippedEnd = Math.min(end, viewWindow.end);
                  const offset = Math.round((clippedStart - viewWindow.start) / DAY_MS);
                  const span = Math.max(1, Math.round((clippedEnd - clippedStart) / DAY_MS) + 1);
                  const state = issue.state_id ? (stateById.get(issue.state_id) ?? null) : null;
                  const color = state?.color || '#6b7280';
                  return (
                    <li key={issue.id} className="relative h-8 border-b border-(--border-subtle)">
                      {visible && (
                        <div
                          role="button"
                          tabIndex={0}
                          onPointerDown={canEdit ? (e) => beginDrag(e, issue, 'move') : undefined}
                          onClick={canEdit ? undefined : () => navigate(issueHref(issue.id))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              navigate(issueHref(issue.id));
                            }
                          }}
                          className={`absolute top-1.5 flex h-5 items-center overflow-hidden rounded-(--radius-md) text-[11px] font-medium text-white shadow-sm transition-opacity ${
                            dragging ? 'opacity-90' : 'hover:opacity-80'
                          } ${canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
                          style={{
                            left: `${offset * dayPx + 2}px`,
                            width: `${span * dayPx - 4}px`,
                            backgroundColor: color,
                          }}
                          title={`${issue.name} · ${fmtDay(start)} → ${fmtDay(end)}`}
                        >
                          {canEdit && (
                            <span
                              onPointerDown={(e) => beginDrag(e, issue, 'start')}
                              className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize bg-black/15 opacity-0 hover:opacity-100"
                              aria-hidden
                            />
                          )}
                          <span className="truncate px-2">{issue.name}</span>
                          {canEdit && (
                            <span
                              onPointerDown={(e) => beginDrag(e, issue, 'end')}
                              className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize bg-black/15 opacity-0 hover:opacity-100"
                              aria-hidden
                            />
                          )}
                        </div>
                      )}
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
            {t('workItem.gantt.undated', 'Undated · {{count}}', { count: undated.length })}
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
                    {issue.start_date ? '' : t('workItem.gantt.noStart', 'no start · ')}
                    {issue.target_date ? '' : t('workItem.gantt.noTarget', 'no target')}
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

// applyDragDelta resolves a drag's previewed [start, end] day timestamps,
// clamping so a resized edge never crosses the opposite edge.
function applyDragDelta(
  mode: DragMode,
  deltaDays: number,
  origStart: number,
  origEnd: number,
): { start: number; end: number } {
  const shift = deltaDays * DAY_MS;
  if (mode === 'move') return { start: origStart + shift, end: origEnd + shift };
  if (mode === 'start') return { start: Math.min(origStart + shift, origEnd), end: origEnd };
  return { start: origStart, end: Math.max(origEnd + shift, origStart) };
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseDay(input: string): number | null {
  // Dates arrive as "YYYY-MM-DD" or a UTC-midnight ISO timestamp. Take the
  // leading date parts and build a local-midnight date, so the day doesn't
  // shift for clients behind UTC. Routing the value through Date.parse +
  // new Date reads local components off a UTC instant and lands on the previous
  // day in the Americas (the calendar layout avoids this the same way).
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(input);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// Format a day timestamp as YYYY-MM-DD (local components), matching how the
// calendar layout sends date patches.
function fmtDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
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
