import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArchiveRestore,
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  Check,
  ChevronDown,
  Copy,
  Earth,
  FileText,
  Filter,
  Info,
  ListFilter,
  Lock,
  MoreHorizontal,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { Avatar, Button, Modal, Tooltip } from '../components/ui';
import { workspaceService } from '../services/workspaceService';
import { projectService } from '../services/projectService';
import { pageService } from '../services/pageService';
import { useAuth } from '../contexts/AuthContext';
import { cn, getImageUrl } from '../lib/utils';
import { PROJECT_PAGES_CREATE_EVENT } from '../lib/projectPagesEvents';
import type {
  PageApiResponse,
  ProjectApiResponse,
  WorkspaceApiResponse,
  WorkspaceMemberApiResponse,
} from '../api/types';
import type { PageLogo } from '../components/page-editor';

type PageTab = 'public' | 'private' | 'archived';
type SortKey = 'updated_at' | 'created_at' | 'name';
type SortDir = 'asc' | 'desc';

const TABS: { key: PageTab; label: string }[] = [
  { key: 'public', label: 'Public' },
  { key: 'private', label: 'Private' },
  { key: 'archived', label: 'Archived' },
];

const SORT_LABELS: Record<SortKey, string> = {
  updated_at: 'Date modified',
  created_at: 'Date created',
  name: 'Name',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function pageLogoFrom(page: PageApiResponse): PageLogo | undefined {
  const props = page.logo_props as PageLogo | undefined;
  if (!props || props.in_use !== 'emoji' || !props.emoji?.value) return undefined;
  return props;
}

export function PagesPage() {
  const { workspaceSlug, projectId } = useParams<{
    workspaceSlug: string;
    projectId: string;
  }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tab, setTab] = useState<PageTab>('public');
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [members, setMembers] = useState<Map<string, WorkspaceMemberApiResponse>>(new Map());
  const [pages, setPages] = useState<PageApiResponse[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('updated_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterLocked, setFilterLocked] = useState(false);
  const [filterOwnedByMe, setFilterOwnedByMe] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createAccess, setCreateAccess] = useState<0 | 1>(0);
  const [creating, setCreating] = useState(false);

  const sortRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ----- Initial load ------------------------------------------------------
  useEffect(() => {
    if (!workspaceSlug || !projectId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const archived = tab === 'archived' ? 'archived' : 'inbox';
    Promise.all([
      workspaceService.getBySlug(workspaceSlug),
      projectService.get(workspaceSlug, projectId),
      pageService.list(workspaceSlug, { projectId, archived }),
      pageService.listFavoriteIds(workspaceSlug).catch(() => [] as string[]),
      workspaceService.listMembers(workspaceSlug).catch(() => [] as WorkspaceMemberApiResponse[]),
    ])
      .then(([w, p, list, favIds, memberList]) => {
        if (cancelled) return;
        setWorkspace(w ?? null);
        setProject(p ?? null);
        setPages(list ?? []);
        setFavoriteIds(new Set(favIds));
        const map = new Map<string, WorkspaceMemberApiResponse>();
        for (const m of memberList) map.set(m.member_id, m);
        setMembers(map);
      })
      .catch(() => {
        if (cancelled) return;
        setWorkspace(null);
        setProject(null);
        setPages([]);
        setFavoriteIds(new Set());
        setMembers(new Map());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, tab]);

  // ----- Click-outside dismissal -------------------------------------------
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (sortOpen && sortRef.current && !sortRef.current.contains(t)) setSortOpen(false);
      if (filterOpen && filterRef.current && !filterRef.current.contains(t)) setFilterOpen(false);
      if (openMenu && menuRef.current && !menuRef.current.contains(t)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [sortOpen, filterOpen, openMenu]);

  // ----- "Add page" event from the project sub-header ---------------------
  useEffect(() => {
    const handler = () => setShowCreate(true);
    window.addEventListener(PROJECT_PAGES_CREATE_EVENT, handler);
    return () => window.removeEventListener(PROJECT_PAGES_CREATE_EVENT, handler);
  }, []);

  // ----- Derived list ------------------------------------------------------
  const visible = useMemo(() => {
    let out = pages.slice();
    if (tab === 'public') out = out.filter((p) => p.access === 0);
    if (tab === 'private') out = out.filter((p) => p.access === 1);
    if (filterLocked) out = out.filter((p) => p.is_locked);
    if (filterOwnedByMe && user) out = out.filter((p) => p.owned_by_id === user.id);
    const q = search.trim().toLowerCase();
    if (q) out = out.filter((p) => (p.name ?? '').toLowerCase().includes(q));
    out.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'created_at':
          return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        case 'name':
          return dir * (a.name ?? '').localeCompare(b.name ?? '');
        case 'updated_at':
        default:
          return dir * (new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());
      }
    });
    return out;
  }, [pages, tab, filterLocked, filterOwnedByMe, user, search, sortKey, sortDir]);

  const totalFilters = (filterLocked ? 1 : 0) + (filterOwnedByMe ? 1 : 0);

  // ----- Actions -----------------------------------------------------------
  const reload = async () => {
    if (!workspaceSlug || !projectId) return;
    const archived = tab === 'archived' ? 'archived' : 'inbox';
    const list = await pageService.list(workspaceSlug, { projectId, archived });
    setPages(list ?? []);
  };

  const onToggleFavorite = async (pageId: string) => {
    if (!workspaceSlug) return;
    const isFav = favoriteIds.has(pageId);
    const next = new Set(favoriteIds);
    if (isFav) next.delete(pageId);
    else next.add(pageId);
    setFavoriteIds(next);
    try {
      if (isFav) await pageService.unfavorite(workspaceSlug, pageId);
      else await pageService.favorite(workspaceSlug, pageId);
    } catch {
      setFavoriteIds((prev) => {
        const r = new Set(prev);
        if (isFav) r.add(pageId);
        else r.delete(pageId);
        return r;
      });
    }
  };

  const onArchiveAction = async (pageId: string, currentlyArchived: boolean) => {
    if (!workspaceSlug) return;
    setOpenMenu(null);
    try {
      if (currentlyArchived) await pageService.unarchive(workspaceSlug, pageId);
      else await pageService.archive(workspaceSlug, pageId);
      await reload();
    } catch {
      // best-effort
    }
  };

  const onDuplicate = async (pageId: string) => {
    if (!workspaceSlug || !projectId) return;
    setOpenMenu(null);
    try {
      const dup = await pageService.duplicate(workspaceSlug, pageId);
      navigate(`/${workspaceSlug}/projects/${projectId}/pages/${dup.id}`);
    } catch {
      // best-effort
    }
  };

  const onDelete = async (pageId: string) => {
    if (!workspaceSlug) return;
    setOpenMenu(null);
    try {
      await pageService.delete(workspaceSlug, pageId);
      await reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      window.alert(message);
    }
  };

  const onCreate = async () => {
    if (!workspaceSlug || !projectId) return;
    setCreating(true);
    try {
      const created = await pageService.create(workspaceSlug, {
        name: createName.trim() || 'Untitled page',
        project_id: projectId,
        access: createAccess,
      });
      setShowCreate(false);
      setCreateName('');
      setCreateAccess(0);
      navigate(`/${workspaceSlug}/projects/${projectId}/pages/${created.id}`);
    } catch {
      // best-effort
    } finally {
      setCreating(false);
    }
  };

  // ----- Render ------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-(--txt-tertiary)">
        Loading…
      </div>
    );
  }
  if (!workspace || !project) {
    return <div className="text-(--txt-secondary)">Project not found.</div>;
  }

  const baseUrl = `/${workspace.slug}/projects/${project.id}`;
  const emptyMessage =
    tab === 'archived'
      ? 'Archived pages will land here. Archive a page from its detail view to declutter the active list.'
      : tab === 'private'
        ? 'No private pages yet. Pages you mark Private are visible only to you.'
        : 'No public pages yet. Create your first page to start documenting work alongside your team.';

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {/* Secondary header — the pages-list header.
       * Sits flush under the project sub-header so the sub-header's
       * bottom border doubles as this row's top border (a single 1px line).
       * Each tab is a full-height column so its accent underline aligns with
       * (and overrides) this row's `border-b`. */}
      <div className="flex shrink-0 items-stretch justify-between border-b border-(--border-subtle) bg-(--bg-canvas) px-(--padding-page)">
        <nav className="flex items-stretch" aria-label="Page visibility">
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setTab(t.key);
                  setOpenMenu(null);
                }}
                className="relative flex h-11 items-center px-4 text-[13px] font-medium transition-colors focus:outline-none"
                aria-current={active ? 'page' : undefined}
              >
                <span className={active ? 'text-(--txt-accent-primary)' : 'text-(--txt-secondary)'}>
                  {t.label}
                </span>
                {/* -bottom-px lets the accent underline replace the row's
                    `border-b` instead of stacking on top of it. */}
                <span
                  aria-hidden
                  className={cn(
                    'absolute right-0 -bottom-px left-0 h-0.5 rounded-t transition-colors',
                    active ? 'bg-(--brand-default)' : 'bg-transparent',
                  )}
                />
              </button>
            );
          })}
        </nav>
        <div className="flex items-center gap-2 py-2">
          {/* Search — collapses to an icon when empty. */}
          <div className="flex items-center">
            {searchOpen || search ? (
              <div className="flex h-8 w-64 items-center gap-2 rounded-md border border-(--border-subtle) bg-(--bg-canvas) px-2.5">
                <Search size={14} className="shrink-0 text-(--txt-icon-tertiary)" />
                <input
                  ref={searchInputRef}
                  autoFocus
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search pages"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      if (search) setSearch('');
                      else setSearchOpen(false);
                    }
                  }}
                  className="w-full border-0 bg-transparent text-[13px] text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setSearchOpen(false);
                  }}
                  className="grid place-items-center text-(--txt-tertiary) hover:text-(--txt-primary)"
                  aria-label="Close search"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <Tooltip content="Search">
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  aria-label="Search"
                  className="grid size-8 place-items-center rounded-md text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
                >
                  <Search size={14} />
                </button>
              </Tooltip>
            )}
          </div>

          {/* Sort dropdown */}
          <div ref={sortRef} className="relative">
            <button
              type="button"
              onClick={() => setSortOpen((v) => !v)}
              className="flex h-8 items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-canvas) px-2.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-1-hover)"
            >
              {sortDir === 'asc' ? (
                <ArrowUpWideNarrow size={12} />
              ) : (
                <ArrowDownWideNarrow size={12} />
              )}
              {SORT_LABELS[sortKey]}
            </button>
            {sortOpen ? (
              <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)">
                {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      setSortKey(k);
                      setSortOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                  >
                    {SORT_LABELS[k]}
                    {sortKey === k ? <Check size={12} className="text-(--txt-tertiary)" /> : null}
                  </button>
                ))}
                <hr className="my-1 border-(--border-subtle)" />
                <button
                  type="button"
                  onClick={() => setSortDir('asc')}
                  className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                >
                  Ascending
                  {sortDir === 'asc' ? <Check size={12} className="text-(--txt-tertiary)" /> : null}
                </button>
                <button
                  type="button"
                  onClick={() => setSortDir('desc')}
                  className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                >
                  Descending
                  {sortDir === 'desc' ? (
                    <Check size={12} className="text-(--txt-tertiary)" />
                  ) : null}
                </button>
              </div>
            ) : null}
          </div>

          {/* Filter dropdown */}
          <div ref={filterRef} className="relative">
            <button
              type="button"
              onClick={() => setFilterOpen((v) => !v)}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] font-medium transition-colors',
                totalFilters > 0
                  ? 'border-(--brand-default)/40 bg-(--brand-default)/10 text-(--txt-accent-primary)'
                  : 'border-(--border-subtle) bg-(--bg-canvas) text-(--txt-secondary) hover:bg-(--bg-layer-1-hover)',
              )}
            >
              <ListFilter size={12} />
              Filters
              {totalFilters > 0 ? (
                <span className="rounded-full bg-(--brand-default) px-1.5 py-0 text-[10px] leading-4 font-semibold text-white">
                  {totalFilters}
                </span>
              ) : (
                <ChevronDown size={12} />
              )}
            </button>
            {filterOpen ? (
              <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-2 shadow-(--shadow-raised)">
                <p className="mb-1 px-2 text-[11px] font-semibold tracking-wide text-(--txt-tertiary) uppercase">
                  Quick filters
                </p>
                <label className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)">
                  <input
                    type="checkbox"
                    checked={filterOwnedByMe}
                    onChange={(e) => setFilterOwnedByMe(e.target.checked)}
                  />
                  Owned by me
                </label>
                <label className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)">
                  <input
                    type="checkbox"
                    checked={filterLocked}
                    onChange={(e) => setFilterLocked(e.target.checked)}
                  />
                  Locked
                </label>
                {totalFilters > 0 ? (
                  <>
                    <hr className="my-1 border-(--border-subtle)" />
                    <button
                      type="button"
                      onClick={() => {
                        setFilterLocked(false);
                        setFilterOwnedByMe(false);
                      }}
                      className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-sm text-(--txt-secondary) hover:bg-(--bg-layer-1-hover)"
                    >
                      <Filter size={12} />
                      Clear filters
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Page list — edge-to-edge rows with `border-b` per row.
       * The tabs row above already paints a single bottom-border, so the
       * first row sits flush against it (no `border-t` on row 0). Each row
       * carries its own `border-b` so one 1px line separates every horizontal
       * section. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="grid place-items-center py-16 text-center">
            <div className="max-w-md space-y-2">
              <FileText size={36} className="mx-auto text-(--txt-icon-tertiary)" />
              <p className="text-sm text-(--txt-secondary)">{emptyMessage}</p>
              {tab !== 'archived' ? (
                <Button size="sm" variant="primary" onClick={() => setShowCreate(true)}>
                  <Plus size={14} /> Add page
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <ul>
            {visible.map((page) => {
              const isFav = favoriteIds.has(page.id);
              const isOwner = !!user && page.owned_by_id === user.id;
              const isArchivedRow = !!page.archived_at;
              const owner = members.get(page.owned_by_id);
              const ownerName = owner?.member_display_name ?? 'Unknown';
              const logo = pageLogoFrom(page);
              return (
                <li
                  key={page.id}
                  className="group relative flex items-center gap-3 border-b border-(--border-subtle) px-(--padding-page) py-2.5 transition-colors hover:bg-(--bg-layer-1-hover)"
                >
                  <Link
                    to={`${baseUrl}/pages/${page.id}`}
                    className="flex min-w-0 flex-1 items-center gap-2 no-underline"
                  >
                    <span className="grid size-5 shrink-0 place-items-center text-(--txt-icon-tertiary)">
                      {logo?.emoji?.value ? (
                        <span className="text-base leading-none">{logo.emoji.value}</span>
                      ) : (
                        <FileText size={14} />
                      )}
                    </span>
                    <span className="min-w-0 truncate text-[13px] font-medium text-(--txt-primary)">
                      {page.name || 'Untitled'}
                    </span>
                  </Link>

                  <div className="flex shrink-0 items-center gap-2 text-(--txt-icon-tertiary)">
                    <Tooltip content={`Owned by ${ownerName}`}>
                      {/* getImageUrl resolves the relative `/api/...` avatar
                          path against VITE_API_BASE_URL so it loads from the
                          API server in dev — same helper the modules page uses. */}
                      <Avatar
                        size="sm"
                        name={ownerName}
                        src={getImageUrl(owner?.member_avatar) ?? undefined}
                      />
                    </Tooltip>
                    <Tooltip content={page.access === 0 ? 'Public' : 'Private'}>
                      <span className="grid size-5 place-items-center">
                        {page.access === 0 ? <Earth size={14} /> : <Lock size={14} />}
                      </span>
                    </Tooltip>
                    <span aria-hidden className="h-4 w-px bg-(--border-subtle)" />
                    <Tooltip content={`Created ${formatDate(page.created_at)}`}>
                      <span className="grid size-5 place-items-center">
                        <Info size={14} />
                      </span>
                    </Tooltip>
                    <Tooltip content={isFav ? 'Remove from favorites' : 'Add to favorites'}>
                      <button
                        type="button"
                        onClick={() => void onToggleFavorite(page.id)}
                        className="grid size-7 place-items-center rounded hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
                        aria-label={isFav ? 'Unfavorite' : 'Favorite'}
                      >
                        {/* Amber matches the favorite star elsewhere
                            (modules / cycles) so favourite state reads the
                            same across the project surface. */}
                        <Star size={14} className={isFav ? 'fill-amber-500 text-amber-500' : ''} />
                      </button>
                    </Tooltip>
                    <button
                      type="button"
                      onClick={() => setOpenMenu((m) => (m === page.id ? null : page.id))}
                      aria-label="More options"
                      className="grid size-7 place-items-center rounded hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                    {openMenu === page.id ? (
                      <div
                        ref={menuRef}
                        className="absolute top-10 right-(--padding-page) z-10 w-44 rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)"
                      >
                        <button
                          type="button"
                          onClick={() => void onDuplicate(page.id)}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                        >
                          <Copy size={13} /> Make a copy
                        </button>
                        {isOwner ? (
                          <button
                            type="button"
                            onClick={() => void onArchiveAction(page.id, isArchivedRow)}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                          >
                            {isArchivedRow ? <ArchiveRestore size={13} /> : <Filter size={13} />}
                            {isArchivedRow ? 'Restore' : 'Archive'}
                          </button>
                        ) : null}
                        {isOwner && isArchivedRow ? (
                          <button
                            type="button"
                            onClick={() => void onDelete(page.id)}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-(--danger-default) hover:bg-(--danger-50)"
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {showCreate ? (
        <Modal open onClose={() => setShowCreate(false)} title="Create page">
          <div className="max-w-md space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">Title</label>
              <input
                autoFocus
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Untitled page"
                className="w-full rounded border border-(--border-subtle) bg-(--bg-canvas) px-3 py-1.5 text-sm text-(--txt-primary) placeholder:text-(--txt-tertiary) focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
                Visibility
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCreateAccess(0)}
                  className={cn(
                    'flex-1 rounded border px-3 py-1.5 text-sm',
                    createAccess === 0
                      ? 'border-(--brand-default) text-(--txt-primary)'
                      : 'border-(--border-subtle) text-(--txt-secondary)',
                  )}
                >
                  Public
                </button>
                <button
                  type="button"
                  onClick={() => setCreateAccess(1)}
                  className={cn(
                    'flex-1 rounded border px-3 py-1.5 text-sm',
                    createAccess === 1
                      ? 'border-(--brand-default) text-(--txt-primary)'
                      : 'border-(--border-subtle) text-(--txt-secondary)',
                  )}
                >
                  Private
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={creating}
                onClick={() => void onCreate()}
              >
                {creating ? 'Creating…' : 'Create'}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
