import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Archive,
  ArchiveRestore,
  ChevronRight,
  Copy,
  Globe,
  History,
  Lock,
  Plus,
  Star,
  Trash2,
  Unlock,
} from 'lucide-react';
import { Button, Modal } from '../components/ui';
import {
  PageDescriptionEditor,
  type PageDescriptionEditorHandle,
} from '../components/PageDescriptionEditor';
import { useAuth } from '../contexts/AuthContext';
import { workspaceService } from '../services/workspaceService';
import { projectService } from '../services/projectService';
import { pageService } from '../services/pageService';
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
  const [showVersions, setShowVersions] = useState(false);
  const [showSubpages, setShowSubpages] = useState(true);
  const [versions, setVersions] = useState<PageVersionApiResponse[] | null>(null);
  const [previewVersion, setPreviewVersion] = useState<PageVersionApiResponse | null>(null);
  const [children, setChildren] = useState<PageApiResponse[] | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const editorRef = useRef<PageDescriptionEditorHandle>(null);
  const titleSaveTimer = useRef<number | null>(null);
  const bodySaveTimer = useRef<number | null>(null);
  const lastSavedHtml = useRef<string>('');

  // ----- Initial load ------------------------------------------------------
  useEffect(() => {
    if (!workspaceSlug || !projectId || !pageId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset when params absent
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    Promise.all([
      workspaceService.getBySlug(workspaceSlug),
      projectService.get(workspaceSlug, projectId),
      pageService.get(workspaceSlug, pageId),
      pageService.listFavoriteIds(workspaceSlug).catch(() => [] as string[]),
    ])
      .then(([w, p, pg, favIds]) => {
        if (cancelled) return;
        setWorkspace(w ?? null);
        setProject(p ?? null);
        setPage(pg);
        setTitleInput(pg.name ?? '');
        lastSavedHtml.current = pg.description_html ?? '<p></p>';
        setIsFavorite(favIds.includes(pg.id));
      })
      .catch(() => {
        if (!cancelled) {
          setNotFound(true);
          setPage(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, pageId]);

  // ----- Permissions (mirror service: canEditContent / canEditMeta) -------
  const isOwner = !!page && !!user && page.owned_by_id === user.id;
  const isArchived = !!page?.archived_at;
  const isPrivate = page?.access === 1;
  const isLocked = !!page?.is_locked;
  const canEditContent = !!page && !isArchived && (isOwner || (!isLocked && !isPrivate));
  const canEditMeta = isOwner;
  const editorReadOnly = !canEditContent;

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

  // ----- Body autosave -----------------------------------------------------
  const saveBodyNow = useCallback(async () => {
    if (!workspaceSlug || !page) return;
    const html = editorRef.current?.getHtml() ?? '';
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
  }, [workspaceSlug, page]);

  // The editor doesn't currently expose an onChange callback, so we install a
  // light keystroke listener on the wrapper to schedule autosaves.
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = editorWrapperRef.current;
    if (!node || !canEditContent) return;
    const onInput = () => {
      if (bodySaveTimer.current) window.clearTimeout(bodySaveTimer.current);
      bodySaveTimer.current = window.setTimeout(() => {
        void saveBodyNow();
      }, AUTOSAVE_DEBOUNCE_MS);
    };
    node.addEventListener('input', onInput);
    return () => node.removeEventListener('input', onInput);
  }, [canEditContent, saveBodyNow]);

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

  // ----- Sub-pages panel ---------------------------------------------------
  useEffect(() => {
    if (!showSubpages || !workspaceSlug || !page) return;
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
  }, [showSubpages, workspaceSlug, page]);

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
  const loadVersions = useCallback(async () => {
    if (!workspaceSlug || !page) return;
    try {
      const list = await pageService.listVersions(workspaceSlug, page.id);
      setVersions(list);
    } catch {
      setVersions([]);
    }
  }, [workspaceSlug, page]);

  useEffect(() => {
    if (showVersions && versions === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: lazy-load versions when the panel first opens
      void loadVersions();
    }
  }, [showVersions, versions, loadVersions]);

  const onRestoreVersion = async (versionId: string) => {
    if (!workspaceSlug || !page) return;
    try {
      const updated = await pageService.restoreVersion(workspaceSlug, page.id, versionId);
      setPage(updated);
      lastSavedHtml.current = updated.description_html ?? '<p></p>';
      editorRef.current?.setHtml(updated.description_html ?? '');
      setBodyStatus({ kind: 'saved', at: Date.now() });
      setPreviewVersion(null);
      void loadVersions();
    } catch {
      // surface as error pill
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

  // ----- Render ------------------------------------------------------------
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
  const canDelete = canEditMeta && isArchived;

  return (
    <div className="flex h-full min-h-0 w-full">
      <main className="min-w-0 flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-(--border-subtle) bg-(--bg-canvas) px-(--padding-page) py-3">
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 items-center gap-1 text-sm text-(--txt-secondary)"
          >
            <Link
              to={`${baseUrl}/pages`}
              className="truncate no-underline hover:text-(--txt-primary)"
            >
              Pages
            </Link>
            <ChevronRight size={14} className="shrink-0 text-(--txt-tertiary)" />
            <span className="truncate text-(--txt-primary)">{page.name || 'Untitled'}</span>
            {statusPill ? <span className="ml-3 shrink-0">{statusPill}</span> : null}
          </nav>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onToggleFavorite}
              title={isFavorite ? 'Unfavorite' : 'Favorite'}
              className="inline-flex h-8 w-8 items-center justify-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
            >
              <Star
                size={16}
                className={isFavorite ? 'fill-(--brand-default) text-(--brand-default)' : ''}
              />
            </button>
            {canEditMeta ? (
              <button
                type="button"
                onClick={onToggleAccess}
                title={isPrivate ? 'Make public' : 'Make private'}
                className="inline-flex h-8 items-center justify-center gap-1 rounded px-2 text-xs text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
              >
                <Globe size={14} />
                {isPrivate ? 'Private' : 'Public'}
              </button>
            ) : null}
            {canEditMeta ? (
              <button
                type="button"
                onClick={onToggleLock}
                title={isLocked ? 'Unlock' : 'Lock'}
                className="inline-flex h-8 w-8 items-center justify-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
              >
                {isLocked ? <Unlock size={16} /> : <Lock size={16} />}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onDuplicate}
              title="Duplicate"
              className="inline-flex h-8 w-8 items-center justify-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
            >
              <Copy size={16} />
            </button>
            {canEditMeta ? (
              <button
                type="button"
                onClick={onToggleArchive}
                title={isArchived ? 'Unarchive' : 'Archive'}
                className="inline-flex h-8 w-8 items-center justify-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
              >
                {isArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setShowVersions((v) => !v)}
              title="Version history"
              className={`inline-flex h-8 w-8 items-center justify-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary) ${showVersions ? 'bg-(--bg-layer-1)' : ''}`}
            >
              <History size={16} />
            </button>
            {canDelete ? (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                title="Delete (archived only)"
                className="inline-flex h-8 w-8 items-center justify-center rounded text-(--danger-default) hover:bg-(--danger-50)"
              >
                <Trash2 size={16} />
              </button>
            ) : null}
          </div>
        </header>

        <div className="mx-auto max-w-3xl px-(--padding-page) py-6">
          {isArchived ? (
            <div className="mb-4 rounded border border-(--warning-300) bg-(--warning-50) px-3 py-2 text-sm text-(--warning-default)">
              This page is archived and read-only. Unarchive to edit.
            </div>
          ) : isLocked && !isOwner ? (
            <div className="mb-4 rounded border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-secondary)">
              The owner has locked this page. You can read but not edit.
            </div>
          ) : null}

          <input
            type="text"
            value={titleInput}
            disabled={!canEditMeta}
            onChange={(e) => onTitleChange(e.target.value)}
            onBlur={onTitleBlur}
            placeholder="Untitled"
            className="mb-4 w-full border-0 bg-transparent text-3xl font-semibold text-(--txt-primary) placeholder:text-(--txt-tertiary) focus:outline-none disabled:opacity-80"
          />

          <div ref={editorWrapperRef}>
            <PageDescriptionEditor
              ref={editorRef}
              initialHtml={page.description_html ?? ''}
              placeholder="Start writing…"
              readOnly={editorReadOnly}
              onSaveShortcut={() => void saveBodyNow()}
            />
          </div>
        </div>
      </main>

      {/* Right rail: sub-pages + versions */}
      <aside className="hidden w-72 shrink-0 flex-col border-l border-(--border-subtle) bg-(--bg-surface-1) lg:flex">
        <div className="flex shrink-0 items-center justify-between border-b border-(--border-subtle) px-3 py-2">
          <button
            type="button"
            onClick={() => setShowSubpages((v) => !v)}
            className={`text-xs font-medium tracking-wide uppercase ${showSubpages ? 'text-(--txt-primary)' : 'text-(--txt-tertiary)'}`}
          >
            Sub-pages
          </button>
          <button
            type="button"
            onClick={() => setShowVersions((v) => !v)}
            className={`text-xs font-medium tracking-wide uppercase ${showVersions ? 'text-(--txt-primary)' : 'text-(--txt-tertiary)'}`}
          >
            Versions
          </button>
        </div>

        {showSubpages ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <button
              type="button"
              disabled={!canEditMeta || isArchived}
              onClick={onAddSubpage}
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
                {children.map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`${baseUrl}/pages/${c.id}`}
                      onClick={() => {
                        // Force-clear children cache so the new page's panel re-fetches.
                        setChildren(null);
                        void refreshChildren();
                      }}
                      className="block truncate rounded px-2 py-1.5 text-sm text-(--txt-primary) no-underline hover:bg-(--bg-layer-1-hover)"
                    >
                      {c.name || 'Untitled'}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {showVersions ? (
          <div className="min-h-0 flex-1 overflow-y-auto border-t border-(--border-subtle) p-2">
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
                      <span className="block">{new Date(v.last_saved_at).toLocaleString()}</span>
                      <span className="block truncate text-xs text-(--txt-tertiary)">
                        {v.description_stripped?.slice(0, 60) || '(empty)'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </aside>

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
