import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Avatar } from '../components/ui';
import { workspaceService } from '../services/workspaceService';
import { projectService } from '../services/projectService';
import { cycleService } from '../services/cycleService';
import type { WorkspaceApiResponse, ProjectApiResponse, CycleApiResponse } from '../api/types';
import { PROJECT_CYCLES_FILTER_EVENT } from '../lib/projectCyclesEvents';
import { parseISODateLocal } from '../lib/dateOnly';

type CycleStatusFilterKey = 'in_progress' | 'yet_to_start' | 'completed' | 'draft';
type DatePresetFilterKey = '1_week' | '2_weeks' | '1_month' | '2_months' | 'custom';

interface CyclesFiltersState {
  statusKeys: CycleStatusFilterKey[];
  startDatePresets: DatePresetFilterKey[];
  dueDatePresets: DatePresetFilterKey[];
  startAfter: string | null;
  startBefore: string | null;
  dueAfter: string | null;
  dueBefore: string | null;
}

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

export function CyclesPage() {
  const { workspaceSlug, projectId } = useParams<{
    workspaceSlug: string;
    projectId: string;
  }>();
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(true);
  const [draftOpen, setDraftOpen] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [cycles, setCycles] = useState<CycleApiResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState<CyclesFiltersState>({
    statusKeys: [],
    startDatePresets: [],
    dueDatePresets: [],
    startAfter: null,
    startBefore: null,
    dueAfter: null,
    dueBefore: null,
  });

  useEffect(() => {
    if (!workspaceSlug || !projectId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset loading when no slug/project (kept for future use)
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      workspaceService.getBySlug(workspaceSlug),
      projectService.get(workspaceSlug, projectId),
      cycleService.list(workspaceSlug, projectId),
    ])
      .then(([w, p, list]) => {
        if (!cancelled) {
          setWorkspace(w ?? null);
          setProject(p ?? null);
          setCycles(list ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWorkspace(null);
          setProject(null);
          setCycles([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId]);

  useEffect(() => {
    if (!workspaceSlug || !projectId) return;

    const handler = (e: Event) => {
      const ce = e as CustomEvent<{
        workspaceSlug?: string;
        projectId?: string;
        filters?: Partial<CyclesFiltersState>;
      }>;
      const d = ce.detail;
      if (
        !d?.workspaceSlug ||
        !d?.projectId ||
        d.workspaceSlug !== workspaceSlug ||
        d.projectId !== projectId
      ) {
        return;
      }
      const next = d.filters;
      if (!next) return;

      setFilters((prev) => ({
        ...prev,
        statusKeys: (next.statusKeys ?? prev.statusKeys) as CycleStatusFilterKey[],
        startDatePresets: (next.startDatePresets ?? prev.startDatePresets) as DatePresetFilterKey[],
        dueDatePresets: (next.dueDatePresets ?? prev.dueDatePresets) as DatePresetFilterKey[],
        startAfter: next.startAfter ?? prev.startAfter,
        startBefore: next.startBefore ?? prev.startBefore,
        dueAfter: next.dueAfter ?? prev.dueAfter,
        dueBefore: next.dueBefore ?? prev.dueBefore,
      }));
    };

    window.addEventListener(PROJECT_CYCLES_FILTER_EVENT, handler as EventListener);
    return () => window.removeEventListener(PROJECT_CYCLES_FILTER_EVENT, handler as EventListener);
  }, [workspaceSlug, projectId]);

  const filteredCycles = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const groupStatuses: Record<CycleStatusFilterKey, string[]> = {
      in_progress: ['started', 'current'],
      yet_to_start: ['upcoming'],
      completed: ['completed'],
      draft: ['draft'],
    };

    const presetDays: Record<DatePresetFilterKey, number | null> = {
      '1_week': 7,
      '2_weeks': 14,
      '1_month': 30,
      '2_months': 60,
      custom: null,
    };

    const inRange = (date: Date, rangeStartMs: number, rangeEndMs: number) => {
      const t = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      return t >= rangeStartMs && t <= rangeEndMs;
    };

    const matchesPresetUnion = (
      dateIso: string | null | undefined,
      selectedPresets: DatePresetFilterKey[],
      customAfter: string | null,
      customBefore: string | null,
    ) => {
      // Empty selection means "no filtering" (match Plane behavior).
      if (selectedPresets.length === 0) return true;
      if (!dateIso) return false;

      const date = parseISODateLocal(dateIso);

      const ranges: Array<{ start: number; end: number }> = [];
      for (const p of selectedPresets) {
        if (p === 'custom') {
          if (!customAfter || !customBefore) continue;
          const a = parseISODateLocal(customAfter);
          const b = parseISODateLocal(customBefore);
          const aMs = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
          const bMs = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
          ranges.push({ start: Math.min(aMs, bMs), end: Math.max(aMs, bMs) });
        } else {
          const days = presetDays[p];
          if (days == null) continue;
          ranges.push({
            start: startOfToday,
            end: startOfToday + days * 24 * 60 * 60 * 1000,
          });
        }
      }

      if (ranges.length === 0) return false;
      return ranges.some((r) => inRange(date, r.start, r.end));
    };

    const matchesStatus = (c: CycleApiResponse) => {
      if (filters.statusKeys.length === 0) return true;
      return filters.statusKeys.some((k) => groupStatuses[k]?.includes(c.status));
    };

    return cycles.filter((c) => {
      return (
        matchesStatus(c) &&
        matchesPresetUnion(
          c.start_date,
          filters.startDatePresets,
          filters.startAfter,
          filters.startBefore,
        ) &&
        matchesPresetUnion(c.end_date, filters.dueDatePresets, filters.dueAfter, filters.dueBefore)
      );
    });
  }, [cycles, filters]);

  const activeCycle = filteredCycles.find((c) => c.status === 'started' || c.status === 'current');
  const upcomingCycles = filteredCycles.filter((c) => c.status === 'upcoming');
  const draftCycles = filteredCycles.filter((c) => c.status === 'draft');
  const completedCycles = filteredCycles.filter((c) => c.status === 'completed');

  const getIssueCount = (cycleId: string) => cycles.find((c) => c.id === cycleId)?.issue_count ?? 0;
  const getUser = (userId: string | null): { name: string; avatarUrl?: string | null } | null => {
    void userId; // reserved for future assignee display
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-(--txt-tertiary)">
        Loading…
      </div>
    );
  }
  if (!workspace || !project) {
    return <div className="text-(--txt-secondary)">Project not found.</div>;
  }

  const baseUrl = `/${workspace.slug}/projects/${project.id}`;
  const formatDateRange = (start: string, end: string) =>
    `${new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <div className="space-y-8">
      {/* Active cycle */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-(--txt-primary)">
          <span className="flex h-2.5 w-2.5 rounded-full bg-(--warning-default)" aria-hidden />
          Active cycle
        </h2>
        {activeCycle ? (
          <div className="space-y-4">
            <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-(--txt-primary)">{activeCycle.name}</p>
                  <p className="mt-0.5 text-sm text-(--txt-secondary)">
                    {Math.round(
                      (getIssueCount(activeCycle.id) / Math.max(1, getIssueCount(activeCycle.id))) *
                        0,
                    )}
                    % completion
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-(--txt-secondary)">
                  <Link
                    to={`${baseUrl}/cycles/${activeCycle.id}`}
                    className="flex items-center gap-1 no-underline hover:text-(--txt-primary)"
                  >
                    <IconEye /> More details
                  </Link>
                  <span className="flex items-center gap-1">
                    <IconCalendar />
                    {activeCycle.start_date && activeCycle.end_date
                      ? formatDateRange(activeCycle.start_date, activeCycle.end_date)
                      : 'No dates'}
                  </span>
                  {getUser('u1') && (
                    <Avatar
                      name={getUser('u1')!.name}
                      src={getUser('u1')!.avatarUrl}
                      size="sm"
                      className="h-6 w-6 text-[10px]"
                    />
                  )}
                  <button
                    type="button"
                    className="rounded p-1 text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
                    aria-label="Star"
                  >
                    <IconStar />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
                    aria-label="More"
                  >
                    <IconMoreVertical />
                  </button>
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-4">
                <h3 className="text-sm font-medium text-(--txt-primary)">Progress</h3>
                <div className="mt-4 flex flex-col items-center justify-center py-6">
                  <IconTrendingUp />
                  <p className="mt-2 text-center text-sm text-(--txt-tertiary)">
                    Add work items to the cycle to view it&apos;s progress
                  </p>
                </div>
              </div>
              <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-4">
                <h3 className="text-sm font-medium text-(--txt-primary)">Work item burndown</h3>
                <div className="mt-4 flex flex-col items-center justify-center py-6">
                  <IconActivity />
                  <p className="mt-2 text-center text-sm text-(--txt-tertiary)">
                    Add work items to the cycle to view the burndown chart.
                  </p>
                </div>
              </div>
              <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-4">
                <h3 className="text-sm font-medium text-(--txt-primary)">Priority work items</h3>
                <div className="mt-2 flex gap-1 border-b border-(--border-subtle)">
                  <button
                    type="button"
                    className="border-b-2 border-(--brand-default) px-2 py-1.5 text-xs font-medium text-(--txt-primary)"
                  >
                    Priority work items
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1.5 text-xs font-medium text-(--txt-tertiary) hover:text-(--txt-secondary)"
                  >
                    Assignees
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1.5 text-xs font-medium text-(--txt-tertiary) hover:text-(--txt-secondary)"
                  >
                    Labels
                  </button>
                </div>
                <div className="flex flex-col items-center justify-center py-6">
                  <IconBarChart />
                  <p className="mt-2 text-center text-sm text-(--txt-tertiary)">
                    Observe high priority work items tackled in the cycle at a glance.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-(--txt-tertiary)">No active cycle.</p>
        )}
      </section>

      {/* Upcoming cycle */}
      <section>
        <button
          type="button"
          onClick={() => setUpcomingOpen((o) => !o)}
          className="flex w-full items-center gap-2 rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-4 py-2.5 text-left text-sm font-medium text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
        >
          <span className="flex h-2 w-2 rounded-full border-2 border-dashed border-(--brand-default) bg-transparent" />
          Upcoming cycle {upcomingCycles.length}
          <span className="ml-auto">{upcomingOpen ? <IconChevronUp /> : <IconChevronDown />}</span>
        </button>
        {upcomingOpen && (
          <div className="mt-2 space-y-2 pl-4">
            {upcomingCycles.length === 0 ? (
              <p className="py-4 text-sm text-(--txt-tertiary)">No upcoming cycles.</p>
            ) : (
              upcomingCycles.map((c) => (
                <Link
                  key={c.id}
                  to={`${baseUrl}/cycles/${c.id}`}
                  className="block rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-3 text-sm no-underline hover:bg-(--bg-layer-1-hover)"
                >
                  <span className="font-medium text-(--txt-primary)">{c.name}</span>
                  <span className="ml-2 text-(--txt-tertiary)">
                    {c.start_date && c.end_date
                      ? formatDateRange(c.start_date, c.end_date)
                      : 'No dates'}
                  </span>
                </Link>
              ))
            )}
          </div>
        )}
      </section>

      {/* Draft cycle */}
      <section>
        <button
          type="button"
          onClick={() => setDraftOpen((o) => !o)}
          className="flex w-full items-center gap-2 rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-4 py-2.5 text-left text-sm font-medium text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
        >
          <span className="flex h-2 w-2 rounded-full border border-(--border-subtle) bg-transparent" />
          Draft cycle {draftCycles.length}
          <span className="ml-auto">{draftOpen ? <IconChevronUp /> : <IconChevronDown />}</span>
        </button>
        {draftOpen && (
          <div className="mt-2 space-y-2 pl-4">
            {draftCycles.length === 0 ? (
              <p className="py-4 text-sm text-(--txt-tertiary)">No draft cycles.</p>
            ) : (
              draftCycles.map((c) => (
                <Link
                  key={c.id}
                  to={`${baseUrl}/cycles/${c.id}`}
                  className="block rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-3 text-sm no-underline hover:bg-(--bg-layer-1-hover)"
                >
                  <span className="font-medium text-(--txt-primary)">{c.name}</span>
                  <span className="ml-2 text-(--txt-tertiary)">
                    {c.start_date && c.end_date
                      ? formatDateRange(c.start_date, c.end_date)
                      : 'No dates'}
                  </span>
                </Link>
              ))
            )}
          </div>
        )}
      </section>

      {/* Completed cycle */}
      <section>
        <button
          type="button"
          onClick={() => setCompletedOpen((o) => !o)}
          className="flex w-full items-center gap-2 rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-4 py-2.5 text-left text-sm font-medium text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
        >
          <span className="flex h-2 w-2 rounded-full bg-(--success-default)" />
          Completed cycle {completedCycles.length}
          <span className="ml-auto">{completedOpen ? <IconChevronUp /> : <IconChevronDown />}</span>
        </button>
        {completedOpen && (
          <div className="mt-2 space-y-2 pl-4">
            {completedCycles.length === 0 ? (
              <p className="py-4 text-sm text-(--txt-tertiary)">No completed cycles.</p>
            ) : (
              completedCycles.map((c) => (
                <Link
                  key={c.id}
                  to={`${baseUrl}/cycles/${c.id}`}
                  className="block rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-3 text-sm no-underline hover:bg-(--bg-layer-1-hover)"
                >
                  <span className="font-medium text-(--txt-primary)">{c.name}</span>
                  <span className="ml-2 text-(--txt-tertiary)">
                    {c.start_date && c.end_date
                      ? formatDateRange(c.start_date, c.end_date)
                      : 'No dates'}
                  </span>
                </Link>
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
}
