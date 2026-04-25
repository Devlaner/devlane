import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Avatar } from '../components/ui';
import { CreateProjectModal } from '../components/CreateProjectModal';
import { ProjectIconDisplay } from '../components/ProjectIconModal';
import { getImageUrl } from '../lib/utils';
import { workspaceService } from '../services/workspaceService';
import { projectService } from '../services/projectService';
import { favoriteService } from '../services/favoriteService';
import { useFavorites } from '../contexts/FavoritesContext';
import { useAuth } from '../contexts/AuthContext';
import { parseProjectsListSearchParams } from '../lib/projectsListSearchParams';
import type { WorkspaceApiResponse, ProjectApiResponse } from '../api/types';

const MAX_AVATARS = 3;

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

const IconStar = ({ filled }: { filled: boolean }) => (
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
    className={filled ? 'text-amber-400' : ''}
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

function getCoverGradient(projectId: string): string {
  const n = projectId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const hues = ['220', '260', '160', '30', '340'];
  const hue = hues[n % hues.length];
  return `linear-gradient(135deg, hsl(${hue}, 45%, 35%) 0%, hsl(${hue}, 55%, 25%) 100%)`;
}

export function ProjectsListPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { user: authUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    searchQuery,
    accessFilters,
    leadFilters,
    memberFilters,
    myProjectsOnly,
    sortField,
    sortDir,
    createdDateFilter,
    createdAfter,
    createdBefore,
    favoritesOnly,
  } = parseProjectsListSearchParams(searchParams);
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [allProjects, setAllProjects] = useState<ProjectApiResponse[]>([]);
  const [membersByProject, setMembersByProject] = useState<Record<string, string[]>>({});
  const { favoriteProjectIds, setFavoriteProjectIds } = useFavorites();
  const [favoriteRequestInFlight, setFavoriteRequestInFlight] = useState<Record<string, boolean>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const createProjectOpen = searchParams.get('createProject') === '1';

  const closeCreateModal = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('createProject');
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (!workspaceSlug) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    workspaceService
      .getBySlug(workspaceSlug)
      .then((w) => {
        if (cancelled) return;
        setWorkspace(w);
        return projectService.list(workspaceSlug);
      })
      .then((list) => {
        if (!cancelled && list) setAllProjects(list);
      })
      .catch(() => {
        if (!cancelled) setWorkspace(null);
        setAllProjects([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  useEffect(() => {
    if (!workspaceSlug) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setFavoriteProjectIds stable; run when workspaceSlug changes
  }, [workspaceSlug]);

  const toggleFavorite = (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!workspace?.slug) return;
    if (favoriteRequestInFlight[projectId]) return;
    const isFav = favoriteProjectIds.includes(projectId);
    setFavoriteRequestInFlight((prev) => ({ ...prev, [projectId]: true }));
    setFavoriteProjectIds((prev) =>
      isFav ? prev.filter((id) => id !== projectId) : [...prev, projectId],
    );
    (isFav
      ? favoriteService.removeFavorite(workspace.slug, projectId)
      : favoriteService.addFavorite(workspace.slug, projectId)
    )
      .catch(() =>
        setFavoriteProjectIds((prev) =>
          isFav ? [...prev, projectId] : prev.filter((id) => id !== projectId),
        ),
      )
      .finally(() => {
        setFavoriteRequestInFlight((prev) => {
          const { [projectId]: _removed, ...rest } = prev; // eslint-disable-line @typescript-eslint/no-unused-vars -- intentionally omit key
          return rest;
        });
      });
  };

  useEffect(() => {
    if (!workspaceSlug || allProjects.length === 0) {
      setMembersByProject({});
      return;
    }
    let cancelled = false;
    Promise.all(
      allProjects.map((p) =>
        projectService
          .listMembers(workspaceSlug, p.id)
          .then((members) => ({
            projectId: p.id,
            memberIds: (members ?? []).map((m) => m.member_id).filter(Boolean) as string[],
          }))
          .catch(() => ({ projectId: p.id, memberIds: [] as string[] })),
      ),
    ).then((rows) => {
      if (cancelled) return;
      const next: Record<string, string[]> = {};
      rows.forEach((r) => {
        next[r.projectId] = r.memberIds;
      });
      setMembersByProject(next);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, allProjects]);

  const projectOrderById = new Map(allProjects.map((p, index) => [p.id, index]));

  const filteredProjects = allProjects
    .filter((p) => {
      if (!searchQuery) return true;
      return (
        p.name.toLowerCase().includes(searchQuery) ||
        p.identifier?.toLowerCase().includes(searchQuery) ||
        p.description?.toLowerCase().includes(searchQuery)
      );
    })
    .filter((p) => (favoritesOnly ? favoriteProjectIds.includes(p.id) : true))
    .filter((p) => {
      if (accessFilters.length === 0) return true;
      const accessValue: 'private' | 'public' = p.guest_view_all_features ? 'public' : 'private';
      return accessFilters.includes(accessValue);
    })
    .filter((p) => {
      if (leadFilters.length === 0) return true;
      return !!p.project_lead_id && leadFilters.includes(p.project_lead_id);
    })
    .filter((p) => {
      if (memberFilters.length === 0) return true;
      const memberIds = membersByProject[p.id] ?? [];
      return memberFilters.some(
        (memberId) => memberIds.includes(memberId) || p.project_lead_id === memberId,
      );
    })
    .filter((p) => {
      if (!myProjectsOnly || !authUser) return true;
      const memberIds = membersByProject[p.id] ?? [];
      return memberIds.includes(authUser.id) || p.project_lead_id === authUser.id;
    })
    .filter((p) => {
      const createdAtMs = Date.parse(p.created_at ?? '');
      if (!Number.isFinite(createdAtMs)) return false;
      if (!createdDateFilter) return true;
      const now = new Date();
      if (createdDateFilter === 'today') {
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        return createdAtMs >= startOfDay.getTime();
      }
      if (createdDateFilter === 'custom') {
        const afterMs = createdAfter ? Date.parse(createdAfter) : NaN;
        const beforeMs = createdBefore ? Date.parse(createdBefore) : NaN;
        if (!Number.isFinite(afterMs) || !Number.isFinite(beforeMs)) return true;
        return createdAtMs >= afterMs && createdAtMs <= beforeMs + (24 * 60 * 60 * 1000 - 1);
      }
      const days = createdDateFilter === 'last7' ? 7 : 30;
      const threshold = now.getTime() - days * 24 * 60 * 60 * 1000;
      return createdAtMs >= threshold;
    });

  const projects = filteredProjects
    .map((project) => ({
      project,
      createdAtMs: Date.parse(project.created_at ?? '') || 0,
      membersCount: new Set([
        ...(membersByProject[project.id] ?? []),
        ...(project.project_lead_id ? [project.project_lead_id] : []),
      ]).size,
    }))
    .sort((a, b) => {
      let result = 0;
      switch (sortField) {
        case 'name':
          result = a.project.name.localeCompare(b.project.name);
          break;
        case 'member_count':
          result = a.membersCount - b.membersCount;
          break;
        case 'manual':
          result =
            (projectOrderById.get(a.project.id) ?? 0) - (projectOrderById.get(b.project.id) ?? 0);
          break;
        case 'created_date':
        default:
          result = a.createdAtMs - b.createdAtMs;
          break;
      }
      if (sortField === 'manual') return result;
      return sortDir === 'desc' ? -result : result;
    })
    .map(({ project }) => project);

  const hasActiveFiltersOrSearch =
    !!searchQuery ||
    favoritesOnly ||
    accessFilters.length > 0 ||
    leadFilters.length > 0 ||
    memberFilters.length > 0 ||
    !!createdDateFilter ||
    myProjectsOnly;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-(--txt-tertiary)">
        Loading…
      </div>
    );
  }
  if (!workspace) {
    return <div className="text-(--txt-secondary)">Workspace not found.</div>;
  }

  const baseUrl = `/${workspace.slug}`;

  return (
    <div className="space-y-6 pb-8">
      <CreateProjectModal
        open={createProjectOpen}
        onClose={closeCreateModal}
        workspaceSlug={workspace.slug}
        onSuccess={(project) => {
          setAllProjects((prev) => [...prev, project]);
          closeCreateModal();
        }}
      />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => {
          const memberIds = membersByProject[project.id] ?? [];
          const visibleMembers: Array<{
            id: string;
            name: string;
            avatarUrl?: string | null;
          }> = memberIds
            .slice(0, MAX_AVATARS)
            .map((id) => ({ id, name: id.slice(0, 8), avatarUrl: null }));
          const extraCount = Math.max(0, memberIds.length - visibleMembers.length);

          const coverUrl = getImageUrl(project.cover_image);
          return (
            <div
              key={project.id}
              className="overflow-hidden rounded-xl bg-(--bg-surface-1) shadow-sm"
            >
              <Link to={`${baseUrl}/projects/${project.id}/issues`} className="block no-underline">
                {/* Cover image */}
                <div
                  className="relative h-32 w-full shrink-0 rounded-t-xl overflow-hidden"
                  style={
                    coverUrl
                      ? {
                          backgroundImage: `url(${coverUrl})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }
                      : { background: getCoverGradient(project.id) }
                  }
                >
                  {/* Star favorite (right side, vertically centered) */}
                  <button
                    type="button"
                    onClick={(e) => toggleFavorite(e, project.id)}
                    disabled={favoriteRequestInFlight[project.id]}
                    className="absolute right-3 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/30 backdrop-blur-sm text-white shadow-sm hover:bg-white/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 disabled:opacity-60 disabled:pointer-events-none"
                    aria-label={
                      favoriteProjectIds.includes(project.id)
                        ? 'Remove from favorites'
                        : 'Add to favorites'
                    }
                  >
                    <IconStar filled={favoriteProjectIds.includes(project.id)} />
                  </button>
                  {/* Overlay: icon + name + identifier, inside cover, no border */}
                  <div className="absolute bottom-4 left-4 z-10 flex items-center gap-3 px-1 py-1">
                    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/15 backdrop-blur-sm">
                      <ProjectIconDisplay
                        emoji={project.emoji}
                        icon_prop={project.icon_prop}
                        size={22}
                      />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white drop-shadow-sm">
                        {project.name}
                      </p>
                      <p className="truncate text-xs text-white/90 drop-shadow-sm">
                        {project.identifier ?? project.id.slice(0, 8)}
                      </p>
                    </div>
                  </div>
                </div>
                {/* Description */}
                <div className="px-4 py-3">
                  <p className="line-clamp-2 text-sm text-(--txt-secondary)">
                    {project.description || 'No description'}
                  </p>
                </div>
              </Link>
              {/* Bottom: avatars + settings */}
              <div className="flex items-center justify-between gap-2 px-4 py-3">
                <Link
                  to={`${baseUrl}/projects/${project.id}/issues`}
                  className="flex min-w-0 flex-1 -space-x-2 no-underline"
                >
                  {visibleMembers.length === 0 ? (
                    <span className="text-xs text-(--txt-tertiary)">No members</span>
                  ) : (
                    <>
                      {visibleMembers.map((user) => (
                        <Avatar
                          key={user.id}
                          name={user.name}
                          src={user.avatarUrl}
                          size="sm"
                          className="h-7 w-7 border-2 border-(--bg-surface-1) text-[10px]"
                        />
                      ))}
                      {extraCount > 0 && (
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-(--bg-surface-1) bg-(--bg-layer-2) text-[10px] font-medium text-(--txt-secondary)"
                          title={`${extraCount} more`}
                        >
                          +{extraCount}
                        </span>
                      )}
                    </>
                  )}
                </Link>
                <Link
                  to={`${baseUrl}/settings/projects/${project.id}`}
                  className="flex size-8 shrink-0 items-center justify-center rounded-(--radius-md) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
                  aria-label="Project settings"
                >
                  <IconSettings />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
      {projects.length === 0 && (
        <p className="text-sm text-(--txt-tertiary)">
          {hasActiveFiltersOrSearch
            ? searchQuery
              ? 'No results match your search'
              : 'No projects match the selected filters.'
            : 'No projects yet.'}
        </p>
      )}
    </div>
  );
}
