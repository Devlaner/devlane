import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '../components/ui';
import { workspaceService } from '../services/workspaceService';
import { projectService } from '../services/projectService';
import { cycleService } from '../services/cycleService';
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

  useEffect(() => {
    if (!workspaceSlug || !projectId || !cycleId) {
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
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
        setCycle((cycles ?? []).find((c) => cycleMatchesPathSegment(c, cycleId)) ?? null);
        setIssues(allIssues ?? []);
        setStates(st ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setWorkspace(null);
        setProject(null);
        setCycle(null);
        setIssues([]);
        setStates([]);
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

  if (loading) {
    return <div className="p-6 text-sm text-(--txt-tertiary)">Loading cycle…</div>;
  }
  if (!workspace || !project || !cycle) {
    return <div className="p-6 text-sm text-(--txt-secondary)">Cycle not found.</div>;
  }

  const projectBase = `/${workspace.slug}/projects/${project.id}`;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Link
          to={`${projectBase}/cycles`}
          className="inline-flex items-center text-sm text-(--txt-secondary) hover:text-(--txt-primary)"
        >
          ← Back to cycles
        </Link>
        <h1 className="text-xl font-semibold text-(--txt-primary)">{cycle.name}</h1>
        <p className="text-sm text-(--txt-secondary)">
          {formatDate(cycle.start_date)} — {formatDate(cycle.end_date)} · {cycle.issue_count ?? 0}{' '}
          work items
        </p>
      </div>

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
