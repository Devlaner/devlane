import { useCallback, useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import {
  Bell,
  ChevronDown,
  Download,
  FileText,
  Folder,
  Pencil,
  Users,
  UserRound,
} from 'lucide-react';
import { Cell, Pie, PieChart } from 'recharts';
import { PageHeading } from '@/components/shadcn/page-heading';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/shadcn/ui/avatar';
import { Badge } from '@/components/shadcn/ui/badge';
import { Button } from '@/components/shadcn/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shadcn/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/shadcn/ui/chart';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/shadcn/ui/collapsible';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/shadcn/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shadcn/ui/tooltip';
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

const TAB_IDS = ['summary', 'assigned', 'created', 'subscribed', 'activity'] as const;
type TabId = (typeof TAB_IDS)[number];

/** Fallback labels, used when a locale has no string for the tab. */
const TAB_LABELS: Record<TabId, string> = {
  summary: 'Summary',
  assigned: 'Assigned',
  created: 'Created',
  subscribed: 'Subscribed',
  activity: 'Activity',
};

function isTabId(value: string): value is TabId {
  return (TAB_IDS as readonly string[]).includes(value);
}

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

/** Quotes a CSV field so commas, quotes and newlines survive a spreadsheet. */
function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Design preview of a workspace member's profile, built from shadcn primitives.
 * It stands alongside ProfilePage rather than replacing it, so the two can be
 * compared side by side.
 *
 * It carries everything the shipped page shows — identity header with cover,
 * username, join date and timezone; the created/assigned/subscribed counters;
 * workload by state; work items by priority; per-project state breakdowns; and
 * recent activity — but the shipped page spends most of its height on
 * hand-rolled SVG stat cards and a conic-gradient donut. Here the counters
 * collapse into one card row, the donut moves onto the shared chart primitive,
 * and the space goes back to the work item tables, which are what a reader
 * actually scans.
 *
 * Like the shipped page, only the signed-in user resolves: there is no
 * user-by-id endpoint yet, so a `:userId` naming anyone else falls back to the
 * current user.
 */
export function ProfilePageV2() {
  const { t } = useTranslation();
  const { workspaceSlug, userId } = useParams<{ workspaceSlug: string; userId: string }>();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabId>('summary');
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [issues, setIssues] = useState<IssueApiResponse[]>([]);
  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [loading, setLoading] = useState(Boolean(workspaceSlug));
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!workspaceSlug) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
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
  }, [workspaceSlug, t, reloadToken]);

  /* Only the current user resolves until a user-by-id endpoint exists. */
  const profileUser = useMemo(
    () => (userId && user?.id === userId ? user : (user ?? null)),
    [userId, user],
  );

  const member = useMemo(
    () => (profileUser ? (members.find((m) => m.member_id === profileUser.id) ?? null) : null),
    [members, profileUser],
  );

  const memberById = useMemo(() => new Map(members.map((m) => [m.member_id, m])), [members]);
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

  /* Subscriptions are only readable one work item at a time
     (`GET …/issues/:id/subscribe/`), so listing them would be one request per
     work item in the workspace. The shipped page takes the same shortcut and
     shows the assigned set here; this mirrors it until a list endpoint exists. */
  const issuesSubscribed = issuesAssigned;

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

  /* Per project: how its work items sit across that project's own states, and
     what share of them landed in a completed state. The shipped sidebar shows
     the same breakdown but hard-codes progress to 0. */
  const projectBreakdown = useMemo(
    () =>
      projects
        .filter((p) => !workspace?.id || p.workspace_id === workspace.id)
        .map((project) => {
          const projectStates = states
            .filter((s) => s.project_id === project.id)
            .map((state) => ({
              ...state,
              count: issues.filter((i) => i.project_id === project.id && i.state_id === state.id)
                .length,
            }));
          const total = projectStates.reduce((sum, s) => sum + s.count, 0);
          const completed = projectStates
            .filter((s) => s.group === 'completed')
            .reduce((sum, s) => sum + s.count, 0);
          return {
            project,
            states: projectStates,
            total,
            progress: total === 0 ? 0 : Math.round((completed / total) * 100),
          };
        }),
    [projects, states, issues, workspace?.id],
  );

  const timezone = useMemo(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const time = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return { zone, time };
  }, []);

  const todaysActivity = useMemo(() => {
    const today = new Date().toDateString();
    return recentActivity.filter((issue) => {
      const created = issue.created_at ?? issue.updated_at;
      const parsed = created ? Date.parse(created) : Number.NaN;
      return !Number.isNaN(parsed) && new Date(parsed).toDateString() === today;
    });
  }, [recentActivity]);

  const downloadTodaysActivity = useCallback(() => {
    const header = ['id', 'work_item', 'project', 'created_at'];
    const rows = todaysActivity.map((issue) => {
      const project = projectById.get(issue.project_id);
      return [
        workItemDisplayId(issue, project),
        issue.name,
        project?.name ?? '',
        issue.created_at ?? issue.updated_at ?? '',
      ]
        .map(csvField)
        .join(',');
    });
    const blob = new Blob([[header.join(','), ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `activity-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [todaysActivity, projectById]);

  if (loading) {
    return (
      <div
        className="space-y-6 pb-8"
        aria-busy="true"
        aria-label={t('profile.loading', 'Loading profile')}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-44 w-full rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div
        className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center"
        role="alert"
      >
        <span className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-full">
          <UserRound aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-xl font-semibold">
          {error ?? t('common.workspaceNotFound', 'Workspace not found.')}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-md text-sm">
          {t(
            'profile.loadErrorDescription',
            'Check your connection and try again. Your profile data has not been changed.',
          )}
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-5"
          onClick={() => setReloadToken((value) => value + 1)}
        >
          {t('common.retry', 'Try again')}
        </Button>
      </div>
    );
  }

  const avatarUrl = getImageUrl(profileUser?.avatarUrl ?? null);
  const coverUrl = getImageUrl(profileUser?.coverImageUrl ?? null);
  const username = profileUser?.email?.split('@')[0] ?? t('profile.usernameFallback', 'user');
  /* Account settings has no v2 page yet, so this leaves the preview shell the
     same way the v2 sidebar's account entry does. */
  const accountHref = `/${workspaceSlug}/settings/account`;

  const statCards: { id: TabId; label: string; value: number; icon: typeof FileText }[] = [
    {
      id: 'created',
      label: t('profile.workItemsCreated', 'Work items created'),
      value: issuesCreated.length,
      icon: FileText,
    },
    {
      id: 'assigned',
      label: t('profile.workItemsAssigned', 'Work items assigned'),
      value: issuesAssigned.length,
      icon: Users,
    },
    {
      id: 'subscribed',
      label: t('profile.workItemsSubscribed', 'Work items subscribed'),
      value: issuesSubscribed.length,
      icon: Bell,
    },
  ];

  const workItemsTable = (rows: IssueApiResponse[], emptyMessage: string) => (
    <div className="space-y-3">
      <p className="text-sm font-medium">
        {t('profile.allWorkItems', 'All work items {{count}}', { count: rows.length })}
      </p>
      <div className="min-h-0 overflow-auto rounded-xl border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-3">{t('views.workItems', 'Work items')}</TableHead>
              <TableHead className="w-44 px-3">{t('common.project', 'Project')}</TableHead>
              <TableHead className="w-40 px-3">{t('views.state', 'State')}</TableHead>
              <TableHead className="w-32 px-3">{t('views.priority', 'Priority')}</TableHead>
              <TableHead className="w-40 px-3">
                {t('display.property.assignee', 'Assignee')}
              </TableHead>
              <TableHead className="w-36 px-3">{t('issues.targetDate', 'Due')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="text-muted-foreground h-32 text-center">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((issue) => {
                const project = projectById.get(issue.project_id);
                const state = issue.state_id ? stateById.get(issue.state_id) : undefined;
                const assigneeId = issue.assignee_ids?.[0];
                const assignee = assigneeId ? memberById.get(assigneeId) : undefined;
                const assigneeName =
                  assignee?.member_display_name?.trim() ||
                  assignee?.member_email?.split('@')[0]?.trim() ||
                  (assigneeId ? t('profile.memberFallback', 'Member') : null);
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
                    <TableCell className="text-muted-foreground px-3 text-sm">
                      <span className="block truncate">{project?.name ?? '—'}</span>
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
                    <TableCell className="px-3">
                      {assigneeName ? (
                        <span className="flex items-center gap-2 text-sm">
                          <Avatar className="size-6 shrink-0">
                            {assignee?.member_avatar && (
                              <AvatarImage
                                src={getImageUrl(assignee.member_avatar) ?? undefined}
                                alt={assigneeName}
                              />
                            )}
                            <AvatarFallback className="text-foreground text-[10px]">
                              {initials(assigneeName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">{assigneeName}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          {t('common.unassigned', 'Unassigned')}
                        </span>
                      )}
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
    </div>
  );

  const activityText = (issue: IssueApiResponse) => {
    const project = projectById.get(issue.project_id);
    return (
      <Trans
        i18nKey="profile.activityTab.created"
        values={{
          ref: workItemDisplayId(issue, project),
          title: issue.name,
          time: formatTimeAgo(issue.created_at ?? issue.updated_at),
        }}
      >
        You created{' '}
        <strong className="text-foreground font-medium">
          {'{{ref}}'} {'{{title}}'}
        </strong>{' '}
        {'{{time}}'}.
      </Trans>
    );
  };

  return (
    <div className="space-y-6 pb-8">
      <PageHeading
        title={t('profile.documentTitle', 'Profile')}
        description={t(
          'profile.pageDescription',
          'Review member details, workload, and recent work across your workspace.',
        )}
        summary={t(
          'profile.summary',
          '{{assigned}} assigned · {{created}} created · {{projects}} projects',
          {
            assigned: issuesAssigned.length,
            created: issuesCreated.length,
            projects: projects.length,
          },
        )}
      />

      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      <Card className="gap-0 overflow-hidden pt-0 shadow-none">
        <div
          className="from-primary/70 to-primary/30 relative h-24 bg-gradient-to-br"
          style={
            coverUrl
              ? {
                  backgroundImage: `url(${coverUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : undefined
          }
        >
          <Button
            asChild
            size="icon"
            variant="secondary"
            className="absolute top-2 right-2 size-8 shadow-sm"
          >
            <Link to={accountHref} aria-label={t('profile.editProfile', 'Edit profile')}>
              <Pencil aria-hidden="true" />
            </Link>
          </Button>
        </div>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex min-w-0 items-end gap-4">
            <Avatar className="ring-background -mt-8 size-16 shrink-0 ring-4">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={profileUser?.name ?? ''} />}
              <AvatarFallback className="text-foreground">
                {initials(profileUser?.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold">
                {profileUser?.name ?? t('profile.documentTitle', 'Profile')}
              </h2>
              <p className="text-muted-foreground truncate text-sm">
                ({username}) · {profileUser?.email}
              </p>
            </div>
          </div>
          <div className="text-muted-foreground space-y-0.5 text-sm sm:ml-auto sm:shrink-0 sm:text-right">
            <p>
              {t('profile.joinedOn', 'Joined on {{date}}', {
                date: formatDate(member?.created_at),
              })}
            </p>
            <p>
              {t('profile.timezoneValue', 'Timezone {{time}} ({{zone}})', {
                time: timezone.time,
                zone: timezone.zone,
              })}
            </p>
          </div>
        </CardContent>
      </Card>

      <section aria-label={t('profile.overview', 'Overview')}>
        <h2 className="mb-3 text-sm font-semibold">{t('profile.overview', 'Overview')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => setActiveTab(card.id)}
                className="focus-visible:ring-ring/50 rounded-xl text-left focus-visible:ring-[3px] focus-visible:outline-none"
              >
                <Card className="hover:bg-muted/40 gap-0 py-4 shadow-none transition-colors">
                  <CardContent className="flex items-center gap-3 px-4">
                    <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-2xl font-semibold tabular-nums">
                        {card.value}
                      </span>
                      <span className="text-muted-foreground block truncate text-sm">
                        {card.label}
                      </span>
                    </span>
                  </CardContent>
                </Card>
              </button>
            );
          })}
          <Card className="gap-0 py-4 shadow-none">
            <CardContent className="flex items-center gap-3 px-4">
              <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
                <Folder className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-2xl font-semibold tabular-nums">{projects.length}</span>
                <span className="text-muted-foreground block truncate text-sm">
                  {t('profile.projects', 'Projects')}
                </span>
              </span>
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="flex flex-col gap-6">
        {/* The segmented control the v2 projects and archives lists use for
            their scopes, so switching sections reads the same everywhere. */}
        <ToggleGroup
          type="single"
          value={activeTab}
          onValueChange={(value) => {
            if (isTabId(value)) setActiveTab(value);
          }}
          variant="default"
          size="sm"
          spacing={1}
          className="bg-muted/60 w-fit max-w-full shrink-0 touch-pan-x overflow-x-auto rounded-lg p-1 sm:p-0.5"
          aria-label={t('profile.documentTitle', 'Profile')}
        >
          {TAB_IDS.map((tab) => (
            <ToggleGroupItem
              key={tab}
              value={tab}
              className="data-[state=on]:bg-background h-11 min-w-0 px-3 data-[state=on]:shadow-xs sm:h-8 sm:px-2.5"
            >
              {t(`profile.tab.${tab}`, TAB_LABELS[tab])}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {activeTab === 'summary' && (
          <div className="space-y-6">
            <section aria-label={t('profile.workload.title', 'Workload')}>
              <h2 className="mb-3 text-sm font-semibold">
                {t('profile.workload.title', 'Workload')}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {workload.map((entry) => (
                  <Card key={entry.group} className="gap-0 py-4 shadow-none">
                    <CardContent className="flex items-center gap-3 px-4">
                      <span
                        aria-hidden
                        className="size-3 shrink-0 rounded-sm"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="min-w-0">
                        <span className="block text-2xl font-semibold tabular-nums">
                          {entry.count}
                        </span>
                        <span className="text-muted-foreground block truncate text-sm">
                          {entry.label}
                        </span>
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle>{t('profile.workItemsByState', 'Work items by state')}</CardTitle>
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
                            <span className="text-muted-foreground tabular-nums">
                              {entry.count}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle>
                    {t('profile.workItemsByPriority', 'Work items by Priority')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {PRIORITIES.map((priority) => {
                    const count = priorityCounts.get(priority) ?? 0;
                    const percent =
                      workloadTotal === 0 ? 0 : Math.round((count / workloadTotal) * 100);
                    const priorityLabel = t(
                      `profile.priority.${priority}`,
                      PRIORITY_LABELS[priority],
                    );
                    return (
                      <div key={priority} className="flex items-center gap-3">
                        <span className="w-16 shrink-0 text-sm">{priorityLabel}</span>
                        <Progress
                          value={percent}
                          className="h-2 flex-1"
                          aria-label={t(
                            'profile.priorityProgress',
                            '{{priority}}: {{count}} of {{total}} assigned work items',
                            { priority: priorityLabel, count, total: workloadTotal },
                          )}
                        />
                        <span className="text-muted-foreground w-8 shrink-0 text-right text-xs tabular-nums">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-none">
              <CardHeader>
                <CardTitle>{t('profile.projects', 'Projects')}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {projectBreakdown.length === 0 ? (
                  <p className="text-muted-foreground px-6 pb-6 text-sm">
                    {t('profile.noProjects', 'No projects yet.')}
                  </p>
                ) : (
                  <ul className="divide-y border-t">
                    {projectBreakdown.map(({ project, states: projectStates, total, progress }) => (
                      <li key={project.id}>
                        <Collapsible>
                          <div className="flex items-center gap-2 px-4">
                            <Folder
                              className="text-muted-foreground size-4 shrink-0"
                              aria-hidden="true"
                            />
                            <Link
                              to={`/${workspaceSlug}/app-v2/projects/${project.id}/work-items`}
                              className="min-w-0 flex-1 truncate py-3 text-sm font-medium hover:underline"
                            >
                              {project.name}
                            </Link>
                            <Badge variant={progress > 0 ? 'secondary' : 'outline'}>
                              {t('profile.projectProgress', '{{percent}}%', { percent: progress })}
                            </Badge>
                            <CollapsibleTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 shrink-0 [&[data-state=open]>svg]:rotate-0"
                                aria-label={t(
                                  'profile.toggleProjectStates',
                                  'Show state breakdown for {{project}}',
                                  { project: project.name },
                                )}
                              >
                                <ChevronDown
                                  className="size-4 -rotate-90 transition-transform"
                                  aria-hidden="true"
                                />
                              </Button>
                            </CollapsibleTrigger>
                          </div>
                          <CollapsibleContent className="px-4 pb-4 pl-10">
                            <div className="bg-muted mb-3 flex h-2 w-full overflow-hidden rounded-full">
                              {total > 0 ? (
                                projectStates.map((state) => (
                                  <Tooltip key={state.id}>
                                    <TooltipTrigger asChild>
                                      <span
                                        className="h-full"
                                        style={{
                                          width: `${(state.count / total) * 100}%`,
                                          minWidth: state.count > 0 ? 4 : 0,
                                          backgroundColor: state.color || 'var(--muted-foreground)',
                                        }}
                                      />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {state.name}: {state.count}
                                    </TooltipContent>
                                  </Tooltip>
                                ))
                              ) : (
                                <span className="bg-muted h-full w-full" />
                              )}
                            </div>
                            <ul className="space-y-1">
                              {projectStates.map((state) => (
                                <li key={state.id} className="flex items-center gap-2 text-xs">
                                  <span
                                    aria-hidden
                                    className="size-3 shrink-0 rounded-sm"
                                    style={{
                                      backgroundColor: state.color || 'var(--muted-foreground)',
                                    }}
                                  />
                                  <span className="text-muted-foreground">{state.name}</span>
                                  <span>
                                    —{' '}
                                    {t('profile.workItemCount', '{{count}} Work items', {
                                      count: state.count,
                                    })}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </CollapsibleContent>
                        </Collapsible>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-none">
              <CardHeader>
                <CardTitle>{t('profile.recentActivity', 'Recent activity')}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {recentActivity.length === 0 ? (
                  <p className="text-muted-foreground px-6 pb-6 text-sm">
                    {t('profile.noRecentActivity', 'No recent activity')}
                  </p>
                ) : (
                  <ul className="divide-y border-t">
                    {recentActivity.slice(0, 8).map((issue) => (
                      <li key={issue.id} className="flex gap-3 px-4 py-3">
                        <Avatar className="size-6 shrink-0">
                          {avatarUrl && (
                            <AvatarImage src={avatarUrl} alt={profileUser?.name ?? ''} />
                          )}
                          <AvatarFallback className="text-foreground text-[10px]">
                            {initials(profileUser?.name)}
                          </AvatarFallback>
                        </Avatar>
                        <p className="text-muted-foreground min-w-0 text-sm">
                          {activityText(issue)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'assigned' && (
          <div>
            {workItemsTable(issuesAssigned, t('profile.noAssigned', 'Nothing assigned yet.'))}
          </div>
        )}

        {activeTab === 'created' && (
          <div>{workItemsTable(issuesCreated, t('profile.noCreated', 'Nothing created yet.'))}</div>
        )}

        {activeTab === 'subscribed' && (
          <div>{workItemsTable(issuesSubscribed, t('profile.noWorkItems', 'No work items'))}</div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">
                {t('profile.recentActivity', 'Recent activity')}
              </h2>
              <Button
                type="button"
                onClick={downloadTodaysActivity}
                disabled={todaysActivity.length === 0}
              >
                <Download aria-hidden="true" />
                {t('profile.downloadTodaysActivity', "Download today's activity")}
              </Button>
            </div>
            <div className="overflow-auto rounded-xl border">
              {recentActivity.length === 0 ? (
                <p className="text-muted-foreground px-4 py-12 text-center text-sm">
                  {t('profile.noRecentActivity', 'No recent activity')}
                </p>
              ) : (
                <ul className="divide-y">
                  {recentActivity.map((issue) => (
                    <li key={issue.id}>
                      <Link
                        to={`/${workspaceSlug}/app-v2/projects/${issue.project_id}/work-items/${issue.id}`}
                        className="hover:bg-muted/50 flex items-center gap-3 px-4 py-3 transition-colors"
                      >
                        <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full">
                          <FileText className="size-4" aria-hidden="true" />
                        </span>
                        <p className="text-muted-foreground min-w-0 flex-1 text-sm">
                          {activityText(issue)}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
