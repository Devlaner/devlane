import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Archive,
  ArchiveRestore,
  Copy,
  ExternalLink,
  FileText,
  FolderInput,
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
import { Button, Modal, Tooltip } from '../components/ui';
import {
  EmojiLogoPicker,
  PageEditorContent,
  PageEditorToolbar,
  PageOutline,
  usePageEditor,
  type PageLogo,
  type MentionItem,
} from '../components/page-editor';
import { useAuth } from '../contexts/AuthContext';
import { useSetPageDetailHeader } from '../contexts/PageDetailHeaderContext';
import { workspaceService } from '../services/workspaceService';
import { projectService } from '../services/projectService';
import { pageService } from '../services/pageService';
import { cn } from '../lib/utils';
import { sanitizeHtml } from '../lib/sanitize';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import type {
  PageApiResponse,
  PageVersionApiResponse,
  ProjectApiResponse,
  WorkspaceApiResponse,
} from '../api/types';

type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string };

const AUTOSAVE_DEBOUNCE_MS = 1500;

function formatRelative(at: number, t: TFunction): string {
  const diff = Math.max(0, Date.now() - at);
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return t('page.relativeJustNow', 'just now');
  if (sec < 60) return t('page.relativeSecondsAgo', '{{count}}s ago', { count: sec });
  const min = Math.floor(sec / 60);
  if (min < 60) return t('page.relativeMinutesAgo', '{{count}}m ago', { count: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t('page.relativeHoursAgo', '{{count}}h ago', { count: hr });
  const day = Math.floor(hr / 24);
  return t('page.relativeDaysAgo', '{{count}}d ago', { count: day });
}

function pageLogoFrom(page: PageApiResponse | null): PageLogo | undefined {
  const props = page?.logo_props as PageLogo | undefined;
  if (!props || props.in_use !== 'emoji' || !props.emoji?.value) return undefined;
  return props;
}

type SidePanel = 'closed' | 'outline' | 'subpages' | 'versions';

export function PageDetailPage() {
  const { workspaceSlug, projectId, pageId } = useParams<{
    workspaceSlug: string;
    projectId: string;
    pageId: string;
  }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();

  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [page, setPage] = useState<PageApiResponse | null>(null);
  // Latest page, readable from async callbacks without re-deriving their
  // identity — lets an in-flight save detect that the route changed and avoid
  // writing the previous page's content onto the newly-opened one.
  const pageRef = useRef<PageApiResponse | null>(page);
  pageRef.current = page;
  // Seed HTML for the editor. Updated only on genuine document swaps (load,
  // route change, version restore) — never from an autosave round-trip — so the
  // editor is never reseeded (and the caret never jumps) while the user types.
  const [seedHtml, setSeedHtml] = useState('<p></p>');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useDocumentTitle(loading ? t('page.title', 'Page') : (page?.name ?? t('page.title', 'Page')));

  const [titleInput, setTitleInput] = useState('');
  const [titleStatus, setTitleStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [bodyStatus, setBodyStatus] = useState<SaveStatus>({ kind: 'idle' });

  const [isFavorite, setIsFavorite] = useState(false);
  // Closed by default — the panel toggle reveals sub-pages / history on demand.
  const [sidePanel, setSidePanel] = useState<SidePanel>('closed');
  const [versions, setVersions] = useState<PageVersionApiResponse[] | null>(null);
  const [previewVersion, setPreviewVersion] = useState<PageVersionApiResponse | null>(null);
  const [children, setChildren] = useState<PageApiResponse[] | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveProjects, setMoveProjects] = useState<ProjectApiResponse[]>([]);
  const [moveLoading, setMoveLoading] = useState(false);
  const [moveSubmitting, setMoveSubmitting] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [mentionMembers, setMentionMembers] = useState<MentionItem[]>([]);

  const titleSaveTimer = useRef<number | null>(null);
  const bodySaveTimer = useRef<number | null>(null);
  const lastSavedHtml = useRef<string>('');
  const optionsRef = useRef<HTMLDivElement>(null);

  // ----- Permissions (mirror service: canEditContent / canEditMeta) -------
  const isOwner = !!page && !!user && page.owned_by_id === user.id;
  const isArchived = !!page?.archived_at;
  const isPrivate = page?.access === 1;
  const isLocked = !!page?.is_locked;
  const canEditContent = !!page && !isArchived && (isOwner || (!isLocked && !isPrivate));
  const canEditMeta = isOwner;
  const editorReadOnly = !canEditContent;

  // ----- Body autosave -----------------------------------------------------
  const saveBodyNow = useCallback(
    async (html: string) => {
      if (!workspaceSlug || !page) return;
      if (html === lastSavedHtml.current) return;
      const savingPageId = page.id;
      setBodyStatus({ kind: 'saving' });
      try {
        const updated = await pageService.updateContent(workspaceSlug, page.id, html);
        // The route may have changed while the request was in flight; the save
        // still persisted, but don't touch the current page's state.
        if (pageRef.current?.id !== savingPageId) return;
        lastSavedHtml.current = html;
        setPage(updated);
        setBodyStatus({ kind: 'saved', at: Date.now() });
      } catch (err) {
        if (pageRef.current?.id !== savingPageId) return;
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

  // The editor instance is needed by `onSaveShortcut` so we can flush the
  // current HTML on Cmd/Ctrl+S. We stash a ref bridge to break the
  // bootstrap cycle between `usePageEditor(opts)` and `opts.onSaveShortcut`.
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
    initialHtml: seedHtml,
    placeholder: t('page.editorPlaceholder', 'Start writing… or press “/” for commands'),
    readOnly: editorReadOnly,
    onUpdate: onEditorUpdate,
    onSaveShortcut,
    mentionItems: mentionMembers,
  });
  // Mirror the latest editor instance into the ref so non-render code (key
  // handlers, save flushes) can reach it without re-deriving callback identity.
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Load workspace members for the @-mention menu. Clearing first avoids briefly
  // offering the previous workspace's members while the new list is in flight.
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
        /* leave the menu empty on failure */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, t]);

  // ----- Initial load ------------------------------------------------------
  useEffect(() => {
    // No route params? React Router shouldn't allow this for the
    // /:workspaceSlug/projects/:projectId/pages/:pageId path, but bail safely.
    if (!workspaceSlug || !projectId || !pageId) return undefined;
    let cancelled = false;
    // Reset stale state when navigating between pages so the new page gets a
    // visible loading state instead of flashing the previous page's content.
    setLoading(true);
    // setState calls live inside the async chain (not the effect body) so the
    // react-hooks/set-state-in-effect rule stays happy.
    void (async () => {
      try {
        const [w, p, pg, favIds] = await Promise.all([
          workspaceService.getBySlug(workspaceSlug),
          projectService.get(workspaceSlug, projectId),
          pageService.get(workspaceSlug, pageId),
          pageService.listFavoriteIds(workspaceSlug).catch(() => [] as string[]),
        ]);
        if (cancelled) return;
        setWorkspace(w ?? null);
        setProject(p ?? null);
        setPage(pg);
        setTitleInput(pg.name ?? '');
        setSeedHtml(pg.description_html ?? '<p></p>');
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

  // ----- Title autosave ----------------------------------------------------
  const saveTitleNow = useCallback(
    async (next: string) => {
      if (!workspaceSlug || !page) return;
      const trimmed = next.trim();
      if (trimmed === page.name) return;
      const savingPageId = page.id;
      setTitleStatus({ kind: 'saving' });
      try {
        const updated = await pageService.update(workspaceSlug, page.id, { name: trimmed });
        if (pageRef.current?.id !== savingPageId) return;
        setPage(updated);
        setTitleStatus({ kind: 'saved', at: Date.now() });
      } catch (err) {
        if (pageRef.current?.id !== savingPageId) return;
        setTitleStatus({
          kind: 'error',
          message: err instanceof Error ? err.message : t('page.saveFailed', 'Save failed'),
        });
      }
    },
    [workspaceSlug, page, t],
  );

  const onTitleChange = (v: string) => {
    setTitleInput(v);
    if (!canEditMeta) return;
    if (titleSaveTimer.current) window.clearTimeout(titleSaveTimer.current);
    titleSaveTimer.current = window.setTimeout(() => {
      void saveTitleNow(v);
    }, AUTOSAVE_DEBOUNCE_MS);
  };

  const onTitleBlur = () => {
    if (titleSaveTimer.current) {
      window.clearTimeout(titleSaveTimer.current);
      titleSaveTimer.current = null;
    }
    void saveTitleNow(titleInput);
  };

  const onTitleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      editor?.commands.focus('end');
    }
  };

  // Refs to the latest save handlers + title, so the flush effect below can run
  // them without taking them as deps (which would re-fire it on every autosave).
  const saveBodyNowRef = useRef(saveBodyNow);
  saveBodyNowRef.current = saveBodyNow;
  const saveTitleNowRef = useRef(saveTitleNow);
  saveTitleNowRef.current = saveTitleNow;
  const titleInputRef = useRef(titleInput);
  titleInputRef.current = titleInput;

  // Flush any pending body/title save when the page changes or on unmount, so
  // edits made in the last debounce window aren't dropped and a stale timer
  // can't later fire against the newly-opened page. The route guards in
  // saveBodyNow/saveTitleNow keep the flushed save from overwriting it.
  useEffect(() => {
    return () => {
      if (bodySaveTimer.current) {
        window.clearTimeout(bodySaveTimer.current);
        bodySaveTimer.current = null;
        const html = editorRef.current?.getHTML();
        if (html !== undefined) void saveBodyNowRef.current(html);
      }
      if (titleSaveTimer.current) {
        window.clearTimeout(titleSaveTimer.current);
        titleSaveTimer.current = null;
        void saveTitleNowRef.current(titleInputRef.current);
      }
    };
  }, [workspaceSlug, projectId, pageId]);

  // Click outside the options dropdown closes it.
  useEffect(() => {
    if (!optionsOpen) return;
    const onClick = (e: MouseEvent) => {
      if (optionsRef.current && !optionsRef.current.contains(e.target as Node)) {
        setOptionsOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [optionsOpen]);

  // ----- Sub-pages panel ---------------------------------------------------
  useEffect(() => {
    if (sidePanel !== 'subpages' || !workspaceSlug || !page) return;
    let cancelled = false;
    pageService
      .listChildren(workspaceSlug, page.id)
      .then((c) => {
        if (!cancelled) setChildren(c);
      })
      .catch(() => {
        if (!cancelled) setChildren([]);
      });
    return () => {
      cancelled = true;
    };
  }, [sidePanel, workspaceSlug, page]);

  const refreshChildren = useCallback(async () => {
    if (!workspaceSlug || !page) return;
    try {
      const c = await pageService.listChildren(workspaceSlug, page.id);
      setChildren(c);
    } catch {
      setChildren([]);
    }
  }, [workspaceSlug, page]);

  const onAddSubpage = async () => {
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
      // best-effort; show no toast
    }
  };

  // ----- Versions panel ----------------------------------------------------
  // Loaded on demand from the panel-switch handler — keeping it out of an
  // effect avoids the react-hooks/set-state-in-effect lint rule and keeps the
  // history load user-initiated.
  const loadVersions = useCallback(async () => {
    if (!workspaceSlug || !page) return;
    try {
      const list = await pageService.listVersions(workspaceSlug, page.id);
      setVersions(list);
    } catch {
      setVersions([]);
    }
  }, [workspaceSlug, page]);

  const switchSidePanelTo = useCallback(
    (next: SidePanel) => {
      setSidePanel(next);
      if (next === 'versions' && versions === null) {
        void loadVersions();
      }
    },
    [versions, loadVersions],
  );

  const onRestoreVersion = async (versionId: string) => {
    if (!workspaceSlug || !page) return;
    try {
      const updated = await pageService.restoreVersion(workspaceSlug, page.id, versionId);
      setPage(updated);
      lastSavedHtml.current = updated.description_html ?? '<p></p>';
      // Reseed the editor with the restored content via the seed prop (a genuine
      // document swap), which the editor's sync effect applies.
      setSeedHtml(updated.description_html ?? '<p></p>');
      setBodyStatus({ kind: 'saved', at: Date.now() });
      setPreviewVersion(null);
      void loadVersions();
    } catch {
      setBodyStatus({ kind: 'error', message: t('page.restoreFailed', 'Restore failed') });
    }
  };

  // ----- Header actions ----------------------------------------------------
  const onToggleFavorite = async () => {
    if (!workspaceSlug || !page) return;
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      if (next) await pageService.favorite(workspaceSlug, page.id);
      else await pageService.unfavorite(workspaceSlug, page.id);
    } catch {
      setIsFavorite(!next);
    }
  };

  const onToggleLock = async () => {
    if (!workspaceSlug || !page) return;
    try {
      if (page.is_locked) await pageService.unlock(workspaceSlug, page.id);
      else await pageService.lock(workspaceSlug, page.id);
      const fresh = await pageService.get(workspaceSlug, page.id);
      setPage(fresh);
    } catch {
      // best-effort
    }
  };

  const onToggleArchive = async () => {
    if (!workspaceSlug || !page) return;
    setOptionsOpen(false);
    try {
      if (page.archived_at) await pageService.unarchive(workspaceSlug, page.id);
      else await pageService.archive(workspaceSlug, page.id);
      const fresh = await pageService.get(workspaceSlug, page.id);
      setPage(fresh);
    } catch {
      // best-effort
    }
  };

  const onToggleAccess = async () => {
    if (!workspaceSlug || !page) return;
    setOptionsOpen(false);
    const next = page.access === 0 ? 1 : 0;
    try {
      const updated = await pageService.update(workspaceSlug, page.id, { access: next });
      setPage(updated);
    } catch {
      // best-effort
    }
  };

  const onDuplicate = async () => {
    if (!workspaceSlug || !projectId || !page) return;
    setOptionsOpen(false);
    try {
      const dup = await pageService.duplicate(workspaceSlug, page.id);
      navigate(`/${workspaceSlug}/projects/${projectId}/pages/${dup.id}`);
    } catch {
      // best-effort
    }
  };

  const onDelete = async () => {
    if (!workspaceSlug || !projectId || !page) return;
    try {
      await pageService.delete(workspaceSlug, page.id);
      navigate(`/${workspaceSlug}/projects/${projectId}/pages`);
    } catch {
      setConfirmingDelete(false);
    }
  };

  const openMove = async () => {
    if (!workspaceSlug) return;
    setOptionsOpen(false);
    setMoveOpen(true);
    setMoveError(null);
    setMoveLoading(true);
    try {
      const list = await projectService.list(workspaceSlug);
      setMoveProjects(list.filter((p) => p.id !== projectId));
    } catch {
      setMoveError(t('page.loadProjectsError', 'Failed to load projects.'));
    } finally {
      setMoveLoading(false);
    }
  };

  const onMove = async (targetProjectId: string) => {
    if (!workspaceSlug || !page) return;
    setMoveSubmitting(true);
    setMoveError(null);
    try {
      await pageService.move(workspaceSlug, page.id, targetProjectId);
      setMoveOpen(false);
      navigate(`/${workspaceSlug}/projects/${targetProjectId}/pages/${page.id}`);
    } catch (err) {
      const apiError =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      setMoveError(apiError ?? t('page.movePageError', 'Failed to move page.'));
    } finally {
      setMoveSubmitting(false);
    }
  };

  const onCopyLink = async () => {
    if (!page) return;
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1500);
    } catch {
      // best-effort
    }
  };

  // ----- Logo --------------------------------------------------------------
  const logo = pageLogoFrom(page);
  const onChangeLogo = useCallback(
    async (next: PageLogo | null) => {
      if (!workspaceSlug || !page || !canEditMeta) return;
      // PageLogo is a discriminated union; the API type uses the looser
      // Record<string, unknown> shape. Cast through unknown to satisfy both.
      const nextAsRecord = (next ?? undefined) as unknown as Record<string, unknown> | undefined;
      const optimistic = { ...page, logo_props: nextAsRecord };
      setPage(optimistic);
      try {
        const updated = await pageService.update(workspaceSlug, page.id, {
          logo_props: (next ?? null) as unknown as Record<string, unknown> | null,
        });
        setPage(updated);
      } catch {
        // revert on failure
        setPage(page);
      }
    },
    [workspaceSlug, page, canEditMeta],
  );

  // ----- Render ------------------------------------------------------------
  // `baseUrl` is computed after the page has loaded (post-early-returns).
  // Other render locals (`canDelete`, `sidebarOpen`) are derived from props
  // or memoized state and can be safely computed up here.
  const canDelete = canEditMeta && isArchived;
  const sidebarOpen = sidePanel !== 'closed';

  const statusPill = useMemo(() => {
    const compose = (text: string, tone: string) => (
      <span className={`text-xs ${tone}`}>{text}</span>
    );
    const overall =
      titleStatus.kind === 'saving' || bodyStatus.kind === 'saving'
        ? { kind: 'saving' as const }
        : titleStatus.kind === 'error' || bodyStatus.kind === 'error'
          ? { kind: 'error' as const }
          : titleStatus.kind === 'saved' || bodyStatus.kind === 'saved'
            ? {
                kind: 'saved' as const,
                at: Math.max(
                  titleStatus.kind === 'saved' ? titleStatus.at : 0,
                  bodyStatus.kind === 'saved' ? bodyStatus.at : 0,
                ),
              }
            : { kind: 'idle' as const };
    if (overall.kind === 'saving')
      return compose(t('page.saving', 'Saving…'), 'text-(--txt-tertiary)');
    if (overall.kind === 'saved')
      return compose(
        t('page.savedAt', 'Saved · {{time}}', { time: formatRelative(overall.at, t) }),
        'text-(--txt-tertiary)',
      );
    if (overall.kind === 'error')
      return compose(t('page.saveFailed', 'Save failed'), 'text-(--danger-default)');
    return null;
  }, [titleStatus, bodyStatus, t]);

  // Page breadcrumb chunk — just the page-name (and tiny emoji) suffix; the
  // workspace/project portion is rendered by `PageDetailHeader` in PageHeader.
  const headerBreadcrumb = page ? (
    <span className="flex min-w-0 items-center gap-1.5">
      {logo?.emoji?.value ? (
        <span className="text-base leading-none">{logo.emoji.value}</span>
      ) : null}
      <span className="truncate font-medium text-(--txt-primary)">
        {page.name || t('page.untitled', 'Untitled')}
      </span>
      {statusPill ? <span className="ml-2 shrink-0">{statusPill}</span> : null}
    </span>
  ) : null;

  // Page actions cluster (lock / link / favorite / more) — rendered into
  // the global PageHeader via `useSetPageDetailHeader`. The side-panel
  // toggle lives on the toolbar, not here.
  const headerActions = page ? (
    <>
      {isArchived ? (
        <span className="rounded border border-(--warning-300) bg-(--warning-50) px-1.5 py-0.5 text-[11px] font-medium text-(--warning-default)">
          {t('page.archived', 'Archived')}
        </span>
      ) : null}
      {canEditMeta ? (
        <Tooltip
          content={isLocked ? t('page.unlockPage', 'Unlock page') : t('page.lockPage', 'Lock page')}
        >
          <button
            type="button"
            onClick={onToggleLock}
            aria-label={
              isLocked ? t('page.unlockPage', 'Unlock page') : t('page.lockPage', 'Lock page')
            }
            className="grid size-7 place-items-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
          >
            {isLocked ? <Unlock size={14} /> : <Lock size={14} />}
          </button>
        </Tooltip>
      ) : null}
      <Tooltip content={linkCopied ? t('page.copied', 'Copied!') : t('page.copyLink', 'Copy link')}>
        <button
          type="button"
          onClick={onCopyLink}
          aria-label={t('page.copyLink', 'Copy link')}
          className="grid size-7 place-items-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
        >
          <Link2 size={14} />
        </button>
      </Tooltip>
      <Tooltip
        content={isFavorite ? t('page.unfavorite', 'Unfavorite') : t('page.favorite', 'Favorite')}
      >
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={
            isFavorite ? t('page.unfavorite', 'Unfavorite') : t('page.favorite', 'Favorite')
          }
          className="grid size-7 place-items-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
        >
          <Star size={14} className={isFavorite ? 'fill-amber-500 text-amber-500' : ''} />
        </button>
      </Tooltip>
      <div ref={optionsRef} className="relative">
        <Tooltip content={t('common.moreOptions', 'More options')}>
          <button
            type="button"
            onClick={() => setOptionsOpen((v) => !v)}
            aria-label={t('common.moreOptions', 'More options')}
            className="grid size-7 place-items-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
          >
            <MoreHorizontal size={14} />
          </button>
        </Tooltip>
        {optionsOpen ? (
          <div className="absolute top-full right-0 z-30 mt-1 w-48 rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)">
            <button
              type="button"
              onClick={() => {
                setOptionsOpen(false);
                window.open(window.location.href, '_blank', 'noopener,noreferrer');
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
            >
              <ExternalLink size={13} /> {t('common.openInNewTab', 'Open in new tab')}
            </button>
            <button
              type="button"
              onClick={() => void onDuplicate()}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
            >
              <Copy size={13} /> {t('page.makeCopy', 'Make a copy')}
            </button>
            {canEditMeta && !isArchived ? (
              <button
                type="button"
                onClick={() => void openMove()}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
              >
                <FolderInput size={13} /> {t('page.moveToProject', 'Move to project')}
              </button>
            ) : null}
            {canEditMeta && !isArchived ? (
              <button
                type="button"
                onClick={() => void onToggleAccess()}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
              >
                <Lock size={13} />{' '}
                {isPrivate
                  ? t('page.makePublic', 'Make public')
                  : t('page.makePrivate', 'Make private')}
              </button>
            ) : null}
            {canEditMeta ? (
              <button
                type="button"
                onClick={() => void onToggleArchive()}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
              >
                {isArchived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                {isArchived ? t('page.restore', 'Restore') : t('page.archive', 'Archive')}
              </button>
            ) : null}
            {canDelete ? (
              <>
                <hr className="my-1 border-(--border-subtle)" />
                <button
                  type="button"
                  onClick={() => {
                    setOptionsOpen(false);
                    setConfirmingDelete(true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-(--danger-default) hover:bg-(--danger-50)"
                >
                  <Trash2 size={13} /> {t('common.delete', 'Delete')}
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  ) : null;

  useSetPageDetailHeader({ breadcrumb: headerBreadcrumb, actions: headerActions });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-(--txt-tertiary)">
        {t('common.loading', 'Loading…')}
      </div>
    );
  }
  if (notFound || !workspace || !project || !page) {
    return (
      <div className="space-y-3 p-6 text-(--txt-secondary)">
        <p>{t('page.notFound', 'Page not found.')}</p>
        {workspaceSlug && projectId ? (
          <Link
            to={`/${workspaceSlug}/projects/${projectId}/pages`}
            className="text-(--txt-accent-primary) underline"
          >
            {t('page.backToPages', 'Back to Pages')}
          </Link>
        ) : null}
      </div>
    );
  }

  const baseUrl = `/${workspace.slug}/projects/${project.id}`;
  const panelToggle = (
    <Tooltip
      content={
        sidebarOpen
          ? t('page.hideSidePanel', 'Hide side panel')
          : t('page.showSidePanel', 'Show side panel')
      }
    >
      <button
        type="button"
        onClick={() => switchSidePanelTo(sidebarOpen ? 'closed' : 'outline')}
        aria-label={
          sidebarOpen
            ? t('page.hideSidePanel', 'Hide side panel')
            : t('page.showSidePanel', 'Show side panel')
        }
        className="grid size-7 place-items-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
      >
        {sidebarOpen ? <PanelRightClose size={14} /> : <PanelRight size={14} />}
      </button>
    </Tooltip>
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {/* The breadcrumb + actions cluster is rendered by `PageDetailHeader`
       * (mounted via `useSetPageDetailHeader` above) into the global
       * PageHeader bar — there is only one top header row. */}

      {/* Sticky toolbar — the page-toolbar; panel toggle anchors right */}
      {!editorReadOnly ? (
        <PageEditorToolbar editor={editor} endSlot={panelToggle} />
      ) : (
        <div className="flex w-full justify-end border-b border-(--border-subtle) bg-(--bg-canvas) px-(--padding-page) py-2">
          {panelToggle}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Main column */}
        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          {/* Notices */}
          {isArchived ? (
            <div className="mx-(--padding-page) mt-4 rounded border border-(--warning-300) bg-(--warning-50) px-3 py-2 text-sm text-(--warning-default)">
              {t(
                'page.archivedNotice',
                'This page is archived and read-only. Restore it from the menu to edit.',
              )}
            </div>
          ) : isLocked && !isOwner ? (
            <div className="mx-(--padding-page) mt-4 rounded border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-secondary)">
              {t('page.lockedNotice', 'The owner has locked this page. You can read but not edit.')}
            </div>
          ) : null}

          {/* Page header: logo + title */}
          <div className="mx-auto w-full max-w-3xl px-(--padding-page) pt-8 pb-4">
            <div className="mb-2 -ml-2">
              <EmojiLogoPicker
                value={logo}
                disabled={!canEditMeta}
                onChange={(next) => void onChangeLogo(next)}
                size={36}
              />
            </div>
            <textarea
              value={titleInput}
              disabled={!canEditMeta}
              onChange={(e) => onTitleChange(e.target.value)}
              onBlur={onTitleBlur}
              onKeyDown={onTitleKeyDown}
              placeholder={t('page.untitled', 'Untitled')}
              rows={1}
              className="block w-full resize-none border-0 bg-transparent text-3xl leading-tight font-bold tracking-tight text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none disabled:opacity-80"
            />
          </div>

          {/* Editor body */}
          <div className="mx-auto w-full max-w-3xl flex-1 px-(--padding-page) pb-32">
            <PageEditorContent editor={editor} />
          </div>
        </main>

        {/* Right rail — sub-pages / versions */}
        {sidebarOpen ? (
          <aside className="hidden w-72 shrink-0 flex-col border-l border-(--border-subtle) bg-(--bg-surface-1) lg:flex">
            <div className="flex shrink-0 items-center gap-1 border-b border-(--border-subtle) px-2 py-1.5">
              <button
                type="button"
                onClick={() => switchSidePanelTo('outline')}
                className={cn(
                  'flex-1 rounded px-2 py-1.5 text-center text-xs font-medium tracking-wide uppercase transition-colors',
                  sidePanel === 'outline'
                    ? 'bg-(--bg-layer-1) text-(--txt-primary)'
                    : 'text-(--txt-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)',
                )}
              >
                <ListTree size={11} className="mr-1 inline-block" /> {t('page.outline', 'Outline')}
              </button>
              <button
                type="button"
                onClick={() => switchSidePanelTo('subpages')}
                className={cn(
                  'flex-1 rounded px-2 py-1.5 text-center text-xs font-medium tracking-wide uppercase transition-colors',
                  sidePanel === 'subpages'
                    ? 'bg-(--bg-layer-1) text-(--txt-primary)'
                    : 'text-(--txt-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)',
                )}
              >
                {t('page.subPages', 'Sub-pages')}
              </button>
              <button
                type="button"
                onClick={() => switchSidePanelTo('versions')}
                className={cn(
                  'flex-1 rounded px-2 py-1.5 text-center text-xs font-medium tracking-wide uppercase transition-colors',
                  sidePanel === 'versions'
                    ? 'bg-(--bg-layer-1) text-(--txt-primary)'
                    : 'text-(--txt-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)',
                )}
              >
                <History size={11} className="mr-1 inline-block" /> {t('page.history', 'History')}
              </button>
            </div>

            {sidePanel === 'outline' ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-1">
                <PageOutline editor={editor} />
              </div>
            ) : sidePanel === 'subpages' ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                <button
                  type="button"
                  disabled={!canEditMeta || isArchived}
                  onClick={() => void onAddSubpage()}
                  className="mb-2 inline-flex w-full items-center justify-center gap-1 rounded border border-dashed border-(--border-subtle) px-2 py-1.5 text-xs text-(--txt-secondary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary) disabled:opacity-50"
                >
                  <Plus size={12} /> {t('page.addSubPage', 'Add sub-page')}
                </button>
                {children === null ? (
                  <p className="px-2 py-3 text-xs text-(--txt-tertiary)">
                    {t('common.loading', 'Loading…')}
                  </p>
                ) : children.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-(--txt-tertiary)">
                    {t('page.noSubPages', 'No sub-pages.')}
                  </p>
                ) : (
                  <ul className="space-y-0.5">
                    {children.map((c) => {
                      const childLogo = pageLogoFrom(c);
                      return (
                        <li key={c.id}>
                          <Link
                            to={`${baseUrl}/pages/${c.id}`}
                            onClick={() => {
                              setChildren(null);
                              void refreshChildren();
                            }}
                            className="flex items-center gap-2 truncate rounded px-2 py-1.5 text-sm text-(--txt-primary) no-underline hover:bg-(--bg-layer-1-hover)"
                          >
                            <span className="grid size-4 shrink-0 place-items-center text-(--txt-icon-tertiary)">
                              {childLogo?.emoji?.value ? (
                                <span className="text-sm leading-none">
                                  {childLogo.emoji.value}
                                </span>
                              ) : (
                                <FileText size={12} />
                              )}
                            </span>
                            <span className="truncate">
                              {c.name || t('page.untitled', 'Untitled')}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {versions === null ? (
                  <p className="px-2 py-3 text-xs text-(--txt-tertiary)">
                    {t('common.loading', 'Loading…')}
                  </p>
                ) : versions.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-(--txt-tertiary)">
                    {t('page.noVersions', 'No versions yet.')}
                  </p>
                ) : (
                  <ul className="space-y-0.5">
                    {versions.map((v) => (
                      <li key={v.id}>
                        <button
                          type="button"
                          onClick={() => setPreviewVersion(v)}
                          className="block w-full truncate rounded px-2 py-1.5 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                        >
                          <span className="block">
                            {new Date(v.last_saved_at).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span className="block truncate text-xs text-(--txt-tertiary)">
                            {v.description_stripped?.slice(0, 60) ||
                              t('page.emptyVersion', '(empty)')}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </aside>
        ) : null}
      </div>

      {previewVersion ? (
        <Modal
          open
          onClose={() => setPreviewVersion(null)}
          title={t('page.versionPreviewTitle', 'Version preview · {{time}}', {
            time: new Date(previewVersion.last_saved_at).toLocaleString(),
          })}
        >
          <div className="max-w-2xl space-y-4">
            <div className="flex items-center justify-end">
              <Button
                size="sm"
                variant="primary"
                disabled={!canEditContent}
                onClick={() => void onRestoreVersion(previewVersion.id)}
              >
                {t('page.restoreThisVersion', 'Restore this version')}
              </Button>
            </div>
            <div
              className="prose prose-sm max-h-[60vh] max-w-none overflow-y-auto rounded border border-(--border-subtle) bg-(--bg-canvas) p-3 text-(--txt-primary)"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewVersion.description_html) }}
            />
          </div>
        </Modal>
      ) : null}

      {moveOpen ? (
        <Modal
          open
          onClose={() => setMoveOpen(false)}
          title={t('page.movePageModalTitle', 'Move page to project')}
        >
          <div className="max-w-md space-y-3">
            <p className="text-sm text-(--txt-tertiary)">
              {t(
                'page.movePageModalDescription',
                'The page and its sub-pages move to the project you choose.',
              )}
            </p>
            {moveError ? (
              <p className="rounded-(--radius-md) bg-(--bg-danger-subtle) px-3 py-2 text-sm text-(--txt-danger)">
                {moveError}
              </p>
            ) : null}
            {moveLoading ? (
              <p className="py-6 text-center text-sm text-(--txt-tertiary)">
                {t('page.loadingProjects', 'Loading projects…')}
              </p>
            ) : moveProjects.length > 0 ? (
              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {moveProjects.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={moveSubmitting}
                      onClick={() => void onMove(p.id)}
                      className="flex w-full items-center gap-2 rounded-(--radius-md) px-3 py-2 text-left text-sm text-(--txt-primary) transition-colors hover:bg-(--bg-layer-1-hover) disabled:opacity-50"
                    >
                      <span className="shrink-0 rounded-(--radius-sm) bg-(--bg-layer-2) px-1.5 py-0.5 text-xs font-medium text-(--txt-secondary)">
                        {p.identifier ?? p.id.slice(0, 8)}
                      </span>
                      <span className="truncate">{p.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : !moveError ? (
              <p className="py-6 text-center text-sm text-(--txt-tertiary)">
                {t('page.noOtherProjects', 'No other projects available.')}
              </p>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {confirmingDelete ? (
        <Modal
          open
          onClose={() => setConfirmingDelete(false)}
          title={t('page.deleteModalTitle', 'Delete page?')}
        >
          <div className="max-w-md space-y-4">
            <p className="text-sm text-(--txt-secondary)">
              {t(
                'page.deleteModalDescription',
                'This permanently removes the page and its history. This cannot be undone.',
              )}
            </p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setConfirmingDelete(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button size="sm" variant="primary" onClick={() => void onDelete()}>
                {t('common.delete', 'Delete')}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
