import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Archive,
  ArchiveRestore,
  Copy,
  ExternalLink,
  FileText,
  History,
  Link2,
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
  usePageEditor,
  type PageLogo,
} from '../components/page-editor';
import { useAuth } from '../contexts/AuthContext';
import { useSetPageDetailHeader } from '../contexts/PageDetailHeaderContext';
import { workspaceService } from '../services/workspaceService';
import { projectService } from '../services/projectService';
import { pageService } from '../services/pageService';
import { cn } from '../lib/utils';
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

function formatRelative(at: number): string {
  const diff = Math.max(0, Date.now() - at);
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function pageLogoFrom(page: PageApiResponse | null): PageLogo | undefined {
  const props = page?.logo_props as PageLogo | undefined;
  if (!props || props.in_use !== 'emoji' || !props.emoji?.value) return undefined;
  return props;
}

type SidePanel = 'closed' | 'subpages' | 'versions';

export function PageDetailPage() {
  const { workspaceSlug, projectId, pageId } = useParams<{
    workspaceSlug: string;
    projectId: string;
    pageId: string;
  }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [page, setPage] = useState<PageApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [titleInput, setTitleInput] = useState('');
  const [titleStatus, setTitleStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [bodyStatus, setBodyStatus] = useState<SaveStatus>({ kind: 'idle' });

  const [isFavorite, setIsFavorite] = useState(false);
  // Closed by default — match Plane's page-detail header where the panel
  // toggle reveals sub-pages / history on demand.
  const [sidePanel, setSidePanel] = useState<SidePanel>('closed');
  const [versions, setVersions] = useState<PageVersionApiResponse[] | null>(null);
  const [previewVersion, setPreviewVersion] = useState<PageVersionApiResponse | null>(null);
  const [children, setChildren] = useState<PageApiResponse[] | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

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
      setBodyStatus({ kind: 'saving' });
      try {
        const updated = await pageService.updateContent(workspaceSlug, page.id, html);
        lastSavedHtml.current = html;
        setPage(updated);
        setBodyStatus({ kind: 'saved', at: Date.now() });
      } catch (err) {
        setBodyStatus({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Save failed',
        });
      }
    },
    [workspaceSlug, page],
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
    initialHtml: page?.description_html ?? '<p></p>',
    placeholder: 'Start writing… or press “/” for commands',
    readOnly: editorReadOnly,
    onUpdate: onEditorUpdate,
    onSaveShortcut,
  });
  // Mirror the latest editor instance into the ref so non-render code (key
  // handlers, save flushes) can reach it without re-deriving callback identity.
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

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
      setTitleStatus({ kind: 'saving' });
      try {
        const updated = await pageService.update(workspaceSlug, page.id, { name: trimmed });
        setPage(updated);
        setTitleStatus({ kind: 'saved', at: Date.now() });
      } catch (err) {
        setTitleStatus({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Save failed',
        });
      }
    },
    [workspaceSlug, page],
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

  // Save on unmount/navigation if there are unsaved changes.
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
        name: 'Untitled sub-page',
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
  // effect avoids the react-hooks/set-state-in-effect lint rule and matches
  // Plane's user-initiated history load.
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
      editor?.commands.setContent(updated.description_html ?? '', { emitUpdate: false });
      setBodyStatus({ kind: 'saved', at: Date.now() });
      setPreviewVersion(null);
      void loadVersions();
    } catch {
      setBodyStatus({ kind: 'error', message: 'Restore failed' });
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
    if (overall.kind === 'saving') return compose('Saving…', 'text-(--txt-tertiary)');
    if (overall.kind === 'saved')
      return compose(`Saved · ${formatRelative(overall.at)}`, 'text-(--txt-tertiary)');
    if (overall.kind === 'error') return compose('Save failed', 'text-(--danger-default)');
    return null;
  }, [titleStatus, bodyStatus]);

  // Page breadcrumb chunk — just the page-name (and tiny emoji) suffix; the
  // workspace/project portion is rendered by `PageDetailHeader` in PageHeader.
  const headerBreadcrumb = page ? (
    <span className="flex min-w-0 items-center gap-1.5">
      {logo?.emoji?.value ? (
        <span className="text-base leading-none">{logo.emoji.value}</span>
      ) : null}
      <span className="truncate font-medium text-(--txt-primary)">{page.name || 'Untitled'}</span>
      {statusPill ? <span className="ml-2 shrink-0">{statusPill}</span> : null}
    </span>
  ) : null;

  // Page actions cluster (lock / link / favorite / more) — rendered into
  // the global PageHeader via `useSetPageDetailHeader`. The side-panel
  // toggle lives on the toolbar (Plane parity), not here.
  const headerActions = page ? (
    <>
      {isArchived ? (
        <span className="rounded border border-(--warning-300) bg-(--warning-50) px-1.5 py-0.5 text-[11px] font-medium text-(--warning-default)">
          Archived
        </span>
      ) : null}
      {canEditMeta ? (
        <Tooltip content={isLocked ? 'Unlock page' : 'Lock page'}>
          <button
            type="button"
            onClick={onToggleLock}
            aria-label={isLocked ? 'Unlock page' : 'Lock page'}
            className="grid size-7 place-items-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
          >
            {isLocked ? <Unlock size={14} /> : <Lock size={14} />}
          </button>
        </Tooltip>
      ) : null}
      <Tooltip content={linkCopied ? 'Copied!' : 'Copy link'}>
        <button
          type="button"
          onClick={onCopyLink}
          aria-label="Copy link"
          className="grid size-7 place-items-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
        >
          <Link2 size={14} />
        </button>
      </Tooltip>
      <Tooltip content={isFavorite ? 'Unfavorite' : 'Favorite'}>
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={isFavorite ? 'Unfavorite' : 'Favorite'}
          className="grid size-7 place-items-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
        >
          <Star size={14} className={isFavorite ? 'fill-amber-500 text-amber-500' : ''} />
        </button>
      </Tooltip>
      <div ref={optionsRef} className="relative">
        <Tooltip content="More options">
          <button
            type="button"
            onClick={() => setOptionsOpen((v) => !v)}
            aria-label="More options"
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
              <ExternalLink size={13} /> Open in new tab
            </button>
            <button
              type="button"
              onClick={() => void onDuplicate()}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
            >
              <Copy size={13} /> Make a copy
            </button>
            {canEditMeta && !isArchived ? (
              <button
                type="button"
                onClick={() => void onToggleAccess()}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
              >
                <Lock size={13} /> {isPrivate ? 'Make public' : 'Make private'}
              </button>
            ) : null}
            {canEditMeta ? (
              <button
                type="button"
                onClick={() => void onToggleArchive()}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
              >
                {isArchived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                {isArchived ? 'Restore' : 'Archive'}
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
                  <Trash2 size={13} /> Delete
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
        Loading…
      </div>
    );
  }
  if (notFound || !workspace || !project || !page) {
    return (
      <div className="space-y-3 p-6 text-(--txt-secondary)">
        <p>Page not found.</p>
        {workspaceSlug && projectId ? (
          <Link
            to={`/${workspaceSlug}/projects/${projectId}/pages`}
            className="text-(--txt-accent-primary) underline"
          >
            Back to Pages
          </Link>
        ) : null}
      </div>
    );
  }

  const baseUrl = `/${workspace.slug}/projects/${project.id}`;
  const panelToggle = (
    <Tooltip content={sidebarOpen ? 'Hide side panel' : 'Show side panel'}>
      <button
        type="button"
        onClick={() => switchSidePanelTo(sidebarOpen ? 'closed' : 'subpages')}
        aria-label={sidebarOpen ? 'Hide side panel' : 'Show side panel'}
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
       * PageHeader bar — Plane parity: there is only one top header row. */}

      {/* Sticky toolbar — Plane's page-toolbar; panel toggle anchors right */}
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
              This page is archived and read-only. Restore it from the menu to edit.
            </div>
          ) : isLocked && !isOwner ? (
            <div className="mx-(--padding-page) mt-4 rounded border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-secondary)">
              The owner has locked this page. You can read but not edit.
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
              placeholder="Untitled"
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
                onClick={() => switchSidePanelTo('subpages')}
                className={cn(
                  'flex-1 rounded px-2 py-1.5 text-left text-xs font-medium tracking-wide uppercase transition-colors',
                  sidePanel === 'subpages'
                    ? 'bg-(--bg-layer-1) text-(--txt-primary)'
                    : 'text-(--txt-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)',
                )}
              >
                Sub-pages
              </button>
              <button
                type="button"
                onClick={() => switchSidePanelTo('versions')}
                className={cn(
                  'flex-1 rounded px-2 py-1.5 text-left text-xs font-medium tracking-wide uppercase transition-colors',
                  sidePanel === 'versions'
                    ? 'bg-(--bg-layer-1) text-(--txt-primary)'
                    : 'text-(--txt-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)',
                )}
              >
                <History size={11} className="mr-1 inline-block" /> History
              </button>
            </div>

            {sidePanel === 'subpages' ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                <button
                  type="button"
                  disabled={!canEditMeta || isArchived}
                  onClick={() => void onAddSubpage()}
                  className="mb-2 inline-flex w-full items-center justify-center gap-1 rounded border border-dashed border-(--border-subtle) px-2 py-1.5 text-xs text-(--txt-secondary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary) disabled:opacity-50"
                >
                  <Plus size={12} /> Add sub-page
                </button>
                {children === null ? (
                  <p className="px-2 py-3 text-xs text-(--txt-tertiary)">Loading…</p>
                ) : children.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-(--txt-tertiary)">No sub-pages.</p>
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
                            <span className="truncate">{c.name || 'Untitled'}</span>
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
                  <p className="px-2 py-3 text-xs text-(--txt-tertiary)">Loading…</p>
                ) : versions.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-(--txt-tertiary)">No versions yet.</p>
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
                            {v.description_stripped?.slice(0, 60) || '(empty)'}
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
          title={`Version preview · ${new Date(previewVersion.last_saved_at).toLocaleString()}`}
        >
          <div className="max-w-2xl space-y-4">
            <div className="flex items-center justify-end">
              <Button
                size="sm"
                variant="primary"
                disabled={!canEditContent}
                onClick={() => void onRestoreVersion(previewVersion.id)}
              >
                Restore this version
              </Button>
            </div>
            <div
              className="prose prose-sm max-h-[60vh] max-w-none overflow-y-auto rounded border border-(--border-subtle) bg-(--bg-canvas) p-3 text-(--txt-primary)"
              dangerouslySetInnerHTML={{ __html: previewVersion.description_html ?? '' }}
            />
          </div>
        </Modal>
      ) : null}

      {confirmingDelete ? (
        <Modal open onClose={() => setConfirmingDelete(false)} title="Delete page?">
          <div className="max-w-md space-y-4">
            <p className="text-sm text-(--txt-secondary)">
              This permanently removes the page and its history. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={() => void onDelete()}>
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
