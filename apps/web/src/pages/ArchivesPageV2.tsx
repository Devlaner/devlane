import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArchiveRestore } from 'lucide-react';
import { Badge } from '@/components/shadcn/ui/badge';
import { Button } from '@/components/shadcn/ui/button';
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
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { issueService } from '../services/issueService';
import { projectService } from '../services/projectService';
import type { IssueApiResponse, ProjectApiResponse } from '../api/types';

const ARCHIVES_PAGE_SIZE = 50;

function formatArchivedAt(iso: string | null | undefined): string {
  if (!iso) return '—';
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return '—';
  return new Date(parsed).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

/**
 * Design preview of the archives page, built from shadcn primitives. It stands
 * alongside ArchivesPage rather than replacing it, so the two can be compared
 * side by side.
 *
 * Loading, paging and restore mirror the shipped page — only the chrome
 * differs: archived work items and archived projects, which the shipped page
 * stacks as two lists, become two tabs of one table, and search and the project
 * filter move into the shell's header (ArchivesToolbar).
 */
export function ArchivesPageV2() {
  const { t } = useTranslation();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const [searchParams] = useSearchParams();
  useDocumentTitle(t('archives.documentTitle', 'Archives'));

  const [issues, setIssues] = useState<IssueApiResponse[]>([]);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<ProjectApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
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
  const projectFilter = useMemo(
    () => (searchParams.get('project') ?? '').split(',').filter(Boolean),
    [searchParams],
  );

  useEffect(() => {
    if (!workspaceSlug) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      /* One extra row tells us whether another page exists. */
      issueService.listWorkspaceArchived(workspaceSlug, { limit: ARCHIVES_PAGE_SIZE + 1 }),
      projectService.list(workspaceSlug).catch(() => [] as ProjectApiResponse[]),
      projectService.listArchived(workspaceSlug).catch(() => [] as ProjectApiResponse[]),
    ])
      .then(([archived, projs, archProjs]) => {
        if (cancelled) return;
        const page = archived.slice(0, ARCHIVES_PAGE_SIZE);
        setHasMore(archived.length > ARCHIVES_PAGE_SIZE);
        setIssues(page);
        setFetchedCount(page.length);
        setProjects(projs ?? []);
        setArchivedProjects(archProjs ?? []);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError(t('archives.loadError', 'Could not load archived work items.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, t]);

  const loadMore = async () => {
    if (!workspaceSlug || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await issueService.listWorkspaceArchived(workspaceSlug, {
        limit: ARCHIVES_PAGE_SIZE + 1,
        offset: fetchedCount,
      });
      const page = next.slice(0, ARCHIVES_PAGE_SIZE);
      setHasMore(next.length > ARCHIVES_PAGE_SIZE);
      setFetchedCount((c) => c + page.length);
      /* De-duplicated by id in case a restore shifted the server-side window. */
      setIssues((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...page.filter((i) => !seen.has(i.id))];
      });
    } catch {
      setError(t('archives.loadMoreError', 'Could not load more archived work items.'));
    } finally {
      setLoadingMore(false);
    }
  };

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const restore = async (issue: IssueApiResponse) => {
    if (!workspaceSlug || restoringId) return;
    setRestoringId(issue.id);
    try {
      await issueService.restore(workspaceSlug, issue.project_id, issue.id);
      setIssues((prev) => prev.filter((i) => i.id !== issue.id));
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
      setArchivedProjects((prev) => prev.filter((p) => p.id !== project.id));
    } catch {
      setError(t('archives.restoreProjectError', 'Could not restore that project.'));
    } finally {
      setRestoringProjectId(null);
    }
  };

  const displayId = (issue: IssueApiResponse) => {
    const p = projectById.get(issue.project_id);
    const prefix = p?.identifier ?? p?.id.slice(0, 8) ?? issue.project_id.slice(0, 8);
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

  /* The project filter names projects; on the projects tab it selects rows
     directly rather than filtering by a foreign key. */
  const visibleArchivedProjects = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return archivedProjects.filter((project) => {
      if (projectFilter.length && !projectFilter.includes(project.id)) return false;
      if (!needle) return true;
      return project.name?.toLowerCase().includes(needle);
    });
  }, [archivedProjects, query, projectFilter]);

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-64" />
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-11 w-full" />
        ))}
      </div>
    );
  }

  const emptyRow = (colSpan: number, message: string) => (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="text-muted-foreground h-32 text-center">
        {message}
      </TableCell>
    </TableRow>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      {/* Two tabs rather than the shipped page's stacked lists: work items and
          projects are restored the same way but are otherwise unrelated, and
          an archive is browsed one kind at a time. */}
      <Tabs defaultValue="work-items" className="flex min-h-0 flex-1 flex-col gap-3">
        <TabsList>
          <TabsTrigger value="work-items">
            {t('views.workItems', 'Work items')}
            <Badge variant="secondary">{visibleIssues.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="projects">
            {t('common.projects', 'Projects')}
            <Badge variant="secondary">{visibleArchivedProjects.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="work-items"
          className="min-h-0 flex-1 flex-col gap-3 data-[state=active]:flex"
        >
          <div className="min-h-0 flex-1 overflow-auto rounded-xl border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-3">{t('views.workItems', 'Work items')}</TableHead>
                  <TableHead className="px-3">{t('common.project', 'Project')}</TableHead>
                  <TableHead className="px-3">{t('archives.archived', 'Archived')}</TableHead>
                  <TableHead className="w-28 px-3 text-right">
                    <span className="sr-only">{t('common.actions', 'Actions')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleIssues.length === 0
                  ? emptyRow(
                      4,
                      issues.length === 0
                        ? t('archives.empty', 'No archived work items')
                        : t(
                            'archives.noMatches',
                            'No archives match the current search or filters.',
                          ),
                    )
                  : visibleIssues.map((issue) => (
                      <TableRow key={issue.id}>
                        <TableCell className="p-0">
                          <Link
                            to={`/${workspaceSlug}/app-v2/projects/${issue.project_id}/work-items/${issue.id}`}
                            className="hover:bg-muted/50 flex h-11 items-center gap-2 px-3 transition-colors"
                          >
                            <span className="text-muted-foreground shrink-0 font-mono text-xs">
                              {displayId(issue)}
                            </span>
                            <span className="truncate font-medium">{issue.name}</span>
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground px-3 text-sm">
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
                            onClick={() => void restore(issue)}
                            disabled={restoringId === issue.id}
                          >
                            <ArchiveRestore />
                            {restoringId === issue.id
                              ? t('archives.restoring', 'Restoring…')
                              : t('common.restore', 'Restore')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>

          {hasMore && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadMore()}
                disabled={loadingMore}
              >
                {loadingMore ? t('common.loading', 'Loading…') : t('common.loadMore', 'Load more')}
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="projects" className="min-h-0 flex-1">
          <div className="min-h-0 flex-1 overflow-auto rounded-xl border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-3">{t('common.project', 'Project')}</TableHead>
                  <TableHead className="px-3">{t('archives.archived', 'Archived')}</TableHead>
                  <TableHead className="w-28 px-3 text-right">
                    <span className="sr-only">{t('common.actions', 'Actions')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleArchivedProjects.length === 0
                  ? emptyRow(
                      3,
                      archivedProjects.length === 0
                        ? t('archives.noArchivedProjects', 'No archived projects')
                        : t(
                            'archives.noMatches',
                            'No archives match the current search or filters.',
                          ),
                    )
                  : visibleArchivedProjects.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell className="px-3 font-medium">{project.name}</TableCell>
                        <TableCell className="text-muted-foreground px-3 text-sm">
                          {formatArchivedAt(project.archived_at)}
                        </TableCell>
                        <TableCell className="px-3 text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void restoreProject(project)}
                            disabled={restoringProjectId === project.id}
                          >
                            <ArchiveRestore />
                            {restoringProjectId === project.id
                              ? t('archives.restoring', 'Restoring…')
                              : t('common.restore', 'Restore')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
