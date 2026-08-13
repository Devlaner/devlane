import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Boxes, CircleAlert, RefreshCw, SearchX } from 'lucide-react';
import { ListPageSkeleton } from '@/components/shadcn/list-page-skeleton';
import { PageHeading } from '@/components/shadcn/page-heading';
import { ProjectListToolbar } from '@/components/shadcn/project-list-toolbar';
import { Badge } from '@/components/shadcn/ui/badge';
import { Button } from '@/components/shadcn/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/shadcn/ui/empty';
import { Progress } from '@/components/shadcn/ui/progress';
import { ScrollArea, ScrollBar } from '@/components/shadcn/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/ui/table';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { moduleService, type ModuleProgress } from '../services/moduleService';
import { projectService } from '../services/projectService';
import { MODULE_STATUSES } from '../lib/moduleStatuses';
import { EMPTY_PROGRESS, completionPercent, formatDate, matchesQuery } from '../lib/projectV2';
import type { ModuleApiResponse, ProjectApiResponse } from '../api/types';

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  MODULE_STATUSES.map((status) => [status.id, status.label]),
);

/**
 * Design preview of a project's modules, built from shadcn primitives. It
 * stands alongside ModulesPage rather than replacing it, so the two can be
 * compared side by side.
 *
 * The page chrome — heading, body toolbar, table section, empty and error
 * states — is the one the workspace views page established, so every v2 list
 * reads the same way. A table rather than the cycles page's cards: modules have
 * no date window to anchor a card on, and the columns — status, progress,
 * dates — are what one module is compared against another by.
 */
export function ProjectModulesPageV2() {
  const { t } = useTranslation();
  const { workspaceSlug, projectId } = useParams<{ workspaceSlug: string; projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  useDocumentTitle(t('common.modules', 'Modules'));

  const [modules, setModules] = useState<ModuleApiResponse[]>([]);
  const [progress, setProgress] = useState<Record<string, ModuleProgress>>({});
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(workspaceSlug && projectId));
  const [loadError, setLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const query = searchParams.get('q') ?? '';

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

  const visible = useMemo(
    () => modules.filter((module) => matchesQuery(query, module.name, module.description)),
    [modules, query],
  );

  const clearSearch = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('q');
    setSearchParams(next, { replace: true });
  };

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
            : t('modules.noMatches', 'No modules match the current search.')}
        </EmptyDescription>
      </EmptyHeader>
      {modules.length > 0 && query && (
        <EmptyContent>
          <Button type="button" variant="outline" onClick={clearSearch}>
            <SearchX aria-hidden="true" />
            {t('common.clearSearch', 'Clear search')}
          </Button>
        </EmptyContent>
      )}
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
      />

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
                          to={`/${workspaceSlug}/app-v2/projects/${projectId}/modules/${module.id}`}
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
