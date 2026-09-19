import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Boxes, CircleAlert, Plus, RefreshCw, SearchX } from 'lucide-react';
import { CreateModuleDialog } from '@/v2/components/create-module-dialog';
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
import { moduleService, type ModuleProgress } from '../../services/moduleService';
import { projectService } from '../../services/projectService';
import { MODULE_STATUSES } from '../../lib/moduleStatuses';
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
import { useModulesListPreferences } from '../hooks/useListViewPreferences';
import { EMPTY_PROGRESS, completionPercent, formatDate, matchesQuery } from '../lib/project';
import type { ModuleApiResponse, ProjectApiResponse } from '../../api/types';

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  MODULE_STATUSES.map((status) => [status.id, status.label]),
);

/** The columns a module list is worth reordering by. */
const SORT_FIELDS = [
  'name',
  'created_at',
  'updated_at',
  'start_date',
  'target_date',
  'progress',
] as const;
type ModuleSortField = (typeof SORT_FIELDS)[number];

/**
 * The v2 view of a project's modules, built from shadcn primitives. It renders
 * at the same URL as ModulesPage; the stored interface preference picks
 * between them.
 *
 * The page chrome — heading, body toolbar, table section, empty and error
 * states — is the one the workspace views page established, so every v2 list
 * reads the same way. A table rather than the cycles page's cards: modules have
 * no date window to anchor a card on, and the columns — status, progress,
 * dates — are what one module is compared against another by.
 */
export function ModulesPage() {
  const { t } = useTranslation();
  const { workspaceSlug, projectId } = useParams<{ workspaceSlug: string; projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  useDocumentTitle(t('common.modules', 'Modules'));
  useModulesListPreferences(workspaceSlug, projectId);

  const [modules, setModules] = useState<ModuleApiResponse[]>([]);
  const [progress, setProgress] = useState<Record<string, ModuleProgress>>({});
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(workspaceSlug && projectId));
  const [loadError, setLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);

  const query = searchParams.get('q') ?? '';
  /* Memoised so the sorted list below is not rebuilt on every render — reading
     a param allocates a fresh array each time. */
  const statusFilter = useMemo(() => readListParam(searchParams, 'status'), [searchParams]);
  const sort = useMemo(
    () => readSortState<ModuleSortField>(searchParams, SORT_FIELDS, 'created_at'),
    [searchParams],
  );

  useEffect(() => {
    if (!workspaceSlug || !projectId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the spinner belongs to this fetch
    setLoading(true);
    setLoadError(false);
    Promise.all([
      moduleService.list(workspaceSlug, projectId),
      /* Progress is decoration: a failure leaves the bars at zero rather than
         failing the page. */
      moduleService.listProgress(workspaceSlug, projectId).catch(() => ({})),
      projectService.get(workspaceSlug, projectId).catch(() => null),
    ])
      .then(([list, prog, proj]) => {
        if (cancelled) return;
        setModules(list ?? []);
        setProgress(prog ?? {});
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

  const visible = useMemo(() => {
    const filtered = modules.filter(
      (module) =>
        matchesQuery(query, module.name, module.description) &&
        passesFilter(statusFilter, module.status),
    );
    return filtered.sort((a, b) => {
      switch (sort.sortBy) {
        case 'name':
          return withOrder(compareText(a.name, b.name), sort.sortOrder);
        case 'updated_at':
          return withOrder(compareDates(a.updated_at, b.updated_at), sort.sortOrder);
        case 'start_date':
          return withOrder(compareDates(a.start_date, b.start_date), sort.sortOrder);
        case 'target_date':
          return withOrder(compareDates(a.target_date, b.target_date), sort.sortOrder);
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
  }, [modules, query, statusFilter, sort, progress]);

  const clearSearch = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('q');
    setSearchParams(next, { replace: true });
  };

  /* Shared by the filter popover and the active-filter chips under it, so the
     labels in both always come from the same config. */
  const filterGroups: ListFilterGroup[] = [
    {
      key: 'status',
      label: t('common.status', 'Status'),
      options: MODULE_STATUSES.map((status) => ({
        value: status.id,
        label: t(`moduleStatus.${status.id}`, status.label),
      })),
    },
  ];
  const selectedFilters = { status: statusFilter };

  const toggleFilter = (key: string, value: string) =>
    setSearchParams(toggleListParam(searchParams, key, value), { replace: true });

  const resetFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('status');
    setSearchParams(next, { replace: true });
  };

  const changeSort = (next: SortState<ModuleSortField>) =>
    setSearchParams(writeSortState(searchParams, next, 'created_at'), { replace: true });

  if (loading) {
    return <ListPageSkeleton label={t('modules.loading', 'Loading modules…')} rows={6} />;
  }

  if (loadError) {
    return (
      <Empty className="min-h-80 rounded-xl border border-dashed" role="alert">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
            <CircleAlert aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t('modules.loadErrorTitle', 'Modules could not be loaded')}</EmptyTitle>
          <EmptyDescription>
            {t(
              'modules.loadErrorDescription',
              'Check your connection and try again. Your modules have not been changed.',
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
          {modules.length === 0 ? <Boxes aria-hidden="true" /> : <SearchX aria-hidden="true" />}
        </EmptyMedia>
        <EmptyTitle>
          {modules.length === 0
            ? t('modules.emptyTitle', 'No modules yet')
            : t('modules.noMatchesTitle', 'No modules found')}
        </EmptyTitle>
        <EmptyDescription>
          {modules.length === 0
            ? t(
                'modules.emptyDescription',
                'Modules split a project into bodies of work that are planned and tracked on their own.',
              )
            : t('modules.noMatchesFiltered', 'No modules match the current search and filters.')}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {modules.length === 0 ? (
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" />
            {t('modules.newModule', 'New module')}
          </Button>
        ) : (
          <>
            {query && (
              <Button type="button" variant="outline" onClick={clearSearch}>
                <SearchX aria-hidden="true" />
                {t('common.clearSearch', 'Clear search')}
              </Button>
            )}
            {statusFilter.length > 0 && (
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
        title={t('common.modules', 'Modules')}
        description={t(
          'modules.pageDescription',
          'Bodies of work planned on their own in {{project}}.',
          {
            project: project?.name ?? t('common.thisProject', 'this project'),
          },
        )}
        summary={t('modules.summary', '{{visible}} of {{total}} modules', {
          visible: visible.length,
          total: modules.length,
        })}
      />

      <ProjectListToolbar
        searchPlaceholder={t('modules.searchPlaceholder', 'Search modules')}
        regionLabel={t('modules.toolbar', 'Module controls')}
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
                { value: 'progress', label: t('common.progress', 'Progress') },
                { value: 'start_date', label: t('modules.startDate', 'Start') },
                { value: 'target_date', label: t('modules.targetDate', 'Target') },
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
            {t('modules.newModule', 'New module')}
          </Button>
        }
      />

      {workspaceSlug && projectId && (
        <CreateModuleDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          onCreated={(module) => setModules((previous) => [module, ...previous])}
        />
      )}

      {visible.length === 0 ? (
        emptyState
      ) : (
        <section
          className="rounded-xl border"
          aria-label={t('modules.tableLabel', 'Modules table')}
        >
          <ScrollArea className="w-full">
            <Table className="min-w-[52rem]">
              <TableCaption className="sr-only">
                {t(
                  'modules.tableCaption',
                  'Modules in this project, with status, progress, start and target dates.',
                )}
              </TableCaption>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="min-w-72 px-3">{t('common.modules', 'Modules')}</TableHead>
                  <TableHead className="w-36 px-3">{t('common.status', 'Status')}</TableHead>
                  <TableHead className="w-56 px-3">{t('common.progress', 'Progress')}</TableHead>
                  <TableHead className="w-36 px-3">{t('modules.startDate', 'Start')}</TableHead>
                  <TableHead className="w-36 px-3">{t('modules.targetDate', 'Target')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((module) => {
                  const counts = progress[module.id] ?? EMPTY_PROGRESS;
                  const percent = completionPercent(counts);
                  return (
                    <TableRow key={module.id}>
                      <TableCell className="min-w-72 p-0">
                        <Link
                          to={`/${workspaceSlug}/projects/${projectId}/modules/${module.id}`}
                          className="hover:bg-muted/50 focus-visible:ring-ring flex h-14 flex-col justify-center gap-0.5 px-3 outline-none transition-colors focus-visible:ring-2"
                        >
                          <span className="truncate font-medium">{module.name}</span>
                          {module.description && (
                            <span className="text-muted-foreground truncate text-xs">
                              {module.description}
                            </span>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell className="px-3">
                        <Badge variant="secondary">
                          {STATUS_LABELS[module.status] ?? module.status}
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
                        {formatDate(module.start_date)}
                      </TableCell>
                      <TableCell className="text-muted-foreground px-3 text-sm">
                        {formatDate(module.target_date)}
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
          {t('modules.visibleCount', '{{count}} modules visible', { count: visible.length })}
        </p>
      )}
    </div>
  );
}
