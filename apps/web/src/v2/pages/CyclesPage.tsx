import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Activity,
  Archive,
  BarChart3,
  CalendarRange,
  ChevronDown,
  CircleAlert,
  Clock,
  ExternalLink,
  Eye,
  LayoutGrid,
  Link2,
  MoreHorizontal,
  Pencil,
  Plus,
  Star,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';
import { UpdateCycleModal } from '@/components/UpdateCycleModal';
import { CycleBurndownChart } from '@/components/cycles/CycleBurndownChart';
import { CreateCycleDialog } from '@/v2/components/create-cycle-dialog';
import { CyclesFiltersMenu } from '@/v2/components/cycles-filters-menu';
import { ListPageSkeleton } from '@/v2/components/list-page-skeleton';
import { PageHeading } from '@/v2/components/page-heading';
import { ProjectListToolbar } from '@/v2/components/project-list-toolbar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/v2/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/v2/components/ui/avatar';
import { Badge } from '@/v2/components/ui/badge';
import { Button } from '@/v2/components/ui/button';
import { CircularProgress } from '@/v2/components/ui/circular-progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/v2/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/v2/components/ui/dropdown-menu';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/v2/components/ui/empty';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/v2/components/ui/tabs';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useProjectCyclesController } from '../hooks/useProjectCyclesController';
import { formatDate } from '../lib/project';
import { getImageUrl } from '../../lib/utils';
import type { CycleApiResponse } from '../../api/types';
import type { Priority } from '../../types';

const PRIORITY_ORDER: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

function cycleDateRange(cycle: CycleApiResponse): string {
  const start = cycle.start_date ? formatDate(cycle.start_date) : null;
  const end = cycle.end_date ? formatDate(cycle.end_date) : null;
  if (!start && !end) return '—';
  return `${start ?? '—'} → ${end ?? '—'}`;
}

/**
 * The v2 design of a project's cycles. Loading, filtering, bucketing and the
 * active cycle's statistics come from useProjectCyclesController — the same
 * controller the shipped page uses — so this is a redesign of that page rather
 * than a second implementation of it.
 */
export function CyclesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workspaceSlug, projectId } = useParams<{ workspaceSlug: string; projectId: string }>();
  useDocumentTitle(t('common.cycles', 'Cycles'));

  const {
    workspace,
    project,
    cycles,
    members,
    labels,
    loading,
    filters,
    setFilters,
    filteredCycles,
    upcomingCycles,
    completedCycles,
    activeCycles,
    activeCycle,
    activeCycleIssues,
    activeBurndownChart,
    activeBurndownTotal,
    activeCycleProgressStats,
    activeCycleAssigneeStats,
    activeCycleLabelStats,
    cyclePath,
    getIssueCount,
    getProgress,
    getStateName,
    getOwnerMember,
    isFavorite,
    toggleFavorite,
    deleteCycle,
    applyCycleUpdate,
    refresh,
  } = useProjectCyclesController(workspaceSlug, projectId);

  const [editCycle, setEditCycle] = useState<CycleApiResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CycleApiResponse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const memberName = (memberId: string | null) => {
    if (!memberId) return t('cycles.unassigned', 'Unassigned');
    const member = members.find((entry) => entry.member_id === memberId);
    return (
      member?.member_display_name?.trim() ||
      member?.member_email?.split('@')[0] ||
      memberId.slice(0, 8)
    );
  };

  const initials = (name: string) =>
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');

  const copyCycleLink = (cycle: CycleApiResponse) => {
    const url = `${window.location.origin}${cyclePath(cycle)}`;
    void navigator.clipboard
      ?.writeText(url)
      .then(() => toast.success(t('common.linkCopied', 'Link copied')))
      .catch(() => toast.error(t('common.copyLinkError', 'Could not copy that link.')));
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCycle(deleteTarget.id);
      toast.success(t('cycles.deleteSuccess', 'Cycle deleted'));
      setDeleteTarget(null);
    } catch {
      toast.error(t('cycles.deleteError', 'Could not delete that cycle.'));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <ListPageSkeleton label={t('cycles.loading', 'Loading cycles…')} rows={6} />;
  }

  if (!workspace || !project) {
    return (
      <Empty className="min-h-80 rounded-xl border border-dashed" role="alert">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
            <CircleAlert aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t('cycles.loadError', 'Could not load cycles.')}</EmptyTitle>
          <EmptyDescription>{t('common.projectNotFound', 'Project not found.')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  /* A row — a bucket row or the active cycle's sub-header — opens the cycle, as
     in the shipped page. Clicks that land on the row's own controls (the name
     link, the favourite button, the menu) are theirs to handle. */
  const openCycleOnRowClick = (
    event: React.MouseEvent<HTMLDivElement>,
    cycle: CycleApiResponse,
  ) => {
    if ((event.target as HTMLElement).closest('a,button,[role="menuitem"]')) return;
    navigate(cyclePath(cycle));
  };

  /** The cycle lead, or the shipped page's dashed placeholder when unassigned. */
  const ownerAvatar = (cycle: CycleApiResponse) => {
    const owner = getOwnerMember(cycle.owned_by_id);
    if (!owner) {
      return (
        <span
          className="text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded border border-dashed"
          aria-label={t('cycles.noOwner', 'No lead')}
        >
          <Users className="size-4" aria-hidden="true" />
        </span>
      );
    }
    return (
      <Avatar className="size-8 shrink-0" title={owner.name}>
        <AvatarImage src={getImageUrl(owner.avatarUrl) ?? ''} alt="" />
        <AvatarFallback className="text-xs">{initials(owner.name)}</AvatarFallback>
      </Avatar>
    );
  };

  const favoriteButton = (cycle: CycleApiResponse) => {
    const favorite = isFavorite(cycle.id);
    return (
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="size-8 shrink-0"
        onClick={() => toggleFavorite({ id: cycle.id, name: cycle.name })}
        aria-pressed={favorite}
        aria-label={`${
          favorite
            ? t('common.removeFromFavorites', 'Remove from favorites')
            : t('common.addToFavorites', 'Add to favorites')
        }: ${cycle.name}`}
      >
        <Star aria-hidden="true" className={favorite ? 'fill-amber-400 text-amber-400' : ''} />
      </Button>
    );
  };

  const cycleMenu = (cycle: CycleApiResponse) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="size-8 shrink-0"
          aria-label={t('cycles.cycleMenu', '{{cycle}} actions', { cycle: cycle.name })}
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={() => setEditCycle(cycle)}>
          <Pencil aria-hidden="true" />
          {t('common.edit', 'Edit')}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={cyclePath(cycle)} target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden="true" />
            {t('common.openInNewTab', 'Open in new tab')}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => copyCycleLink(cycle)}>
          <Link2 aria-hidden="true" />
          {t('common.copyLink', 'Copy link')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* Archiving is offered for completed cycles only, matching the
            shipped menu's rule (and, as there, it is not wired yet). */}
        <DropdownMenuItem disabled={cycle.status !== 'completed'}>
          <Archive aria-hidden="true" />
          <span className="flex flex-col gap-0.5">
            {t('common.archive', 'Archive')}
            {cycle.status !== 'completed' && (
              <span className="text-muted-foreground text-[11px] leading-tight">
                {t('cycles.onlyCompletedArchivable', 'Only completed cycles can be archived.')}
              </span>
            )}
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget(cycle)}>
          <Trash2 aria-hidden="true" />
          {t('common.delete', 'Delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  /* Row order follows the shipped page exactly: progress ring, name, work item
     count, dates, lead, favourite, menu. */
  const renderCycleRow = (cycle: CycleApiResponse) => {
    const percent = getProgress(cycle);

    return (
      <div
        key={cycle.id}
        className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 border-b px-4 py-2 last:border-b-0"
        onClick={(event) => openCycleOnRowClick(event, cycle)}
      >
        <CircularProgress
          value={percent}
          size={40}
          aria-label={t('cycles.progressLabel', '{{percent}}% complete', { percent })}
        />

        <Link
          to={cyclePath(cycle)}
          title={cycle.name}
          className="focus-visible:ring-ring min-w-0 flex-1 truncate rounded-sm font-medium outline-none hover:underline focus-visible:ring-2"
        >
          {cycle.name}
        </Link>

        <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-[13px]">
          <LayoutGrid className="size-3.5" aria-hidden="true" />
          {getIssueCount(cycle.id)}
        </span>

        <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-[13px]">
          <CalendarRange className="size-3.5" aria-hidden="true" />
          {cycleDateRange(cycle)}
        </span>

        {ownerAvatar(cycle)}
        {favoriteButton(cycle)}
        {cycleMenu(cycle)}
      </div>
    );
  };

  /* The three buckets — active, upcoming, completed — stack inside one surface,
     as in the shipped page: a full-width header bar carrying a marker and the
     count in its label, a chevron on the right, and a bordered body. */
  const section = ({
    label,
    marker,
    defaultOpen,
    children,
  }: {
    label: string;
    marker: ReactNode;
    defaultOpen: boolean;
    children: ReactNode;
  }) => (
    <Collapsible defaultOpen={defaultOpen} className="border-t first:border-t-0">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="bg-muted/50 hover:bg-muted group flex min-h-11 w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium"
        >
          {marker}
          {label}
          <ChevronDown
            aria-hidden="true"
            className="text-muted-foreground ml-auto size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180"
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );

  const cycleList = (list: CycleApiResponse[], emptyLabel: string) =>
    list.length === 0 ? (
      <p className="text-muted-foreground border-t py-4 pl-4 text-sm">{emptyLabel}</p>
    ) : (
      <div className="border-t">{list.map(renderCycleRow)}</div>
    );

  /** One of the three statistics cards under the active cycle. */
  const statCard = (title: string, meta: string, children: ReactNode) => (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-muted-foreground shrink-0 text-xs">{meta}</span>
      </div>
      {children}
    </div>
  );

  /* The active cycle's work split, in the shipped page's colours and order:
     started, backlog, completed. Drives both the stacked bar and its legend. */
  const progressSegments = [
    {
      key: 'started',
      count: activeCycleProgressStats.started,
      color: 'bg-amber-500',
      label: t('cycles.progress.started', 'Started {{count}} Work item{{plural}}', {
        count: activeCycleProgressStats.started,
        plural: activeCycleProgressStats.started !== 1 ? 's' : '',
      }),
    },
    {
      key: 'backlog',
      count: activeCycleProgressStats.backlog,
      color: 'bg-muted-foreground/40',
      label: t('cycles.progress.backlog', 'Backlog {{count}} Work item{{plural}}', {
        count: activeCycleProgressStats.backlog,
        plural: activeCycleProgressStats.backlog !== 1 ? 's' : '',
      }),
    },
    {
      key: 'completed',
      count: activeCycleProgressStats.completed,
      color: 'bg-emerald-500',
      label: t('cycles.progress.completed', 'Completed {{count}} Work item{{plural}}', {
        count: activeCycleProgressStats.completed,
        plural: activeCycleProgressStats.completed !== 1 ? 's' : '',
      }),
    },
  ];

  const cardEmpty = (icon: ReactNode, message: string) => (
    <div className="text-muted-foreground mt-4 flex flex-col items-center justify-center py-6">
      {icon}
      <p className="mt-2 text-center text-sm">{message}</p>
    </div>
  );

  return (
    <div className="space-y-6 pb-8">
      {workspaceSlug && projectId && (
        <UpdateCycleModal
          open={editCycle !== null}
          onClose={() => setEditCycle(null)}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          cycle={editCycle}
          onUpdated={(updated) => {
            applyCycleUpdate(updated);
            setEditCycle(null);
            toast.success(t('cycles.updateSuccess', 'Cycle updated'));
          }}
        />
      )}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('cycles.confirmDeleteTitle', 'Delete {{cycle}}?', {
                cycle: deleteTarget?.name ?? '',
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'cycles.confirmDeleteDescription',
                'The cycle is removed. Its work items stay in the project.',
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {t('common.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PageHeading
        title={t('common.cycles', 'Cycles')}
        description={t('cycles.pageDescription', 'Time-boxed delivery windows for {{project}}.', {
          project: project.name,
        })}
        summary={t('cycles.summary', '{{visible}} of {{total}} cycles', {
          visible: filteredCycles.length,
          total: cycles.length,
        })}
      />

      {/* The search lives in the cycles controller rather than the URL, so the
          shared toolbar is driven as a controlled field here. */}
      <ProjectListToolbar
        searchPlaceholder={t('cycles.searchPlaceholder', 'Search cycles')}
        regionLabel={t('cycles.toolbar', 'Cycle controls')}
        value={filters.searchQuery ?? ''}
        onValueChange={(value) =>
          setFilters((previous) => ({ ...previous, searchQuery: value || null }))
        }
        filters={<CyclesFiltersMenu filters={filters} onChange={setFilters} />}
        actions={
          <Button
            type="button"
            className="h-11 sm:h-9"
            onClick={() => setCreateOpen(true)}
            disabled={!workspaceSlug || !projectId}
          >
            <Plus aria-hidden="true" />
            {t('cycles.newCycle', 'New cycle')}
          </Button>
        }
      />

      {workspaceSlug && projectId && (
        <CreateCycleDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          onCreated={(cycle) => {
            /* The controller buckets cycles by date, so the new one is placed by
               a refetch rather than pushed onto a list it may not belong to. */
            refresh();
            toast.success(t('cycles.createSuccess', '{{cycle}} created', { cycle: cycle.name }));
          }}
        />
      )}

      {filteredCycles.length === 0 && cycles.length > 0 && (
        <p className="sr-only" aria-live="polite">
          {t('cycles.noMatches', 'No cycles match the current search and filters.')}
        </p>
      )}

      {cycles.length === 0 ? (
        <Empty className="rounded-xl border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarRange aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t('cycles.empty', 'No cycles yet')}</EmptyTitle>
            <EmptyDescription>
              {t(
                'cycles.emptyDescription',
                'Cycles group work into time-boxed windows so a team can see what ships when.',
              )}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden="true" />
              {t('cycles.newCycle', 'New cycle')}
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          {section({
            label:
              activeCycles.length === 1
                ? t('cycles.activeCycle', 'Active cycle')
                : t('cycles.activeCycles', 'Active cycles'),
            marker: <Clock className="size-4 shrink-0 text-amber-500" aria-hidden="true" />,
            defaultOpen: true,
            children: !activeCycle ? (
              <p className="text-muted-foreground border-t py-4 pl-4 text-sm">
                {t('cycles.noActive', 'No cycle is running right now.')}
              </p>
            ) : (
              <>
                {/* Sub-header, in the shipped page's order: ring, name, More
                    details, dates, timezone, lead, favourite, menu. */}
                <div
                  className="hover:bg-muted/50 flex cursor-pointer flex-wrap items-center gap-3 border-t px-4 py-3"
                  onClick={(event) => openCycleOnRowClick(event, activeCycle)}
                >
                  <CircularProgress
                    value={activeCycleProgressStats.percentClosed}
                    size={40}
                    aria-label={t('cycles.percentClosed', '{{percent}}% closed', {
                      percent: activeCycleProgressStats.percentClosed,
                    })}
                  />
                  <Link
                    to={cyclePath(activeCycle)}
                    title={activeCycle.name}
                    className="focus-visible:ring-ring min-w-0 flex-1 truncate rounded-sm font-medium outline-none hover:underline focus-visible:ring-2"
                  >
                    {activeCycle.name}
                  </Link>
                  <Link
                    to={cyclePath(activeCycle)}
                    className="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1.5 text-sm"
                  >
                    <Eye className="size-3.5" aria-hidden="true" />
                    {t('cycles.moreDetails', 'More details')}
                  </Link>
                  <span className="text-muted-foreground shrink-0 text-[13px]">
                    {cycleDateRange(activeCycle)}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-[13px]">
                    {project.timezone ?? 'UTC'}
                  </span>
                  {ownerAvatar(activeCycle)}
                  {favoriteButton(activeCycle)}
                  {cycleMenu(activeCycle)}
                </div>

                {/* Progress, burndown and the breakdown tabs, three across. */}
                <div className="grid gap-4 border-t p-4 sm:grid-cols-3">
                  {statCard(
                    t('cycles.progress.title', 'Progress'),
                    t(
                      'cycles.progress.workItemClosed',
                      '{{completed}}/{{total}} Work item closed',
                      {
                        completed: activeCycleProgressStats.completed,
                        total: activeCycleProgressStats.total,
                      },
                    ),
                    activeCycleProgressStats.total === 0 ? (
                      cardEmpty(
                        <TrendingUp className="size-12" strokeWidth={1.5} aria-hidden="true" />,
                        t(
                          'cycles.progress.empty',
                          'Add work items to the cycle to view its progress',
                        ),
                      )
                    ) : (
                      <>
                        <div className="bg-muted mt-3 flex h-2 w-full overflow-hidden rounded-full">
                          {progressSegments
                            .filter((segment) => segment.count > 0)
                            .map((segment) => (
                              <div
                                key={segment.key}
                                className={segment.color}
                                style={{
                                  width: `${(segment.count / activeCycleProgressStats.total) * 100}%`,
                                }}
                              />
                            ))}
                        </div>
                        <ul className="mt-3 space-y-1.5 text-[13px]">
                          {progressSegments
                            .filter((segment) => segment.count > 0)
                            .map((segment) => (
                              <li key={segment.key} className="flex items-center gap-2">
                                <span
                                  aria-hidden="true"
                                  className={`size-2 shrink-0 rounded-full ${segment.color}`}
                                />
                                {segment.label}
                              </li>
                            ))}
                        </ul>
                      </>
                    ),
                  )}

                  {statCard(
                    t('cycles.burndown.title', 'Work item burndown'),
                    t('cycles.burndown.pending', 'Pending work items - {{count}}', {
                      count: activeCycleProgressStats.total - activeCycleProgressStats.completed,
                    }),
                    activeCycleProgressStats.total === 0 ? (
                      cardEmpty(
                        <Activity className="size-12" strokeWidth={1.5} aria-hidden="true" />,
                        t(
                          'cycles.burndown.empty',
                          'Add work items to the cycle to view the burndown chart.',
                        ),
                      )
                    ) : (
                      <div className="mt-4">
                        <CycleBurndownChart
                          completionChart={activeBurndownChart ?? {}}
                          total={activeBurndownTotal}
                          startDate={activeCycle.start_date}
                          endDate={activeCycle.end_date}
                        />
                      </div>
                    ),
                  )}

                  <div className="rounded-lg border p-4">
                    <Tabs defaultValue="priority">
                      <TabsList className="w-full">
                        <TabsTrigger value="priority" className="flex-1 text-xs">
                          {t('cycles.tabs.priority', 'Priority work items')}
                        </TabsTrigger>
                        <TabsTrigger value="assignees" className="flex-1 text-xs">
                          {t('cycles.tabs.assignees', 'Assignees')}
                        </TabsTrigger>
                        <TabsTrigger value="labels" className="flex-1 text-xs">
                          {t('cycles.tabs.labels', 'Labels')}
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="priority" className="min-h-30 pt-3">
                        {activeCycleIssues.length === 0 ? (
                          cardEmpty(
                            <BarChart3 className="size-12" strokeWidth={1.5} aria-hidden="true" />,
                            t(
                              'cycles.tabs.priorityEmpty',
                              'Add work items to view priority breakdown.',
                            ),
                          )
                        ) : (
                          <ul className="space-y-2">
                            {[...activeCycleIssues]
                              .sort(
                                (a, b) =>
                                  (PRIORITY_ORDER[(a.priority as Priority) ?? 'none'] ?? 99) -
                                  (PRIORITY_ORDER[(b.priority as Priority) ?? 'none'] ?? 99),
                              )
                              .map((issue) => (
                                <li key={issue.id}>
                                  <Link
                                    to={`/${workspaceSlug}/projects/${projectId}/issues/${issue.id}`}
                                    className="hover:bg-muted/50 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
                                  >
                                    <span className="min-w-0 flex-1 truncate">{issue.name}</span>
                                    <Badge
                                      variant={
                                        issue.priority === 'urgent' ? 'destructive' : 'secondary'
                                      }
                                      className="shrink-0 px-1.5 py-0 text-[10px]"
                                    >
                                      {issue.priority ?? '—'}
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className="shrink-0 px-1.5 py-0 text-[10px]"
                                    >
                                      {getStateName(issue.state_id)}
                                    </Badge>
                                    {issue.target_date && (
                                      <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-[11px]">
                                        <CalendarRange className="size-3" aria-hidden="true" />
                                        {formatDate(issue.target_date)}
                                      </span>
                                    )}
                                  </Link>
                                </li>
                              ))}
                          </ul>
                        )}
                      </TabsContent>

                      <TabsContent value="assignees" className="min-h-30 pt-3">
                        {activeCycleAssigneeStats.length === 0 ? (
                          cardEmpty(
                            <Users className="size-12" strokeWidth={1.5} aria-hidden="true" />,
                            t('cycles.tabs.assigneesEmpty', 'No assignees in this cycle.'),
                          )
                        ) : (
                          <ul className="space-y-2">
                            {activeCycleAssigneeStats.map((stat) => {
                              const name = memberName(stat.memberId);
                              const member = stat.memberId
                                ? members.find((entry) => entry.member_id === stat.memberId)
                                : null;
                              return (
                                <li
                                  key={stat.memberId ?? '__unassigned__'}
                                  className="flex items-center justify-between gap-2"
                                >
                                  <div className="flex min-w-0 items-center gap-2">
                                    <Avatar className="size-6 shrink-0">
                                      <AvatarImage
                                        src={getImageUrl(member?.member_avatar) ?? ''}
                                        alt=""
                                      />
                                      <AvatarFallback className="text-[10px]">
                                        {initials(name)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="truncate text-sm">{name}</span>
                                  </div>
                                  <span className="text-muted-foreground shrink-0 text-[13px] tabular-nums">
                                    {t('cycles.percentOf', '{{percent}}% of {{total}}', {
                                      percent: stat.percent,
                                      total: stat.total,
                                    })}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </TabsContent>

                      <TabsContent value="labels" className="min-h-30 pt-3">
                        {activeCycleLabelStats.length === 0 ? (
                          cardEmpty(
                            <BarChart3 className="size-12" strokeWidth={1.5} aria-hidden="true" />,
                            t('cycles.tabs.labelsEmpty', 'No labels in this cycle.'),
                          )
                        ) : (
                          <ul className="space-y-2">
                            {activeCycleLabelStats.map((stat) => {
                              const label = stat.labelId
                                ? labels.find((entry) => entry.id === stat.labelId)
                                : null;
                              return (
                                <li
                                  key={stat.labelId ?? '__no_label__'}
                                  className="flex items-center justify-between gap-2"
                                >
                                  <div className="flex min-w-0 items-center gap-2">
                                    <span
                                      aria-hidden="true"
                                      className="size-3 shrink-0 rounded-full"
                                      style={{
                                        backgroundColor: label?.color || 'var(--muted-foreground)',
                                      }}
                                    />
                                    <span className="truncate text-sm">
                                      {label?.name ?? t('cycles.noLabels', 'No labels')}
                                    </span>
                                  </div>
                                  <span className="text-muted-foreground shrink-0 text-[13px] tabular-nums">
                                    {t('cycles.percentOf', '{{percent}}% of {{total}}', {
                                      percent: stat.percent,
                                      total: stat.total,
                                    })}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>

                {activeCycles.length > 1 && (
                  <div className="border-t px-4 py-3">
                    <p className="text-muted-foreground mb-2 text-[13px] font-medium">
                      {t('cycles.alsoInProgress', 'Also in progress:')}
                    </p>
                    <ul className="space-y-1.5">
                      {activeCycles.slice(1).map((cycle) => (
                        <li key={cycle.id}>
                          <Link
                            to={cyclePath(cycle)}
                            className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm"
                          >
                            <span>{cycle.name}</span>
                            <span className="text-xs">{cycleDateRange(cycle)}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ),
          })}

          {section({
            label: t('cycles.upcomingCycle', 'Upcoming cycle {{count}}', {
              count: upcomingCycles.length,
            }),
            marker: (
              <span
                aria-hidden="true"
                className="border-primary size-2 shrink-0 rounded-full border-2 border-dashed"
              />
            ),
            defaultOpen: true,
            children: cycleList(upcomingCycles, t('cycles.noUpcoming', 'No upcoming cycles.')),
          })}

          {section({
            label: t('cycles.completedCycle', 'Completed cycle {{count}}', {
              count: completedCycles.length,
            }),
            marker: (
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-emerald-500" />
            ),
            defaultOpen: true,
            children: cycleList(completedCycles, t('cycles.noCompleted', 'No completed cycles.')),
          })}
        </div>
      )}
    </div>
  );
}
