import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CircleAlert, Layers, Plus, RefreshCw, SearchX } from 'lucide-react';
import { CreateEpicDialog } from '@/v2/components/create-epic-dialog';
import { ListFilterChips } from '@/v2/components/list-filter-chips';
import { ListFiltersMenu, type ListFilterGroup } from '@/v2/components/list-filters-menu';
import { ListPageSkeleton } from '@/v2/components/list-page-skeleton';
import { ListSortMenu } from '@/v2/components/list-sort-menu';
import { PageHeading } from '@/v2/components/page-heading';
import { ProjectListToolbar } from '@/v2/components/project-list-toolbar';
import { Badge } from '@/v2/components/ui/badge';
import { Button } from '@/v2/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/v2/components/ui/empty';
import { Progress } from '@/v2/components/ui/progress';
import { ScrollArea, ScrollBar } from '@/v2/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/v2/components/ui/table';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { epicService, type EpicProgress } from '../../services/epicService';
import { projectService } from '../../services/projectService';
import { stateService } from '../../services/stateService';
import {
  compareDates,
  compareNumbers,
  compareText,
  passesFilter,
  readListParam,
  readSortState,
  toggleListParam,
  withOrder,
  writeSortState,
  type SortState,
} from '../lib/listControls';
import { useEpicsListPreferences } from '../hooks/useListViewPreferences';
import {
  EMPTY_PROGRESS,
  PRIORITIES,
  PRIORITY_LABELS,
  completionPercent,
  formatDate,
  matchesQuery,
  priorityVariant,
  stateDotStyle,
  workItemDisplayId,
  type Priority,
} from '../lib/project';
import type { IssueApiResponse, ProjectApiResponse, StateApiResponse } from '../../api/types';

/** The columns an epic list is worth reordering by. */
const SORT_FIELDS = [
  'name',
  'created_at',
  'updated_at',
  'target_date',
  'priority',
  'progress',
] as const;
type EpicSortField = (typeof SORT_FIELDS)[number];

/** Urgent first when descending, which is the order the reader expects. */
const PRIORITY_RANK: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
};

/**
 * The v2 view of a project's epics, built from shadcn primitives. It renders
 * at the same URL as EpicsPage; the stored interface preference picks between
 * them.
 *
 * The page chrome — heading, body toolbar, table section, empty and error
 * states — is the one the workspace views page established, so every v2 list
 * reads the same way. An epic is a work item with children, so the useful
 * column is progress: the shipped page shows a count, this one shows the same
 * numbers as a bar, which is what the reader is actually comparing between rows.
 */
export function EpicsPage() {
  const { t } = useTranslation();
  const { workspaceSlug, projectId } = useParams<{ workspaceSlug: string; projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  useDocumentTitle(t('common.epics', 'Epics'));
  useEpicsListPreferences(workspaceSlug, projectId);

  const [epics, setEpics] = useState<IssueApiResponse[]>([]);
  const [progress, setProgress] = useState<Record<string, EpicProgress>>({});
  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(workspaceSlug && projectId));
  const [loadError, setLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);

  const query = searchParams.get('q') ?? '';
  /* Memoised so the sorted list below is not rebuilt on every render — reading
     a param allocates a fresh array each time. */
  const stateFilter = useMemo(() => readListParam(searchParams, 'state'), [searchParams]);
  const priorityFilter = useMemo(() => readListParam(searchParams, 'priority'), [searchParams]);
  const sort = useMemo(
    () => readSortState<EpicSortField>(searchParams, SORT_FIELDS, 'created_at'),
    [searchParams],
  );

  useEffect(() => {
    if (!workspaceSlug || !projectId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the spinner belongs to this fetch
    setLoading(true);
    setLoadError(false);
    Promise.all([
      epicService.list(workspaceSlug, projectId),
      /* Progress is decoration: a failure leaves the bars at zero rather than
         failing the page. */
      epicService.listProgress(workspaceSlug, projectId).catch(() => ({})),
      stateService.list(workspaceSlug, projectId).catch(() => [] as StateApiResponse[]),
      projectService.get(workspaceSlug, projectId).catch(() => null),
    ])
      .then(([list, prog, stateList, proj]) => {
        if (cancelled) return;
        setEpics(list ?? []);
        setProgress(prog ?? {});
        setStates(stateList ?? []);
        setProject(proj);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, reloadToken]);

  const stateById = useMemo(() => new Map(states.map((s) => [s.id, s])), [states]);

  const visible = useMemo(() => {
    const filtered = epics.filter(
      (epic) =>
        matchesQuery(query, epic.name, workItemDisplayId(epic, project ?? undefined)) &&
        passesFilter(stateFilter, epic.state_id) &&
        passesFilter(priorityFilter, epic.priority ?? 'none'),
    );
    return filtered.sort((a, b) => {
      switch (sort.sortBy) {
        case 'name':
          return withOrder(compareText(a.name, b.name), sort.sortOrder);
        case 'updated_at':
          return withOrder(compareDates(a.updated_at, b.updated_at), sort.sortOrder);
        case 'target_date':
          return withOrder(compareDates(a.target_date, b.target_date), sort.sortOrder);
        case 'priority':
          return withOrder(
            compareNumbers(
              PRIORITY_RANK[a.priority ?? 'none'] ?? 0,
              PRIORITY_RANK[b.priority ?? 'none'] ?? 0,
            ),
            sort.sortOrder,
          );
        case 'progress':
          return withOrder(
            compareNumbers(
              completionPercent(progress[a.id] ?? EMPTY_PROGRESS),
              completionPercent(progress[b.id] ?? EMPTY_PROGRESS),
            ),
            sort.sortOrder,
          );
        default:
          return withOrder(compareDates(a.created_at, b.created_at), sort.sortOrder);
      }
    });
  }, [epics, query, project, stateFilter, priorityFilter, sort, progress]);

  const clearSearch = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('q');
    setSearchParams(next, { replace: true });
  };

  /* Shared by the filter popover and the active-filter chips under it, so the
     labels in both always come from the same config. */
  const filterGroups: ListFilterGroup[] = [
    {
      key: 'state',
      label: t('views.state', 'State'),
      options: states.map((state) => ({
        value: state.id,
        label: state.name,
        color: state.color || undefined,
      })),
    },
    {
      key: 'priority',
      label: t('views.priority', 'Priority'),
      options: PRIORITIES.map((value) => ({
        value,
        label: t(`priority.${value}`, PRIORITY_LABELS[value]),
      })),
    },
  ];
  const selectedFilters = { state: stateFilter, priority: priorityFilter };

  const toggleFilter = (key: string, value: string) =>
    setSearchParams(toggleListParam(searchParams, key, value), { replace: true });

  const resetFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('state');
    next.delete('priority');
    setSearchParams(next, { replace: true });
  };

  const changeSort = (next: SortState<EpicSortField>) =>
    setSearchParams(writeSortState(searchParams, next, 'created_at'), { replace: true });

  const filtersActive = stateFilter.length > 0 || priorityFilter.length > 0;

  if (loading) {
    return <ListPageSkeleton label={t('epics.loading', 'Loading epics…')} rows={6} />;
  }

  if (loadError) {
    return (
      <Empty className="min-h-80 rounded-xl border border-dashed" role="alert">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
            <CircleAlert aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t('epics.loadErrorTitle', 'Epics could not be loaded')}</EmptyTitle>
          <EmptyDescription>
            {t(
              'epics.loadErrorDescription',
              'Check your connection and try again. Your epics have not been changed.',
            )}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            type="button"
            variant="outline"
            onClick={() => setReloadToken((value) => value + 1)}
          >
            <RefreshCw aria-hidden="true" />
            {t('common.retry', 'Try again')}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const emptyState = (
    <Empty className="rounded-xl border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {epics.length === 0 ? <Layers aria-hidden="true" /> : <SearchX aria-hidden="true" />}
        </EmptyMedia>
        <EmptyTitle>
          {epics.length === 0
            ? t('epics.emptyTitle', 'No epics yet')
            : t('epics.noMatchesTitle', 'No epics found')}
        </EmptyTitle>
        <EmptyDescription>
          {epics.length === 0
            ? t(
                'epics.emptyDescription',
                'Epics group related work items so a long-running effort can be tracked as one thing.',
              )
            : t('epics.noMatchesFiltered', 'No epics match the current search and filters.')}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {epics.length === 0 ? (
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" />
            {t('epics.newEpic', 'New epic')}
          </Button>
        ) : (
          <>
            {query && (
              <Button type="button" variant="outline" onClick={clearSearch}>
                <SearchX aria-hidden="true" />
                {t('common.clearSearch', 'Clear search')}
              </Button>
            )}
            {filtersActive && (
              <Button type="button" variant="outline" onClick={resetFilters}>
                {t('common.resetFilters', 'Reset filters')}
              </Button>
            )}
          </>
        )}
      </EmptyContent>
    </Empty>
  );

  return (
    <div className="space-y-6 pb-8">
      <PageHeading
        title={t('common.epics', 'Epics')}
        description={t(
          'epics.pageDescription',
          'Long-running efforts grouping work in {{project}}.',
          {
            project: project?.name ?? t('common.thisProject', 'this project'),
          },
        )}
        summary={t('epics.summary', '{{visible}} of {{total}} epics', {
          visible: visible.length,
          total: epics.length,
        })}
      />

      <ProjectListToolbar
        searchPlaceholder={t('epics.searchPlaceholder', 'Search epics')}
        regionLabel={t('epics.toolbar', 'Epic controls')}
        chips={
          <ListFilterChips
            groups={filterGroups}
            selected={selectedFilters}
            onToggle={toggleFilter}
            onReset={resetFilters}
          />
        }
        filters={
          <>
            <ListFiltersMenu
              groups={filterGroups}
              selected={selectedFilters}
              onToggle={toggleFilter}
              onReset={resetFilters}
            />
            <ListSortMenu
              options={[
                { value: 'created_at', label: t('common.createdAt', 'Created at') },
                { value: 'updated_at', label: t('common.updatedAt', 'Updated at') },
                { value: 'name', label: t('common.name', 'Name') },
                { value: 'priority', label: t('views.priority', 'Priority') },
                { value: 'progress', label: t('common.progress', 'Progress') },
                { value: 'target_date', label: t('issues.targetDate', 'Due') },
              ]}
              value={sort}
              onChange={changeSort}
            />
          </>
        }
        actions={
          <Button
            type="button"
            className="h-11 sm:h-9"
            onClick={() => setCreateOpen(true)}
            disabled={!workspaceSlug || !projectId}
          >
            <Plus aria-hidden="true" />
            {t('epics.newEpic', 'New epic')}
          </Button>
        }
      />

      {workspaceSlug && projectId && (
        <CreateEpicDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          onCreated={(epic) => setEpics((previous) => [epic, ...previous])}
        />
      )}

      {visible.length === 0 ? (
        emptyState
      ) : (
        <section className="rounded-xl border" aria-label={t('epics.tableLabel', 'Epics table')}>
          <ScrollArea className="w-full">
            <Table className="min-w-[52rem]">
              <TableCaption className="sr-only">
                {t(
                  'epics.tableCaption',
                  'Epics in this project, with state, priority, progress and due date.',
                )}
              </TableCaption>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="min-w-72 px-3">{t('common.epics', 'Epics')}</TableHead>
                  <TableHead className="w-40 px-3">{t('views.state', 'State')}</TableHead>
                  <TableHead className="w-32 px-3">{t('views.priority', 'Priority')}</TableHead>
                  <TableHead className="w-56 px-3">{t('common.progress', 'Progress')}</TableHead>
                  <TableHead className="w-36 px-3">{t('issues.targetDate', 'Due')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((epic) => {
                  const counts = progress[epic.id] ?? EMPTY_PROGRESS;
                  const percent = completionPercent(counts);
                  const state = epic.state_id ? stateById.get(epic.state_id) : undefined;
                  return (
                    <TableRow key={epic.id}>
                      <TableCell className="min-w-72 p-0">
                        <Link
                          to={`/${workspaceSlug}/projects/${projectId}/epics/${epic.id}`}
                          className="hover:bg-muted/50 focus-visible:ring-ring flex h-14 items-center gap-2 px-3 outline-none transition-colors focus-visible:ring-2"
                        >
                          <span className="text-muted-foreground shrink-0 font-mono text-xs">
                            {workItemDisplayId(epic, project ?? undefined)}
                          </span>
                          <span className="truncate font-medium">{epic.name}</span>
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
                        <Badge variant={priorityVariant(epic.priority)}>
                          {PRIORITY_LABELS[(epic.priority ?? 'none') as Priority] ?? epic.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3">
                        <div className="flex items-center gap-2">
                          <Progress value={percent} className="h-2 w-28" />
                          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                            {counts.completed}/{counts.total}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground px-3 text-sm">
                        {formatDate(epic.target_date)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </section>
      )}

      {query && (
        <p className="sr-only" aria-live="polite">
          {t('epics.visibleCount', '{{count}} epics visible', { count: visible.length })}
        </p>
      )}
    </div>
  );
}
