import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { MoreHorizontal, Star, Trash2 } from 'lucide-react';
import { Badge } from '@/components/shadcn/ui/badge';
import { Button } from '@/components/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/shadcn/ui/dropdown-menu';
import { Skeleton } from '@/components/shadcn/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/ui/table';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { viewService } from '../services/viewService';
import { getViewAccessMeta } from '../lib/viewAccess';
import { formatDate, matchesQuery } from '../lib/projectV2';
import { cn } from '../lib/utils';
import type { IssueViewApiResponse } from '../api/types';

/**
 * Design preview of a project's saved views, built from shadcn primitives. It
 * stands alongside ViewsPage rather than replacing it, so the two can be
 * compared side by side.
 *
 * Favouriting and deleting mirror the shipped page. Both update the row
 * optimistically and roll back on failure, because either request is fast
 * enough that a spinner reads as a stutter.
 */
export function ProjectViewsPageV2() {
  const { t } = useTranslation();
  const { workspaceSlug, projectId } = useParams<{ workspaceSlug: string; projectId: string }>();
  const [searchParams] = useSearchParams();
  useDocumentTitle(t('common.views', 'Views'));

  const [views, setViews] = useState<IssueViewApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const query = searchParams.get('q') ?? '';

  useEffect(() => {
    if (!workspaceSlug || !projectId) return;
    let cancelled = false;
    setLoading(true);
    viewService
      .list(workspaceSlug, projectId)
      .then((list) => {
        if (cancelled) return;
        setViews(list ?? []);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError(t('views.loadError', 'Could not load views.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, t]);

  const visible = useMemo(
    () => views.filter((view) => matchesQuery(query, view.name, view.description)),
    [views, query],
  );

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
      setError(t('views.favoriteError', 'Could not update that view.'));
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
      setError(t('views.deleteError', 'Could not delete that view.'));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-3">{t('common.views', 'Views')}</TableHead>
              <TableHead className="w-32 px-3">{t('views.access', 'Access')}</TableHead>
              <TableHead className="w-36 px-3">{t('common.updated', 'Updated')}</TableHead>
              <TableHead className="w-24 px-3 text-right">
                <span className="sr-only">{t('common.actions', 'Actions')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="text-muted-foreground h-32 text-center">
                  {views.length === 0
                    ? t('views.empty', 'No views yet')
                    : t('views.noMatches', 'No views match the current search.')}
                </TableCell>
              </TableRow>
            ) : (
              visible.map((view) => {
                const access = getViewAccessMeta(view);
                return (
                  <TableRow key={view.id}>
                    <TableCell className="p-0">
                      <Link
                        to={`/${workspaceSlug}/app-v2/projects/${projectId}/views/${view.id}`}
                        className="hover:bg-muted/50 flex h-12 flex-col justify-center gap-0.5 px-3 transition-colors"
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
                          <Star className={cn(view.is_favorite && 'fill-current text-amber-500')} />
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
                                to={`/${workspaceSlug}/app-v2/projects/${projectId}/views/${view.id}`}
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
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
