import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Archive,
  CalendarRange,
  ChevronDown,
  CircleAlert,
  ExternalLink,
  Link2,
  MoreHorizontal,
  Pencil,
  Plus,
  Star,
  Trash2,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/v2/components/ui/card';
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
import { Progress } from '@/v2/components/ui/progress';
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

  const renderCycleRow = (cycle: CycleApiResponse) => {
    const owner = getOwnerMember(cycle.owned_by_id);
    const percent = getProgress(cycle);
    const favorite = isFavorite(cycle.id);

    return (
      <div
        key={cycle.id}
        className="hover:bg-muted/40 flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0"
      >
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

        <Link
          to={cyclePath(cycle)}
          className="focus-visible:ring-ring min-w-40 flex-1 truncate rounded-sm font-medium outline-none hover:underline focus-visible:ring-2"
        >
          {cycle.name}
        </Link>

        <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs">
          <CalendarRange className="size-3.5" aria-hidden="true" />
          {cycleDateRange(cycle)}
        </span>

        <span className="flex w-32 shrink-0 items-center gap-2">
          <Progress value={percent} className="h-1.5 flex-1" />
          <span className="text-muted-foreground text-xs tabular-nums">{percent}%</span>
        </span>

        <Badge variant="secondary" className="shrink-0 tabular-nums">
          {t('cycles.workItemCount', '{{count}} work items', { count: getIssueCount(cycle.id) })}
        </Badge>

        {owner ? (
          <Avatar className="size-6 shrink-0" title={owner.name}>
            <AvatarImage src={getImageUrl(owner.avatarUrl) ?? ''} alt="" />
            <AvatarFallback className="text-[10px]">{initials(owner.name)}</AvatarFallback>
          </Avatar>
        ) : (
          <span className="text-muted-foreground shrink-0 text-xs">
            {t('cycles.noOwner', 'No lead')}
          </span>
        )}

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
      </div>
    );
  };

  const section = (
    title: string,
    list: CycleApiResponse[],
    defaultOpen: boolean,
    emptyLabel: string,
  ) => (
    <Collapsible defaultOpen={defaultOpen} className="rounded-xl border">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="hover:bg-muted/40 group flex w-full items-center gap-2 px-4 py-3 text-left"
        >
          <ChevronDown
            aria-hidden="true"
            className="size-4 transition-transform group-data-[state=closed]:-rotate-90"
          />
          <span className="text-sm font-medium">{title}</span>
          <Badge variant="secondary" className="tabular-nums">
            {list.length}
          </Badge>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {list.length === 0 ? (
          <p className="text-muted-foreground border-t px-4 py-6 text-center text-sm">
            {emptyLabel}
          </p>
        ) : (
          <div className="border-t">{list.map(renderCycleRow)}</div>
        )}
      </CollapsibleContent>
    </Collapsible>
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

      {activeCycle ? (
        <Card className="gap-4">
          <CardHeader className="gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">
                <Link to={cyclePath(activeCycle)} className="hover:underline">
                  {activeCycle.name}
                </Link>
              </CardTitle>
              <Badge variant="secondary">{t('cycles.active', 'Active')}</Badge>
              <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <CalendarRange className="size-3.5" aria-hidden="true" />
                {cycleDateRange(activeCycle)}
              </span>
              <span className="text-muted-foreground ml-auto text-sm tabular-nums">
                {t('cycles.percentClosed', '{{percent}}% closed', {
                  percent: activeCycleProgressStats.percentClosed,
                })}
              </span>
            </div>
            <Progress value={activeCycleProgressStats.percentClosed} className="h-2" />
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="tabular-nums">
                {t('common.total', 'Total')} {activeCycleProgressStats.total}
              </Badge>
              <Badge variant="secondary" className="tabular-nums">
                {t('states.started', 'In Progress')} {activeCycleProgressStats.started}
              </Badge>
              <Badge variant="secondary" className="tabular-nums">
                {t('stateGroup.backlog', 'Backlog')} {activeCycleProgressStats.backlog}
              </Badge>
              <Badge variant="secondary" className="tabular-nums">
                {t('states.completed', 'Done')} {activeCycleProgressStats.completed}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {activeBurndownChart && (
              <CycleBurndownChart
                completionChart={activeBurndownChart}
                total={activeBurndownTotal}
                startDate={activeCycle.start_date}
                endDate={activeCycle.end_date}
              />
            )}

            <Tabs defaultValue="priority">
              <TabsList>
                <TabsTrigger value="priority">
                  {t('cycles.tabs.priority', 'Priority work items')}
                </TabsTrigger>
                <TabsTrigger value="assignees">{t('common.assignees', 'Assignees')}</TabsTrigger>
                <TabsTrigger value="labels">{t('common.labels', 'Labels')}</TabsTrigger>
              </TabsList>

              <TabsContent value="priority" className="pt-3">
                {activeCycleIssues.length === 0 ? (
                  <p className="text-muted-foreground py-6 text-center text-sm">
                    {t('cycles.tabs.priorityEmpty', 'Add work items to view priority breakdown.')}
                  </p>
                ) : (
                  <ul className="space-y-1">
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
                              variant={issue.priority === 'urgent' ? 'destructive' : 'secondary'}
                              className="shrink-0"
                            >
                              {issue.priority ?? '—'}
                            </Badge>
                            <Badge variant="outline" className="shrink-0">
                              {getStateName(issue.state_id)}
                            </Badge>
                            {issue.target_date && (
                              <span className="text-muted-foreground shrink-0 text-xs">
                                {formatDate(issue.target_date)}
                              </span>
                            )}
                          </Link>
                        </li>
                      ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="assignees" className="pt-3">
                {activeCycleAssigneeStats.length === 0 ? (
                  <p className="text-muted-foreground py-6 text-center text-sm">
                    {t('cycles.tabs.assigneesEmpty', 'No assignees in this cycle.')}
                  </p>
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
                          className="flex items-center gap-3"
                        >
                          <Avatar className="size-6 shrink-0">
                            <AvatarImage src={getImageUrl(member?.member_avatar) ?? ''} alt="" />
                            <AvatarFallback className="text-[10px]">
                              {initials(name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
                          <Progress value={stat.percent} className="h-1.5 w-32 shrink-0" />
                          <span className="text-muted-foreground w-20 shrink-0 text-right text-xs tabular-nums">
                            {stat.completed}/{stat.total}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="labels" className="pt-3">
                {activeCycleLabelStats.length === 0 ? (
                  <p className="text-muted-foreground py-6 text-center text-sm">
                    {t('cycles.tabs.labelsEmpty', 'No labels in this cycle.')}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {activeCycleLabelStats.map((stat) => {
                      const label = stat.labelId
                        ? labels.find((entry) => entry.id === stat.labelId)
                        : null;
                      return (
                        <li
                          key={stat.labelId ?? '__no_label__'}
                          className="flex items-center gap-3"
                        >
                          <span
                            aria-hidden="true"
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: label?.color || 'var(--muted-foreground)' }}
                          />
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {label?.name ?? t('cycles.noLabel', 'No label')}
                          </span>
                          <Progress value={stat.percent} className="h-1.5 w-32 shrink-0" />
                          <span className="text-muted-foreground w-20 shrink-0 text-right text-xs tabular-nums">
                            {stat.completed}/{stat.total}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      ) : (
        cycles.length > 0 && (
          <Card className="border-dashed shadow-none">
            <CardContent className="text-muted-foreground py-8 text-center text-sm">
              {t('cycles.noActive', 'No cycle is running right now.')}
            </CardContent>
          </Card>
        )
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
        <div className="space-y-4">
          {section(
            t('cycles.upcoming', 'Upcoming'),
            upcomingCycles,
            true,
            t('cycles.noUpcoming', 'No upcoming cycles.'),
          )}
          {section(
            t('cycles.completed', 'Completed'),
            completedCycles,
            false,
            t('cycles.noCompleted', 'No completed cycles.'),
          )}
        </div>
      )}
    </div>
  );
}
