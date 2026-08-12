import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar, Badge, Button, Modal } from '../components/ui';
import { UpdateCycleModal } from '../components/UpdateCycleModal';
import { cycleService } from '../services/cycleService';
import { CycleBurndownChart } from '../components/cycles/CycleBurndownChart';
import type { CycleApiResponse } from '../api/types';
import type { Priority } from '../types';
import { PROJECT_CYCLES_REFRESH_EVENT } from '../lib/projectCyclesEvents';
import { useProjectCyclesController } from '../hooks/useProjectCyclesController';
import { parseISODateForDisplay } from '../lib/dateOnly';
import { cn, getImageUrl } from '../lib/utils';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
const MONTH_ABBR = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function formatCycleDateRange(c: CycleApiResponse): string | null {
  const startRaw = c.start_date?.trim();
  const endRaw = c.end_date?.trim();
  if (!startRaw && !endRaw) return null;
  const parse = (iso: string) => {
    const d = parseISODateForDisplay(iso);
    if (!d) return null;
    return { m: d.getMonth(), d: d.getDate(), y: d.getFullYear() };
  };
  if (startRaw && endRaw) {
    const s = parse(startRaw);
    const e = parse(endRaw);
    if (!s || !e) return null;
    if (s.y === e.y && s.m === e.m) {
      return `${MONTH_ABBR[s.m]} ${pad2(s.d)} - ${pad2(e.d)}, ${s.y}`;
    }
    if (s.y === e.y) {
      return `${MONTH_ABBR[s.m]} ${pad2(s.d)} - ${MONTH_ABBR[e.m]} ${pad2(e.d)}, ${s.y}`;
    }
    return `${MONTH_ABBR[s.m]} ${pad2(s.d)}, ${s.y} - ${MONTH_ABBR[e.m]} ${pad2(e.d)}, ${e.y}`;
  }
  const single = parse((startRaw ?? endRaw)!);
  if (!single) return null;
  return `${MONTH_ABBR[single.m]} ${pad2(single.d)}, ${single.y}`;
}

function CycleProgressCircle({ progress }: { progress: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const stroke = Math.max(0, Math.min(100, progress)) / 100;
  return (
    <div className="relative flex size-10 shrink-0 items-center justify-center">
      <svg width="40" height="40" viewBox="0 0 40 40" className="-rotate-90" aria-hidden>
        <circle cx="20" cy="20" r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="3" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke="var(--brand-default)"
          strokeWidth="3"
          strokeDasharray={c}
          strokeDashoffset={c - stroke * c}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-[10px] font-medium text-(--txt-secondary)">{progress}%</span>
    </div>
  );
}

const priorityVariant: Record<Priority, 'danger' | 'warning' | 'default' | 'neutral'> = {
  urgent: 'danger',
  high: 'danger',
  medium: 'warning',
  low: 'default',
  none: 'neutral',
};

const IconTrendingUp = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    className="text-(--txt-icon-tertiary)"
    aria-hidden
  >
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);
const IconActivity = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    className="text-(--txt-icon-tertiary)"
    aria-hidden
  >
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);
const IconCycle = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className="text-(--warning-default)"
    aria-hidden
  >
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="3" x2="12" y2="9" />
  </svg>
);
const IconEye = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconBarChart = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    className="text-(--txt-icon-tertiary)"
    aria-hidden
  >
    <line x1="12" y1="20" x2="12" y2="10" />
    <line x1="18" y1="20" x2="18" y2="4" />
    <line x1="6" y1="20" x2="6" y2="16" />
  </svg>
);
const IconCalendar = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const IconStar = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);
const IconStarFilled = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);
const IconMoreVertical = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <circle cx="12" cy="5" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="12" cy="19" r="1.5" />
  </svg>
);
const IconChevronDown = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);
const IconChevronUp = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="m18 15-6-6-6 6" />
  </svg>
);
const IconIssueCount = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <rect width="8" height="8" x="3" y="3" rx="1" />
    <rect width="8" height="8" x="13" y="3" rx="1" />
    <rect width="8" height="8" x="3" y="13" rx="1" />
    <rect width="8" height="8" x="13" y="13" rx="1" />
  </svg>
);
const IconUsers = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export function CyclesPage() {
  const { t } = useTranslation();
  const { workspaceSlug, projectId } = useParams<{
    workspaceSlug: string;
    projectId: string;
  }>();
  const navigate = useNavigate();
  const [upcomingOpen, setUpcomingOpen] = useState(true);
  const [completedOpen, setCompletedOpen] = useState(true);
  const [activeCycleExpanded, setActiveCycleExpanded] = useState(true);
  const [activeCycleTab, setActiveCycleTab] = useState<'priority' | 'assignees' | 'labels'>(
    'priority',
  );
  const [ellipsisMenuOpenId, setEllipsisMenuOpenId] = useState<string | null>(null);
  const [editCycle, setEditCycle] = useState<CycleApiResponse | null>(null);
  const [deleteCycleId, setDeleteCycleId] = useState<string | null>(null);
  useDocumentTitle(t('cycles.documentTitle', 'Cycles'));

  /* Loading, filtering, grouping and the active cycle's statistics all live in
     the shared controller, so this page and the v2 preview show the same cycles
     under two designs rather than two implementations. */
  const {
    workspace,
    project,
    cycles,
    setCycles,
    members,
    labels,
    loading,
    upcomingCycles,
    completedCycles,
    activeCycles,
    activeCycle,
    activeCycleIssues,
    activeBurndownChart,
    activeBurndownTotal,
    activeCycleProgressStats,
    activeCycleAssigneeStats,
    activeCycleLabelStats,
    baseUrl,
    cyclePath,
    getIssueCount,
    getProgress,
    getStateName,
    getOwnerMember,
    isFavorite,
    toggleFavorite,
  } = useProjectCyclesController(workspaceSlug, projectId);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('[data-cycle-ellipsis-menu]')) setEllipsisMenuOpenId(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-(--txt-tertiary)">
        {t('common.loading', 'Loading…')}
      </div>
    );
  }
  if (!workspace || !project) {
    return (
      <div className="text-(--txt-secondary)">
        {t('common.projectNotFound', 'Project not found.')}
      </div>
    );
  }

  const renderCycleRow = (c: CycleApiResponse) => {
    const count = getIssueCount(c.id);
    const dateRange = formatCycleDateRange(c);
    const owner = getOwnerMember(c.owned_by_id);
    const path = cyclePath(c);
    const progress = getProgress(c);
    const isCompleted = c.status === 'completed';
    const canArchive = isCompleted;

    return (
      <div
        key={c.id}
        className="flex items-center gap-3 border-b border-(--border-subtle) last:border-b-0 px-4 py-2 hover:bg-(--bg-layer-1-hover)"
        role="button"
        tabIndex={0}
        onClick={() => navigate(path)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigate(path);
          }
        }}
      >
        <CycleProgressCircle progress={progress} />
        <div className="min-w-0 flex-1">
          <Link to={path} className="min-w-0 no-underline" title={c.name}>
            <p className="truncate font-medium text-(--txt-primary)">{c.name}</p>
          </Link>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 text-[13px] text-(--txt-secondary)">
          <IconIssueCount />
          {count}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-[13px] text-(--txt-secondary)">
          <IconCalendar />
          {dateRange ?? t('cycles.noDates', 'No dates')}
        </span>
        {owner ? (
          <Avatar
            name={owner.name}
            src={getImageUrl(owner.avatarUrl) ?? undefined}
            size="sm"
            className="h-8 w-8 shrink-0 text-xs"
          />
        ) : (
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded border border-(--border-subtle) border-dashed text-(--txt-icon-tertiary)"
            aria-hidden
          >
            <IconUsers />
          </span>
        )}
        <button
          type="button"
          className="flex size-8 shrink-0 items-center justify-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
          aria-label={
            isFavorite(c.id)
              ? t('common.removeFromFavorites', 'Remove from favorites')
              : t('common.addToFavorites', 'Add to favorites')
          }
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void toggleFavorite(c);
          }}
        >
          {isFavorite(c.id) ? (
            <span className="text-amber-500">
              <IconStarFilled />
            </span>
          ) : (
            <IconStar />
          )}
        </button>
        <div className="relative shrink-0" data-cycle-ellipsis-menu>
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
            aria-label={t('common.moreOptions', 'More options')}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setEllipsisMenuOpenId((cur) => (cur === c.id ? null : c.id));
            }}
          >
            <IconMoreVertical />
          </button>
          {ellipsisMenuOpenId === c.id && (
            <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setEllipsisMenuOpenId(null);
                  setEditCycle(c);
                }}
              >
                {t('common.edit', 'Edit')}
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open(path, '_blank', 'noopener,noreferrer');
                  setEllipsisMenuOpenId(null);
                }}
              >
                {t('common.openInNewTab', 'Open in new tab')}
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
                  } catch {
                    // ignore
                  }
                  setEllipsisMenuOpenId(null);
                }}
              >
                {t('common.copyLink', 'Copy link')}
              </button>
              <div className="my-1 border-t border-(--border-subtle)" />
              <button
                type="button"
                disabled={!canArchive}
                className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm text-(--txt-tertiary) disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>{t('common.archive', 'Archive')}</span>
                <span className="text-[11px] leading-tight">
                  {t('cycles.onlyCompletedArchivable', 'Only completed cycles can be archived.')}
                </span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setEllipsisMenuOpenId(null);
                  setDeleteCycleId(c.id);
                }}
              >
                {t('common.delete', 'Delete')}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  function formatShortDate(iso: string | null | undefined): string | null {
    const d = parseISODateForDisplay(iso);
    if (!d) return null;
    return `${MONTH_ABBR[d.getMonth()]} ${pad2(d.getDate())}`;
  }

  return (
    <div className="border-y border-(--border-subtle) border-x-0 rounded-none bg-(--bg-surface-1)">
      {/* Active cycle */}
      <section>
        <button
          type="button"
          onClick={() => setActiveCycleExpanded((e) => !e)}
          className="flex w-full min-h-[44px] items-center gap-2 bg-(--bg-layer-1-hover) px-4 py-2.5 text-left text-sm font-medium text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
        >
          <IconCycle />
          {activeCycles.length === 1
            ? t('cycles.activeCycle', 'Active cycle')
            : t('cycles.activeCycles', 'Active cycles')}
          <span className="ml-auto flex size-4 shrink-0 items-center justify-center text-(--txt-icon-tertiary)">
            {activeCycleExpanded ? <IconChevronUp /> : <IconChevronDown />}
          </span>
        </button>
        {activeCycleExpanded && activeCycles.length > 0 && (
          <>
            {/* Sub-header: progress ring, cycle name, More details, date range, timezone, avatar, favorite, menu */}
            <div className="flex flex-wrap items-center gap-3 border-t border-(--border-subtle) px-4 py-3">
              <CycleProgressCircle progress={activeCycleProgressStats.percentClosed} />
              <div className="min-w-0 flex-1">
                <span className="font-medium text-(--txt-primary)">{activeCycle.name}</span>
              </div>
              <Link
                to={cyclePath(activeCycle)}
                className="flex items-center gap-1.5 text-sm text-(--txt-secondary) hover:text-(--txt-primary)"
              >
                <IconEye />
                {t('cycles.moreDetails', 'More details')}
              </Link>
              <span className="text-[13px] text-(--txt-secondary)">
                {formatCycleDateRange(activeCycle) ?? t('cycles.noDates', 'No dates')}
              </span>
              <span className="text-[13px] text-(--txt-tertiary)">
                {project?.timezone ?? 'UTC'}
              </span>
              {getOwnerMember(activeCycle.owned_by_id) ? (
                <Avatar
                  name={getOwnerMember(activeCycle.owned_by_id)!.name}
                  src={getImageUrl(getOwnerMember(activeCycle.owned_by_id)!.avatarUrl) ?? undefined}
                  size="sm"
                  className="h-8 w-8 shrink-0 text-xs"
                />
              ) : (
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded border border-(--border-subtle) border-dashed text-(--txt-icon-tertiary)"
                  aria-hidden
                >
                  <IconUsers />
                </span>
              )}
              <button
                type="button"
                className="flex size-8 shrink-0 items-center justify-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
                aria-label={
                  isFavorite(activeCycle.id)
                    ? t('common.removeFromFavorites', 'Remove from favorites')
                    : t('common.addToFavorites', 'Add to favorites')
                }
                onClick={() => void toggleFavorite(activeCycle)}
              >
                {isFavorite(activeCycle.id) ? (
                  <span className="text-amber-500">
                    <IconStarFilled />
                  </span>
                ) : (
                  <IconStar />
                )}
              </button>
              <div className="relative shrink-0" data-cycle-ellipsis-menu>
                <button
                  type="button"
                  className="flex size-8 items-center justify-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
                  aria-label={t('common.moreOptions', 'More options')}
                  onClick={() =>
                    setEllipsisMenuOpenId((cur) => (cur === activeCycle.id ? null : activeCycle.id))
                  }
                >
                  <IconMoreVertical />
                </button>
                {ellipsisMenuOpenId === activeCycle.id && (
                  <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                      onClick={() => {
                        setEllipsisMenuOpenId(null);
                        setEditCycle(activeCycle);
                      }}
                    >
                      {t('common.edit', 'Edit')}
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                      onClick={() => {
                        window.open(cyclePath(activeCycle), '_blank', 'noopener,noreferrer');
                        setEllipsisMenuOpenId(null);
                      }}
                    >
                      {t('common.openInNewTab', 'Open in new tab')}
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            `${window.location.origin}${cyclePath(activeCycle)}`,
                          );
                        } catch {
                          /* ignore */
                        }
                        setEllipsisMenuOpenId(null);
                      }}
                    >
                      {t('common.copyLink', 'Copy link')}
                    </button>
                    <div className="my-1 border-t border-(--border-subtle)" />
                    <button
                      type="button"
                      disabled={activeCycle.status !== 'completed'}
                      className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm text-(--txt-tertiary) disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span>{t('common.archive', 'Archive')}</span>
                      <span className="text-[11px] leading-tight">
                        {t(
                          'cycles.onlyCompletedArchivable',
                          'Only completed cycles can be archived.',
                        )}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                      onClick={() => {
                        setEllipsisMenuOpenId(null);
                        setDeleteCycleId(activeCycle.id);
                      }}
                    >
                      {t('common.delete', 'Delete')}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Three cards */}
            <div className="grid gap-4 border-t border-(--border-subtle) p-4 sm:grid-cols-3">
              {/* Progress card */}
              <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-(--txt-primary)">
                    {t('cycles.progress.title', 'Progress')}
                  </h3>
                  <span className="text-xs text-(--txt-tertiary)">
                    {t(
                      'cycles.progress.workItemClosed',
                      '{{completed}}/{{total}} Work item closed',
                      {
                        completed: activeCycleProgressStats.completed,
                        total: activeCycleProgressStats.total,
                      },
                    )}
                  </span>
                </div>
                {activeCycleProgressStats.total > 0 ? (
                  <>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-(--bg-layer-2)">
                      <div className="flex h-full">
                        {activeCycleProgressStats.started > 0 && (
                          <div
                            className="bg-(--warning-default)"
                            style={{
                              width: `${(activeCycleProgressStats.started / activeCycleProgressStats.total) * 100}%`,
                            }}
                          />
                        )}
                        {activeCycleProgressStats.backlog > 0 && (
                          <div
                            className="bg-(--border-subtle)"
                            style={{
                              width: `${(activeCycleProgressStats.backlog / activeCycleProgressStats.total) * 100}%`,
                            }}
                          />
                        )}
                        {activeCycleProgressStats.completed > 0 && (
                          <div
                            className="bg-(--success-default)"
                            style={{
                              width: `${(activeCycleProgressStats.completed / activeCycleProgressStats.total) * 100}%`,
                            }}
                          />
                        )}
                      </div>
                    </div>
                    <ul className="mt-3 space-y-1.5 text-[13px]">
                      {activeCycleProgressStats.started > 0 && (
                        <li className="flex items-center gap-2">
                          <span className="size-2 rounded-full bg-(--warning-default)" />
                          {t('cycles.progress.started', 'Started {{count}} Work item{{plural}}', {
                            count: activeCycleProgressStats.started,
                            plural: activeCycleProgressStats.started !== 1 ? 's' : '',
                          })}
                        </li>
                      )}
                      {activeCycleProgressStats.backlog > 0 && (
                        <li className="flex items-center gap-2">
                          <span className="size-2 rounded-full bg-(--border-subtle)" />
                          {t('cycles.progress.backlog', 'Backlog {{count}} Work item{{plural}}', {
                            count: activeCycleProgressStats.backlog,
                            plural: activeCycleProgressStats.backlog !== 1 ? 's' : '',
                          })}
                        </li>
                      )}
                      {activeCycleProgressStats.completed > 0 && (
                        <li className="flex items-center gap-2">
                          <span className="size-2 rounded-full bg-(--success-default)" />
                          {t(
                            'cycles.progress.completed',
                            'Completed {{count}} Work item{{plural}}',
                            {
                              count: activeCycleProgressStats.completed,
                              plural: activeCycleProgressStats.completed !== 1 ? 's' : '',
                            },
                          )}
                        </li>
                      )}
                    </ul>
                  </>
                ) : (
                  <div className="mt-4 flex flex-col items-center justify-center py-6">
                    <IconTrendingUp />
                    <p className="mt-2 text-center text-sm text-(--txt-tertiary)">
                      {t(
                        'cycles.progress.empty',
                        'Add work items to the cycle to view its progress',
                      )}
                    </p>
                  </div>
                )}
              </div>

              {/* Burndown card */}
              <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-(--txt-primary)">
                    {t('cycles.burndown.title', 'Work item burndown')}
                  </h3>
                  <span className="text-xs text-(--txt-tertiary)">
                    {t('cycles.burndown.pending', 'Pending work items - {{count}}', {
                      count: activeCycleProgressStats.total - activeCycleProgressStats.completed,
                    })}
                  </span>
                </div>
                {activeCycleProgressStats.total > 0 ? (
                  <div className="mt-4">
                    <CycleBurndownChart
                      completionChart={activeBurndownChart ?? {}}
                      total={activeBurndownTotal}
                      startDate={activeCycle.start_date}
                      endDate={activeCycle.end_date}
                    />
                  </div>
                ) : (
                  <div className="mt-4 flex flex-col items-center justify-center py-6">
                    <IconActivity />
                    <p className="mt-2 text-center text-sm text-(--txt-tertiary)">
                      {t(
                        'cycles.burndown.empty',
                        'Add work items to the cycle to view the burndown chart.',
                      )}
                    </p>
                  </div>
                )}
              </div>

              {/* Stats card with tabs */}
              <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-4">
                <div className="flex gap-1 rounded-md bg-(--bg-layer-2) p-0.5">
                  {(['priority', 'assignees', 'labels'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveCycleTab(tab)}
                      className={cn(
                        'flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors',
                        activeCycleTab === tab
                          ? 'bg-(--bg-surface-1) text-(--txt-primary) shadow-sm'
                          : 'text-(--txt-tertiary) hover:text-(--txt-secondary)',
                      )}
                    >
                      {tab === 'priority' && t('cycles.tabs.priority', 'Priority work items')}
                      {tab === 'assignees' && t('cycles.tabs.assignees', 'Assignees')}
                      {tab === 'labels' && t('cycles.tabs.labels', 'Labels')}
                    </button>
                  ))}
                </div>
                <div className="mt-3 min-h-[120px]">
                  {activeCycleTab === 'priority' && (
                    <>
                      {activeCycleIssues.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6">
                          <IconBarChart />
                          <p className="mt-2 text-center text-sm text-(--txt-tertiary)">
                            {t(
                              'cycles.tabs.priorityEmpty',
                              'Add work items to view priority breakdown.',
                            )}
                          </p>
                        </div>
                      ) : (
                        <ul className="space-y-2">
                          {[...activeCycleIssues]
                            .sort((a, b) => {
                              const pr = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
                              return (
                                (pr[(a.priority as Priority) ?? 'none'] ?? 99) -
                                (pr[(b.priority as Priority) ?? 'none'] ?? 99)
                              );
                            })
                            .map((issue) => (
                              <li key={issue.id}>
                                <Link
                                  to={`${baseUrl}/issues/${issue.id}`}
                                  className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-(--bg-layer-1-hover)"
                                >
                                  <span className="min-w-0 flex-1 truncate text-(--txt-primary)">
                                    {issue.name}
                                  </span>
                                  <Badge
                                    variant={
                                      priorityVariant[(issue.priority as Priority) ?? 'none']
                                    }
                                    className="!px-1.5 !py-0 text-[10px] shrink-0"
                                  >
                                    {issue.priority ?? '—'}
                                  </Badge>
                                  <Badge
                                    variant="neutral"
                                    className="!px-1.5 !py-0 text-[10px] shrink-0"
                                  >
                                    {getStateName(issue.state_id)}
                                  </Badge>
                                  {issue.target_date && (
                                    <span className="flex items-center gap-1 text-[11px] text-(--txt-tertiary) shrink-0">
                                      <IconCalendar />
                                      {formatShortDate(issue.target_date)}
                                    </span>
                                  )}
                                </Link>
                              </li>
                            ))}
                        </ul>
                      )}
                    </>
                  )}
                  {activeCycleTab === 'assignees' && (
                    <>
                      {activeCycleAssigneeStats.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6">
                          <IconUsers />
                          <p className="mt-2 text-center text-sm text-(--txt-tertiary)">
                            {t('cycles.tabs.assigneesEmpty', 'No assignees in this cycle.')}
                          </p>
                        </div>
                      ) : (
                        <ul className="space-y-2">
                          {activeCycleAssigneeStats.map((s) => {
                            const member = s.memberId
                              ? members.find((m) => m.member_id === s.memberId)
                              : null;
                            const name =
                              member?.member_display_name?.trim() ??
                              member?.member_email?.split('@')[0] ??
                              (s.memberId
                                ? s.memberId.slice(0, 8)
                                : t('cycles.unassigned', 'Unassigned'));
                            return (
                              <li
                                key={s.memberId ?? '__unassigned__'}
                                className="flex items-center justify-between gap-2"
                              >
                                <div className="flex min-w-0 items-center gap-2">
                                  {s.memberId ? (
                                    <Avatar
                                      name={name}
                                      src={getImageUrl(member?.member_avatar ?? null) ?? undefined}
                                      size="sm"
                                      className="h-6 w-6 shrink-0 text-[10px]"
                                    />
                                  ) : (
                                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-(--bg-layer-2) text-(--txt-icon-tertiary)">
                                      <IconUsers />
                                    </span>
                                  )}
                                  <span className="truncate text-sm text-(--txt-primary)">
                                    {name}
                                  </span>
                                </div>
                                <span className="shrink-0 text-[13px] text-(--txt-secondary)">
                                  {t('cycles.percentOf', '{{percent}}% of {{total}}', {
                                    percent: s.percent,
                                    total: s.total,
                                  })}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </>
                  )}
                  {activeCycleTab === 'labels' && (
                    <>
                      {activeCycleLabelStats.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6">
                          <IconBarChart />
                          <p className="mt-2 text-center text-sm text-(--txt-tertiary)">
                            {t('cycles.tabs.labelsEmpty', 'No labels in this cycle.')}
                          </p>
                        </div>
                      ) : (
                        <ul className="space-y-2">
                          {activeCycleLabelStats.map((s) => {
                            const label = s.labelId ? labels.find((l) => l.id === s.labelId) : null;
                            const name =
                              label?.name ??
                              (s.labelId
                                ? t('cycles.unknownLabel', 'Unknown')
                                : t('cycles.noLabels', 'No labels'));
                            const color = label?.color ?? '#6b7280';
                            return (
                              <li
                                key={s.labelId ?? '__no_label__'}
                                className="flex items-center justify-between gap-2"
                              >
                                <div className="flex min-w-0 items-center gap-2">
                                  <span
                                    className="size-3 shrink-0 rounded-full"
                                    style={{ backgroundColor: color }}
                                  />
                                  <span className="truncate text-sm text-(--txt-primary)">
                                    {name}
                                  </span>
                                </div>
                                <span className="shrink-0 text-[13px] text-(--txt-secondary)">
                                  {t('cycles.percentOf', '{{percent}}% of {{total}}', {
                                    percent: s.percent,
                                    total: s.total,
                                  })}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
            {activeCycles.length > 1 && (
              <div className="border-t border-(--border-subtle) px-4 py-3">
                <p className="mb-2 text-[13px] font-medium text-(--txt-secondary)">
                  {t('cycles.alsoInProgress', 'Also in progress:')}
                </p>
                <ul className="space-y-1.5">
                  {activeCycles.slice(1).map((c) => (
                    <li key={c.id}>
                      <Link
                        to={cyclePath(c)}
                        className="flex items-center gap-2 text-sm text-(--txt-secondary) hover:text-(--txt-primary)"
                      >
                        <span>{c.name}</span>
                        <span className="text-[12px] text-(--txt-tertiary)">
                          {formatCycleDateRange(c) ?? t('cycles.noDates', 'No dates')}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      {/* Upcoming cycle */}
      <section className="border-t border-(--border-subtle)">
        <button
          type="button"
          onClick={() => setUpcomingOpen((o) => !o)}
          className="flex min-h-[44px] w-full items-center gap-2 bg-(--bg-layer-1-hover) px-4 py-2.5 text-left text-sm font-medium text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
        >
          <span className="flex h-2 w-2 rounded-full border-2 border-dashed border-(--brand-default) bg-transparent" />
          {t('cycles.upcomingCycle', 'Upcoming cycle {{count}}', { count: upcomingCycles.length })}
          <span className="ml-auto">{upcomingOpen ? <IconChevronUp /> : <IconChevronDown />}</span>
        </button>
        {upcomingOpen && (
          <div>
            {upcomingCycles.length === 0 ? (
              <p className="py-4 pl-4 text-sm text-(--txt-tertiary)">
                {t('cycles.noUpcoming', 'No upcoming cycles.')}
              </p>
            ) : (
              upcomingCycles.map((c) => renderCycleRow(c))
            )}
          </div>
        )}
      </section>

      {/* Completed cycle */}
      <section className="border-t border-(--border-subtle)">
        <button
          type="button"
          onClick={() => setCompletedOpen((o) => !o)}
          className="flex min-h-[44px] w-full items-center gap-2 bg-(--bg-layer-1-hover) px-4 py-2.5 text-left text-sm font-medium text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
        >
          <span className="flex h-2 w-2 rounded-full bg-(--success-default)" />
          {t('cycles.completedCycle', 'Completed cycle {{count}}', {
            count: completedCycles.length,
          })}
          <span className="ml-auto">{completedOpen ? <IconChevronUp /> : <IconChevronDown />}</span>
        </button>
        {completedOpen && (
          <div>
            {completedCycles.length === 0 ? (
              <p className="py-4 pl-4 text-sm text-(--txt-tertiary)">
                {t('cycles.noCompleted', 'No completed cycles.')}
              </p>
            ) : (
              completedCycles.map((c) => renderCycleRow(c))
            )}
          </div>
        )}
      </section>

      <UpdateCycleModal
        open={editCycle !== null}
        onClose={() => setEditCycle(null)}
        workspaceSlug={workspaceSlug!}
        projectId={projectId!}
        cycle={editCycle}
        onUpdated={(updated) => {
          setCycles((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          window.dispatchEvent(
            new CustomEvent(PROJECT_CYCLES_REFRESH_EVENT, {
              detail: { workspaceSlug, projectId },
            }),
          );
        }}
      />

      <DeleteCycleConfirm
        open={!!deleteCycleId}
        cycleName={
          cycles.find((c) => c.id === deleteCycleId)?.name ?? t('cycles.cycleFallbackName', 'Cycle')
        }
        onClose={() => setDeleteCycleId(null)}
        onConfirm={async () => {
          if (!workspaceSlug || !projectId || !deleteCycleId) return;
          try {
            await cycleService.delete(workspaceSlug, projectId, deleteCycleId);
            setCycles((prev) => prev.filter((c) => c.id !== deleteCycleId));
            window.dispatchEvent(
              new CustomEvent(PROJECT_CYCLES_REFRESH_EVENT, {
                detail: { workspaceSlug, projectId },
              }),
            );
          } catch {
            // ignore
          }
          setDeleteCycleId(null);
        }}
      />
    </div>
  );
}

function DeleteCycleConfirm({
  open,
  cycleName,
  onClose,
  onConfirm,
}: {
  open: boolean;
  cycleName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState(false);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('cycles.deleteConfirmTitle', 'Delete "{{name}}"?', { name: cycleName })}
      className="max-w-sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={deleting}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              setDeleting(true);
              await onConfirm();
              setDeleting(false);
            }}
            disabled={deleting}
          >
            {deleting ? t('common.deleting', 'Deleting…') : t('common.delete', 'Delete')}
          </Button>
        </>
      }
    >
      <p className="text-sm text-(--txt-secondary)">
        {t('cycles.deleteCannotUndo', 'This cannot be undone.')}
      </p>
    </Modal>
  );
}
