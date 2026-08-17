import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import {
  Bell,
  CalendarDays,
  Clock,
  Download,
  FileText,
  Folder,
  Mail,
  Search,
  ShieldCheck,
  SquareArrowOutUpRight,
  UserPen,
  UserRound,
  Users,
} from 'lucide-react';
import { Cell, Pie, PieChart } from 'recharts';
import { Avatar, AvatarFallback, AvatarImage } from '@/v2/components/ui/avatar';
import { Badge } from '@/v2/components/ui/badge';
import { Button } from '@/v2/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/v2/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/v2/components/ui/chart';
import { Input } from '@/v2/components/ui/input';
import { Skeleton } from '@/v2/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/v2/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/v2/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/v2/components/ui/tooltip';
import { ProjectIconDisplay } from '../../components/ProjectIconModal';
import { useAuth } from '../../contexts/AuthContext';
import { getImageUrl } from '../../lib/utils';
import {
  PRIORITY_LABELS,
  formatDate,
  formatTimeAgo,
  priorityVariant,
  stateDotStyle,
  workItemDisplayId,
  type Priority,
} from '../lib/project';
import { issueService } from '../../services/issueService';
import { projectService } from '../../services/projectService';
import { stateService } from '../../services/stateService';
import { workspaceService } from '../../services/workspaceService';
import type {
  IssueApiResponse,
  ProjectApiResponse,
  StateApiResponse,
  WorkspaceApiResponse,
  WorkspaceMemberApiResponse,
} from '../../api/types';

/* Only the placeholder cover needs the hero and its WebGL gradient, so it
   loads on its own chunk. */
const HeroGeometric = lazy(() => import('@/v2/components/ui/hero-geometric'));

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

/** Devlane stores workspace roles as numbers; 20 and above is an admin. */
const ROLE_ADMIN = 20;

/** Above this many projects the list table earns a search field and a count. */
const SEARCHABLE_PROJECT_COUNT = 6;

/* One hue per state group, matching the ramp AnalyticsOverviewPage uses so a
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
 * The v2 view of a workspace member's profile, built from shadcn primitives and
 * laid out like the AdminCN user profile page: a cover-and-avatar identity card,
 * a pill tab bar, then a row of counter tiles above the activity timeline, the
 * workload donut and the projects table.
 *
 * It renders at the same URL as ProfilePage; the stored interface preference
 * picks between them.
 *
 * The summary tab is deliberately four blocks deep. Identity fields — username,
 * role, email, join date, timezone — all live in the header, so no "about" rail
 * repeats them beside the charts; the counters are tiles that open the tab
 * holding their rows; and the priority breakdown is left to the Assigned tab's
 * priority column rather than a second chart card. What remains is the donut on
 * the shared chart primitive and the per-project state breakdown as one table,
 * where the shipped page uses hand-rolled SVG stat cards, a conic-gradient donut
 * and a stack of collapsibles.
 *
 * Like the shipped page, only the signed-in user resolves: there is no
 * user-by-id endpoint yet, so a `:userId` naming anyone else falls back to the
 * current user.
 */
export function ProfilePage() {
  const { t } = useTranslation();
  const { workspaceSlug, userId } = useParams<{ workspaceSlug: string; userId: string }>();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabId>('summary');
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [issues, setIssues] = useState<IssueApiResponse[]>([]);
  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [projectQuery, setProjectQuery] = useState('');
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

  const visibleProjects = useMemo(() => {
    const query = projectQuery.trim().toLowerCase();
    if (!query) return projectBreakdown;
    return projectBreakdown.filter(
      ({ project }) =>
        project.name.toLowerCase().includes(query) ||
        (project.identifier ?? '').toLowerCase().includes(query),
    );
  }, [projectBreakdown, projectQuery]);

  const timezone = useMemo(() => ({ zone: Intl.DateTimeFormat().resolvedOptions().timeZone }), []);

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
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-10 w-80 max-w-full rounded-lg" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-96 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl lg:col-span-2" />
        </div>
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
  const roleLabel =
    (member?.role ?? 0) >= ROLE_ADMIN
      ? t('settings.role.admin', 'Admin')
      : t('settings.role.member', 'Member');
  /* Account settings has no v2 page yet, so this leaves the v2 shell the
     same way the v2 sidebar's account entry does. */
  const accountHref = `/${workspaceSlug}/settings/account`;

  /* The counters the About rail used to list. As tiles they read at a glance
     and each one opens the tab that holds the rows behind the number. */
  const statTiles: { id: TabId | null; label: string; value: number; icon: typeof FileText }[] = [
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
    {
      id: null,
      label: t('profile.projects', 'Projects'),
      value: projects.length,
      icon: Folder,
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
                        to={`/${workspaceSlug}/projects/${issue.project_id}/issues/${issue.id}`}
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
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      {/* Identity card: cover, overlapping avatar, name and inline meta —
          the AdminCN profile header, with Devlane's own fields in the chips. */}
      <Card className="gap-0 overflow-hidden pt-0 shadow-none">
        {coverUrl ? (
          <div
            className="relative h-32 sm:h-44"
            style={{
              backgroundImage: `url(${coverUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        ) : (
          /* No uploaded cover: the shader hero stands in for the flat gradient
             placeholder, with no headline over it — the name and meta below are
             the header's text. Its own `min-h-screen` is dropped so the band
             keeps the same height the cover image gets. */
          <Suspense fallback={<div className="bg-muted h-32 sm:h-44" />}>
            <HeroGeometric speed={1} className="h-32 min-h-0 sm:h-44" />
          </Suspense>
        )}
        <CardContent className="flex flex-col gap-4 pt-0 sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
            <Avatar className="ring-background bg-background -mt-12 size-24 shrink-0 rounded-xl ring-4 sm:-mt-14 sm:size-28">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={profileUser?.name ?? ''} />}
              <AvatarFallback className="text-foreground rounded-xl text-2xl">
                {initials(profileUser?.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 pb-1">
              <h1 className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-2xl font-semibold tracking-tight">
                <span className="truncate">
                  {profileUser?.name ?? t('profile.documentTitle', 'Profile')}
                </span>
                <span className="text-muted-foreground truncate text-sm font-normal">
                  @{username}
                </span>
              </h1>
              {/* Every identity field lives here — role, email, join date,
                  timezone — so the summary tab needs no About rail repeating
                  them beside the charts. */}
              <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
                  {roleLabel}
                </span>
                <span className="flex min-w-0 items-center gap-1.5">
                  <Mail className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{profileUser?.email ?? '—'}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
                  {t('profile.joinedOn', 'Joined on {{date}}', {
                    date: formatDate(member?.created_at),
                  })}
                </span>
                <span className="flex min-w-0 items-center gap-1.5">
                  <Clock className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{timezone.zone}</span>
                </span>
              </div>
            </div>
          </div>
          <Button asChild className="sm:ml-auto sm:shrink-0">
            <Link to={accountHref}>
              <UserPen aria-hidden="true" />
              {t('profile.editProfile', 'Edit profile')}
            </Link>
          </Button>
        </CardContent>
      </Card>

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
        <div className="space-y-4">
          {/* Counters first, one line, each opening its own tab. */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {statTiles.map((tile) => {
              const Icon = tile.icon;
              const body = (
                <>
                  <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-2xl leading-none font-semibold tabular-nums">
                      {tile.value}
                    </span>
                    <span className="text-muted-foreground mt-1 block truncate text-sm">
                      {tile.label}
                    </span>
                  </span>
                </>
              );
              return (
                <Card key={tile.label} className="shadow-none">
                  <CardContent className="p-0">
                    {tile.id ? (
                      <button
                        type="button"
                        onClick={() => setActiveTab(tile.id as TabId)}
                        className="hover:bg-muted/50 focus-visible:ring-ring/50 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors focus-visible:ring-[3px] focus-visible:outline-none"
                      >
                        {body}
                      </button>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-3">{body}</div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Timeline beside the workload donut, then the projects table. The
              donut card stretches to the timeline's height instead of leaving
              a gap under itself. */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle>{t('profile.activityTimeline', 'Activity timeline')}</CardTitle>
              </CardHeader>
              <CardContent>
                {recentActivity.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    {t('profile.noRecentActivity', 'No recent activity')}
                  </p>
                ) : (
                  <ol className="space-y-5">
                    {recentActivity.slice(0, 5).map((issue, index, list) => {
                      const project = projectById.get(issue.project_id);
                      const state = issue.state_id ? stateById.get(issue.state_id) : undefined;
                      return (
                        <li key={issue.id} className="relative pl-6">
                          <span
                            aria-hidden="true"
                            className="bg-background absolute top-1 left-0 size-3 rounded-full border-2"
                            style={{ borderColor: state?.color || 'var(--primary)' }}
                          />
                          {index < list.slice(0, 5).length - 1 && (
                            <span
                              aria-hidden="true"
                              className="bg-border absolute top-5 bottom-[-1.25rem] left-[5px] w-px"
                            />
                          )}
                          <div className="flex items-start justify-between gap-3">
                            <Link
                              to={`/${workspaceSlug}/projects/${issue.project_id}/issues/${issue.id}`}
                              className="flex min-w-0 items-baseline gap-2 text-sm hover:underline"
                            >
                              <span className="text-muted-foreground shrink-0 font-mono text-xs">
                                {workItemDisplayId(issue, project)}
                              </span>
                              <span className="line-clamp-1 font-medium">{issue.name}</span>
                            </Link>
                            <span className="text-muted-foreground shrink-0 text-xs">
                              {formatTimeAgo(issue.created_at ?? issue.updated_at)}
                            </span>
                          </div>
                          <p className="text-muted-foreground mt-0.5 truncate text-sm">
                            {t('profile.activityTab.createdShort', 'Created')} ·{' '}
                            {project?.name ?? '—'}
                          </p>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </CardContent>
            </Card>

            {/* One workload chart, not two: the priority split the second card
                carried is a column on the Assigned tab's table. */}
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle>{t('profile.workItemsByState', 'Work items by state')}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 items-center">
                {workloadTotal === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    {t('profile.noAssigned', 'Nothing assigned yet.')}
                  </p>
                ) : (
                  <div className="flex w-full flex-wrap items-center justify-center gap-6">
                    <ChartContainer config={chartConfig} className="aspect-square h-40">
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
                        <Pie data={workload} dataKey="count" nameKey="label" innerRadius={40}>
                          {workload.map((entry) => (
                            <Cell key={entry.group} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ChartContainer>
                    <ul className="w-full max-w-56 min-w-36 flex-1 space-y-2">
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
          </div>

          {/* The reference's "Projects List" table: one row per project, the
                stacked bar carrying the per-state breakdown the shipped page
                hides behind a collapsible. */}
          <Card className="gap-0 shadow-none">
            <CardHeader className="flex flex-wrap items-center justify-between gap-3 pb-4">
              <CardTitle>{t('profile.projectsList', 'Projects list')}</CardTitle>
              {/* A search field over a handful of rows is just another
                    control to read past, so it appears once the list is long
                    enough to scan. */}
              {projectBreakdown.length > SEARCHABLE_PROJECT_COUNT && (
                <div className="relative w-full sm:w-56">
                  <Search
                    className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <Input
                    value={projectQuery}
                    onChange={(event) => setProjectQuery(event.target.value)}
                    placeholder={t('profile.searchProjects', 'Search project')}
                    aria-label={t('profile.searchProjects', 'Search project')}
                    className="pl-8"
                  />
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto border-t">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-4">{t('common.project', 'Project')}</TableHead>
                      <TableHead className="w-44 px-3">{t('common.lead', 'Lead')}</TableHead>
                      <TableHead className="w-56 px-3">
                        {t('common.progress', 'Progress')}
                      </TableHead>
                      <TableHead className="w-12 px-3" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleProjects.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={4} className="text-muted-foreground h-28 text-center">
                          {projectQuery.trim()
                            ? t('profile.noMatchingProjects', 'No projects match your search.')
                            : t('profile.noProjects', 'No projects yet.')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      visibleProjects.map(({ project, states: projectStates, total, progress }) => {
                        const lead = project.project_lead_id
                          ? memberById.get(project.project_lead_id)
                          : undefined;
                        const leadName =
                          lead?.member_display_name?.trim() ||
                          lead?.member_email?.split('@')[0]?.trim() ||
                          null;
                        const issuesUrl = `/${workspaceSlug}/projects/${project.id}/issues`;
                        return (
                          <TableRow key={project.id}>
                            <TableCell className="px-4">
                              <Link
                                to={issuesUrl}
                                className="flex min-w-0 items-center gap-3 hover:underline"
                              >
                                <span
                                  aria-hidden="true"
                                  className="border-border/60 bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg border"
                                >
                                  <ProjectIconDisplay
                                    emoji={project.emoji}
                                    icon_prop={project.icon_prop}
                                    size={16}
                                  />
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-medium">
                                    {project.name}
                                  </span>
                                  <span className="text-muted-foreground block truncate font-mono text-xs">
                                    {project.identifier ?? project.id.slice(0, 8)}
                                  </span>
                                </span>
                              </Link>
                            </TableCell>
                            <TableCell className="px-3">
                              {leadName ? (
                                <span className="flex items-center gap-2 text-sm">
                                  <Avatar className="size-6 shrink-0">
                                    {lead?.member_avatar && (
                                      <AvatarImage
                                        src={getImageUrl(lead.member_avatar) ?? undefined}
                                        alt={leadName}
                                      />
                                    )}
                                    <AvatarFallback className="text-foreground text-[10px]">
                                      {initials(leadName)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="truncate">{leadName}</span>
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-sm">
                                  {t('common.unassigned', 'Unassigned')}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="px-3">
                              <div className="flex items-center gap-3">
                                <div className="bg-muted flex h-2 flex-1 overflow-hidden rounded-full">
                                  {total > 0 ? (
                                    projectStates.map((state) => (
                                      <Tooltip key={state.id}>
                                        <TooltipTrigger asChild>
                                          <span
                                            className="h-full"
                                            style={{
                                              width: `${(state.count / total) * 100}%`,
                                              minWidth: state.count > 0 ? 4 : 0,
                                              backgroundColor:
                                                state.color || 'var(--muted-foreground)',
                                            }}
                                          />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          {state.name}:{' '}
                                          {t('profile.workItemCount', '{{count}} Work items', {
                                            count: state.count,
                                          })}
                                        </TooltipContent>
                                      </Tooltip>
                                    ))
                                  ) : (
                                    <span className="bg-muted h-full w-full" />
                                  )}
                                </div>
                                <span className="w-9 shrink-0 text-right text-xs tabular-nums">
                                  {t('profile.projectProgress', '{{percent}}%', {
                                    percent: progress,
                                  })}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="px-3">
                              <Button asChild variant="ghost" size="icon" className="size-8">
                                <Link
                                  to={issuesUrl}
                                  aria-label={t('profile.openProject', 'Open {{project}}', {
                                    project: project.name,
                                  })}
                                >
                                  <SquareArrowOutUpRight aria-hidden="true" />
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              {projectBreakdown.length > SEARCHABLE_PROJECT_COUNT && (
                <p className="text-muted-foreground border-t px-4 py-3 text-sm">
                  {t('profile.showingProjects', 'Showing {{shown}} of {{total}} projects', {
                    shown: visibleProjects.length,
                    total: projectBreakdown.length,
                  })}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'assigned' &&
        workItemsTable(issuesAssigned, t('profile.noAssigned', 'Nothing assigned yet.'))}

      {activeTab === 'created' &&
        workItemsTable(issuesCreated, t('profile.noCreated', 'Nothing created yet.'))}

      {activeTab === 'subscribed' &&
        workItemsTable(issuesSubscribed, t('profile.noWorkItems', 'No work items'))}

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
                      to={`/${workspaceSlug}/projects/${issue.project_id}/issues/${issue.id}`}
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
  );
}
