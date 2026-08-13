import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  Archive,
  ArchiveRestore,
  CircleAlert,
  FileText,
  Lock,
  LockOpen,
  MoreHorizontal,
  RefreshCw,
  SearchX,
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
import { ToggleGroup, ToggleGroupItem } from '@/v2/components/ui/toggle-group';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { pageService } from '../../services/pageService';
import { projectService } from '../../services/projectService';
import { formatDate, matchesQuery } from '../lib/project';
import type { PageApiResponse, ProjectApiResponse } from '../../api/types';

type PagesScope = 'live' | 'archived';

/**
 * The v2 view of a project's pages, built from shadcn primitives. It renders
 * at the same URL as PagesPage; the stored interface preference picks between
 * them.
 *
 * The page chrome — heading, body toolbar, table section, empty and error
 * states — is the one the workspace views page established, so every v2 list
 * reads the same way. Two scopes — live pages and archived ones — replace the
 * shipped page's filter dropdown, because the archived list is a different list
 * rather than a narrowing of the first. Each is fetched separately, since the
 * endpoint takes `archived` as a mode rather than returning both. The scope
 * sits in the toolbar next to search, as it does on the archives page.
 */
export function PagesPage() {
  const { t } = useTranslation();
  const { workspaceSlug, projectId } = useParams<{ workspaceSlug: string; projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  useDocumentTitle(t('common.pages', 'Pages'));

  const [pages, setPages] = useState<PageApiResponse[]>([]);
  const [archived, setArchived] = useState<PageApiResponse[]>([]);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  /* Only failed archive, restore and lock requests land here; a failed load
     takes over the whole page instead. */
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const query = searchParams.get('q') ?? '';
  /* URL-backed like the search, so a shared link lands on the same scope. */
  const scope: PagesScope = searchParams.get('scope') === 'archived' ? 'archived' : 'live';

  const load = useCallback(() => {
    if (!workspaceSlug || !projectId) return () => {};
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    Promise.all([
      pageService.list(workspaceSlug, { projectId, archived: 'inbox' }),
      pageService
        .list(workspaceSlug, { projectId, archived: 'archived' })
        .catch(() => [] as PageApiResponse[]),
      projectService.get(workspaceSlug, projectId).catch(() => null),
    ])
      .then(([live, arch, proj]) => {
        if (cancelled) return;
        setPages(live ?? []);
        setArchived(arch ?? []);
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
  }, [workspaceSlug, projectId]);

  useEffect(() => load(), [load]);

  const visible = useMemo(
    () => pages.filter((page) => matchesQuery(query, page.title ?? page.name)),
    [pages, query],
  );
  const visibleArchived = useMemo(
    () => archived.filter((page) => matchesQuery(query, page.title ?? page.name)),
    [archived, query],
  );

  const setScope = (next: string) => {
    if (next !== 'live' && next !== 'archived') return;
    const params = new URLSearchParams(searchParams);
    if (next === 'archived') params.set('scope', next);
    else params.delete('scope');
    setSearchParams(params, { replace: true });
  };

  const clearSearch = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('q');
    setSearchParams(params, { replace: true });
  };

  /* Archiving moves a row between the two scopes, so both lists are updated in
     place rather than refetched. */
  const archivePage = async (page: PageApiResponse) => {
    if (!workspaceSlug || busyId) return;
    setBusyId(page.id);
    try {
      await pageService.archive(workspaceSlug, page.id);
      setPages((prev) => prev.filter((p) => p.id !== page.id));
      setArchived((prev) => [{ ...page, archived_at: new Date().toISOString() }, ...prev]);
      setActionError(null);
    } catch {
      setActionError(t('pages.archiveError', 'Could not archive that page.'));
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
      setActionError(null);
    } catch {
      setActionError(t('pages.unarchiveError', 'Could not restore that page.'));
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
      setActionError(null);
    } catch {
      setActionError(t('pages.lockError', 'Could not update that page.'));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <ListPageSkeleton label={t('pages.loading', 'Loading pages…')} rows={6} />;
  }

  if (loadError) {
    return (
      <Empty className="min-h-80 rounded-xl border border-dashed" role="alert">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
            <CircleAlert aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t('pages.loadErrorTitle', 'Pages could not be loaded')}</EmptyTitle>
          <EmptyDescription>
            {t(
              'pages.loadErrorDescription',
              'Check your connection and try again. Your pages have not been changed.',
            )}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button type="button" variant="outline" onClick={() => load()}>
            <RefreshCw aria-hidden="true" />
            {t('common.retry', 'Try again')}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const emptyState = (isArchivedScope: boolean) => {
    const total = isArchivedScope ? archived.length : pages.length;
    const filtered = total > 0 && Boolean(query);
    return (
      <Empty className="rounded-xl border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            {filtered ? <SearchX aria-hidden="true" /> : <FileText aria-hidden="true" />}
          </EmptyMedia>
          <EmptyTitle>
            {filtered
              ? t('pages.noMatchesTitle', 'No pages found')
              : isArchivedScope
                ? t('pages.emptyArchivedTitle', 'No archived pages')
                : t('pages.emptyTitle', 'No pages yet')}
          </EmptyTitle>
          <EmptyDescription>
            {filtered
              ? t('pages.noMatches', 'No pages match the current search.')
              : isArchivedScope
                ? t(
                    'pages.emptyArchived',
                    'Archived pages will land here. Archive a page from its detail view to declutter the active list.',
                  )
                : t(
                    'pages.emptyDescription',
                    'Pages hold the writing around the work — specs, notes and decisions that outlive a work item.',
                  )}
          </EmptyDescription>
        </EmptyHeader>
        {filtered && (
          <EmptyContent>
            <Button type="button" variant="outline" onClick={clearSearch}>
              <SearchX aria-hidden="true" />
              {t('common.clearSearch', 'Clear search')}
            </Button>
          </EmptyContent>
        )}
      </Empty>
    );
  };

  const renderTable = (list: PageApiResponse[], isArchivedScope: boolean) => (
    <section
      className="rounded-xl border"
      aria-label={
        isArchivedScope
          ? t('pages.archivedTableLabel', 'Archived pages table')
          : t('pages.tableLabel', 'Pages table')
      }
    >
      <ScrollArea className="w-full">
        <Table className="min-w-[44rem]">
          <TableCaption className="sr-only">
            {t('pages.tableCaption', 'Pages in this project, with access, dates and actions.')}
          </TableCaption>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-72 px-3">{t('common.pages', 'Pages')}</TableHead>
              <TableHead className="w-32 px-3">{t('pages.access', 'Access')}</TableHead>
              <TableHead className="w-36 px-3">
                {isArchivedScope
                  ? t('archives.archived', 'Archived')
                  : t('common.updated', 'Updated')}
              </TableHead>
              <TableHead className="w-16 px-3 text-right">
                <span className="sr-only">{t('common.actions', 'Actions')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((page) => (
              <TableRow key={page.id}>
                <TableCell className="min-w-72 p-0">
                  <Link
                    to={`/${workspaceSlug}/projects/${projectId}/pages/${page.id}`}
                    className="hover:bg-muted/50 focus-visible:ring-ring flex h-12 items-center gap-2 px-3 outline-none transition-colors focus-visible:ring-2"
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
                  {formatDate(isArchivedScope ? page.archived_at : page.updated_at)}
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
                      {isArchivedScope ? (
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
            ))}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </section>
  );

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeading
        title={t('common.pages', 'Pages')}
        description={t(
          'pages.pageDescription',
          'Written knowledge that lives alongside {{project}}.',
          {
            project: project?.name ?? t('common.thisProject', 'this project'),
          },
        )}
        summary={t('pages.summary', '{{live}} live · {{archived}} archived', {
          live: pages.length,
          archived: archived.length,
        })}
      />

      <ProjectListToolbar
        searchPlaceholder={t('pages.searchPlaceholder', 'Search pages')}
        regionLabel={t('pages.toolbar', 'Page controls')}
        scopeControl={
          /* The segmented control the v2 projects and archives lists use for
             their scopes, so every scope switch reads the same. */
          <ToggleGroup
            type="single"
            value={scope}
            onValueChange={setScope}
            variant="default"
            size="sm"
            spacing={1}
            className="bg-muted/60 w-fit max-w-full shrink-0 touch-pan-x overflow-x-auto rounded-lg p-1 sm:p-0.5"
            aria-label={t('pages.scope', 'Page type')}
          >
            <ToggleGroupItem
              value="live"
              className="data-[state=on]:bg-background h-11 min-w-0 gap-1.5 px-3 data-[state=on]:shadow-xs sm:h-8 sm:px-2.5"
            >
              {t('common.pages', 'Pages')}
              <span className="text-muted-foreground min-w-3 text-center text-xs font-normal tabular-nums">
                {pages.length}
              </span>
            </ToggleGroupItem>
            <ToggleGroupItem
              value="archived"
              className="data-[state=on]:bg-background h-11 min-w-0 gap-1.5 px-3 data-[state=on]:shadow-xs sm:h-8 sm:px-2.5"
            >
              {t('archives.documentTitle', 'Archives')}
              <span className="text-muted-foreground min-w-3 text-center text-xs font-normal tabular-nums">
                {archived.length}
              </span>
            </ToggleGroupItem>
          </ToggleGroup>
        }
      />

      {actionError && (
        <p className="text-destructive text-sm" role="alert">
          {actionError}
        </p>
      )}

      {scope === 'live' && (
        <div>{visible.length === 0 ? emptyState(false) : renderTable(visible, false)}</div>
      )}

      {scope === 'archived' && (
        <div>
          {visibleArchived.length === 0 ? emptyState(true) : renderTable(visibleArchived, true)}
        </div>
      )}

      {query && (
        <p className="sr-only" aria-live="polite">
          {t('pages.visibleCount', '{{count}} pages visible', {
            count: scope === 'archived' ? visibleArchived.length : visible.length,
          })}
        </p>
      )}
    </div>
  );
}
