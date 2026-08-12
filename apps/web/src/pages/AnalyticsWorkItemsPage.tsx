import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { workspaceService } from '../services/workspaceService';
import { projectService } from '../services/projectService';
import { API_BASE } from '../api/client';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import type { WorkspaceApiResponse, ProjectApiResponse } from '../api/types';

interface TrendPoint {
  date: string;
  created: number;
  resolved: number;
}

interface AnalyticsResponse {
  by_state: Record<string, number>;
  by_priority: Record<string, number>;
  trend?: TrendPoint[];
  partial_error?: boolean;
  warnings?: string[];
}

const STATE_GROUP_SYNONYMS: Record<'backlog' | 'unstarted' | 'started' | 'completed', string[]> = {
  backlog: ['backlog'],
  unstarted: ['todo', 'to do', 'unstarted'],
  started: ['in progress', 'started'],
  completed: ['done', 'completed'],
};

function sumStateGroup(byState: Record<string, number>, synonyms: string[]): number {
  const wanted = new Set(synonyms.map((s) => s.toLowerCase()));
  return Object.entries(byState).reduce(
    (sum, [name, count]) => (wanted.has(name.toLowerCase()) ? sum + count : sum),
    0,
  );
}

// Safely downloads the CSV via fetch using credentials (cookies) and correct absolute API URL
async function downloadCsv(url: string, fallbackFilename: string) {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    throw new Error(`Export failed: ${res.status}`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? fallbackFilename;
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
}

const IconBriefcase = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
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
const IconSettings = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);
const IconDownload = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

export function AnalyticsWorkItemsPage() {
  const { t } = useTranslation();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { pathname } = useLocation();
  /* The v2 preview shell carries its own navigation, and its tab strip would
     link back out of the preview — so the strip is dropped there. Outside the
     preview it stays: it is the only way to reach this page from Overview. */
  const inPreviewShell = pathname.includes('/app-v2/');
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);

  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // States to track downloads
  const [exportingWorkspace, setExportingWorkspace] = useState(false);
  const [exportingProjectId, setExportingProjectId] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useDocumentTitle('Analytics');

  useEffect(() => {
    if (!workspaceSlug) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setAnalyticsError(null);

    (async () => {
      let w: WorkspaceApiResponse | null = null;
      try {
        w = await workspaceService.getBySlug(workspaceSlug);
      } catch (err) {
        console.error('Erreur Workspace:', err);
        if (!cancelled) setWorkspace(null);
        return;
      }
      if (cancelled) return;
      setWorkspace(w);

      const [projectsResult, analyticsResult] = await Promise.allSettled([
        projectService.list(workspaceSlug),
        fetch(`${API_BASE}/api/workspaces/${workspaceSlug}/analytics/`, {
          credentials: 'include',
        }).then((res) => {
          if (!res.ok) {
            throw new Error(`Code erreur serveur Go : ${res.status}`);
          }
          return res.json() as Promise<AnalyticsResponse>;
        }),
      ]);
      if (cancelled) return;

      if (projectsResult.status === 'fulfilled') {
        if (projectsResult.value) setProjects(projectsResult.value);
      } else {
        console.error('Erreur projets:', projectsResult.reason);
      }

      if (analyticsResult.status === 'fulfilled') {
        setAnalytics(analyticsResult.value);
      } else {
        console.error('Erreur API Analytics Go:', analyticsResult.reason);
        setAnalyticsError(t('analytics.loadFailed', 'Could not load analytics. Please try again.'));
      }
    })().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, t]);

  const exportWorkspaceCsv = async () => {
    if (!workspaceSlug || exportingWorkspace) return;
    setExportError(null);
    setExportingWorkspace(true);
    try {
      const fallback = `workspace-${workspace?.slug ?? workspaceSlug}-analytics-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      await downloadCsv(`${API_BASE}/api/workspaces/${workspaceSlug}/analytics/export/`, fallback);
    } catch {
      setExportError(t('analytics.exportFailed', 'Export failed. Please try again.'));
    } finally {
      setExportingWorkspace(false);
    }
  };

  const exportProjectCsv = async (projectId: string) => {
    if (!workspaceSlug || exportingProjectId) return;
    setExportError(null);
    setExportingProjectId(projectId);
    try {
      const proj = projects.find((p) => p.id === projectId);
      const fallback = `project-${proj?.name ?? projectId}-analytics-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      await downloadCsv(
        `${API_BASE}/api/workspaces/${workspaceSlug}/projects/${projectId}/analytics/export/`,
        fallback,
      );
    } catch {
      setExportError(t('analytics.exportFailed', 'Export failed. Please try again.'));
    } finally {
      setExportingProjectId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-(--txt-tertiary)">
        {t('common.loading', 'Loading…')}
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="text-(--txt-secondary)">
        {t('common.workspaceNotFound', 'Workspace not found.')}
      </div>
    );
  }

  const baseUrl = `/${workspace.slug}/analytics`;

  const byState = analytics?.by_state ?? {};
  const backlogCount = sumStateGroup(byState, STATE_GROUP_SYNONYMS.backlog);
  const startedCount = sumStateGroup(byState, STATE_GROUP_SYNONYMS.started);
  const unstartedCount = sumStateGroup(byState, STATE_GROUP_SYNONYMS.unstarted);
  const completedCount = sumStateGroup(byState, STATE_GROUP_SYNONYMS.completed);
  const totalIssues = Object.values(byState).reduce((sum, count) => sum + count, 0);

  const priorityRows = Object.entries(analytics?.by_priority ?? {}).map(([priority, count]) => ({
    priority: priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : 'None',
    count,
  }));

  const createdResolvedData: TrendPoint[] = analytics?.trend ?? [];
  return (
    <div className="space-y-6 pb-8">
      {/* Tabs */}
      {!inPreviewShell && (
        <div className="flex gap-1 border-b border-(--border-subtle)">
          <Link
            to={`${baseUrl}/overview`}
            className="border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-(--txt-secondary) no-underline hover:text-(--txt-primary)"
          >
            {t('common.overview', 'Overview')}
          </Link>
          <Link
            to={`${baseUrl}/work-items`}
            className="border-b-2 border-(--brand-default) px-4 py-2.5 text-sm font-medium text-(--txt-primary) no-underline"
          >
            {t('common.workItems', 'Work items')}
          </Link>
        </div>
      )}

      <h2 className="text-lg font-semibold text-(--txt-primary)">
        {t('analytics.workItems', 'Work items')}
      </h2>

      {analyticsError && (
        <p className="text-sm text-(--txt-danger-primary) font-medium">{analyticsError}</p>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-4 py-3">
          <p className="text-xs font-medium text-(--txt-tertiary)">
            {t('analytics.totalWorkItems', 'Total Work items')}
          </p>
          <p className="mt-1 text-2xl font-semibold text-(--txt-primary)">{totalIssues}</p>
        </div>
        <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-4 py-3">
          <p className="text-xs font-medium text-(--txt-tertiary)">
            {t('analytics.startedWorkItems', 'Started Work items')}
          </p>
          <p className="mt-1 text-2xl font-semibold text-(--txt-primary)">{startedCount}</p>
        </div>
        <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-4 py-3">
          <p className="text-xs font-medium text-(--txt-tertiary)">
            {t('analytics.backlogWorkItems', 'Backlog Work items')}
          </p>
          <p className="mt-1 text-2xl font-semibold text-(--txt-primary)">{backlogCount}</p>
        </div>
        <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-4 py-3">
          <p className="text-xs font-medium text-(--txt-tertiary)">
            {t('analytics.unstartedWorkItems', 'Unstarted Work items')}
          </p>
          <p className="mt-1 text-2xl font-semibold text-(--txt-primary)">{unstartedCount}</p>
        </div>
        <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-4 py-3">
          <p className="text-xs font-medium text-(--txt-tertiary)">
            {t('analytics.completedWorkItems', 'Completed Work items')}
          </p>
          <p className="mt-1 text-2xl font-semibold text-(--txt-primary)">{completedCount}</p>
        </div>
      </div>

      {/* Created vs Resolved */}
      <section>
        <h3 className="mb-4 text-base font-semibold text-(--txt-primary)">
          {t('analytics.createdVsResolved', 'Created vs Resolved')}
        </h3>
        <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-6">
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={createdResolvedData}
                margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border-subtle)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'var(--txt-secondary)', fontSize: 11 }}
                  tickLine={{ stroke: 'var(--border-subtle)' }}
                  axisLine={{ stroke: 'var(--border-subtle)' }}
                  label={{
                    value: t('analytics.axisDate', 'DATE'),
                    position: 'insideBottom',
                    offset: -4,
                    fill: 'var(--txt-tertiary)',
                    fontSize: 11,
                  }}
                />
                <YAxis
                  tick={{ fill: 'var(--txt-secondary)', fontSize: 11 }}
                  tickLine={{ stroke: 'var(--border-subtle)' }}
                  axisLine={{ stroke: 'var(--border-subtle)' }}
                  label={{
                    value: t('analytics.axisWorkItemsCount', 'NO. OF WORK ITEMS'),
                    angle: -90,
                    position: 'insideLeft',
                    fill: 'var(--txt-tertiary)',
                    fontSize: 11,
                  }}
                  domain={[0, 'auto']}
                  allowDecimals={false}
                />
                <Legend
                  layout="horizontal"
                  align="left"
                  verticalAlign="bottom"
                  wrapperStyle={{ paddingTop: 8 }}
                  iconType="square"
                  iconSize={10}
                  formatter={(value) => (
                    <span className="text-xs text-(--txt-secondary)">{value}</span>
                  )}
                />
                <Line
                  type="monotone"
                  dataKey="resolved"
                  name={t('analytics.resolved', 'Resolved')}
                  stroke="var(--txt-success-primary, #22c55e)"
                  strokeWidth={2}
                  dot={{ fill: 'var(--txt-success-primary, #22c55e)', r: 4 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="created"
                  name={t('analytics.created', 'Created')}
                  stroke="var(--brand-default)"
                  strokeWidth={2}
                  dot={{ fill: 'var(--brand-default)', r: 4 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Customized Insights */}
      <section>
        <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-(--txt-primary)">
          <IconBriefcase />
          {t('analytics.customizedInsights', 'Customized Insights')}
        </h3>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
          >
            <IconBriefcase /> {t('analytics.filterWorkItem', 'Work item')} {}
            <span className="opacity-60">∨</span>
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
          >
            <IconCalendar /> {t('analytics.priority', 'Priority')} {}
            <span className="opacity-60">∨</span>
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
          >
            <IconSettings /> {t('analytics.addProperty', 'Add Property')} {}
            <span className="opacity-60">∨</span>
          </button>
        </div>
        <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-6">
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityRows} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border-subtle)"
                  vertical={false}
                />
                <XAxis
                  dataKey="priority"
                  tick={{ fill: 'var(--txt-secondary)', fontSize: 11 }}
                  tickLine={{ stroke: 'var(--border-subtle)' }}
                  axisLine={{ stroke: 'var(--border-subtle)' }}
                  label={{
                    value: t('analytics.axisPriority', 'PRIORITY'),
                    position: 'insideBottom',
                    offset: -4,
                    fill: 'var(--txt-tertiary)',
                    fontSize: 11,
                  }}
                />
                <YAxis
                  tick={{ fill: 'var(--txt-secondary)', fontSize: 11 }}
                  tickLine={{ stroke: 'var(--border-subtle)' }}
                  axisLine={{ stroke: 'var(--border-subtle)' }}
                  label={{
                    value: t('analytics.axisWorkItemCount', 'NO. OF WORK ITEM'),
                    angle: -90,
                    position: 'insideLeft',
                    fill: 'var(--txt-tertiary)',
                    fontSize: 11,
                  }}
                  domain={[0, 'auto']}
                  allowDecimals={false}
                />
                <Bar dataKey="count" fill="var(--neutral-400, #9389a0)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {exportError && (
        <p className="text-sm text-(--txt-danger-primary) font-medium">{exportError}</p>
      )}

      {/* Priority table */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-(--txt-primary)">
              {t('analytics.prioritiesCount', '{{count}} Priorities', {
                count: priorityRows.length,
              })}
            </h3>
          </div>
          <button
            type="button"
            disabled={exportingWorkspace}
            onClick={exportWorkspaceCsv}
            className="flex items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover) disabled:opacity-60"
          >
            <IconDownload />
            {exportingWorkspace
              ? t('analytics.exporting', 'Exporting…')
              : t('analytics.exportAsCsv', 'Export as CSV')}
          </button>
        </div>
        <div className="overflow-x-auto rounded-md border border-(--border-subtle) bg-(--bg-surface-1)">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-(--border-subtle)">
                <th className="py-3 px-4 font-medium text-(--txt-secondary)">
                  {t('analytics.priority', 'Priority')}
                </th>
                <th className="py-3 px-4 font-medium text-(--txt-secondary)">
                  {t('analytics.count', 'Count')}
                </th>
              </tr>
            </thead>
            <tbody>
              {priorityRows.map(({ priority, count }) => (
                <tr key={priority} className="border-b border-(--border-subtle) last:border-0">
                  <td className="py-3 px-4 text-(--txt-primary)">{priority}</td>
                  <td className="py-3 px-4 text-(--txt-secondary)">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Projects table */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-(--txt-primary)">
              {t('analytics.projectsCount', '{{count}} Projects', { count: projects.length })}
            </h3>
          </div>
        </div>
        <div className="overflow-x-auto rounded-md border border-(--border-subtle) bg-(--bg-surface-1)">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-(--border-subtle)">
                <th className="py-3 px-4 font-medium text-(--txt-secondary)">
                  {t('common.project', 'Project')}
                </th>
                <th className="py-3 px-4 font-medium text-(--txt-secondary)">
                  {t('common.actions', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} className="border-b border-(--border-subtle) last:border-0">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded bg-(--bg-layer-2) text-[10px] font-medium text-(--txt-icon-secondary)">
                        <IconBriefcase />
                      </span>
                      <span className="text-(--txt-primary)">{project.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      disabled={exportingProjectId === project.id}
                      onClick={() => exportProjectCsv(project.id)}
                      className="flex items-center gap-1 rounded border border-(--border-subtle) bg-(--bg-layer-2) px-2 py-1 text-xs text-(--txt-secondary) hover:bg-(--bg-layer-2-hover) disabled:opacity-60"
                    >
                      <IconDownload />
                      {exportingProjectId === project.id
                        ? t('analytics.exporting', 'Exporting…')
                        : t('analytics.exportProjectCsv', 'Export Project CSV')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
