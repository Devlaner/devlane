import { useCallback, useEffect, useMemo, useState, type SVGProps } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Avatar, Button, Input, Modal } from '../components/ui';
import { Dropdown } from '../components/work-item';
import { useWorkspaceViewsState } from '../contexts/WorkspaceViewsStateContext';
import { useAuth } from '../contexts/AuthContext';
import { workspaceService } from '../services/workspaceService';
import { projectService } from '../services/projectService';
import { viewService } from '../services/viewService';
import { getViewAccessMeta } from '../lib/viewAccess';
import { ISSUE_VIEW_FAVORITES_CHANGED_EVENT } from '../lib/issueViewFavoritesEvents';
import { countSavedViewFilters } from '../lib/viewFilterCount';
import {
  PROJECT_VIEWS_CREATE_EVENT,
  PROJECT_VIEWS_EDIT_EVENT,
  PROJECT_VIEWS_FILTER_EVENT,
  PROJECT_VIEWS_REFRESH_EVENT,
} from '../lib/projectViewsEvents';
import { findWorkspaceMemberByUserId, getImageUrl } from '../lib/utils';
import type {
  WorkspaceApiResponse,
  ProjectApiResponse,
  IssueViewApiResponse,
  WorkspaceMemberApiResponse,
} from '../api/types';

type CreatedDatePreset = '1_week' | '2_weeks' | '1_month';

type ProjectViewsFilters = {
  query: string;
  favoritesOnly: boolean;
  createdDatePreset: CreatedDatePreset | 'custom' | null;
  createdAfter: string | null;
  createdBefore: string | null;
  createdByIds: string[];
};

function IconLayers(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
    </svg>
  );
}

function IconGlobe(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

function IconLock(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconMoreVertical(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  );
}

function IconPencil(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function IconExternalTab(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function IconLinkChain(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function IconTrash(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function IconStar(props: SVGProps<SVGSVGElement> & { filled?: boolean }) {
  const { filled, ...rest } = props;
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      <polygon points="12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9" />
    </svg>
  );
}

function getProjectViewsFavoritesKey(workspaceId: string, projectId: string) {
  return `project-view-favorites:${workspaceId}:${projectId}`;
}

function resolveViewCreator(
  members: WorkspaceMemberApiResponse[],
  v: IssueViewApiResponse,
): { label: string; avatarSrc: string | undefined } {
  const m = findWorkspaceMemberByUserId(members, v.owned_by_id);
  const fromDisplay = m?.member_display_name?.trim() ?? '';
  const fromEmail = m?.member_email?.trim().split('@')[0]?.trim() ?? '';
  const ownedByStr = v.owned_by?.trim() ?? '';
  const label =
    fromDisplay !== ''
      ? fromDisplay
      : fromEmail !== ''
        ? fromEmail
        : ownedByStr !== ''
          ? ownedByStr
          : v.owned_by_id.slice(0, 8);
  const raw = m?.member_avatar?.trim();
  const resolved = raw ? getImageUrl(raw) : null;
  return { label, avatarSrc: resolved ?? undefined };
}

export function ViewsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { workspaceSlug, projectId } = useParams<{
    workspaceSlug: string;
    projectId: string;
  }>();
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [views, setViews] = useState<IssueViewApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { display } = useWorkspaceViewsState();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpenId, setEditOpenId] = useState<string | null>(null);
  const [deleteOpenId, setDeleteOpenId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [viewMenuOpenId, setViewMenuOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [favoriteActionError, setFavoriteActionError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ProjectViewsFilters>({
    query: '',
    favoritesOnly: false,
    createdDatePreset: null,
    createdAfter: null,
    createdBefore: null,
    createdByIds: [],
  });
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  const loadPageData = useCallback(() => {
    if (!workspaceSlug || !projectId) {
      setLoading(false);
      return Promise.resolve();
    }
    setLoading(true);
    setLoadError(null);
    return Promise.all([
      workspaceService.getBySlug(workspaceSlug),
      projectService.get(workspaceSlug, projectId),
      viewService.list(workspaceSlug, projectId),
      workspaceService.listMembers(workspaceSlug),
      projectService.listMembers(workspaceSlug, projectId),
    ])
      .then(([w, p, list, mem, projectMem]) => {
        setWorkspace(w ?? null);
        setProject(p ?? null);
        setViews(list ?? []);
        setMembers(mem ?? []);
        void projectMem;
        setFavoriteActionError(null);
        // Server is source of truth (omit `is_favorite` for non-favorites → treat as false).
        const serverFavoriteIds = (list ?? [])
          .filter((v) => v.is_favorite === true)
          .map((v) => v.id);
        setFavoriteIds(serverFavoriteIds);
        if (w?.id) {
          try {
            localStorage.setItem(
              getProjectViewsFavoritesKey(w.id, projectId),
              JSON.stringify(serverFavoriteIds),
            );
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {
        setWorkspace(null);
        setProject(null);
        setViews([]);
        setMembers([]);
        setLoadError('Unable to load project views right now. Please refresh and try again.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [workspaceSlug, projectId]);

  const openEdit = useCallback((view: IssueViewApiResponse) => {
    setEditOpenId(view.id);
    setEditTitle(view.name ?? '');
    setEditDescription(view.description ?? '');
    setError(null);
  }, []);

  const editFromUrl = searchParams.get('edit');
  useEffect(() => {
    if (!editFromUrl || views.length === 0) return;
    const target = views.find((v) => v.id === editFromUrl);
    const next = new URLSearchParams(searchParams);
    next.delete('edit');
    if (!target) {
      setSearchParams(next, { replace: true });
      return;
    }
    openEdit(target);
    setSearchParams(next, { replace: true });
  }, [editFromUrl, views, openEdit, searchParams, setSearchParams]);

  useEffect(() => {
    void loadPageData();
  }, [loadPageData]);

  useEffect(() => {
    const handleOpenCreate = () => setCreateOpen(true);
    const handleOpenEdit = (e: Event) => {
      const ce = e as CustomEvent<{ viewId?: string }>;
      const id = ce.detail?.viewId;
      if (!id) return;
      const target = views.find((v) => v.id === id);
      if (target) openEdit(target);
    };
    const handleRefresh = () => {
      void loadPageData();
    };
    window.addEventListener(PROJECT_VIEWS_CREATE_EVENT, handleOpenCreate);
    window.addEventListener(PROJECT_VIEWS_EDIT_EVENT, handleOpenEdit as EventListener);
    window.addEventListener(PROJECT_VIEWS_REFRESH_EVENT, handleRefresh);
    return () => {
      window.removeEventListener(PROJECT_VIEWS_CREATE_EVENT, handleOpenCreate);
      window.removeEventListener(PROJECT_VIEWS_EDIT_EVENT, handleOpenEdit as EventListener);
      window.removeEventListener(PROJECT_VIEWS_REFRESH_EVENT, handleRefresh);
    };
  }, [views, loadPageData, openEdit]);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<ProjectViewsFilters>;
      if (!ce.detail) return;
      setFilters((prev) => ({ ...prev, ...ce.detail }));
    };
    window.addEventListener(PROJECT_VIEWS_FILTER_EVENT, handler as EventListener);
    return () => {
      window.removeEventListener(PROJECT_VIEWS_FILTER_EVENT, handler as EventListener);
    };
  }, []);

  const toggleFavorite = async (viewId: string) => {
    if (!workspace?.id || !projectId || !workspaceSlug) return;
    const key = getProjectViewsFavoritesKey(workspace.id, projectId);

    const prevFavoriteIds = favoriteIds;
    const wasFavorited = prevFavoriteIds.includes(viewId);
    const nextFavoriteIds = wasFavorited
      ? prevFavoriteIds.filter((id) => id !== viewId)
      : [...prevFavoriteIds, viewId];
    const nextIsFavorite = !wasFavorited;

    setFavoriteActionError(null);
    // Optimistic UI update so the star responds immediately.
    setFavoriteIds(nextFavoriteIds);
    setViews((prev) =>
      prev.map((v) => (v.id === viewId ? { ...v, is_favorite: nextIsFavorite } : v)),
    );
    try {
      localStorage.setItem(key, JSON.stringify(nextFavoriteIds));
    } catch {
      // ignore local storage issues
    }

    try {
      if (wasFavorited) {
        await viewService.removeFavorite(workspaceSlug, viewId);
      } else {
        await viewService.addFavorite(workspaceSlug, viewId);
      }
      window.dispatchEvent(
        new CustomEvent(ISSUE_VIEW_FAVORITES_CHANGED_EVENT, {
          detail: { workspaceSlug },
        }),
      );
    } catch {
      // Roll back optimistic UI if the server update fails.
      setFavoriteActionError('Unable to update favorite. Please try again.');
      setFavoriteIds(prevFavoriteIds);
      setViews((prev) =>
        prev.map((v) => (v.id === viewId ? { ...v, is_favorite: wasFavorited } : v)),
      );
      try {
        localStorage.setItem(key, JSON.stringify(prevFavoriteIds));
      } catch {
        // ignore local storage issues
      }
    }
  };

  const filteredViews = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const now = Date.now();
    const days =
      filters.createdDatePreset === '1_week'
        ? 7
        : filters.createdDatePreset === '2_weeks'
          ? 14
          : filters.createdDatePreset === '1_month'
            ? 30
            : null;
    const createdAfter = days ? now - days * 24 * 60 * 60 * 1000 : null;
    const customAfter = filters.createdAfter ? new Date(filters.createdAfter).getTime() : null;
    const customBefore = filters.createdBefore ? new Date(filters.createdBefore).getTime() : null;
    return views.filter((v) => {
      if (q) {
        const hay = `${v.name ?? ''} ${v.description ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.favoritesOnly && !favoriteIds.includes(v.id)) return false;
      if (filters.createdByIds.length && !filters.createdByIds.includes(v.owned_by_id))
        return false;
      if (createdAfter) {
        const ts = v.created_at ? new Date(v.created_at).getTime() : 0;
        if (!ts || ts < createdAfter) return false;
      }
      if (filters.createdDatePreset === 'custom') {
        const ts = v.created_at ? new Date(v.created_at).getTime() : 0;
        if (!ts) return false;
        if (customAfter && ts < customAfter) return false;
        if (customBefore && ts > customBefore + 24 * 60 * 60 * 1000 - 1) return false;
      }
      return true;
    });
  }, [views, filters, favoriteIds]);

  const sortedViews = useMemo(() => {
    const list = [...filteredViews];
    const sortBy = display.sortBy;
    const sortOrder = display.sortOrder;
    list.sort((a, b) => {
      let va: string | number = '';
      let vb: string | number = '';
      if (sortBy === 'name') {
        va = a.name ?? '';
        vb = b.name ?? '';
      } else if (sortBy === 'created_at') {
        va = a.created_at ? new Date(a.created_at).getTime() : 0;
        vb = b.created_at ? new Date(b.created_at).getTime() : 0;
      } else {
        va = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        vb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      }
      const cmp =
        typeof va === 'string' && typeof vb === 'string'
          ? va.localeCompare(vb, undefined, { sensitivity: 'base' })
          : Number(va) - Number(vb);
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filteredViews, display.sortBy, display.sortOrder]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceSlug || !projectId || !title.trim() || !canCreateViews) return;
    setSubmitting(true);
    setError(null);
    try {
      await viewService.create(workspaceSlug, {
        name: title.trim(),
        description: description.trim() || undefined,
        project_id: projectId,
      });
      setCreateOpen(false);
      setTitle('');
      setDescription('');
      await loadPageData();
      window.dispatchEvent(new CustomEvent(PROJECT_VIEWS_REFRESH_EVENT));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create view.');
    } finally {
      setSubmitting(false);
    }
  };

  const activeView = useMemo(
    () => views.find((v) => v.id === editOpenId) ?? null,
    [views, editOpenId],
  );
  const deleteView = useMemo(
    () => views.find((v) => v.id === deleteOpenId) ?? null,
    [views, deleteOpenId],
  );

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceSlug || !activeView || !editTitle.trim()) return;
    setEditing(true);
    setError(null);
    try {
      await viewService.update(workspaceSlug, activeView.id, {
        name: editTitle.trim(),
        description: editDescription.trim() || undefined,
      });
      setEditOpenId(null);
      await loadPageData();
      window.dispatchEvent(new CustomEvent(PROJECT_VIEWS_REFRESH_EVENT));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update view.');
    } finally {
      setEditing(false);
    }
  };

  const handleDelete = async () => {
    if (!workspaceSlug || !deleteView) return;
    setDeleting(true);
    setError(null);
    try {
      await viewService.remove(workspaceSlug, deleteView.id);
      setDeleteOpenId(null);
      await loadPageData();
      window.dispatchEvent(new CustomEvent(PROJECT_VIEWS_REFRESH_EVENT));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete view.');
    } finally {
      setDeleting(false);
    }
  };

  const copyViewLink = async (viewId: string) => {
    if (!workspaceSlug || !projectId) return;
    setCopyingId(viewId);
    try {
      const href = `${window.location.origin}/${workspaceSlug}/projects/${projectId}/views/${viewId}`;
      await navigator.clipboard.writeText(href);
    } finally {
      setTimeout(() => setCopyingId((prev) => (prev === viewId ? null : prev)), 800);
    }
  };

  const handleTogglePublish = async (view: IssueViewApiResponse) => {
    if (!workspaceSlug) return;
    setPublishingId(view.id);
    setError(null);
    try {
      if (view.anchor) {
        await viewService.unpublish(workspaceSlug, view.id);
      } else {
        await viewService.publish(workspaceSlug, view.id);
      }
      await loadPageData();
    } catch {
      setError('Unable to update publish status for this view.');
    } finally {
      setPublishingId(null);
    }
  };

  const viewsFeatureEnabled = project?.issue_views_view !== false;
  const canCreateViews = !!user && viewsFeatureEnabled;

  const noViewsAtAll = views.length === 0;
  const hasFilteredOutResults = views.length > 0 && sortedViews.length === 0;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (isTyping) return;
      if (e.key.toLowerCase() === 'c' && canCreateViews) {
        e.preventDefault();
        setCreateOpen(true);
      }
      if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(PROJECT_VIEWS_REFRESH_EVENT));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canCreateViews]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-(--txt-tertiary)">
        Loading…
      </div>
    );
  }
  if (!workspace || !project) {
    return (
      <div className="px-6 py-8 text-sm text-(--txt-secondary)">
        {loadError ?? 'Project not found.'}
      </div>
    );
  }
  if (!viewsFeatureEnabled) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-10">
        <div className="max-w-xl rounded-lg border border-(--border-subtle) bg-(--bg-layer-1) p-6 text-center">
          <h2 className="text-lg font-semibold text-(--txt-primary)">
            Views are disabled for this project
          </h2>
          <p className="mt-2 text-sm text-(--txt-secondary)">
            Enable the Views feature in project settings to create and manage project views.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="-mt-(--padding-page) -mr-(--padding-page) -mb-(--padding-page) flex min-h-0 flex-1 flex-col">
        {favoriteActionError ? (
          <div className="mx-6 mt-3 rounded-md border border-(--border-danger) bg-(--bg-danger-subtle) px-3 py-2 text-sm text-(--txt-danger-primary)">
            {favoriteActionError}
          </div>
        ) : null}
        {noViewsAtAll ? (
          <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto px-8 py-10">
            <div className="w-full max-w-5xl">
              <h2 className="text-2xl font-semibold text-(--txt-primary)">
                Save filtered views for your project. Create as many as you need
              </h2>
              <p className="mt-2 max-w-4xl text-sm text-(--txt-secondary)">
                Views are a set of saved filters that you use frequently or want easy access to. All
                your colleagues in a project can see everyone&apos;s views and choose whichever
                suits their needs best.
              </p>
              <div className="mt-6 rounded-lg border border-(--border-subtle) bg-(--bg-layer-1) p-6">
                <div className="mx-auto flex h-80 w-full max-w-4xl items-center justify-center rounded-md border border-(--border-subtle) bg-(--bg-surface-1)">
                  <div className="space-y-3 text-center">
                    <div className="mx-auto h-12 w-12 rounded-md border border-(--border-subtle) bg-(--bg-layer-1)" />
                    <p className="text-sm text-(--txt-tertiary)">No project views yet</p>
                  </div>
                </div>
              </div>
              <div className="mt-7 flex justify-center">
                <Button size="sm" onClick={() => setCreateOpen(true)} disabled={!canCreateViews}>
                  Create your first view
                </Button>
              </div>
            </div>
          </div>
        ) : hasFilteredOutResults ? (
          <div className="flex min-h-0 flex-1 items-center justify-center px-8 py-10">
            <div className="max-w-lg text-center">
              <h3 className="text-lg font-semibold text-(--txt-primary)">
                No views match your filters
              </h3>
              <p className="mt-2 text-sm text-(--txt-secondary)">
                Try clearing or relaxing your search, created date, favorites, or created-by
                filters.
              </p>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="divide-y divide-(--border-subtle)">
              {sortedViews.map((v) => {
                const accessMeta = getViewAccessMeta(v);
                const filterCount = countSavedViewFilters(v);
                const filterLabel = filterCount === 1 ? '1 filter' : `${filterCount} filters`;
                const { label: creatorLabel, avatarSrc: creatorAvatarSrc } = resolveViewCreator(
                  members,
                  v,
                );
                const isFav =
                  typeof v.is_favorite === 'boolean' ? v.is_favorite : favoriteIds.includes(v.id);
                const isPublic = accessMeta?.tone === 'public';

                return (
                  <div
                    key={v.id}
                    className="group flex items-center justify-between gap-4 px-6 py-3.5 transition-colors duration-150 hover:bg-(--bg-layer-1-hover)"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <span className="shrink-0 text-(--txt-icon-tertiary)" aria-hidden>
                        <IconLayers className="size-4" />
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/${workspaceSlug}/projects/${projectId}/views/${v.id}`)
                        }
                        className="min-w-0 truncate text-left text-sm font-medium text-(--txt-primary) hover:underline"
                      >
                        {v.name}
                      </button>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
                      <span
                        className="pointer-events-none shrink-0 select-none rounded-full border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-0.5 text-[11px] font-medium text-(--txt-secondary) shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-opacity duration-150 max-sm:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                        title={filterLabel}
                      >
                        {filterLabel}
                      </span>
                      <span
                        className="shrink-0 text-(--txt-icon-tertiary)"
                        title={
                          isPublic
                            ? 'Public'
                            : accessMeta
                              ? accessMeta.tone === 'restricted'
                                ? 'Restricted'
                                : 'Private'
                              : 'Access'
                        }
                      >
                        {isPublic ? (
                          <IconGlobe className="size-4" strokeWidth={1.75} />
                        ) : (
                          <IconLock className="size-4" strokeWidth={1.75} />
                        )}
                      </span>
                      <span className="shrink-0" title={creatorLabel}>
                        <Avatar
                          name={creatorLabel}
                          src={creatorAvatarSrc}
                          size="sm"
                          className="size-6 ring-1 ring-(--border-subtle)"
                        />
                      </span>
                      <button
                        type="button"
                        className="inline-flex size-8 items-center justify-center rounded-md text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2-hover) hover:text-(--txt-icon-secondary)"
                        aria-label={isFav ? 'Unfavorite view' : 'Favorite view'}
                        onClick={(e) => {
                          e.stopPropagation();
                          void toggleFavorite(v.id);
                        }}
                      >
                        <IconStar filled={isFav} className="size-4.5" />
                      </button>
                      <Dropdown
                        id={`project-view-row-${v.id}`}
                        openId={viewMenuOpenId}
                        onOpen={setViewMenuOpenId}
                        label="View actions"
                        icon={<IconMoreVertical className="size-4" />}
                        displayValue=""
                        align="right"
                        triggerClassName="inline-flex size-8 items-center justify-center rounded-md text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2-hover) hover:text-(--txt-icon-secondary)"
                        triggerContent={
                          <>
                            <span className="sr-only">View actions</span>
                            <IconMoreVertical className="size-4" />
                          </>
                        }
                        panelClassName="min-w-[220px] overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)"
                      >
                        <button
                          type="button"
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                          onClick={() => {
                            setViewMenuOpenId(null);
                            openEdit(v);
                          }}
                        >
                          <IconPencil className="shrink-0 text-(--txt-icon-tertiary)" />
                          Edit
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                          onClick={() => {
                            setViewMenuOpenId(null);
                            window.open(
                              `/${workspaceSlug}/projects/${projectId}/views/${v.id}`,
                              '_blank',
                            );
                          }}
                        >
                          <IconExternalTab className="shrink-0 text-(--txt-icon-tertiary)" />
                          Open in new tab
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                          onClick={() => {
                            setViewMenuOpenId(null);
                            void copyViewLink(v.id);
                          }}
                        >
                          <IconLinkChain className="shrink-0 text-(--txt-icon-tertiary)" />
                          {copyingId === v.id ? 'Copied!' : 'Copy link'}
                        </button>
                        <button
                          type="button"
                          disabled={!canCreateViews || publishingId === v.id}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover) disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => {
                            setViewMenuOpenId(null);
                            void handleTogglePublish(v);
                          }}
                        >
                          <span className="inline-flex w-3.5 shrink-0 justify-center text-xs text-(--txt-icon-tertiary)">
                            ●
                          </span>
                          {publishingId === v.id ? 'Updating…' : v.anchor ? 'Unpublish' : 'Publish'}
                        </button>
                        <div className="my-0.5 h-px bg-(--border-subtle)" role="separator" />
                        <button
                          type="button"
                          disabled={!canCreateViews}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-(--txt-danger-primary) hover:bg-(--bg-layer-1-hover) disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => {
                            setViewMenuOpenId(null);
                            setDeleteOpenId(v.id);
                          }}
                        >
                          <IconTrash className="shrink-0" />
                          Delete
                        </button>
                      </Dropdown>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <Modal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setError(null);
        }}
        title="New view"
        className="max-w-lg"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCreateOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="project-create-view-form"
              disabled={submitting || !title.trim() || !canCreateViews}
            >
              {submitting ? 'Creating...' : 'Add view'}
            </Button>
          </>
        }
      >
        <form id="project-create-view-form" onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="View name"
            autoFocus
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
              className="w-full rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
            />
          </div>
          {error && <p className="text-sm text-(--txt-danger-primary)">{error}</p>}
        </form>
      </Modal>
      <Modal
        open={!!editOpenId}
        onClose={() => {
          setEditOpenId(null);
          setError(null);
        }}
        title="Edit view"
        className="max-w-lg"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditOpenId(null)}
              disabled={editing}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="project-edit-view-form"
              disabled={editing || !editTitle.trim()}
            >
              {editing ? 'Saving...' : 'Save changes'}
            </Button>
          </>
        }
      >
        <form id="project-edit-view-form" onSubmit={handleEdit} className="space-y-4">
          <Input
            label="Name"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="View name"
            autoFocus
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
              Description
            </label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
              className="w-full rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
            />
          </div>
          {error && <p className="text-sm text-(--txt-danger-primary)">{error}</p>}
        </form>
      </Modal>
      <Modal
        open={!!deleteOpenId}
        onClose={() => {
          setDeleteOpenId(null);
          setError(null);
        }}
        title="Delete view"
        className="max-w-md"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeleteOpenId(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleDelete()} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-(--txt-secondary)">
          Delete view{' '}
          <span className="font-medium text-(--txt-primary)">
            {deleteView?.name ?? 'this view'}
          </span>
          ? This action cannot be undone.
        </p>
        {error && <p className="mt-3 text-sm text-(--txt-danger-primary)">{error}</p>}
      </Modal>
    </>
  );
}
