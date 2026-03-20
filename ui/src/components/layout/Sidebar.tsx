import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation, useParams } from 'react-router-dom';
import { workspaceService } from '../../services/workspaceService';
import { projectService } from '../../services/projectService';
import { favoriteService } from '../../services/favoriteService';
import type {
  WorkspaceApiResponse,
  ProjectApiResponse,
  ModuleApiResponse,
  IssueViewApiResponse,
} from '../../api/types';
import { CreateWorkItemModal } from '../CreateWorkItemModal';
import { Avatar, Button } from '../ui';
import { ProjectIconDisplay } from '../ProjectIconModal';
import { useAuth } from '../../contexts/AuthContext';
import { useFavorites } from '../../contexts/FavoritesContext';
import { cn, getImageUrl } from '../../lib/utils';
import { moduleService } from '../../services/moduleService';
import { viewService } from '../../services/viewService';
import { slugify } from '../../lib/slug';
import { ISSUE_VIEW_FAVORITES_CHANGED_EVENT } from '../../lib/issueViewFavoritesEvents';

const SIDEBAR_WIDTH = 256;
const SIDEBAR_WIDTH_COLLAPSED = 0;

// Icons (Devlane-style outline)
const IconPanelLeft = () => (
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
  >
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M9 3v18" />
  </svg>
);
const IconHome = () => (
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
  >
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);
const IconInbox = () => (
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
  >
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);
const IconUser = () => (
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
  >
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const IconBriefcase = () => (
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
  >
    <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);
const IconBarChart = () => (
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
  >
    <line x1="12" x2="12" y1="20" y2="10" />
    <line x1="18" x2="18" y1="20" y2="4" />
    <line x1="6" x2="6" y1="20" y2="16" />
  </svg>
);
const IconArchive = () => (
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
  >
    <rect width="20" height="5" x="2" y="3" rx="1" />
    <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
    <path d="M10 12h4" />
  </svg>
);
const IconSearch = () => (
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
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);
const IconPencil = () => (
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
  >
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </svg>
);
const IconChevronRight = ({ className }: { className?: string }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
);
const IconFileStack = () => (
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
  >
    <path d="M16 2v6h6" />
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7 10H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-2" />
    <path d="M17 2v4a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V2" />
  </svg>
);
const IconViewLayers = () => (
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
  >
    <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
    <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
    <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
  </svg>
);

function favoritedIssueViewHref(baseUrl: string, view: IssueViewApiResponse): string {
  if (view.project_id) {
    return `${baseUrl}/projects/${view.project_id}/views/${view.id}`;
  }
  return `${baseUrl}/views/${view.id}`;
}
const IconIterationCw = () => (
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
  >
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 21h5v-5" />
  </svg>
);
const IconLayers = () => (
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
  >
    <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
    <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
    <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
  </svg>
);
/** 2×2 grid — same glyph as project “Modules” nav (Plane-style module badge). */
const IconModuleGrid = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    className={cn('shrink-0', className ?? 'size-4')}
  >
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);
const IconFileText = () => (
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
  >
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M10 9H8" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
  </svg>
);
const IconHelp = () => (
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
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <path d="M12 17h.01" />
  </svg>
);
const IconBook = () => (
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
  >
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
  </svg>
);
const IconChevronDown = ({ className }: { className?: string }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);
const IconChevronUp = ({ className }: { className?: string }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <path d="m18 15-6-6-6 6" />
  </svg>
);
const IconCheck = () => (
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
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
const IconSettings = () => (
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
  >
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconUserPlus = () => (
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
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="19" x2="19" y1="8" y2="14" />
    <line x1="22" x2="16" y1="11" y2="11" />
  </svg>
);
const IconEnvelope = () => (
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
  >
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);
const IconLogOut = () => (
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
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" x2="9" y1="12" y2="12" />
  </svg>
);

const projectNavItems = [
  { key: 'issues', to: 'issues', label: 'Work items', Icon: IconFileStack },
  { key: 'cycles', to: 'cycles', label: 'Cycles', Icon: IconIterationCw },
  { key: 'modules', to: 'modules', label: 'Modules', Icon: IconModuleGrid },
  { key: 'views', to: 'views', label: 'Views', Icon: IconLayers },
  { key: 'pages', to: 'pages', label: 'Pages', Icon: IconFileText },
];

/** Pill + grid icon — matches the “Modules” category badge (not list progress rings). */
function SidebarFavoritedModuleBadge() {
  return (
    <span
      className="flex h-6 shrink-0 items-center justify-center rounded-md border border-(--border-subtle) bg-(--bg-layer-1) px-1.5 text-(--txt-icon-secondary) shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      aria-hidden
    >
      <IconModuleGrid className="size-3.5" />
    </span>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
    minWidth: number;
  } | null>(null);
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(new Set());
  const [workspaceSectionExpanded, setWorkspaceSectionExpanded] = useState(true);
  const [favoritesSectionExpanded, setFavoritesSectionExpanded] = useState(true);
  const [projectsSectionExpanded, setProjectsSectionExpanded] = useState(true);
  const [createWorkItemOpen, setCreateWorkItemOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceApiResponse[]>([]);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const { favoriteProjectIds, setFavoriteProjectIds } = useFavorites();
  const [favoriteModules, setFavoriteModules] = useState<
    Array<{ projectId: string; module: ModuleApiResponse }>
  >([]);
  const [moduleFavoritesNonce, setModuleFavoritesNonce] = useState(0);
  const [favoriteIssueViews, setFavoriteIssueViews] = useState<IssueViewApiResponse[]>([]);
  const [issueViewFavoritesNonce, setIssueViewFavoritesNonce] = useState(0);
  const workspaceTriggerRef = useRef<HTMLButtonElement>(null);
  const workspaceDropdownRef = useRef<HTMLDivElement>(null);

  const location = useLocation();
  const { workspaceSlug: paramsSlug, projectId } = useParams<{
    workspaceSlug?: string;
    projectId?: string;
  }>();
  // Derive workspace slug from URL when useParams doesn't provide it (e.g. parent route context)
  const pathSegment = location.pathname.match(/^\/([^/]+)/)?.[1];
  const slugFromPath =
    pathSegment && !['login', 'setup', 'instance-admin', 'auth'].includes(pathSegment)
      ? pathSegment
      : undefined;
  const workspaceSlug = paramsSlug ?? slugFromPath;
  const workspace = workspaces.find((w) => w.slug === workspaceSlug) ?? workspaces[0] ?? null;
  const baseUrl = workspaceSlug ? `/${workspaceSlug}` : workspace ? `/${workspace.slug}` : '';
  const favoriteProjects = projects.filter((p) => favoriteProjectIds.includes(p.id));

  const STORAGE_KEY_PREFIX = 'module_favorites';
  const storageKey = (workspaceId: string, projId: string) =>
    `${STORAGE_KEY_PREFIX}_${workspaceId}_${projId}`;

  const loadModuleFavoriteIds = useCallback((workspaceId: string, projId: string) => {
    try {
      const raw = localStorage.getItem(storageKey(workspaceId, projId));
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    workspaceService.list().then((list) => {
      if (!cancelled) setWorkspaces(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load projects for the current workspace (from URL slug or from workspace list when at root)
  const slugForProjects = workspaceSlug ?? workspace?.slug;
  useEffect(() => {
    if (!slugForProjects) {
      // Intentional: clear projects when workspace unmounts (kept for future use)

      setProjects([]);
      return;
    }
    let cancelled = false;
    projectService
      .list(slugForProjects)
      .then((list) => {
        if (!cancelled) setProjects(list);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [slugForProjects]);

  useEffect(() => {
    if (!workspaceSlug) {
      setFavoriteModules([]);
      return;
    }
    // Load starred modules from localStorage, then resolve names via module list.
    let cancelled = false;
    const run = async () => {
      const entries: Array<{ projectId: string; module: ModuleApiResponse }> = [];
      for (const proj of projects) {
        const favIds = loadModuleFavoriteIds(workspaceSlug, proj.id);
        if (!favIds.length) continue;
        const mods = await moduleService.list(workspaceSlug, proj.id);
        const favSet = new Set(favIds);
        for (const m of mods ?? []) {
          if (favSet.has(m.id)) {
            entries.push({ projectId: proj.id, module: m });
          }
        }
      }
      if (!cancelled) setFavoriteModules(entries);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projects, loadModuleFavoriteIds, moduleFavoritesNonce]);

  useEffect(() => {
    if (!workspaceSlug) {
      setFavoriteIssueViews([]);
      return;
    }
    let cancelled = false;
    void viewService
      .listFavorites(workspaceSlug)
      .then((list) => {
        if (!cancelled) setFavoriteIssueViews(list ?? []);
      })
      .catch(() => {
        if (!cancelled) setFavoriteIssueViews([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, issueViewFavoritesNonce]);

  useEffect(() => {
    if (!workspaceSlug) return;
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ workspaceSlug?: string }>;
      if (ce.detail?.workspaceSlug !== workspaceSlug) return;
      setIssueViewFavoritesNonce((n) => n + 1);
    };
    window.addEventListener(ISSUE_VIEW_FAVORITES_CHANGED_EVENT, handler as EventListener);
    return () => {
      window.removeEventListener(ISSUE_VIEW_FAVORITES_CHANGED_EVENT, handler as EventListener);
    };
  }, [workspaceSlug]);

  // Keep the "Favorites -> Modules" list in sync without requiring a full refresh.
  useEffect(() => {
    if (!workspaceSlug) return;
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{
        workspaceId?: string;
        projectId?: string;
        moduleId?: string;
        isFavorite?: boolean;
      }>;
      if (ce?.detail?.workspaceId !== workspaceSlug) return;
      const { moduleId, isFavorite } = ce.detail ?? {};

      // Optimistically remove immediately on un-favorite.
      if (moduleId && isFavorite === false) {
        setFavoriteModules((prev) => prev.filter(({ module }) => module.id !== moduleId));
      }

      // Always reload after a change to ensure names and newly-added items are correct.
      setModuleFavoritesNonce((n) => n + 1);
    };
    window.addEventListener('module-favorites-changed', handler as EventListener);
    return () => {
      window.removeEventListener('module-favorites-changed', handler as EventListener);
    };
  }, [workspaceSlug]);

  useEffect(() => {
    let cancelled = false;
    favoriteService
      .getFavoriteProjectIds()
      .then((ids) => {
        if (!cancelled) setFavoriteProjectIds(ids);
      })
      .catch(() => {
        if (!cancelled) setFavoriteProjectIds([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount; setFavoriteProjectIds is stable
  }, []);

  useEffect(() => {
    if (!baseUrl) return;
    const path = location.pathname;
    if (
      path === `${baseUrl}/projects` ||
      path === `${baseUrl}/views` ||
      path === `${baseUrl}/drafts` ||
      path === `${baseUrl}/archives` ||
      path.startsWith(`${baseUrl}/analytics`)
    ) {
      // Intentional: expand section when on relevant route (kept for future use)

      setWorkspaceSectionExpanded(true);
    }
    if (projectId && path.startsWith(`${baseUrl}/projects/`)) {
      setProjectsSectionExpanded(true);
    }
  }, [baseUrl, location.pathname, projectId]);

  useEffect(() => {
    if (!workspaceDropdownOpen) {
      // Intentional: clear position when dropdown closes (kept for future use)

      setDropdownPosition(null);
      return;
    }
    const updatePosition = () => {
      const el = workspaceTriggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        minWidth: rect.width,
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        workspaceTriggerRef.current?.contains(target) ||
        workspaceDropdownRef.current?.contains(target)
      )
        return;
      setWorkspaceDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [workspaceDropdownOpen]);

  const toggleProject = (id: string) => {
    setExpandedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const width = collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH;

  return (
    <>
      <div
        className="flex h-full shrink-0 flex-col border-r border-(--border-subtle) bg-(--bg-surface-1) transition-all duration-300 ease-in-out"
        style={{
          width: `${width}px`,
          minWidth: `${width}px`,
          maxWidth: `${width}px`,
        }}
        role="complementary"
        aria-label="Main sidebar"
      >
        <aside className="flex h-full w-full flex-col overflow-hidden bg-(--bg-surface-1)">
          {/* 1. Top: Workspace name (left, clickable) + User avatar (right) */}
          <div className="relative flex items-center justify-between gap-2 px-3 py-3">
            <button
              ref={workspaceTriggerRef}
              type="button"
              onClick={() => setWorkspaceDropdownOpen((o) => !o)}
              className="group flex min-w-0 flex-1 items-center gap-2 rounded-(--radius-md) py-0.5 text-left outline-none hover:bg-(--bg-layer-transparent-hover) focus-visible:outline-none"
              aria-expanded={workspaceDropdownOpen}
              aria-haspopup="true"
              aria-label="Workspace menu"
            >
              <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-(--radius-md) bg-(--bg-layer-1) text-sm font-semibold text-(--txt-secondary)">
                {workspace?.logo && getImageUrl(workspace.logo) ? (
                  <img
                    src={getImageUrl(workspace.logo)!}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  (workspace?.name ?? '—').slice(0, 2).toUpperCase()
                )}
              </div>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-(--txt-primary)">
                {workspace?.name ?? 'Loading…'}
              </span>
              <span
                className={cn(
                  'shrink-0 text-(--txt-icon-tertiary) transition-opacity',
                  workspaceDropdownOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                )}
                aria-hidden
              >
                {workspaceDropdownOpen ? <IconChevronUp /> : <IconChevronDown />}
              </span>
            </button>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                className="flex size-8 items-center justify-center rounded-(--radius-md) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-transparent-hover)"
                aria-label="Collapse sidebar"
              >
                <IconPanelLeft />
              </button>
              <Avatar name={user?.name ?? 'User'} src={getImageUrl(user?.avatarUrl)} size="sm" />
            </div>
          </div>

          {/* Workspace dropdown (portal) */}
          {workspaceDropdownOpen &&
            dropdownPosition &&
            createPortal(
              <div
                ref={workspaceDropdownRef}
                className="z-50 min-w-[280px] rounded-(--radius-lg) border border-(--border-subtle) bg-(--bg-surface-1) p-4 shadow-(--shadow-lg)"
                style={{
                  position: 'fixed',
                  top: dropdownPosition.top,
                  left: dropdownPosition.left,
                  minWidth: Math.max(dropdownPosition.minWidth, 280),
                  maxWidth: 320,
                }}
                role="menu"
                aria-label="Workspace menu"
              >
                <p className="mb-3 truncate text-sm text-(--txt-primary)">{user?.email}</p>
                <div className="mb-4 flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-(--border-subtle) bg-(--bg-layer-2) text-xs font-semibold uppercase tracking-wide text-(--txt-secondary)">
                    {workspace?.logo && getImageUrl(workspace.logo) ? (
                      <img
                        src={getImageUrl(workspace.logo)!}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      (workspace?.name ?? '—').slice(0, 2)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-(--txt-primary)">
                      {workspace?.name ?? '—'}
                    </p>
                    <p className="text-xs text-(--txt-tertiary)">Members</p>
                  </div>
                  <span className="shrink-0 text-(--txt-primary)" aria-hidden>
                    <IconCheck />
                  </span>
                </div>
                <div className="mb-3 flex gap-1.5">
                  <Link
                    to={baseUrl ? `${baseUrl}/settings` : '/settings'}
                    onClick={() => setWorkspaceDropdownOpen(false)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-layer-2) px-1.5 py-1.5 text-[12px] font-medium text-(--txt-primary) hover:bg-(--bg-layer-2-hover) whitespace-nowrap"
                  >
                    <IconSettings />
                    Settings
                  </Link>
                  <Link
                    to={baseUrl ? `${baseUrl}/settings?section=members` : '/settings'}
                    onClick={() => setWorkspaceDropdownOpen(false)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-layer-2) px-1.5 py-1.5 text-[12px] font-medium text-(--txt-primary) hover:bg-(--bg-layer-2-hover) whitespace-nowrap no-underline"
                  >
                    <IconUserPlus />
                    Invite members
                  </Link>
                </div>
                <div className="flex flex-col gap-0.5 border-t border-(--border-subtle) pt-3">
                  <Link
                    to={baseUrl ? `${baseUrl}/settings?section=members` : '/settings'}
                    onClick={() => setWorkspaceDropdownOpen(false)}
                    className="flex w-full items-center gap-2 rounded-(--radius-md) px-2 py-2 text-left text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-primary) no-underline"
                  >
                    <IconEnvelope />
                    Workspace invites
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setWorkspaceDropdownOpen(false);
                      logout();
                    }}
                    className="flex w-full items-center gap-2 rounded-(--radius-md) px-2 py-2 text-left text-[13px] font-medium text-(--txt-danger-primary) hover:bg-(--bg-danger-subtle) hover:text-(--txt-danger-primary)"
                  >
                    <IconLogOut />
                    Sign out
                  </button>
                </div>
              </div>,
              document.body,
            )}

          {/* 2. New work item + Search */}
          <div className="flex items-center gap-2 px-3 py-2">
            <Button
              variant="secondary"
              className="min-w-0 flex-1 justify-start gap-2 rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-1-hover)"
              onClick={() => setCreateWorkItemOpen(true)}
            >
              <IconPencil />
              <span className="truncate">New work item</span>
            </Button>
            <button
              type="button"
              className="flex size-9 shrink-0 items-center justify-center rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover)"
              aria-label="Search"
            >
              <IconSearch />
            </button>
          </div>

          {/* Scrollable area: primary nav, workspace, favorites, projects */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {/* 3. Primary nav: Home, Inbox, Your work */}
            <div className="flex flex-col gap-0.5 px-2 py-2">
              <NavLink
                to={baseUrl || (workspace ? `/${workspace.slug}` : '/')}
                end
                className={({ isActive }) =>
                  cn(
                    'flex w-full items-center gap-2 rounded-(--radius-md) px-2 py-1.5 text-[13px] font-medium outline-none transition-colors',
                    isActive
                      ? 'bg-(--bg-accent-subtle) text-(--txt-accent-primary)'
                      : 'text-(--txt-secondary) hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-primary)',
                  )
                }
              >
                <span
                  className={cn(
                    'flex size-4 shrink-0 items-center justify-center',
                    'text-(--txt-icon-tertiary)',
                  )}
                >
                  <IconHome />
                </span>
                Home
              </NavLink>
              <NavLink
                to={baseUrl ? `${baseUrl}/notifications` : '/'}
                end
                className={({ isActive }) =>
                  cn(
                    'flex w-full items-center gap-2 rounded-(--radius-md) px-2 py-1.5 text-[13px] font-medium outline-none transition-colors',
                    isActive
                      ? 'bg-(--bg-accent-subtle) text-(--txt-accent-primary)'
                      : 'text-(--txt-secondary) hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-primary)',
                  )
                }
              >
                <span className="flex size-4 shrink-0 items-center justify-center text-(--txt-icon-tertiary)">
                  <IconInbox />
                </span>
                Inbox
              </NavLink>
              <NavLink
                to={baseUrl && user ? `${baseUrl}/profile/${user.id}` : baseUrl || '/'}
                end
                className={({ isActive }) =>
                  cn(
                    'flex w-full items-center gap-2 rounded-(--radius-md) px-2 py-1.5 text-[13px] font-medium outline-none transition-colors',
                    isActive
                      ? 'bg-(--bg-accent-subtle) text-(--txt-accent-primary)'
                      : 'text-(--txt-secondary) hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-primary)',
                  )
                }
              >
                <span className="flex size-4 shrink-0 items-center justify-center text-(--txt-icon-tertiary)">
                  <IconUser />
                </span>
                Your work
              </NavLink>
            </div>

            {/* 4. Workspace section (collapsible) */}
            <div className="flex flex-col gap-0.5 px-2 pt-2 pb-1">
              <button
                type="button"
                onClick={() => setWorkspaceSectionExpanded((e) => !e)}
                className="group flex w-full items-center justify-between gap-2 rounded-(--radius-md) px-2 py-1.5 text-left text-[11px] font-medium uppercase tracking-wide text-(--txt-placeholder) outline-none hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-secondary)"
                aria-expanded={workspaceSectionExpanded}
              >
                <span>Workspace</span>
                <span className="flex size-4 shrink-0 items-center justify-center opacity-0 transition-[opacity,transform] duration-150 group-hover:opacity-100">
                  <IconChevronRight
                    className={cn(
                      'text-(--txt-icon-tertiary)',
                      workspaceSectionExpanded && 'rotate-90',
                    )}
                  />
                </span>
              </button>
              {workspaceSectionExpanded && (
                <div className="flex flex-col gap-0.5 pl-1">
                  <NavLink
                    to={baseUrl ? `${baseUrl}/projects` : '/'}
                    end
                    className={({ isActive }) =>
                      cn(
                        'flex w-full items-center gap-2 rounded-(--radius-md) px-2 py-1.5 text-[13px] font-medium outline-none transition-colors',
                        isActive
                          ? 'bg-(--bg-accent-subtle) text-(--txt-accent-primary)'
                          : 'text-(--txt-secondary) hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-primary)',
                      )
                    }
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center text-(--txt-icon-tertiary)">
                      <IconBriefcase />
                    </span>
                    Projects
                  </NavLink>
                  <NavLink
                    to={baseUrl ? `${baseUrl}/views/all-issues` : '/'}
                    className={({ isActive }) =>
                      cn(
                        'flex w-full items-center gap-2 rounded-(--radius-md) px-2 py-1.5 text-[13px] font-medium outline-none transition-colors',
                        isActive || location.pathname.startsWith(`${baseUrl}/views`)
                          ? 'bg-(--bg-accent-subtle) text-(--txt-accent-primary)'
                          : 'text-(--txt-secondary) hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-primary)',
                      )
                    }
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center text-(--txt-icon-tertiary)">
                      <IconLayers />
                    </span>
                    Views
                  </NavLink>
                  <NavLink
                    to={baseUrl ? `${baseUrl}/analytics` : '/'}
                    end={false}
                    className={({ isActive }) =>
                      cn(
                        'flex w-full items-center gap-2 rounded-(--radius-md) px-2 py-1.5 text-[13px] font-medium outline-none transition-colors',
                        isActive
                          ? 'bg-(--bg-accent-subtle) text-(--txt-accent-primary)'
                          : 'text-(--txt-secondary) hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-primary)',
                      )
                    }
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center text-(--txt-icon-tertiary)">
                      <IconBarChart />
                    </span>
                    Analytics
                  </NavLink>
                  <NavLink
                    to={baseUrl ? `${baseUrl}/drafts` : '/'}
                    end
                    className={({ isActive }) =>
                      cn(
                        'flex w-full items-center gap-2 rounded-(--radius-md) px-2 py-1.5 text-[13px] font-medium outline-none transition-colors',
                        isActive
                          ? 'bg-(--bg-accent-subtle) text-(--txt-accent-primary)'
                          : 'text-(--txt-secondary) hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-primary)',
                      )
                    }
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center text-(--txt-icon-tertiary)">
                      <IconPencil />
                    </span>
                    Drafts
                  </NavLink>
                  <NavLink
                    to={baseUrl ? `${baseUrl}/archives` : '/'}
                    end
                    className={({ isActive }) =>
                      cn(
                        'flex w-full items-center gap-2 rounded-(--radius-md) px-2 py-1.5 text-[13px] font-medium outline-none transition-colors',
                        isActive
                          ? 'bg-(--bg-accent-subtle) text-(--txt-accent-primary)'
                          : 'text-(--txt-secondary) hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-primary)',
                      )
                    }
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center text-(--txt-icon-tertiary)">
                      <IconArchive />
                    </span>
                    Archives
                  </NavLink>
                </div>
              )}
            </div>

            {/* 6. Favorites section (collapsible) */}
            <div className="flex flex-col gap-0.5 px-2 pt-3 pb-1">
              <button
                type="button"
                onClick={() => setFavoritesSectionExpanded((e) => !e)}
                className="group flex w-full items-center justify-between gap-2 rounded-(--radius-md) px-2 py-1.5 text-left text-[11px] font-medium uppercase tracking-wide text-(--txt-placeholder) outline-none hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-secondary)"
                aria-expanded={favoritesSectionExpanded}
              >
                <span>Favorites</span>
                <span className="flex size-4 shrink-0 items-center justify-center opacity-0 transition-[opacity,transform] duration-150 group-hover:opacity-100">
                  <IconChevronRight
                    className={cn(
                      'text-(--txt-icon-tertiary)',
                      favoritesSectionExpanded && 'rotate-90',
                    )}
                  />
                </span>
              </button>
              {favoritesSectionExpanded && (
                <div className="flex flex-col gap-0.5 pl-1 py-1">
                  {favoriteProjects.map((project) => (
                    <Link
                      key={project.id}
                      to={`${baseUrl}/projects/${project.id}`}
                      className="flex w-full items-center gap-2 rounded-(--radius-md) px-2 py-1.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-primary)"
                    >
                      <div className="flex size-5 shrink-0 items-center justify-center rounded-sm bg-(--bg-layer-1) text-(--txt-tertiary)">
                        <ProjectIconDisplay
                          emoji={project.emoji}
                          icon_prop={project.icon_prop}
                          size={14}
                          className="leading-none"
                        />
                      </div>
                      <span className="truncate">{project.name}</span>
                    </Link>
                  ))}
                  {favoriteIssueViews.map((view) => (
                    <Link
                      key={view.id}
                      to={favoritedIssueViewHref(baseUrl, view)}
                      className="flex w-full items-center gap-2 rounded-(--radius-md) px-2 py-1.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-primary)"
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center text-(--txt-icon-tertiary)">
                        <IconViewLayers />
                      </span>
                      <span className="truncate">{view.name}</span>
                    </Link>
                  ))}
                  {favoriteModules.length > 0 && (
                    <>
                      {favoriteModules.map(({ projectId, module }) => (
                        <Link
                          key={`${projectId}:${module.id}`}
                          to={`${baseUrl}/projects/${projectId}/modules/${slugify(module.name)}`}
                          className="flex w-full items-center gap-2 rounded-(--radius-md) px-2 py-1.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-primary)"
                        >
                          <SidebarFavoritedModuleBadge />
                          <div className="min-w-0 flex-1">
                            <span className="truncate">{module.name}</span>
                          </div>
                        </Link>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 7. Projects section (collapsible) */}
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex flex-col gap-0.5 px-2 pt-2 pb-1">
                <button
                  type="button"
                  onClick={() => setProjectsSectionExpanded((e) => !e)}
                  className="group flex w-full items-center justify-between gap-2 rounded-(--radius-md) px-2 py-1.5 text-left text-[11px] font-medium uppercase tracking-wide text-(--txt-placeholder) outline-none hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-secondary)"
                  aria-expanded={projectsSectionExpanded}
                >
                  <span>Projects</span>
                  <span className="flex size-4 shrink-0 items-center justify-center opacity-0 transition-[opacity,transform] duration-150 group-hover:opacity-100">
                    <IconChevronRight
                      className={cn(
                        'text-(--txt-icon-tertiary)',
                        projectsSectionExpanded && 'rotate-90',
                      )}
                    />
                  </span>
                </button>
              </div>
              {projectsSectionExpanded && (
                <div className="flex flex-col gap-0.5 px-2 py-1 pb-2">
                  {projects.map((project) => {
                    const isExpanded =
                      expandedProjectIds.has(project.id) || projectId === project.id;
                    const projectUrl = `${baseUrl}/projects/${project.id}`;
                    return (
                      <div key={project.id} className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => toggleProject(project.id)}
                          className="group flex w-full items-center justify-between gap-2 rounded-(--radius-md) px-1.5 py-1.5 text-left text-[13px] font-medium text-(--txt-secondary) outline-none hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-primary)"
                          aria-expanded={isExpanded}
                        >
                          <span className="flex min-w-0 flex-1 items-center gap-2">
                            <div className="flex size-5 shrink-0 items-center justify-center rounded-sm bg-(--bg-layer-1) text-(--txt-tertiary)">
                              <ProjectIconDisplay
                                emoji={project.emoji}
                                icon_prop={project.icon_prop}
                                size={14}
                                className="leading-none"
                              />
                            </div>
                            <span className="truncate">{project.name}</span>
                          </span>
                          <span className="flex size-5 shrink-0 items-center justify-center opacity-0 transition-[opacity,transform] duration-150 group-hover:opacity-100">
                            <IconChevronRight
                              className={cn(
                                'text-(--txt-icon-tertiary)',
                                isExpanded && 'rotate-90',
                              )}
                            />
                          </span>
                        </button>
                        {isExpanded && (
                          <div className="ml-5 flex flex-col gap-0.5 border-l border-(--border-subtle) pl-2">
                            {projectNavItems.map(({ key, to, label, Icon }) => (
                              <NavLink
                                key={key}
                                to={`${projectUrl}/${to}`}
                                className={({ isActive }) =>
                                  cn(
                                    'flex w-full items-center gap-2 rounded-(--radius-md) px-2 py-1 text-[13px] font-medium outline-none',
                                    isActive
                                      ? 'bg-(--bg-layer-transparent-active) text-(--txt-primary)'
                                      : 'text-(--txt-secondary) hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-primary)',
                                  )
                                }
                              >
                                <span className="flex size-4 shrink-0 items-center justify-center text-(--txt-icon-tertiary)">
                                  <Icon />
                                </span>
                                {label}
                              </NavLink>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 8. Footer: Community + Help + Settings */}
          <div className="flex items-center justify-between gap-2 border-t border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2.5">
            {/* <Button
              variant="secondary"
              size="sm"
              className="rounded-full px-3 text-[12px] font-medium text-(--txt-accent-primary)"
            >
              Community
            </Button> */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                className="flex size-8 items-center justify-center rounded-(--radius-md) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-icon-secondary)"
                aria-label="Help"
              >
                <IconHelp />
              </button>
              <Link
                to={baseUrl ? `${baseUrl}/settings` : '/settings'}
                className="flex size-8 items-center justify-center rounded-(--radius-md) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-icon-secondary)"
                aria-label="Settings"
              >
                <IconBook />
              </Link>
            </div>
          </div>
        </aside>
      </div>

      {collapsed && (
        <div
          className="flex shrink-0 flex-col items-center border-r border-(--border-subtle) bg-(--bg-surface-1) py-3"
          style={{ width: '48px', minWidth: '48px' }}
        >
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="flex size-8 items-center justify-center rounded-(--radius-md) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-transparent-hover)"
            aria-label="Expand sidebar"
          >
            <span className="rotate-180">
              <IconPanelLeft />
            </span>
          </button>
        </div>
      )}
      <CreateWorkItemModal
        open={createWorkItemOpen}
        onClose={() => setCreateWorkItemOpen(false)}
        workspaceSlug={workspace?.slug ?? ''}
        projects={projects}
      />
    </>
  );
}
