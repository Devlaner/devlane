import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, XAxis, YAxis } from 'recharts';
import { Download } from 'lucide-react';
import { Button } from '@/components/shadcn/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/shadcn/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/shadcn/ui/chart';
import { Skeleton } from '@/components/shadcn/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/ui/table';
import { API_BASE } from '../api/client';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PRIORITIES, PRIORITY_LABELS, type Priority } from '../lib/projectV2';
import { projectService } from '../services/projectService';
import { workspaceService } from '../services/workspaceService';
import type { ProjectApiResponse, WorkspaceApiResponse } from '../api/types';

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

/* One hue per state group, matching AnalyticsOverviewPageV2's ramp so a reader
   moving between the two analytics pages reads the same colour the same way. */
const STATE_GROUPS = [
  { group: 'backlog', label: 'Backlog', synonyms: ['backlog'], color: 'var(--chart-4)' },
  {
    group: 'unstarted',
    label: 'Todo',
    synonyms: ['todo', 'to do', 'unstarted'],
    color: 'var(--chart-1)',
  },
  {
    group: 'started',
    label: 'In Progress',
    synonyms: ['in progress', 'started'],
    color: 'var(--chart-3)',
  },
  { group: 'completed', label: 'Done', synonyms: ['done', 'completed'], color: 'var(--chart-2)' },
] as const;

function sumStateGroup(byState: Record<string, number>, synonyms: readonly string[]): number {
  const wanted = new Set(synonyms.map((s) => s.toLowerCase()));
  return Object.entries(byState).reduce(
    (sum, [name, count]) => (wanted.has(name.toLowerCase()) ? sum + count : sum),
    0,
  );
}

/**
 * Downloads a CSV through fetch so the session cookie rides along, then honours
 * the server's Content-Disposition filename when it sends one.
 *
 * Duplicated from the shipped page rather than lifted into `lib/`: lifting it
 * would edit a shipped file for the preview's convenience, and this is fifteen
 * lines with no branching.
 */
async function downloadCsv(url: string, fallbackFilename: string) {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const filename = disposition.match(/filename="?([^"]+)"?/)?.[1] ?? fallbackFilename;
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
}

/**
 * Design preview of the work item analytics, built from shadcn primitives. It
 * stands alongside AnalyticsWorkItemsPage rather than replacing it, so the two
 * can be compared side by side.
 *
 * This page is the one place in the app that bypasses `src/services/`: the
 * analytics and export endpoints are called through `fetch(API_BASE + …)`
 * directly. That is ported as-is rather than fixed. Adding an `analyticsService`
 * would change the shipped page's contract too, which is a wider change than a
 * design preview should carry — so it is noted here rather than silently
 * corrected.
 *
 * The shipped page draws its distributions as hand-built bar divs. Here they go
 * through the shared chart primitive, and every plotted value is repeated in a
 * table underneath, so nothing is reachable only by hovering or by telling
 * shades apart.
 */
export function AnalyticsWorkItemsPageV2() {
  const { t } = useTranslation();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  useDocumentTitle(t('analytics.workItems', 'Work items'));

  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(workspaceSlug));
  const [exportingWorkspace, setExportingWorkspace] = useState(false);
  const [exportingProjectId, setExportingProjectId] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceSlug) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      let ws: WorkspaceApiResponse | null = null;
      try {
        ws = await workspaceService.getBySlug(workspaceSlug);
      } catch {
        if (!cancelled) setWorkspace(null);
        return;
      }
      if (cancelled) return;
      setWorkspace(ws);

      /* allSettled so a failing analytics call still leaves the project list —
         the export buttons below it remain usable. */
      const [projectsResult, analyticsResult] = await Promise.allSettled([
        projectService.list(workspaceSlug),
        fetch(`${API_BASE}/api/workspaces/${workspaceSlug}/analytics/`, {
          credentials: 'include',
        }).then((res) => {
          if (!res.ok) throw new Error(`Analytics request failed: ${res.status}`);
          return res.json() as Promise<AnalyticsResponse>;
        }),
      ]);
      if (cancelled) return;

      if (projectsResult.status === 'fulfilled' && projectsResult.value) {
        setProjects(projectsResult.value);
      }
      if (analyticsResult.status === 'fulfilled') {
        setAnalytics(analyticsResult.value);
        setAnalyticsError(null);
      } else {
        setAnalyticsError(t('analytics.loadFailed', 'Could not load analytics. Please try again.'));
      }
    })().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, t]);

  const stateData = useMemo(() => {
    const byState = analytics?.by_state ?? {};
    return STATE_GROUPS.map((entry) => ({
      group: entry.group,
      label: t(`analytics.stateGroup.${entry.group}`, entry.label),
      count: sumStateGroup(byState, entry.synonyms),
      fill: entry.color,
    }));
  }, [analytics, t]);

  const priorityData = useMemo(() => {
    const byPriority = analytics?.by_priority ?? {};
    return PRIORITIES.map((priority) => ({
      group: priority,
      label: PRIORITY_LABELS[priority as Priority],
      count: byPriority[priority] ?? 0,
      fill: priority === 'urgent' ? 'var(--destructive)' : 'var(--chart-1)',
    }));
  }, [analytics]);

  const trend = analytics?.trend ?? [];

  const stateChartConfig = useMemo(
    () =>
      ({
        count: { label: t('analytics.workItems', 'Work items') },
        ...Object.fromEntries(
          stateData.map((entry) => [entry.group, { label: entry.label, color: entry.fill }]),
        ),
      }) satisfies ChartConfig,
    [stateData, t],
  );

  const trendChartConfig = useMemo(
    () =>
      ({
        created: { label: t('analytics.created', 'Created'), color: 'var(--chart-1)' },
        resolved: { label: t('analytics.resolved', 'Resolved'), color: 'var(--chart-2)' },
      }) satisfies ChartConfig,
    [t],
  );

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
      const project = projects.find((p) => p.id === projectId);
      const fallback = `project-${project?.name ?? projectId}-analytics-${new Date()
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
      <div className="space-y-6 pb-8">
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <p className="text-muted-foreground text-sm">
        {t('common.workspaceNotFound', 'Workspace not found.')}
      </p>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {analyticsError && (
        <p className="text-destructive text-sm" role="alert">
          {analyticsError}
        </p>
      )}
      {analytics?.partial_error && (
        <p className="text-muted-foreground text-sm">
          {t('analytics.partial', 'Some analytics could not be computed and are shown as zero.')}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.byState', 'By state')}</CardTitle>
            <CardDescription>
              {t('analytics.byStateHint', 'Open work items grouped by state.')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ChartContainer config={stateChartConfig} className="h-[220px] w-full">
              <BarChart accessibilityLayer data={stateData} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" dataKey="count" hide />
                <YAxis
                  type="category"
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  width={90}
                />
                <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={22}>
                  {stateData.map((entry) => (
                    <Cell key={entry.group} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>

            {/* Every plotted value in text, so nothing is reachable only by
                hovering or by telling shades apart. */}
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t('views.state', 'State')}</TableHead>
                  <TableHead className="w-24 text-right">{t('analytics.count', 'Count')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stateData.map((entry) => (
                  <TableRow key={entry.group}>
                    <TableCell>{entry.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{entry.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.byPriority', 'By priority')}</CardTitle>
            <CardDescription>
              {t('analytics.byPriorityHint', 'Open work items grouped by priority.')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ChartContainer config={stateChartConfig} className="h-[220px] w-full">
              <BarChart
                accessibilityLayer
                data={priorityData}
                layout="vertical"
                margin={{ left: 8 }}
              >
                <CartesianGrid horizontal={false} />
                <XAxis type="number" dataKey="count" hide />
                <YAxis
                  type="category"
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  width={90}
                />
                <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={22}>
                  {priorityData.map((entry) => (
                    <Cell key={entry.group} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>

            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t('views.priority', 'Priority')}</TableHead>
                  <TableHead className="w-24 text-right">{t('analytics.count', 'Count')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {priorityData.map((entry) => (
                  <TableRow key={entry.group}>
                    <TableCell>{entry.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{entry.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {trend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.trend', 'Created vs resolved')}</CardTitle>
            <CardDescription>
              {t('analytics.trendHint', 'Work items opened and closed over time.')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={trendChartConfig} className="h-[240px] w-full">
              <LineChart accessibilityLayer data={trend} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={32} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  dataKey="created"
                  type="monotone"
                  stroke="var(--color-created)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  dataKey="resolved"
                  type="monotone"
                  stroke="var(--color-resolved)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>{t('analytics.exports', 'Exports')}</CardTitle>
            <CardDescription>
              {t('analytics.exportsHint', 'Download the underlying rows as CSV.')}
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void exportWorkspaceCsv()}
            disabled={exportingWorkspace}
          >
            <Download />
            {exportingWorkspace
              ? t('analytics.exporting', 'Exporting…')
              : t('analytics.exportWorkspace', 'Export workspace')}
          </Button>
        </CardHeader>
        <CardContent>
          {exportError && (
            <p className="text-destructive mb-3 text-sm" role="alert">
              {exportError}
            </p>
          )}
          {projects.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t('projects.empty', 'No projects yet')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t('common.project', 'Project')}</TableHead>
                  <TableHead className="w-32 text-right">
                    {t('analytics.export', 'Export')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="truncate font-medium">{project.name}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void exportProjectCsv(project.id)}
                        disabled={exportingProjectId === project.id}
                      >
                        <Download />
                        {exportingProjectId === project.id
                          ? t('analytics.exporting', 'Exporting…')
                          : t('analytics.exportCsv', 'CSV')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
