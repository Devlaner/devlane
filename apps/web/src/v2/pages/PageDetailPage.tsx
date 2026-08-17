import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Archive,
  ArchiveRestore,
  Copy,
  ExternalLink,
  History,
  Link2,
  ListTree,
  Lock,
  MoreHorizontal,
  PanelRight,
  PanelRightClose,
  Plus,
  Star,
  Trash2,
  Unlock,
} from 'lucide-react';
import { Badge } from '@/v2/components/ui/badge';
import { Button } from '@/v2/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/v2/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/v2/components/ui/dropdown-menu';
import { Skeleton } from '@/v2/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/v2/components/ui/tabs';
import {
  EmojiLogoPicker,
  PageEditorContent,
  PageEditorToolbar,
  PageOutline,
  usePageEditor,
  type MentionItem,
  type PageLogo,
} from '../../components/page-editor';
import { useSetV2Header } from '../contexts/AppShellHeaderContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatTimeAgo } from '../lib/project';
import { pageService } from '../../services/pageService';
import { workspaceService } from '../../services/workspaceService';
import type { PageApiResponse, PageVersionApiResponse } from '../../api/types';

type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string };

type SidePanel = 'closed' | 'outline' | 'subpages' | 'versions';

/** Matches the shipped page's debounce so autosave timing is identical. */
const AUTOSAVE_DEBOUNCE_MS = 1500;

function pageLogoFrom(page: PageApiResponse | null): PageLogo | undefined {
  const props = page?.logo_props as PageLogo | undefined;
  if (!props || props.in_use !== 'emoji' || !props.emoji?.value) return undefined;
  return props;
}

/**
 * The v2 view of a wiki page, built from shadcn primitives. It renders at the
 * same URL as PageDetailPage; the stored interface preference picks between
 * them.
 *
 * The editor is the shipped one, imported whole: `usePageEditor` carries a
 * large TipTap extension stack (typography, colour, alignment, lists, to-dos,
 * images, tables, @-mentions and slash commands) that a preview has no business
 * re-deriving. The toolbar, content and outline render from the same barrel.
 *
 * Autosave timing is ported exactly — two independent debounced timers, body
 * and title, both cleared on unmount so a navigation cannot land a write after
 * the page is gone. The `editorRef` bridge is kept for the same reason the
 * shipped page has it: `onSaveShortcut` needs the editor that
 * `usePageEditor(opts)` is still constructing.
 *
 * The one structural change: the shipped page's actions are a hand-rolled
 * dropdown with a click-outside listener; here they are a `DropdownMenu`, and
 * they are pushed into the v2 shell header rather than a second header row —
 * via `useSetV2Header`, not the shipped `useSetPageDetailHeader`, whose
 * provider is mounted only in the shipped AppShell.
 */
export function PageDetailPage() {
  const { t } = useTranslation();
  const { workspaceSlug, projectId, pageId } = useParams<{
    workspaceSlug: string;
    projectId: string;
    pageId: string;
  }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [page, setPage] = useState<PageApiResponse | null>(null);
  const [titleInput, setTitleInput] = useState('');
  const [bodyStatus, setBodyStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [titleStatus, setTitleStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [loading, setLoading] = useState(Boolean(workspaceSlug && projectId && pageId));
  const [notFound, setNotFound] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [sidePanel, setSidePanel] = useState<SidePanel>('closed');
  const [versions, setVersions] = useState<PageVersionApiResponse[] | null>(null);
  const [children, setChildren] = useState<PageApiResponse[] | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [mentionMembers, setMentionMembers] = useState<MentionItem[]>([]);

  const titleSaveTimer = useRef<number | null>(null);
  const bodySaveTimer = useRef<number | null>(null);
  const lastSavedHtml = useRef<string>('');

  /* Permissions mirror the service: canEditContent / canEditMeta. */
  const isOwner = Boolean(page && user && page.owned_by_id === user.id);
  const isArchived = Boolean(page?.archived_at);
  const isPrivate = page?.access === 1;
  const isLocked = Boolean(page?.is_locked);
  const canEditContent = Boolean(page) && !isArchived && (isOwner || (!isLocked && !isPrivate));
  const canEditMeta = isOwner;

  const saveBodyNow = useCallback(
    async (html: string) => {
      if (!workspaceSlug || !page) return;
      if (html === lastSavedHtml.current) return;
      setBodyStatus({ kind: 'saving' });
      try {
        const updated = await pageService.updateContent(workspaceSlug, page.id, html);
        lastSavedHtml.current = html;
        setPage(updated);
        setBodyStatus({ kind: 'saved', at: Date.now() });
      } catch (err) {
        setBodyStatus({
          kind: 'error',
          message: err instanceof Error ? err.message : t('page.saveFailed', 'Save failed'),
        });
      }
    },
    [workspaceSlug, page, t],
  );

  const onEditorUpdate = useCallback(
    (html: string) => {
      if (!canEditContent) return;
      if (bodySaveTimer.current) window.clearTimeout(bodySaveTimer.current);
      bodySaveTimer.current = window.setTimeout(() => {
        void saveBodyNow(html);
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [canEditContent, saveBodyNow],
  );

  /* A ref bridge breaks the bootstrap cycle between `usePageEditor(opts)` and
     `opts.onSaveShortcut`, which needs the editor being constructed. */
  const editorRef = useRef<ReturnType<typeof usePageEditor>>(null);
  const onSaveShortcut = useCallback(() => {
    if (bodySaveTimer.current) {
      window.clearTimeout(bodySaveTimer.current);
      bodySaveTimer.current = null;
    }
    const html = editorRef.current?.getHTML();
    if (html !== undefined) void saveBodyNow(html);
  }, [saveBodyNow]);

  const editor = usePageEditor({
    initialHtml: page?.description_html ?? '<p></p>',
    placeholder: t('page.editorPlaceholder', 'Start writing… or press “/” for commands'),
    readOnly: !canEditContent,
    onUpdate: onEditorUpdate,
    onSaveShortcut,
    mentionItems: mentionMembers,
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  /* Members back the @-mention menu. Clearing first avoids briefly offering the
     previous workspace's members while the new list is in flight. */
  useEffect(() => {
    if (!workspaceSlug) return;
    let cancelled = false;
    void (async () => {
      setMentionMembers([]);
      try {
        const members = await workspaceService.listMembers(workspaceSlug);
        if (cancelled) return;
        setMentionMembers(
          members.map((m) => ({
            id: m.member_id,
            label: m.member_display_name || m.member_email || t('common.member', 'Member'),
            avatarUrl: m.member_avatar ?? null,
          })),
        );
      } catch {
        /* An empty menu is better than a failed page. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, t]);

  useEffect(() => {
    if (!workspaceSlug || !projectId || !pageId) return undefined;
    let cancelled = false;
    setLoading(true);
    /* The setState calls sit inside the async chain rather than the effect
       body, which is what keeps react-hooks/set-state-in-effect quiet. */
    void (async () => {
      try {
        const [pg, favIds] = await Promise.all([
          pageService.get(workspaceSlug, pageId),
          pageService.listFavoriteIds(workspaceSlug).catch(() => [] as string[]),
        ]);
        if (cancelled) return;
        setPage(pg);
        setTitleInput(pg.name ?? '');
        lastSavedHtml.current = pg.description_html ?? '<p></p>';
        setIsFavorite(favIds.includes(pg.id));
        setNotFound(false);
      } catch {
        if (!cancelled) {
          setNotFound(true);
          setPage(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, pageId]);

  const saveTitleNow = useCallback(
    async (next: string) => {
      if (!workspaceSlug || !page) return;
      const trimmed = next.trim();
      if (trimmed === page.name) return;
      setTitleStatus({ kind: 'saving' });
      try {
        const updated = await pageService.update(workspaceSlug, page.id, { name: trimmed });
        setPage(updated);
        setTitleStatus({ kind: 'saved', at: Date.now() });
      } catch (err) {
        setTitleStatus({
          kind: 'error',
          message: err instanceof Error ? err.message : t('page.saveFailed', 'Save failed'),
        });
      }
    },
    [workspaceSlug, page, t],
  );

  const onTitleChange = (value: string) => {
    setTitleInput(value);
    if (!canEditMeta) return;
    if (titleSaveTimer.current) window.clearTimeout(titleSaveTimer.current);
    titleSaveTimer.current = window.setTimeout(() => {
      void saveTitleNow(value);
    }, AUTOSAVE_DEBOUNCE_MS);
  };

  const onTitleBlur = () => {
    if (titleSaveTimer.current) {
      window.clearTimeout(titleSaveTimer.current);
      titleSaveTimer.current = null;
    }
    void saveTitleNow(titleInput);
  };

  /* Both timers are cleared on unmount so a pending write can't land after the
     page is gone. */
  useEffect(() => {
    return () => {
      if (bodySaveTimer.current) {
        window.clearTimeout(bodySaveTimer.current);
        bodySaveTimer.current = null;
      }
      if (titleSaveTimer.current) {
        window.clearTimeout(titleSaveTimer.current);
        titleSaveTimer.current = null;
      }
    };
  }, []);

  const loadVersions = useCallback(async () => {
    if (!workspaceSlug || !page) return;
    try {
      setVersions(await pageService.listVersions(workspaceSlug, page.id));
    } catch {
      setVersions([]);
    }
  }, [workspaceSlug, page]);

  const loadChildren = useCallback(async () => {
    if (!workspaceSlug || !page) return;
    try {
      setChildren(await pageService.listChildren(workspaceSlug, page.id));
    } catch {
      setChildren([]);
    }
  }, [workspaceSlug, page]);

  const switchPanel = useCallback(
    (next: SidePanel) => {
      setSidePanel(next);
      if (next === 'versions' && versions === null) void loadVersions();
      if (next === 'subpages' && children === null) void loadChildren();
    },
    [versions, children, loadVersions, loadChildren],
  );

  const onToggleFavorite = useCallback(async () => {
    if (!workspaceSlug || !page) return;
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      if (next) await pageService.favorite(workspaceSlug, page.id);
      else await pageService.unfavorite(workspaceSlug, page.id);
    } catch {
      setIsFavorite(!next);
    }
  }, [workspaceSlug, page, isFavorite]);

  const onToggleLock = useCallback(async () => {
    if (!workspaceSlug || !page) return;
    try {
      if (page.is_locked) await pageService.unlock(workspaceSlug, page.id);
      else await pageService.lock(workspaceSlug, page.id);
      setPage(await pageService.get(workspaceSlug, page.id));
    } catch {
      /* Best-effort; the lock state re-reads on the next load. */
    }
  }, [workspaceSlug, page]);

  const onToggleArchive = useCallback(async () => {
    if (!workspaceSlug || !page) return;
    try {
      if (page.archived_at) await pageService.unarchive(workspaceSlug, page.id);
      else await pageService.archive(workspaceSlug, page.id);
      setPage(await pageService.get(workspaceSlug, page.id));
    } catch {
      /* Best-effort. */
    }
  }, [workspaceSlug, page]);

  const onCopyLink = useCallback(async () => {
    if (!page) return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      /* Clipboard access can be denied; nothing to recover. */
    }
  }, [page]);

  const onDuplicate = useCallback(async () => {
    if (!workspaceSlug || !projectId || !page) return;
    try {
      const duplicate = await pageService.duplicate(workspaceSlug, page.id);
      navigate(`/${workspaceSlug}/projects/${projectId}/pages/${duplicate.id}`);
    } catch {
      /* Best-effort. */
    }
  }, [workspaceSlug, projectId, page, navigate]);

  const onDelete = useCallback(async () => {
    if (!workspaceSlug || !projectId || !page) return;
    try {
      await pageService.delete(workspaceSlug, page.id);
      navigate(`/${workspaceSlug}/projects/${projectId}/pages`);
    } catch {
      setConfirmingDelete(false);
    }
  }, [workspaceSlug, projectId, page, navigate]);

  const onAddSubpage = useCallback(async () => {
    if (!workspaceSlug || !projectId || !page) return;
    try {
      const child = await pageService.create(workspaceSlug, {
        name: t('page.untitledSubpage', 'Untitled sub-page'),
        project_id: projectId,
        parent_id: page.id,
        access: page.access,
      });
      navigate(`/${workspaceSlug}/projects/${projectId}/pages/${child.id}`);
    } catch {
      /* Best-effort. */
    }
  }, [workspaceSlug, projectId, page, navigate, t]);

  const onChangeLogo = useCallback(
    async (next: PageLogo | null | undefined) => {
      if (!workspaceSlug || !page) return;
      try {
        setPage(
          await pageService.update(workspaceSlug, page.id, {
            logo_props: (next ?? {}) as Record<string, unknown>,
          }),
        );
      } catch {
        /* Best-effort. */
      }
    },
    [workspaceSlug, page],
  );

  const parent = useMemo(
    () => ({
      label: t('common.pages', 'Pages'),
      to: `/${workspaceSlug}/projects/${projectId}/pages`,
    }),
    [workspaceSlug, projectId, t],
  );

  const saveLabel = useMemo(() => {
    const status = bodyStatus.kind !== 'idle' ? bodyStatus : titleStatus;
    if (status.kind === 'saving') return t('page.saving', 'Saving…');
    if (status.kind === 'saved') return t('page.saved', 'Saved');
    if (status.kind === 'error') return status.message;
    return null;
  }, [bodyStatus, titleStatus, t]);

  const headerActions = useMemo(() => {
    if (!page) return null;
    return (
      <div className="ml-auto flex items-center gap-1 px-4">
        {saveLabel && (
          <span
            className={
              bodyStatus.kind === 'error' || titleStatus.kind === 'error'
                ? 'text-destructive mr-1 text-xs'
                : 'text-muted-foreground mr-1 text-xs'
            }
          >
            {saveLabel}
          </span>
        )}
        {isArchived && <Badge variant="secondary">{t('page.archived', 'Archived')}</Badge>}
        {canEditMeta && (
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={() => void onToggleLock()}
            title={isLocked ? t('page.unlockPage', 'Unlock page') : t('page.lockPage', 'Lock page')}
            aria-label={
              isLocked ? t('page.unlockPage', 'Unlock page') : t('page.lockPage', 'Lock page')
            }
          >
            {isLocked ? <Unlock /> : <Lock />}
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          onClick={() => void onCopyLink()}
          title={linkCopied ? t('page.copied', 'Copied!') : t('page.copyLink', 'Copy link')}
          aria-label={t('page.copyLink', 'Copy link')}
        >
          <Link2 />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          onClick={() => void onToggleFavorite()}
          title={isFavorite ? t('page.unfavorite', 'Unfavorite') : t('page.favorite', 'Favorite')}
          aria-label={
            isFavorite ? t('page.unfavorite', 'Unfavorite') : t('page.favorite', 'Favorite')
          }
        >
          <Star className={isFavorite ? 'fill-amber-500 text-amber-500' : ''} />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              aria-label={t('common.moreOptions', 'More options')}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => window.open(window.location.href, '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink />
              {t('common.openInNewTab', 'Open in new tab')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void onDuplicate()}>
              <Copy />
              {t('page.makeCopy', 'Make a copy')}
            </DropdownMenuItem>
            {canEditMeta && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void onToggleArchive()}>
                  {isArchived ? <ArchiveRestore /> : <Archive />}
                  {isArchived ? t('common.unarchive', 'Unarchive') : t('common.archive', 'Archive')}
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => setConfirmingDelete(true)}>
                  <Trash2 />
                  {t('common.delete', 'Delete')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }, [
    page,
    saveLabel,
    bodyStatus.kind,
    titleStatus.kind,
    isArchived,
    canEditMeta,
    isLocked,
    isFavorite,
    linkCopied,
    onToggleLock,
    onCopyLink,
    onToggleFavorite,
    onDuplicate,
    onToggleArchive,
    t,
  ]);

  useSetV2Header({
    parent,
    title: page?.name ?? null,
    actions: page ? headerActions : null,
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (notFound || !page) {
    return <p className="text-muted-foreground text-sm">{t('page.notFound', 'Page not found.')}</p>;
  }

  const logo = pageLogoFrom(page);
  const sidebarOpen = sidePanel !== 'closed';
  const panelToggle = (
    <Button
      size="icon"
      variant="ghost"
      className="size-7"
      onClick={() => switchPanel(sidebarOpen ? 'closed' : 'outline')}
      aria-label={
        sidebarOpen
          ? t('page.hideSidePanel', 'Hide side panel')
          : t('page.showSidePanel', 'Show side panel')
      }
    >
      {sidebarOpen ? <PanelRightClose /> : <PanelRight />}
    </Button>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border">
      {editor ? (
        <PageEditorToolbar editor={editor} endSlot={panelToggle} />
      ) : (
        <div className="flex w-full justify-end border-b px-4 py-2">{panelToggle}</div>
      )}

      <div className="flex min-h-0 flex-1">
        <main className="min-h-0 min-w-0 flex-1 overflow-auto">
          <div className="mx-auto max-w-3xl px-6 py-8">
            <div className="mb-3">
              <EmojiLogoPicker
                value={logo}
                disabled={!canEditMeta}
                onChange={(next) => void onChangeLogo(next)}
                size={36}
              />
            </div>
            <textarea
              value={titleInput}
              onChange={(event) => onTitleChange(event.target.value)}
              onBlur={onTitleBlur}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  editor?.commands.focus('end');
                }
              }}
              readOnly={!canEditMeta}
              rows={1}
              placeholder={t('page.untitled', 'Untitled')}
              aria-label={t('page.titleLabel', 'Page title')}
              className="placeholder:text-muted-foreground w-full resize-none border-0 bg-transparent text-3xl font-semibold outline-none"
            />
            <PageEditorContent editor={editor} />
          </div>
        </main>

        {sidebarOpen && (
          <aside className="hidden w-72 shrink-0 flex-col border-l lg:flex">
            <div className="border-b p-2">
              <Tabs value={sidePanel} onValueChange={(value) => switchPanel(value as SidePanel)}>
                <TabsList className="w-full">
                  <TabsTrigger value="outline" title={t('page.outline', 'Outline')}>
                    <ListTree />
                  </TabsTrigger>
                  <TabsTrigger value="subpages" title={t('page.subpages', 'Sub-pages')}>
                    <Plus />
                  </TabsTrigger>
                  <TabsTrigger value="versions" title={t('page.versions', 'Versions')}>
                    <History />
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-2">
              {sidePanel === 'outline' && <PageOutline editor={editor} />}

              {sidePanel === 'subpages' && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mb-2 w-full"
                    disabled={!canEditMeta || isArchived}
                    onClick={() => void onAddSubpage()}
                  >
                    <Plus />
                    {t('page.addSubpage', 'Add sub-page')}
                  </Button>
                  {children === null ? (
                    <Skeleton className="h-20 w-full" />
                  ) : children.length === 0 ? (
                    <p className="text-muted-foreground px-1 py-2 text-xs">
                      {t('page.noSubpages', 'No sub-pages yet.')}
                    </p>
                  ) : (
                    <ul className="space-y-0.5">
                      {children.map((child) => (
                        <li key={child.id}>
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/${workspaceSlug}/projects/${projectId}/pages/${child.id}`)
                            }
                            className="hover:bg-muted w-full truncate rounded-md px-2 py-1.5 text-left text-sm transition-colors"
                          >
                            {child.name || t('page.untitled', 'Untitled')}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              {sidePanel === 'versions' &&
                (versions === null ? (
                  <Skeleton className="h-20 w-full" />
                ) : versions.length === 0 ? (
                  <p className="text-muted-foreground px-1 py-2 text-xs">
                    {t('page.noVersions', 'No saved versions yet.')}
                  </p>
                ) : (
                  <ul className="space-y-0.5">
                    {versions.map((version) => (
                      <li
                        key={version.id}
                        className="text-muted-foreground rounded-md px-2 py-1.5 text-xs"
                      >
                        {formatTimeAgo(version.created_at)}
                      </li>
                    ))}
                  </ul>
                ))}
            </div>
          </aside>
        )}
      </div>

      <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('page.deleteTitle', 'Delete page')}</DialogTitle>
            <DialogDescription>
              {t(
                'page.deleteBody',
                'This permanently removes the page and its versions. This cannot be undone.',
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmingDelete(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button variant="destructive" onClick={() => void onDelete()}>
              {t('common.delete', 'Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
