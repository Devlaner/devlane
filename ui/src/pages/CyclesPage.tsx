import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Avatar } from '../components/ui';
import { workspaceService } from '../services/workspaceService';
import { projectService } from '../services/projectService';
import { cycleService } from '../services/cycleService';
import type { WorkspaceApiResponse, ProjectApiResponse, CycleApiResponse } from '../api/types';

const IconTrendingUp = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--txt-icon-tertiary)]" aria-hidden>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
  </svg>
);
const IconActivity = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--txt-icon-tertiary)]" aria-hidden>
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);
const IconBarChart = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--txt-icon-tertiary)]" aria-hidden>
    <line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" />
  </svg>
);
const IconEye = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const IconCalendar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const IconStar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);
const IconMoreVertical = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
  </svg>
);
const IconChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
const IconChevronUp = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="m18 15-6-6-6 6" />
  </svg>
);

export function CyclesPage() {
  const { workspaceSlug, projectId } = useParams<{ workspaceSlug: string; projectId: string }>();
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(true);
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [cycles, setCycles] = useState<CycleApiResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceSlug || !projectId) {
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
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [workspaceSlug, projectId]);

  const activeCycle = cycles.find((c) => c.status === 'started' || c.status === 'current');
  const upcomingCycles = cycles.filter((c) => c.status === 'draft' || c.status === 'upcoming');
  const completedCycles = cycles.filter((c) => c.status === 'completed');

  const getIssueCount = (cycleId: string) => cycles.find((c) => c.id === cycleId)?.issue_count ?? 0;
  const getUser = (_userId: string | null) => null;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-[var(--txt-tertiary)]">
        Loading…
      </div>
    );
  }
  if (!workspace || !project) {
    return (
      <div className="text-[var(--txt-secondary)]">
        Project not found.
      </div>
    );
  }

  const baseUrl = `/${workspace.slug}/projects/${project.id}`;
  const formatDateRange = (start: string, end: string) =>
    `${new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <div className="space-y-8">
      {/* Active cycle */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-[var(--txt-primary)]">
          <span className="flex h-2.5 w-2.5 rounded-full bg-[var(--warning-default)]" aria-hidden />
          Active cycle
        </h2>
        {activeCycle ? (
          <div className="space-y-4">
            <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-[var(--txt-primary)]">{activeCycle.name}</p>
                  <p className="mt-0.5 text-sm text-[var(--txt-secondary)]">
                    {Math.round((getIssueCount(activeCycle.id) / Math.max(1, getIssueCount(activeCycle.id))) * 0)}% completion
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-[var(--txt-secondary)]">
                  <Link to={`${baseUrl}/cycles/${activeCycle.id}`} className="flex items-center gap-1 no-underline hover:text-[var(--txt-primary)]">
                    <IconEye /> More details
                  </Link>
                  <span className="flex items-center gap-1">
                    <IconCalendar />
                    {activeCycle.start_date && activeCycle.end_date
                      ? formatDateRange(activeCycle.start_date, activeCycle.end_date)
                      : 'No dates'}
                  </span>
                  {getUser('u1') && (
                    <Avatar name={getUser('u1')!.name} src={getUser('u1')!.avatarUrl} size="sm" className="h-6 w-6 text-[10px]" />
                  )}
                  <button type="button" className="rounded p-1 text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-1-hover)] hover:text-[var(--txt-icon-secondary)]" aria-label="Star">
                    <IconStar />
                  </button>
                  <button type="button" className="rounded p-1 text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-1-hover)] hover:text-[var(--txt-icon-secondary)]" aria-label="More">
                    <IconMoreVertical />
                  </button>
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] p-4">
                <h3 className="text-sm font-medium text-[var(--txt-primary)]">Progress</h3>
                <div className="mt-4 flex flex-col items-center justify-center py-6">
                  <IconTrendingUp />
                  <p className="mt-2 text-center text-sm text-[var(--txt-tertiary)]">
                    Add work items to the cycle to view it&apos;s progress
                  </p>
                </div>
              </div>
              <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] p-4">
                <h3 className="text-sm font-medium text-[var(--txt-primary)]">Work item burndown</h3>
                <div className="mt-4 flex flex-col items-center justify-center py-6">
                  <IconActivity />
                  <p className="mt-2 text-center text-sm text-[var(--txt-tertiary)]">
                    Add work items to the cycle to view the burndown chart.
                  </p>
                </div>
              </div>
              <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] p-4">
                <h3 className="text-sm font-medium text-[var(--txt-primary)]">Priority work items</h3>
                <div className="mt-2 flex gap-1 border-b border-[var(--border-subtle)]">
                  <button type="button" className="border-b-2 border-[var(--brand-default)] px-2 py-1.5 text-xs font-medium text-[var(--txt-primary)]">
                    Priority work items
                  </button>
                  <button type="button" className="px-2 py-1.5 text-xs font-medium text-[var(--txt-tertiary)] hover:text-[var(--txt-secondary)]">
                    Assignees
                  </button>
                  <button type="button" className="px-2 py-1.5 text-xs font-medium text-[var(--txt-tertiary)] hover:text-[var(--txt-secondary)]">
                    Labels
                  </button>
                </div>
                <div className="flex flex-col items-center justify-center py-6">
                  <IconBarChart />
                  <p className="mt-2 text-center text-sm text-[var(--txt-tertiary)]">
                    Observe high priority work items tackled in the cycle at a glance.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--txt-tertiary)]">No active cycle.</p>
        )}
      </section>

      {/* Upcoming cycle */}
      <section>
        <button
          type="button"
          onClick={() => setUpcomingOpen((o) => !o)}
          className="flex w-full items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] px-4 py-2.5 text-left text-sm font-medium text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]"
        >
          <span className="flex h-2 w-2 rounded-full border-2 border-dashed border-[var(--brand-default)] bg-transparent" />
          Upcoming cycle {upcomingCycles.length}
          <span className="ml-auto">{upcomingOpen ? <IconChevronUp /> : <IconChevronDown />}</span>
        </button>
        {upcomingOpen && (
          <div className="mt-2 space-y-2 pl-4">
            {upcomingCycles.length === 0 ? (
              <p className="py-4 text-sm text-[var(--txt-tertiary)]">No upcoming cycles.</p>
            ) : (
              upcomingCycles.map((c) => (
                <Link
                  key={c.id}
                  to={`${baseUrl}/cycles/${c.id}`}
                  className="block rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] p-3 text-sm no-underline hover:bg-[var(--bg-layer-1-hover)]"
                >
                  <span className="font-medium text-[var(--txt-primary)]">{c.name}</span>
                  <span className="ml-2 text-[var(--txt-tertiary)]">
                    {c.start_date && c.end_date ? formatDateRange(c.start_date, c.end_date) : 'No dates'}
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
          className="flex w-full items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] px-4 py-2.5 text-left text-sm font-medium text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]"
        >
          <span className="flex h-2 w-2 rounded-full bg-[var(--success-default)]" />
          Completed cycle {completedCycles.length}
          <span className="ml-auto">{completedOpen ? <IconChevronUp /> : <IconChevronDown />}</span>
        </button>
        {completedOpen && (
          <div className="mt-2 space-y-2 pl-4">
            {completedCycles.length === 0 ? (
              <p className="py-4 text-sm text-[var(--txt-tertiary)]">No completed cycles.</p>
            ) : (
              completedCycles.map((c) => (
                <Link
                  key={c.id}
                  to={`${baseUrl}/cycles/${c.id}`}
                  className="block rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] p-3 text-sm no-underline hover:bg-[var(--bg-layer-1-hover)]"
                >
                  <span className="font-medium text-[var(--txt-primary)]">{c.name}</span>
                  <span className="ml-2 text-[var(--txt-tertiary)]">
                    {c.start_date && c.end_date ? formatDateRange(c.start_date, c.end_date) : 'No dates'}
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
