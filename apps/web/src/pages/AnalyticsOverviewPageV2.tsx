import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/shadcn/ui/badge';
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
import { Progress } from '@/components/shadcn/ui/progress';
import { Skeleton } from '@/components/shadcn/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/ui/table';
import { cycleService } from '../services/cycleService';
import { issueService } from '../services/issueService';
import { moduleService } from '../services/moduleService';
import { pageService } from '../services/pageService';
import { projectService } from '../services/projectService';
import { stateService } from '../services/stateService';
import { workspaceService } from '../services/workspaceService';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import type {
  IssueApiResponse,
  ProjectApiResponse,
  StateApiResponse,
  WorkspaceApiResponse,
  WorkspaceMemberApiResponse,
} from '../api/types';

const ISSUE_PAGE_SIZE = 100;

/** Roles at or above this are admins; below are members. */
const ADMIN_ROLE = 20;

/** Projects listed in the sidebar before the rest are folded away. */
const MAX_PROJECTS_LISTED = 8;

/**
 * Work item states, in lifecycle order. This is an ordered scale rather than a
 * set of unrelated categories, so it takes one hue stepped light→dark rather
 * than one hue per class — the reader gets progression for free, and nothing
 * relies on telling five hues apart.
 *
 * The steps are the blue ramp widened until adjacent lightness gaps are visible
 * in both modes (validated: monotone L, gaps >= 0.06, light end clears the
 * surface at 2:1).
 */
const STATE_GROUP_ORDER = ['backlog', 'unstarted', 'started', 'completed', 'cancelled'] as const;
type StateGroupKey = (typeof STATE_GROUP_ORDER)[number];

const STATE_GROUP_STEPS: Record<StateGroupKey, { light: string; dark: string }> = {
  backlog: { light: '#86b6ef', dark: '#cde2fb' },
  unstarted: { light: '#5598e7', dark: '#9ec5f4' },
  started: { light: '#2a78d6', dark: '#6da7ec' },
  completed: { light: '#1c5cab', dark: '#3987e5' },
  cancelled: { light: '#104281', dark: '#184f95' },
};

async function fetchAllProjectIssues(
  workspaceSlug: string,
  projectId: string,
): Promise<IssueApiResponse[]> {
  const issues: IssueApiResponse[] = [];
  let offset = 0;

  while (true) {
    const page = await issueService.list(workspaceSlug, projectId, {
      limit: ISSUE_PAGE_SIZE,
      offset,
    });
    issues.push(...page);

    if (page.length < ISSUE_PAGE_SIZE) return issues;
    offset += page.length;
  }
}

/** The API spells cancelled both ways; both mean the same group. */
function normalizeStateGroup(group: string | undefined): StateGroupKey | undefined {
  if (!group) return undefined;
  const value = group.toLowerCase();
  if (value === 'canceled') return 'cancelled';
  return (STATE_GROUP_ORDER as readonly string[]).includes(value)
    ? (value as StateGroupKey)
    : undefined;
}

/**
 * Design preview of the analytics overview, built from shadcn primitives. It
 * stands alongside AnalyticsOverviewPage rather than replacing it, so the two
 * can be compared side by side.
 *
 * Two things changed beyond the chrome, because the shipped versions state
 * something the data does not support:
 *
 * - The radar chart is gone. It plotted work items, cycles, members and pages
 *   on one shared radius, so a workspace with 300 work items and 5 members drew
 *   a spike that means nothing — the quantities have no common unit, and the
 *   shape implied they were comparable. The same numbers are now stat tiles,
 *   where each is read on its own, and the two questions the chart was reaching
 *   for get real forms: how work is distributed across states (part-to-whole)
 *   and how far each project has got (magnitude, compared).
 * - Cycles, modules and pages were hard-coded to zero. They are fetched here.
 */
export function AnalyticsOverviewPageV2() {
  const { t } = useTranslation();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [issues, setIssues] = useState<IssueApiResponse[]>([]);
  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [cycleCount, setCycleCount] = useState(0);
  const [moduleCount, setModuleCount] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useDocumentTitle(t('analytics.documentTitle', 'Analytics'));

  useEffect(() => {
    if (!workspaceSlug) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(false);

    const loadAnalytics = async () => {
      try {
        let loadedWorkspace: WorkspaceApiResponse;
        try {
          loadedWorkspace = await workspaceService.getBySlug(workspaceSlug);
        } catch {
          if (cancelled) return;
          setWorkspace(null);
          setProjects([]);
          setIssues([]);
          setStates([]);
          setMembers([]);
          return;
        }

        if (cancelled) return;
        setWorkspace(loadedWorkspace);

        const [projs, mem] = await Promise.all([
          projectService.list(workspaceSlug),
          workspaceService.listMembers(workspaceSlug),
        ]);
        const [issueArrays, stateArrays] = projs.length
          ? await Promise.all([
              Promise.all(projs.map((p) => fetchAllProjectIssues(workspaceSlug, p.id))),
              Promise.all(projs.map((p) => stateService.list(workspaceSlug, p.id))),
            ])
          : [[], []];

        if (cancelled) return;
        setProjects(projs);
        setMembers(mem);
        setIssues(issueArrays.flat());
        setStates(stateArrays.flat());

        /* Counted after the main figures are on screen, and each swallows its
           own failure: these are secondary tiles, so one unreadable project
           should not blank the page. */
        if (projs.length) {
          const [cycles, modules] = await Promise.all([
            Promise.all(projs.map((p) => cycleService.list(workspaceSlug, p.id).catch(() => []))),
            Promise.all(projs.map((p) => moduleService.list(workspaceSlug, p.id).catch(() => []))),
          ]);
          if (cancelled) return;
          setCycleCount(cycles.flat().length);
          setModuleCount(modules.flat().length);
        }
        const pages = await pageService.list(workspaceSlug).catch(() => []);
        if (cancelled) return;
        setPageCount(pages.length);
      } catch {
        if (cancelled) return;
        setProjects([]);
        setIssues([]);
        setStates([]);
        setMembers([]);
        setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadAnalytics();
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  const stateGroupById = useMemo(
    () => new Map(states.map((s) => [s.id, normalizeStateGroup(s.group)])),
    [states],
  );

  /** Work items per lifecycle state, in order. */
  const stateDistribution = useMemo(() => {
    const counts = new Map<StateGroupKey, number>(STATE_GROUP_ORDER.map((group) => [group, 0]));
    for (const issue of issues) {
      const group = issue.state_id ? stateGroupById.get(issue.state_id) : undefined;
      if (!group) continue;
      counts.set(group, (counts.get(group) ?? 0) + 1);
    }
    return STATE_GROUP_ORDER.map((group) => ({
      group,
      count: counts.get(group) ?? 0,
    }));
  }, [issues, stateGroupById]);

  /* Cancelled work is excluded from the denominator: a cancelled item was
     neither completed nor left outstanding, so counting it would make a
     finished project look unfinished. */
  const completionByProjectId = useMemo(() => {
    const stats = new Map<string, { total: number; completed: number }>();
    for (const issue of issues) {
      const group = issue.state_id ? stateGroupById.get(issue.state_id) : undefined;
      if (group === 'cancelled') continue;
      const entry = stats.get(issue.project_id) ?? { total: 0, completed: 0 };
      entry.total += 1;
      if (group === 'completed') entry.completed += 1;
      stats.set(issue.project_id, entry);
    }
    return stats;
  }, [issues, stateGroupById]);

  const projectProgress = useMemo(
    () =>
      projects
        .map((project) => {
          const stats = completionByProjectId.get(project.id) ?? { total: 0, completed: 0 };
          return {
            id: project.id,
            name: project.name,
            identifier: project.identifier ?? project.id.slice(0, 8),
            total: stats.total,
            completed: stats.completed,
            percent: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
          };
        })
        .sort((a, b) => b.percent - a.percent || b.total - a.total),
    [projects, completionByProjectId],
  );

  if (loading) {
    return (
      <div className="space-y-6 pb-8">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-[88px] rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <Skeleton className="h-[360px] rounded-xl" />
          <Skeleton className="h-[360px] rounded-xl" />
        </div>
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

  if (loadError) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {t('analytics.loadError', 'Could not load analytics data.')}
      </p>
    );
  }

  const totalWorkItems = issues.length;
  const admins = members.filter((m) => m.role >= ADMIN_ROLE).length;

  const stateGroupLabels: Record<StateGroupKey, string> = {
    backlog: t('analytics.stateBacklog', 'Backlog'),
    unstarted: t('analytics.stateTodo', 'Todo'),
    started: t('analytics.stateInProgress', 'In progress'),
    completed: t('analytics.stateDone', 'Done'),
    cancelled: t('analytics.stateCancelled', 'Cancelled'),
  };

  /* Each tile is read on its own terms, which is exactly what the radar chart
     could not do — no shared axis is implied between members and work items. */
  const statTiles = [
    { label: t('analytics.totalProjects', 'Projects'), value: projects.length },
    { label: t('analytics.totalWorkItems', 'Work items'), value: totalWorkItems },
    { label: t('analytics.totalCycles', 'Cycles'), value: cycleCount },
    { label: t('analytics.totalModules', 'Modules'), value: moduleCount },
    { label: t('analytics.totalPages', 'Pages'), value: pageCount },
    { label: t('analytics.totalUsers', 'Members'), value: members.length },
    { label: t('analytics.totalAdmins', 'Admins'), value: admins },
    {
      label: t('analytics.totalMembers', 'Contributors'),
      value: members.length - admins,
    },
  ];

  const chartConfig: ChartConfig = {
    count: { label: t('analytics.workItems', 'Work items') },
    ...Object.fromEntries(
      STATE_GROUP_ORDER.map((group) => [
        group,
        {
          label: stateGroupLabels[group],
          theme: { light: STATE_GROUP_STEPS[group].light, dark: STATE_GROUP_STEPS[group].dark },
        },
      ]),
    ),
  };

  const chartData = stateDistribution.map((entry) => ({
    ...entry,
    label: stateGroupLabels[entry.group],
    fill: `var(--color-${entry.group})`,
  }));

  const classified = stateDistribution.reduce((sum, entry) => sum + entry.count, 0);
  const unclassified = totalWorkItems - classified;

  return (
    <div className="space-y-6 pb-8">
      {/* No tab strip: the sidebar's Analytics group already lists Overview and
          Work items, and a second copy of the same two links inside the page
          just repeats it. The heading names the page in its place. */}
      <h2 className="text-lg font-semibold">{t('analytics.overview', 'Overview')}</h2>

      {/* Stat tiles. Proportional figures, not tabular: these do not align in a
          column, and tabular digits read loose at this size. */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statTiles.map(({ label, value }) => (
          <Card key={label} className="gap-0 py-4">
            <CardContent className="px-4">
              <p className="text-muted-foreground text-xs font-medium">{label}</p>
              <p className="mt-1 text-2xl font-semibold">{value.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{t('analytics.workItemsByState', 'Work items by state')}</CardTitle>
            <CardDescription>
              {t(
                'analytics.workItemsByStateDescription',
                'Every work item in the workspace, by where it sits in its lifecycle.',
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {totalWorkItems === 0 ? (
              <p className="text-muted-foreground py-12 text-center text-sm">
                {t('analytics.noWorkItems', 'No work items yet.')}
              </p>
            ) : (
              <>
                {/* Horizontal bars: the state names are long, and reading them
                    flat beats rotated column labels. One hue stepped by
                    lifecycle position, so no legend is needed — the axis names
                    every bar, and each value is labelled at its tip. */}
                <ChartContainer config={chartConfig} className="h-[260px] w-full">
                  <BarChart
                    accessibilityLayer
                    data={chartData}
                    layout="vertical"
                    margin={{ left: 8, right: 40, top: 4, bottom: 4 }}
                  >
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" dataKey="count" hide />
                    <YAxis
                      type="category"
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      width={92}
                      tickMargin={8}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent hideLabel={false} nameKey="label" />}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={22}>
                      {chartData.map((entry) => (
                        <Cell key={entry.group} fill={entry.fill} />
                      ))}
                      <LabelList
                        dataKey="count"
                        position="right"
                        offset={8}
                        className="fill-foreground"
                        fontSize={12}
                      />
                    </Bar>
                  </BarChart>
                </ChartContainer>

                {/* The table view: every plotted value in text, so nothing is
                    reachable only by hovering or by telling shades apart. */}
                <Table className="mt-4">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>{t('analytics.state', 'State')}</TableHead>
                      <TableHead className="text-right">
                        {t('analytics.workItems', 'Work items')}
                      </TableHead>
                      <TableHead className="text-right">{t('analytics.share', 'Share')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stateDistribution.map((entry) => (
                      <TableRow key={entry.group}>
                        <TableCell className="flex items-center gap-2">
                          {/* Identity rides a swatch beside the name, never the
                              text colour — a light step is illegible as ink. */}
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: `var(--color-${entry.group})` }}
                          />
                          {stateGroupLabels[entry.group]}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{entry.count}</TableCell>
                        <TableCell className="text-muted-foreground text-right tabular-nums">
                          {classified > 0 ? Math.round((entry.count / classified) * 100) : 0}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {unclassified > 0 && (
                  <p className="text-muted-foreground mt-3 text-xs">
                    {t(
                      'analytics.unclassifiedWorkItems',
                      '{{count}} work items have no state and are not plotted.',
                      { count: unclassified },
                    )}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{t('analytics.projectProgress', 'Project progress')}</CardTitle>
            <CardDescription>
              {t(
                'analytics.projectProgressDescription',
                'Share of each project’s work items that are done. Cancelled items are excluded.',
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {projectProgress.length === 0 ? (
              <p className="text-muted-foreground py-12 text-center text-sm">
                {t('projects.empty', 'No projects yet.')}
              </p>
            ) : (
              <>
                {projectProgress.slice(0, MAX_PROJECTS_LISTED).map((project) => (
                  <div key={project.id} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-sm font-medium">{project.name}</span>
                      {/* A plain figure, not a coloured badge: a percentage is
                          not a status, and the shipped page painted every one
                          of them in the danger colour — including 100%. */}
                      <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                        {project.percent}%
                      </span>
                    </div>
                    <Progress value={project.percent} />
                    <p className="text-muted-foreground text-xs tabular-nums">
                      {t('analytics.completedOfTotal', '{{completed}} of {{total}} done', {
                        completed: project.completed,
                        total: project.total,
                      })}
                    </p>
                  </div>
                ))}

                {projectProgress.length > MAX_PROJECTS_LISTED && (
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link to={`/${workspace.slug}/app-v2/projects`}>
                      {t('analytics.viewAllProjects', 'All {{count}} projects', {
                        count: projectProgress.length,
                      })}
                    </Link>
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {totalWorkItems > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.projectBreakdown', 'Project breakdown')}</CardTitle>
            <CardDescription>
              {t(
                'analytics.projectBreakdownDescription',
                'Work item counts per project, alongside how much is finished.',
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t('analytics.project', 'Project')}</TableHead>
                  <TableHead className="text-right">
                    {t('analytics.workItems', 'Work items')}
                  </TableHead>
                  <TableHead className="text-right">{t('analytics.done', 'Done')}</TableHead>
                  <TableHead className="text-right">
                    {t('analytics.completion', 'Completion')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projectProgress.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <Badge variant="secondary" className="font-mono text-[10px]">
                          {project.identifier}
                        </Badge>
                        <span className="truncate font-medium">{project.name}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{project.total}</TableCell>
                    <TableCell className="text-right tabular-nums">{project.completed}</TableCell>
                    <TableCell className="text-right tabular-nums">{project.percent}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
