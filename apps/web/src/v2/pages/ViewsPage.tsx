import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  CircleAlert,
  LayoutList,
  MoreHorizontal,
  RefreshCw,
  SearchX,
  Star,
  Trash2,
} from 'lucide-react';
import { ListPageSkeleton } from '@/v2/components/list-page-skeleton';
import { PageHeading } from '@/v2/components/page-heading';
import { ProjectListToolbar } from '@/v2/components/project-list-toolbar';
import { Badge } from '@/v2/components/ui/badge';
import { Button } from '@/v2/components/ui/button';
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
import { projectService } from '../../services/projectService';
import { viewService } from '../../services/viewService';
import { getViewAccessMeta } from '../../lib/viewAccess';
import { formatDate, matchesQuery } from '../lib/project';
import { cn } from '../../lib/utils';
import type { IssueViewApiResponse, ProjectApiResponse } from '../../api/types';

/**
 * The v2 view of a project's saved views, built from shadcn primitives. It
 * renders at the same URL as ViewsPage; the stored interface preference picks
 * between them.
 *
 * The page chrome — heading, body toolbar, table section, empty and error
 * states — is the one the workspace views page established, so every v2 list
 * reads the same way. Favouriting and deleting mirror the shipped page: both
 * update the row optimistically and roll back on failure, because either
 * request is fast enough that a spinner reads as a stutter.
 */
export function ViewsPage() {
  const { t } = useTranslation();
  const { workspaceSlug, projectId } = useParams<{ workspaceSlug: string; projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  useDocumentTitle(t('common.views', 'Views'));

  const [views, setViews] = useState<IssueViewApiResponse[]>([]);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  /* Only failed favourite and delete requests land here; a failed load takes
     over the whole page instead. */
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const query = searchParams.get('q') ?? '';

  useEffect(() => {
    if (!workspaceSlug || !projectId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    Promise.all([
      viewService.list(workspaceSlug, projectId),
      projectService.get(workspaceSlug, projectId).catch(() => null),
    ])
      .then(([list, proj]) => {
        if (cancelled) return;
        setViews(list ?? []);
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
    () => views.filter((view) => matchesQuery(query, view.name, view.description)),
    [views, query],
  );

  const clearSearch = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('q');
    setSearchParams(next, { replace: true });
  };

  const toggleFavorite = async (view: IssueViewApiResponse) => {
    if (!workspaceSlug) return;
    const next = !view.is_favorite;
    setViews((prev) => prev.map((v) => (v.id === view.id ? { ...v, is_favorite: next } : v)));
    try {
      if (next) await viewService.addFavorite(workspaceSlug, view.id);
      else await viewService.removeFavorite(workspaceSlug, view.id);
    } catch {
      /* Rolled back so the star never claims a state the server rejected. */
      setViews((prev) => prev.map((v) => (v.id === view.id ? { ...v, is_favorite: !next } : v)));
      setActionError(t('views.favoriteError', 'Could not update that view.'));
    }
  };

  const remove = async (view: IssueViewApiResponse) => {
    if (!workspaceSlug || deletingId) return;
    setDeletingId(view.id);
    const previous = views;
    setViews((prev) => prev.filter((v) => v.id !== view.id));
    try {
      await viewService.remove(workspaceSlug, view.id);
    } catch {
      setViews(previous);
      setActionError(t('views.deleteError', 'Could not delete that view.'));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return <ListPageSkeleton label={t('views.loadingView', 'Loading views…')} rows={6} />;
  }

  if (loadError) {
    return (
      <Empty className="min-h-80 rounded-xl border border-dashed" role="alert">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
            <CircleAlert aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t('views.projectLoadErrorTitle', 'Views could not be loaded')}</EmptyTitle>
          <EmptyDescription>
            {t(
              'views.projectLoadErrorDescription',
              'Check your connection and try again. Your views have not been changed.',
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
          {views.length === 0 ? <LayoutList aria-hidden="true" /> : <SearchX aria-hidden="true" />}
        </EmptyMedia>
        <EmptyTitle>
          {views.length === 0
            ? t('views.noProjectViews', 'No project views yet')
            : t('views.noMatchTitle', 'No views match your filters')}
        </EmptyTitle>
        <EmptyDescription>
          {views.length === 0
            ? t(
                'views.projectEmptyDescription',
                'A view saves a set of filters so the work you look at every day is one click away.',
              )
            : t('views.projectNoMatches', 'No views match the current search.')}
        </EmptyDescription>
      </EmptyHeader>
      {views.length > 0 && query && (
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
        title={t('common.views', 'Views')}
        description={t(
          'views.projectPageDescription',
          'Saved filters over the work in {{project}}.',
          {
            project: project?.name ?? t('common.thisProject', 'this project'),
          },
        )}
        summary={t('views.projectSummary', '{{visible}} of {{total}} views', {
          visible: visible.length,
          total: views.length,
        })}
      />

      <ProjectListToolbar
        searchPlaceholder={t('views.searchProjectViews', 'Search views')}
        regionLabel={t('views.toolbar', 'View controls')}
      />

      {actionError && (
        <p className="text-destructive text-sm" role="alert">
          {actionError}
        </p>
      )}

      {visible.length === 0 ? (
        emptyState
      ) : (
        <section
          className="rounded-xl border"
          aria-label={t('views.projectTableLabel', 'Views table')}
        >
          <ScrollArea className="w-full">
            <Table className="min-w-[44rem]">
              <TableCaption className="sr-only">
                {t(
                  'views.projectTableCaption',
                  'Saved views in this project, with access, last update and per-view actions.',
                )}
              </TableCaption>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="min-w-72 px-3">{t('common.views', 'Views')}</TableHead>
                  <TableHead className="w-32 px-3">{t('views.access', 'Access')}</TableHead>
                  <TableHead className="w-36 px-3">{t('common.updated', 'Updated')}</TableHead>
                  <TableHead className="w-24 px-3 text-right">
                    <span className="sr-only">{t('common.actions', 'Actions')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((view) => {
                  const access = getViewAccessMeta(view);
                  return (
                    <TableRow key={view.id}>
                      <TableCell className="min-w-72 p-0">
                        <Link
                          to={`/${workspaceSlug}/projects/${projectId}/views/${view.id}`}
                          className="hover:bg-muted/50 focus-visible:ring-ring flex h-12 flex-col justify-center gap-0.5 px-3 outline-none transition-colors focus-visible:ring-2"
                        >
                          <span className="truncate font-medium">{view.name}</span>
                          {view.description && (
                            <span className="text-muted-foreground truncate text-xs">
                              {view.description}
                            </span>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell className="px-3">
                        {access ? (
                          <Badge variant="secondary">{access.label}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground px-3 text-sm">
                        {formatDate(view.updated_at)}
                      </TableCell>
                      <TableCell className="px-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => void toggleFavorite(view)}
                            aria-pressed={Boolean(view.is_favorite)}
                            aria-label={t('common.favorite', 'Favorite')}
                          >
                            <Star
                              className={cn(view.is_favorite && 'fill-current text-amber-500')}
                            />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={t('common.more', 'More')}
                              >
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem asChild>
                                <Link
                                  to={`/${workspaceSlug}/projects/${projectId}/views/${view.id}`}
                                >
                                  {t('common.open', 'Open')}
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                disabled={deletingId === view.id}
                                onSelect={() => void remove(view)}
                              >
                                <Trash2 />
                                {t('common.delete', 'Delete')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
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
          {t('views.projectVisibleCount', '{{count}} views visible', { count: visible.length })}
        </p>
      )}
    </div>
  );
}
