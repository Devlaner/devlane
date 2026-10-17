import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Archive, ArchiveRestore, SearchX } from 'lucide-react';
import { ArchivesToolbar } from '@/v2/components/archives-toolbar';
import { PageHeading } from '@/v2/components/page-heading';
import { Button } from '@/v2/components/ui/button';
import { Card, CardContent } from '@/v2/components/ui/card';
import { Skeleton } from '@/v2/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/v2/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/v2/components/ui/toggle-group';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDate } from '../../i18n/format';
import { issueService } from '../../services/issueService';
import { projectService } from '../../services/projectService';
import { useArchivesPreferences } from '../hooks/useListViewPreferences';
import type { IssueApiResponse, ProjectApiResponse } from '../../api/types';

const ARCHIVES_PAGE_SIZE = 50;
type ArchiveScope = 'work-items' | 'projects';

function formatArchivedAt(iso: string | null | undefined): string {
  if (!iso) return '—';
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return '—';
  return formatDate(parsed, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

/**
 * Workspace archives rendered with the same page hierarchy and responsive
 * control surface as the v2 Projects page. Archive-specific behavior remains
 * intact: work items and projects have separate scopes, filters are URL-backed,
 * and work-item pagination keeps its own server offset after restores.
 */
export function ArchivesPage() {
  const { t } = useTranslation();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  useDocumentTitle(t('archives.documentTitle', 'Archives'));
  useArchivesPreferences(workspaceSlug);

  const [issues, setIssues] = useState<IssueApiResponse[]>([]);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<ProjectApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  /* Server-side fetch position, tracked separately from issues.length so that
     restoring an item — which removes it from the list — does not skew the
     next page's offset. */
  const [fetchedCount, setFetchedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoringProjectId, setRestoringProjectId] = useState<string | null>(null);

  const query = searchParams.get('q') ?? '';
  const activeScope: ArchiveScope =
    searchParams.get('scope') === 'projects' ? 'projects' : 'work-items';
  const projectFilter = useMemo(
    () => (searchParams.get('project') ?? '').split(',').filter(Boolean),
    [searchParams],
  );
  const hasDiscoveryFilters = Boolean(query.trim() || projectFilter.length);

  useEffect(() => {
    if (!workspaceSlug) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    setError(null);
    Promise.all([
      /* One extra row tells us whether another page exists. */
      issueService.listWorkspaceArchived(workspaceSlug, { limit: ARCHIVES_PAGE_SIZE + 1 }),
      projectService.list(workspaceSlug),
      projectService.listArchived(workspaceSlug),
    ])
      .then(([archived, activeProjects, archivedProjectList]) => {
        if (cancelled) return;
        const page = archived.slice(0, ARCHIVES_PAGE_SIZE);
        setHasMore(archived.length > ARCHIVES_PAGE_SIZE);
        setIssues(page);
        setFetchedCount(page.length);
        setProjects(activeProjects ?? []);
        setArchivedProjects(archivedProjectList ?? []);
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
  }, [workspaceSlug, reloadToken]);

  const loadMore = async () => {
    if (!workspaceSlug || loadingMore || restoringId) return;
    setLoadingMore(true);
    try {
      const next = await issueService.listWorkspaceArchived(workspaceSlug, {
        limit: ARCHIVES_PAGE_SIZE + 1,
        offset: fetchedCount,
      });
      const page = next.slice(0, ARCHIVES_PAGE_SIZE);
      setHasMore(next.length > ARCHIVES_PAGE_SIZE);
      setFetchedCount((count) => count + page.length);
      /* De-duplicated by id in case a restore shifted the server-side window. */
      setIssues((previous) => {
        const seen = new Set(previous.map((issue) => issue.id));
        return [...previous, ...page.filter((issue) => !seen.has(issue.id))];
      });
      setError(null);
    } catch {
      setError(t('archives.loadMoreError', 'Could not load more archived work items.'));
    } finally {
      setLoadingMore(false);
    }
  };

  const projectOptions = useMemo(() => {
    const byId = new Map<string, ProjectApiResponse>();
    [...projects, ...archivedProjects].forEach((project) => byId.set(project.id, project));
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [archivedProjects, projects]);

  const projectById = useMemo(
    () => new Map(projectOptions.map((project) => [project.id, project])),
    [projectOptions],
  );

  const restore = async (issue: IssueApiResponse) => {
    if (!workspaceSlug || restoringId || loadingMore) return;
    setRestoringId(issue.id);
    try {
      await issueService.restore(workspaceSlug, issue.project_id, issue.id);
      setIssues((previous) => previous.filter((item) => item.id !== issue.id));
      /* Restoring removes the row from the server-side OFFSET window too. Keep
         the next page aligned so the first unseen item is not skipped. */
      setFetchedCount((count) => Math.max(0, count - 1));
      setError(null);
    } catch {
      setError(t('archives.restoreItemError', 'Could not restore that work item.'));
    } finally {
      setRestoringId(null);
    }
  };

  const restoreProject = async (project: ProjectApiResponse) => {
    if (!workspaceSlug || restoringProjectId) return;
    setRestoringProjectId(project.id);
    try {
      await projectService.restore(workspaceSlug, project.id);
      setProjects((previous) => [
        ...previous.filter((item) => item.id !== project.id),
        { ...project, archived_at: null },
      ]);
      setArchivedProjects((previous) => previous.filter((item) => item.id !== project.id));
      setError(null);
    } catch {
      setError(t('archives.restoreProjectError', 'Could not restore that project.'));
    } finally {
      setRestoringProjectId(null);
    }
  };

  const displayId = (issue: IssueApiResponse) => {
    const project = projectById.get(issue.project_id);
    const prefix = project?.identifier ?? project?.id.slice(0, 8) ?? issue.project_id.slice(0, 8);
    return `${prefix}-${issue.sequence_id ?? issue.id.slice(-4)}`;
  };

  /* Search and the project filter are applied here rather than in the request:
     the archives endpoints take only limit and offset. */
  const visibleIssues = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return issues.filter((issue) => {
      if (projectFilter.length && !projectFilter.includes(issue.project_id)) return false;
      if (!needle) return true;
      return (
        issue.name?.toLowerCase().includes(needle) ||
        displayId(issue).toLowerCase().includes(needle)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- displayId is derived from projectById
  }, [issues, query, projectFilter, projectById]);

  /* The project filter names projects; on the projects scope it selects rows
     directly rather than filtering by a foreign key. */
  const visibleArchivedProjects = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return archivedProjects.filter((project) => {
      if (projectFilter.length && !projectFilter.includes(project.id)) return false;
      if (!needle) return true;
      return project.name?.toLowerCase().includes(needle);
    });
  }, [archivedProjects, query, projectFilter]);

  const clearDiscoveryFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('q');
    next.delete('project');
    setSearchParams(next, { replace: true });
  };

  const setActiveScope = (scope: string) => {
    if (scope !== 'work-items' && scope !== 'projects') return;
    const next = new URLSearchParams(searchParams);
    if (scope === 'projects') next.set('scope', scope);
    else next.delete('scope');
    setSearchParams(next, { replace: true });
  };

  if (loading) {
    return (
      <div
        className="space-y-6 pb-8"
        aria-busy="true"
        aria-label={t('archives.loading', 'Loading archives…')}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center"
        role="alert"
      >
        <span className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-full">
          <Archive aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-xl font-semibold">
          {t('archives.loadErrorTitle', 'Archives could not be loaded')}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-md text-sm">
          {t(
            'archives.loadErrorDescription',
            'Check your connection and try again. Your archived data has not been changed.',
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

  const emptyState = (scope: ArchiveScope) => {
    const isFiltered = hasDiscoveryFilters;
    const canLoadMore = scope === 'work-items' && hasMore;
    const title = canLoadMore
      ? t('archives.noMatchesYetTitle', 'No matches yet')
      : isFiltered
        ? t('archives.noMatchesTitle', 'No archives found')
        : scope === 'work-items'
          ? t('archives.empty', 'No archived work items')
          : t('archives.noArchivedProjects', 'No archived projects');
    const description = canLoadMore
      ? t(
          'archives.noMatchesYet',
          'No loaded archives match this view. Load more to continue searching.',
        )
      : isFiltered
        ? t('archives.noMatches', 'No archives match the current search or filters.')
        : scope === 'work-items'
          ? t('archives.emptyHint', 'Archive a work item from its menu and it will show up here.')
          : t(
              'archives.noArchivedProjectsHint',
              'Archived projects will appear here until they are restored.',
            );

    return (
      <Card className="items-center gap-0 border-dashed px-6 py-14 text-center shadow-none">
        <span className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
          {isFiltered ? <SearchX aria-hidden="true" /> : <Archive aria-hidden="true" />}
        </span>
        <CardContent className="mt-4 max-w-md px-0">
          <h2 className="font-semibold">{title}</h2>
          <p className="text-muted-foreground mt-2 text-sm leading-6">{description}</p>
          {isFiltered && !canLoadMore && (
            <Button
              type="button"
              variant="outline"
              className="mt-5"
              onClick={clearDiscoveryFilters}
            >
              <SearchX aria-hidden="true" />
              {t('common.clearFilters', 'Clear filters')}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  const workItemCount = hasMore ? `${issues.length}+` : issues.length;

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeading
        title={t('archives.title', 'Archives')}
        description={t(
          'archives.pageDescription',
          'Review and restore archived work items and projects across your workspace.',
        )}
        summary={t('archives.summary', 'Work items {{workItems}} · Projects {{projects}}', {
          workItems: workItemCount,
          projects: archivedProjects.length,
        })}
      />

      <ArchivesToolbar
        projects={projectOptions}
        scopeControl={
          /* The same segmented control the projects list uses for its scope —
             same component, spacing and sizes — so the two discovery toolbars
             are one pattern rather than two lookalikes. */
          <ToggleGroup
            type="single"
            value={activeScope}
            onValueChange={setActiveScope}
            variant="default"
            size="sm"
            spacing={1}
            className="bg-muted/60 w-fit max-w-full shrink-0 touch-pan-x overflow-x-auto rounded-lg p-1 sm:p-0.5"
            aria-label={t('archives.scope', 'Archive type')}
          >
            <ToggleGroupItem
              value="work-items"
              className="data-[state=on]:bg-background h-11 min-w-0 gap-1.5 px-3 data-[state=on]:shadow-xs sm:h-8 sm:px-2.5"
            >
              {t('views.workItems', 'Work items')}
              <span className="text-muted-foreground min-w-3 text-center text-xs font-normal tabular-nums">
                {workItemCount}
              </span>
            </ToggleGroupItem>
            <ToggleGroupItem
              value="projects"
              className="data-[state=on]:bg-background h-11 min-w-0 gap-1.5 px-3 data-[state=on]:shadow-xs sm:h-8 sm:px-2.5"
            >
              {t('common.projects', 'Projects')}
              <span className="text-muted-foreground min-w-3 text-center text-xs font-normal tabular-nums">
                {archivedProjects.length}
              </span>
            </ToggleGroupItem>
          </ToggleGroup>
        }
      />

      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      {activeScope === 'work-items' && (
        <div>
          {visibleIssues.length === 0 ? (
            emptyState('work-items')
          ) : (
            <>
              <section
                className="overflow-hidden rounded-xl border"
                aria-label={t('archives.workItemsTableLabel', 'Archived work items table')}
              >
                <Table className="min-w-[44rem]">
                  <TableCaption className="sr-only">
                    {t(
                      'archives.workItemsTableCaption',
                      'Archived work items, their projects, archive dates, and restore actions',
                    )}
                  </TableCaption>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="min-w-72 px-4">
                        {t('views.workItems', 'Work items')}
                      </TableHead>
                      <TableHead className="min-w-48 px-3">
                        {t('common.project', 'Project')}
                      </TableHead>
                      <TableHead className="w-40 px-3">
                        {t('archives.archived', 'Archived')}
                      </TableHead>
                      <TableHead className="w-36 px-3 text-right">
                        <span className="sr-only">{t('common.actions', 'Actions')}</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleIssues.map((issue) => (
                      <TableRow key={issue.id}>
                        <TableCell className="px-4 py-3">
                          <Link
                            to={`/${workspaceSlug}/projects/${issue.project_id}/issues/${issue.id}`}
                            className="block max-w-96 truncate rounded-sm font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {issue.name}
                          </Link>
                          <span className="text-muted-foreground mt-0.5 block font-mono text-xs">
                            {displayId(issue)}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-64 truncate px-3 text-sm">
                          {projectById.get(issue.project_id)?.name ?? '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground px-3 text-sm">
                          {formatArchivedAt(issue.archived_at)}
                        </TableCell>
                        <TableCell className="px-3 text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-11 sm:h-8"
                            onClick={() => void restore(issue)}
                            disabled={restoringId !== null || loadingMore}
                            aria-busy={restoringId === issue.id || undefined}
                            aria-label={t('archives.restoreWorkItem', 'Restore {{item}}', {
                              item: issue.name,
                            })}
                          >
                            <ArchiveRestore aria-hidden="true" />
                            {restoringId === issue.id
                              ? t('archives.restoring', 'Restoring…')
                              : t('common.restore', 'Restore')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </section>
            </>
          )}

          {hasMore && (
            <div className="mt-3 flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11 sm:h-8"
                onClick={() => void loadMore()}
                disabled={loadingMore || restoringId !== null}
                aria-busy={loadingMore || undefined}
              >
                {loadingMore ? t('common.loading', 'Loading…') : t('common.loadMore', 'Load more')}
              </Button>
            </div>
          )}
        </div>
      )}

      {activeScope === 'projects' && (
        <div>
          {visibleArchivedProjects.length === 0 ? (
            emptyState('projects')
          ) : (
            <section
              className="overflow-hidden rounded-xl border"
              aria-label={t('archives.projectsTableLabel', 'Archived projects table')}
            >
              <Table className="min-w-[36rem]">
                <TableCaption className="sr-only">
                  {t(
                    'archives.projectsTableCaption',
                    'Archived projects, archive dates, and restore actions',
                  )}
                </TableCaption>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="min-w-72 px-4">
                      {t('common.project', 'Project')}
                    </TableHead>
                    <TableHead className="w-40 px-3">
                      {t('archives.archived', 'Archived')}
                    </TableHead>
                    <TableHead className="w-36 px-3 text-right">
                      <span className="sr-only">{t('common.actions', 'Actions')}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleArchivedProjects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="px-4 py-3">
                        <span className="block max-w-96 truncate font-medium">{project.name}</span>
                        <span className="text-muted-foreground mt-0.5 block font-mono text-xs">
                          {project.identifier ?? project.id.slice(0, 8)}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground px-3 text-sm">
                        {formatArchivedAt(project.archived_at)}
                      </TableCell>
                      <TableCell className="px-3 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-11 sm:h-8"
                          onClick={() => void restoreProject(project)}
                          disabled={restoringProjectId !== null}
                          aria-busy={restoringProjectId === project.id || undefined}
                          aria-label={t('archives.restoreProject', 'Restore {{project}}', {
                            project: project.name,
                          })}
                        >
                          <ArchiveRestore aria-hidden="true" />
                          {restoringProjectId === project.id
                            ? t('archives.restoring', 'Restoring…')
                            : t('common.restore', 'Restore')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          )}
        </div>
      )}

      {hasDiscoveryFilters && (
        <p className="sr-only" aria-live="polite">
          {activeScope === 'work-items'
            ? t('archives.visibleWorkItemCount', '{{count}} archived work items visible', {
                count: visibleIssues.length,
              })
            : t('archives.visibleProjectCount', '{{count}} archived projects visible', {
                count: visibleArchivedProjects.length,
              })}
        </p>
      )}
    </div>
  );
}
