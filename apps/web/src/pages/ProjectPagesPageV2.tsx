import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Archive, ArchiveRestore, Lock, LockOpen, MoreHorizontal } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/shadcn/ui/tabs';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { pageService } from '../services/pageService';
import { formatDate, matchesQuery } from '../lib/projectV2';
import type { PageApiResponse } from '../api/types';

/**
 * Design preview of a project's pages, built from shadcn primitives. It stands
 * alongside PagesPage rather than replacing it, so the two can be compared side
 * by side.
 *
 * Two tabs — live pages and archived ones — replace the shipped page's filter
 * dropdown, because the archived list is a different list rather than a
 * narrowing of the first. Each is fetched separately, since the endpoint takes
 * `archived` as a mode rather than returning both.
 */
export function ProjectPagesPageV2() {
  const { t } = useTranslation();
  const { workspaceSlug, projectId } = useParams<{ workspaceSlug: string; projectId: string }>();
  const [searchParams] = useSearchParams();
  useDocumentTitle(t('common.pages', 'Pages'));

  const [pages, setPages] = useState<PageApiResponse[]>([]);
  const [archived, setArchived] = useState<PageApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const query = searchParams.get('q') ?? '';

  const load = useCallback(() => {
    if (!workspaceSlug || !projectId) return () => {};
    let cancelled = false;
    setLoading(true);
    Promise.all([
      pageService.list(workspaceSlug, { projectId, archived: 'inbox' }),
      pageService
        .list(workspaceSlug, { projectId, archived: 'archived' })
        .catch(() => [] as PageApiResponse[]),
    ])
      .then(([live, arch]) => {
        if (cancelled) return;
        setPages(live ?? []);
        setArchived(arch ?? []);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError(t('pages.loadError', 'Could not load pages.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, t]);

  useEffect(() => load(), [load]);

  const visible = useMemo(
    () => pages.filter((page) => matchesQuery(query, page.title ?? page.name)),
    [pages, query],
  );
  const visibleArchived = useMemo(
    () => archived.filter((page) => matchesQuery(query, page.title ?? page.name)),
    [archived, query],
  );

  /* Archiving moves a row between the two tabs, so both lists are updated in
     place rather than refetched. */
  const archivePage = async (page: PageApiResponse) => {
    if (!workspaceSlug || busyId) return;
    setBusyId(page.id);
    try {
      await pageService.archive(workspaceSlug, page.id);
      setPages((prev) => prev.filter((p) => p.id !== page.id));
      setArchived((prev) => [{ ...page, archived_at: new Date().toISOString() }, ...prev]);
    } catch {
      setError(t('pages.archiveError', 'Could not archive that page.'));
    } finally {
      setBusyId(null);
    }
  };

  const unarchivePage = async (page: PageApiResponse) => {
    if (!workspaceSlug || busyId) return;
    setBusyId(page.id);
    try {
      await pageService.unarchive(workspaceSlug, page.id);
      setArchived((prev) => prev.filter((p) => p.id !== page.id));
      setPages((prev) => [{ ...page, archived_at: null }, ...prev]);
    } catch {
      setError(t('pages.unarchiveError', 'Could not restore that page.'));
    } finally {
      setBusyId(null);
    }
  };

  const toggleLock = async (page: PageApiResponse) => {
    if (!workspaceSlug || busyId) return;
    setBusyId(page.id);
    const next = !page.is_locked;
    try {
      if (next) await pageService.lock(workspaceSlug, page.id);
      else await pageService.unlock(workspaceSlug, page.id);
      setPages((prev) => prev.map((p) => (p.id === page.id ? { ...p, is_locked: next } : p)));
    } catch {
      setError(t('pages.lockError', 'Could not update that page.'));
    } finally {
      setBusyId(null);
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

  const renderTable = (list: PageApiResponse[], isArchivedTab: boolean) => (
    <div className="min-h-0 flex-1 overflow-auto rounded-xl border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent">
            <TableHead className="px-3">{t('common.pages', 'Pages')}</TableHead>
            <TableHead className="w-32 px-3">{t('pages.access', 'Access')}</TableHead>
            <TableHead className="w-36 px-3">
              {isArchivedTab ? t('archives.archived', 'Archived') : t('common.updated', 'Updated')}
            </TableHead>
            <TableHead className="w-16 px-3 text-right">
              <span className="sr-only">{t('common.actions', 'Actions')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={4} className="text-muted-foreground h-32 text-center">
                {t('pages.empty', 'No pages yet')}
              </TableCell>
            </TableRow>
          ) : (
            list.map((page) => (
              <TableRow key={page.id}>
                <TableCell className="p-0">
                  <Link
                    to={`/${workspaceSlug}/app-v2/projects/${projectId}/pages/${page.id}`}
                    className="hover:bg-muted/50 flex h-12 items-center gap-2 px-3 transition-colors"
                  >
                    <span className="truncate font-medium">
                      {page.title || page.name || t('pages.untitled', 'Untitled')}
                    </span>
                    {page.is_locked && (
                      <Lock
                        className="text-muted-foreground size-3.5 shrink-0"
                        aria-label={t('pages.locked', 'Locked')}
                      />
                    )}
                  </Link>
                </TableCell>
                <TableCell className="px-3">
                  <Badge variant="secondary">
                    {page.access === 1
                      ? t('pages.private', 'Private')
                      : t('pages.public', 'Public')}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground px-3 text-sm">
                  {formatDate(isArchivedTab ? page.archived_at : page.updated_at)}
                </TableCell>
                <TableCell className="px-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={busyId === page.id}
                        aria-label={t('common.more', 'More')}
                      >
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      {isArchivedTab ? (
                        <DropdownMenuItem onSelect={() => void unarchivePage(page)}>
                          <ArchiveRestore />
                          {t('common.restore', 'Restore')}
                        </DropdownMenuItem>
                      ) : (
                        <>
                          <DropdownMenuItem onSelect={() => void toggleLock(page)}>
                            {page.is_locked ? <LockOpen /> : <Lock />}
                            {page.is_locked ? t('pages.unlock', 'Unlock') : t('pages.lock', 'Lock')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => void archivePage(page)}>
                            <Archive />
                            {t('common.archive', 'Archive')}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      <Tabs defaultValue="live" className="flex min-h-0 flex-1 flex-col gap-3">
        <TabsList>
          <TabsTrigger value="live">
            {t('common.pages', 'Pages')}
            <Badge variant="secondary">{visible.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="archived">
            {t('archives.documentTitle', 'Archives')}
            <Badge variant="secondary">{visibleArchived.length}</Badge>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="live" className="min-h-0 flex-1 flex-col data-[state=active]:flex">
          {renderTable(visible, false)}
        </TabsContent>
        <TabsContent value="archived" className="min-h-0 flex-1 flex-col data-[state=active]:flex">
          {renderTable(visibleArchived, true)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
