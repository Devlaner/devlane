import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Cell, Pie, PieChart } from 'recharts';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/shadcn/ui/avatar';
import { Badge } from '@/components/shadcn/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shadcn/ui/card';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/shadcn/ui/tabs';
import { useAuth } from '../contexts/AuthContext';
import { getImageUrl } from '../lib/utils';
import {
  PRIORITIES,
  PRIORITY_LABELS,
  formatDate,
  formatTimeAgo,
  priorityVariant,
  stateDotStyle,
  workItemDisplayId,
  type Priority,
} from '../lib/projectV2';
import { issueService } from '../services/issueService';
import { projectService } from '../services/projectService';
import { stateService } from '../services/stateService';
import { workspaceService } from '../services/workspaceService';
import type {
  IssueApiResponse,
  ProjectApiResponse,
  StateApiResponse,
  WorkspaceApiResponse,
  WorkspaceMemberApiResponse,
} from '../api/types';

type TabId = 'summary' | 'assigned' | 'created' | 'activity';

/* One hue per state group, matching the ramp AnalyticsOverviewPageV2 uses so a
   reader moving between the two pages reads the same colour the same way. */
const WORKLOAD_GROUPS = [
  { group: 'backlog', label: 'Backlog', color: 'var(--chart-4)' },
  { group: 'unstarted', label: 'Todo', color: 'var(--chart-1)' },
  { group: 'started', label: 'In Progress', color: 'var(--chart-3)' },
  { group: 'completed', label: 'Done', color: 'var(--chart-2)' },
  { group: 'cancelled', label: 'Cancelled', color: 'var(--chart-5)' },
] as const;

function initials(name: string | undefined): string {
  if (!name) return '?';
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

/**
 * Design preview of a workspace member's profile, built from shadcn primitives.
 * It stands alongside ProfilePage rather than replacing it, so the two can be
 * compared side by side.
 *
 * The shipped page spends most of its height on hand-rolled SVG stat cards. The
 * numbers behind them are the same handful of counts, so this one puts them in
 * a single card row and gives the space back to the work item tables, which are
 * what a reader actually scans. The workload donut moves onto the shared chart
 * primitive rather than a conic-gradient div.
 *
 * Like the shipped page, only the signed-in user resolves: there is no
 * user-by-id endpoint yet, so a `:userId` naming anyone else falls back to the
 * current user.
 */
export function ProfilePageV2() {
  const { t } = useTranslation();
  const { workspaceSlug, userId } = useParams<{ workspaceSlug: string; userId: string }>();
  const { user } = useAuth();

  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [issues, setIssues] = useState<IssueApiResponse[]>([]);
  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [loading, setLoading] = useState(Boolean(workspaceSlug));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceSlug) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the spinner belongs to this fetch
    setLoading(true);
    Promise.all([
      workspaceService.getBySlug(workspaceSlug),
      projectService.list(workspaceSlug),
      workspaceService.listMembers(workspaceSlug).catch(() => [] as WorkspaceMemberApiResponse[]),
    ])
      .then(async ([w, projectList, memberList]) => {
        if (cancelled) return;
        setWorkspace(w ?? null);
        setProjects(projectList ?? []);
        setMembers(memberList ?? []);
        const list = projectList ?? [];
        if (list.length === 0) {
          setIssues([]);
          setStates([]);
          setError(null);
          return;
        }
        /* Work items and states are per project, so both fan out across the
           workspace's projects. A single project failing leaves the rest. */
        const [issueLists, stateLists] = await Promise.all([
          Promise.all(
            list.map((p) =>
              issueService
                .list(workspaceSlug, p.id, { limit: 100 })
                .catch(() => [] as IssueApiResponse[]),
            ),
          ),
          Promise.all(
            list.map((p) =>
              stateService.list(workspaceSlug, p.id).catch(() => [] as StateApiResponse[]),
            ),
          ),
        ]);
        if (cancelled) return;
        setIssues(issueLists.flat());
        setStates(stateLists.flat());
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setWorkspace(null);
        setError(t('profile.loadError', 'Could not load this profile.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, t]);

  /* Only the current user resolves until a user-by-id endpoint exists. */
  const profileUser = useMemo(
    () => (userId && user?.id === userId ? user : (user ?? null)),
    [userId, user],
  );

  const member = useMemo(
    () => (profileUser ? (members.find((m) => m.member_id === profileUser.id) ?? null) : null),
    [members, profileUser],
  );

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const stateById = useMemo(() => new Map(states.map((s) => [s.id, s])), [states]);

  const issuesCreated = useMemo(
    () => (profileUser ? issues.filter((i) => i.created_by_id === profileUser.id) : []),
    [issues, profileUser],
  );

  const issuesAssigned = useMemo(
    () =>
      profileUser
        ? issues.filter((i) => (i.assignee_ids ?? []).includes(profileUser.id))
        : ([] as IssueApiResponse[]),
    [issues, profileUser],
  );

  const workload = useMemo(() => {
    const counts = new Map<string, number>();
    issuesAssigned.forEach((issue) => {
      const group = issue.state_id ? stateById.get(issue.state_id)?.group : undefined;
      /* The API spells the cancelled group both ways depending on endpoint. */
      const key = group === 'canceled' ? 'cancelled' : (group ?? 'backlog');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return WORKLOAD_GROUPS.map((entry) => ({
      ...entry,
      label: t(`profile.workload.${entry.group}`, entry.label),
      count: counts.get(entry.group) ?? 0,
    }));
  }, [issuesAssigned, stateById, t]);

  const workloadTotal = useMemo(
    () => workload.reduce((sum, entry) => sum + entry.count, 0),
    [workload],
  );

  const chartConfig = useMemo(
    () =>
      Object.fromEntries(
        workload.map((entry) => [entry.group, { label: entry.label, color: entry.color }]),
      ) satisfies ChartConfig,
    [workload],
  );

  const priorityCounts = useMemo(() => {
    const counts = new Map<Priority, number>(PRIORITIES.map((p) => [p, 0]));
    issuesAssigned.forEach((issue) => {
      const priority = (issue.priority ?? 'none') as Priority;
      counts.set(priority, (counts.get(priority) ?? 0) + 1);
    });
    return counts;
  }, [issuesAssigned]);

  const recentActivity = useMemo(
    () =>
      [...issuesCreated]
        .sort(
          (a, b) =>
            Date.parse(b.created_at ?? b.updated_at ?? '') -
            Date.parse(a.created_at ?? a.updated_at ?? ''),
        )
        .slice(0, 20),
    [issuesCreated],
  );

  if (loading) {
    return (
      <div className="space-y-6 pb-8">
        <Skeleton className="h-28 w-full rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <p className="text-muted-foreground text-sm">
        {error ?? t('common.workspaceNotFound', 'Workspace not found.')}
      </p>
    );
  }

  const avatarUrl = getImageUrl(profileUser?.avatarUrl ?? null);

  const workItemsTable = (rows: IssueApiResponse[], emptyMessage: string) => (
    <div className="min-h-0 overflow-auto rounded-xl border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent">
            <TableHead className="px-3">{t('views.workItems', 'Work items')}</TableHead>
            <TableHead className="w-40 px-3">{t('views.state', 'State')}</TableHead>
            <TableHead className="w-32 px-3">{t('views.priority', 'Priority')}</TableHead>
            <TableHead className="w-36 px-3">{t('issues.targetDate', 'Due')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={4} className="text-muted-foreground h-32 text-center">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((issue) => {
              const project = projectById.get(issue.project_id);
              const state = issue.state_id ? stateById.get(issue.state_id) : undefined;
              return (
                <TableRow key={issue.id}>
                  <TableCell className="p-0">
                    <Link
                      to={`/${workspaceSlug}/app-v2/projects/${issue.project_id}/work-items/${issue.id}`}
                      className="hover:bg-muted/50 flex h-12 items-center gap-2 px-3 transition-colors"
                    >
                      <span className="text-muted-foreground shrink-0 font-mono text-xs">
                        {workItemDisplayId(issue, project)}
                      </span>
                      <span className="truncate font-medium">{issue.name}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="px-3">
                    <span className="flex items-center gap-2 text-sm">
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full"
                        style={stateDotStyle(state)}
                      />
                      <span className="truncate">
                        {state?.name ?? t('common.noState', 'No state')}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="px-3">
                    <Badge variant={priorityVariant(issue.priority)}>
                      {PRIORITY_LABELS[(issue.priority ?? 'none') as Priority] ?? issue.priority}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground px-3 text-sm">
                    {formatDate(issue.target_date)}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-6 pb-8">
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4">
          <Avatar className="size-16">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={profileUser?.name ?? ''} />}
            <AvatarFallback>{initials(profileUser?.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold">
              {profileUser?.name ?? t('profile.documentTitle', 'Profile')}
            </h2>
            <p className="text-muted-foreground truncate text-sm">{profileUser?.email}</p>
          </div>
          <div className="text-muted-foreground text-sm">
            {t('profile.joined', 'Joined')} {formatDate(member?.created_at)}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              {t('profile.tab.assigned', 'Assigned')}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {issuesAssigned.length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              {t('profile.tab.created', 'Created')}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {issuesCreated.length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              {t('profile.projects', 'Projects')}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {projects.length}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue={'summary' satisfies TabId}>
        <TabsList>
          <TabsTrigger value="summary">{t('profile.tab.summary', 'Summary')}</TabsTrigger>
          <TabsTrigger value="assigned">{t('profile.tab.assigned', 'Assigned')}</TabsTrigger>
          <TabsTrigger value="created">{t('profile.tab.created', 'Created')}</TabsTrigger>
          <TabsTrigger value="activity">{t('profile.tab.activity', 'Activity')}</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t('profile.workloadTitle', 'Workload')}</CardTitle>
              </CardHeader>
              <CardContent>
                {workloadTotal === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    {t('profile.noAssigned', 'Nothing assigned yet.')}
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-6">
                    <ChartContainer config={chartConfig} className="aspect-square h-44">
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
                        <Pie data={workload} dataKey="count" nameKey="label" innerRadius={45}>
                          {workload.map((entry) => (
                            <Cell key={entry.group} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ChartContainer>
                    <ul className="min-w-40 space-y-2">
                      {workload.map((entry) => (
                        <li key={entry.group} className="flex items-center gap-2 text-sm">
                          <span
                            aria-hidden
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="flex-1 truncate">{entry.label}</span>
                          <span className="text-muted-foreground tabular-nums">{entry.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('views.priority', 'Priority')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {PRIORITIES.map((priority) => {
                  const count = priorityCounts.get(priority) ?? 0;
                  const percent =
                    workloadTotal === 0 ? 0 : Math.round((count / workloadTotal) * 100);
                  return (
                    <div key={priority} className="flex items-center gap-3">
                      <span className="w-16 shrink-0 text-sm">{PRIORITY_LABELS[priority]}</span>
                      <Progress value={percent} className="h-2 flex-1" />
                      <span className="text-muted-foreground w-8 shrink-0 text-right text-xs tabular-nums">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="assigned">
          {workItemsTable(issuesAssigned, t('profile.noAssigned', 'Nothing assigned yet.'))}
        </TabsContent>

        <TabsContent value="created">
          {workItemsTable(issuesCreated, t('profile.noCreated', 'Nothing created yet.'))}
        </TabsContent>

        <TabsContent value="activity">
          <div className="overflow-auto rounded-xl border">
            {recentActivity.length === 0 ? (
              <p className="text-muted-foreground px-4 py-12 text-center text-sm">
                {t('profile.noRecentActivity', 'No recent activity')}
              </p>
            ) : (
              <ul className="divide-y">
                {recentActivity.map((issue) => {
                  const project = projectById.get(issue.project_id);
                  return (
                    <li key={issue.id}>
                      <Link
                        to={`/${workspaceSlug}/app-v2/projects/${issue.project_id}/work-items/${issue.id}`}
                        className="hover:bg-muted/50 flex items-center gap-2 px-4 py-3 text-sm transition-colors"
                      >
                        <span className="text-muted-foreground shrink-0 font-mono text-xs">
                          {workItemDisplayId(issue, project)}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {t('profile.activityTab.createdShort', 'Created')} {issue.name}
                        </span>
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {formatTimeAgo(issue.created_at ?? issue.updated_at)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
