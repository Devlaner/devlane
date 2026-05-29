import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '../components/ui';
import { workspaceService } from '../services/workspaceService';
import { projectService } from '../services/projectService';
import { cycleService, type CycleProgressResponse } from '../services/cycleService';
import { issueService } from '../services/issueService';
import { stateService } from '../services/stateService';
import { cycleMatchesPathSegment } from '../lib/cycle';
import type {
  CycleApiResponse,
  IssueApiResponse,
  ProjectApiResponse,
  StateApiResponse,
  WorkspaceApiResponse,
} from '../api/types';
import type { Priority } from '../types';
import { parseISODateForDisplay } from '../lib/dateOnly';

const priorityVariant: Record<Priority, 'danger' | 'warning' | 'default' | 'neutral'> = {
  urgent: 'danger',
  high: 'danger',
  medium: 'warning',
  low: 'default',
  none: 'neutral',
};

function formatDate(iso: string | null | undefined): string {
  const d = parseISODateForDisplay(iso);
  if (!d) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-(--bg-layer-1)">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-8 text-right text-xs tabular-nums text-(--txt-tertiary)">{pct}%</span>
    </div>
  );
}

function BurndownChart({
  chart,
  startDate,
  endDate,
}: {
  chart: Record<string, number | null>;
  startDate?: string | null;
  endDate?: string | null;
}) {
  const entries = Object.entries(chart)
    .filter(([, v]) => v != null)
    .sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) {
    return <p className="text-xs text-(--txt-tertiary)">No completion data yet.</p>;
  }
  const maxVal = Math.max(...entries.map(([, v]) => v as number), 1);
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-(--txt-secondary)">Completions per day</p>
      <div className="flex h-24 items-end gap-0.5 overflow-x-auto">
        {entries.map(([date, count]) => {
          const h = Math.round(((count as number) / maxVal) * 100);
          return (
            <div
              key={date}
              className="group relative flex flex-col items-center"
              style={{ minWidth: 12 }}
            >
              <div
                className="w-2.5 rounded-t bg-(--bg-accent-primary) opacity-80 transition-all group-hover:opacity-100"
                style={{ height: `${h}%` }}
              />
              <div className="absolute bottom-full mb-1 hidden whitespace-nowrap rounded bg-(--bg-surface-1) px-1.5 py-0.5 text-[10px] text-(--txt-secondary) shadow group-hover:block">
                {date}: {count}
              </div>
            </div>
          );
        })}
      </div>
      {(startDate || endDate) && (
        <div className="mt-1 flex justify-between text-[10px] text-(--txt-tertiary)">
          <span>{startDate ? formatDate(startDate) : ''}</span>
          <span>{endDate ? formatDate(endDate) : ''}</span>
        </div>
      )}
    </div>
  );
}

export function CycleDetailPage() {
  const { workspaceSlug, projectId, cycleId } = useParams<{
    workspaceSlug: string;
    projectId: string;
    cycleId: string;
  }>();

  const [loading, setLoading] = useState(() => Boolean(workspaceSlug && projectId && cycleId));
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [cycle, setCycle] = useState<CycleApiResponse | null>(null);
  const [issues, setIssues] = useState<IssueApiResponse[]>([]);
  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [progress, setProgress] = useState<CycleProgressResponse | null>(null);

  useEffect(() => {
    if (!workspaceSlug || !projectId || !cycleId) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setProgress(null);
        setLoading(true);
      }
    });
    Promise.all([
      workspaceService.getBySlug(workspaceSlug),
      projectService.get(workspaceSlug, projectId),
      cycleService.list(workspaceSlug, projectId),
      issueService.list(workspaceSlug, projectId, { limit: 500 }),
      stateService.list(workspaceSlug, projectId),
    ])
      .then(([w, p, cycles, allIssues, st]) => {
        if (cancelled) return;
        setWorkspace(w ?? null);
        setProject(p ?? null);
        const found = (cycles ?? []).find((c) => cycleMatchesPathSegment(c, cycleId)) ?? null;
        setCycle(found);
        setIssues(allIssues ?? []);
        setStates(st ?? []);
        // Fetch progress separately so it doesn't block the main render.
        if (found && workspaceSlug && projectId) {
          cycleService
            .getProgress(workspaceSlug, projectId, found.id)
            .then((snap) => {
              if (!cancelled) setProgress(snap);
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        if (cancelled) return;
        setWorkspace(null);
        setProject(null);
        setCycle(null);
        setIssues([]);
        setStates([]);
        setProgress(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, cycleId]);

  const cycleIssues = useMemo(() => {
    if (!cycle) return [];
    return issues.filter((i) => i.cycle_ids?.includes(cycle.id));
  }, [issues, cycle]);

  const stateName = (stateId: string | null | undefined) =>
    stateId ? (states.find((s) => s.id === stateId)?.name ?? '—') : '—';

  if (loading) return <div className="p-6 text-sm text-(--txt-tertiary)">Loading cycle…</div>;
  if (!workspace || !project || !cycle)
    return <div className="p-6 text-sm text-(--txt-secondary)">Cycle not found.</div>;

  const projectBase = `/${workspace.slug}/projects/${project.id}`;
  const total = progress?.total_issues ?? cycleIssues.length;
  const completed = progress?.completed_issues ?? 0;
  const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          to={`${projectBase}/cycles`}
          className="inline-flex items-center text-sm text-(--txt-secondary) hover:text-(--txt-primary)"
        >
          ← Back to cycles
        </Link>
        <h1 className="text-xl font-semibold text-(--txt-primary)">{cycle.name}</h1>
        <p className="text-sm text-(--txt-secondary)">
          {formatDate(cycle.start_date)} — {formatDate(cycle.end_date)} · {total} work items
        </p>
      </div>

      {/* ── Progress stats ── */}
      {progress && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Overall completion */}
          <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-(--txt-secondary)">Overall Progress</p>
              <span className="text-2xl font-bold text-(--txt-primary)">{completionPct}%</span>
            </div>
            <ProgressBar value={completed} max={total} color="var(--color-success-600, #16a34a)" />
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-(--txt-tertiary)">
              <span>✓ Completed: {progress.completed_issues}</span>
              <span>▷ Started: {progress.started_issues}</span>
              <span>○ Unstarted: {progress.unstarted_issues}</span>
              <span>⊘ Cancelled: {progress.cancelled_issues}</span>
              <span>◻ Backlog: {progress.backlog_issues}</span>
            </div>
          </div>

          {/* Burndown chart */}
          <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-4">
            {progress.distribution?.completion_chart ? (
              <BurndownChart
                chart={progress.distribution.completion_chart as Record<string, number | null>}
                startDate={cycle.start_date}
                endDate={cycle.end_date}
              />
            ) : (
              <p className="text-xs text-(--txt-tertiary)">No completion data yet.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Issues table ── */}
      <div className="overflow-x-auto rounded-md border border-(--border-subtle) bg-(--bg-surface-1)">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-(--bg-layer-1)">
            <tr>
              <th className="px-4 py-2 font-medium text-(--txt-secondary)">Work item</th>
              <th className="px-4 py-2 font-medium text-(--txt-secondary)">Priority</th>
              <th className="px-4 py-2 font-medium text-(--txt-secondary)">State</th>
              <th className="px-4 py-2 font-medium text-(--txt-secondary)">Due date</th>
            </tr>
          </thead>
          <tbody>
            {cycleIssues.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-(--txt-tertiary)">
                  No work items in this cycle.
                </td>
              </tr>
            ) : (
              cycleIssues.map((issue) => (
                <tr key={issue.id} className="border-t border-(--border-subtle)">
                  <td className="px-4 py-2">
                    <Link
                      to={`${projectBase}/issues/${issue.id}`}
                      className="text-(--txt-primary) no-underline hover:text-(--txt-accent-primary)"
                    >
                      {issue.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={priorityVariant[(issue.priority as Priority) ?? 'none']}>
                      {issue.priority ?? 'none'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-(--txt-secondary)">
                    {stateName(issue.state_id ?? undefined)}
                  </td>
                  <td className="px-4 py-2 text-(--txt-secondary)">
                    {formatDate(issue.target_date)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
