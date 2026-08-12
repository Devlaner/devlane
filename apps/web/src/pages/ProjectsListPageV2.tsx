import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Settings2, Star } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/shadcn/ui/avatar';
import { Badge } from '@/components/shadcn/ui/badge';
import { Button } from '@/components/shadcn/ui/button';
import { Card, CardContent, CardFooter } from '@/components/shadcn/ui/card';
import { Skeleton } from '@/components/shadcn/ui/skeleton';
import { CreateProjectDialog } from '@/components/shadcn/create-project-dialog';
import { ProjectIconDisplay } from '../components/ProjectIconModal';
import { getImageUrl } from '../lib/utils';
import { workspaceService } from '../services/workspaceService';
import { projectService } from '../services/projectService';
import { favoriteService } from '../services/favoriteService';
import { useFavorites } from '../contexts/FavoritesContext';
import { useAuth } from '../contexts/AuthContext';
import { filterProjectsList } from '../lib/filterProjectsList';
import { parseProjectsListSearchParams } from '../lib/projectsListSearchParams';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import type {
  WorkspaceApiResponse,
  ProjectApiResponse,
  WorkspaceMemberApiResponse,
} from '../api/types';

const MAX_AVATARS = 3;

/* Projects with no cover image get a deterministic gradient, so the same
   project always draws the same one. Mirrors the shipped page. */
function getCoverGradient(projectId: string): string {
  const n = projectId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const hues = ['220', '260', '160', '30', '340'];
  const hue = hues[n % hues.length];
  return `linear-gradient(135deg, hsl(${hue}, 45%, 35%) 0%, hsl(${hue}, 55%, 25%) 100%)`;
}

/**
 * Design preview of the projects list, built from shadcn primitives. It stands
 * alongside ProjectsListPage rather than replacing it, so the two can be
 * compared side by side.
 *
 * The data loading and favourite toggling mirror the shipped page. The search,
 * filter and sort controls live in the shell's header (ProjectsToolbar); this
 * page only reads the state they write into the URL.
 */
export function ProjectsListPageV2() {
  const { t } = useTranslation();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { favoriteProjectIds, setFavoriteProjectIds } = useFavorites();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  /* The "new project" button lives in the shell's header, so the dialog is
     opened through the URL rather than through state this page owns. */
  const createOpen = searchParams.get('createProject') === '1';
  const setCreateOpen = (open: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (open) next.set('createProject', '1');
    else next.delete('createProject');
    setSearchParams(next, { replace: true });
  };

  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [allProjects, setAllProjects] = useState<ProjectApiResponse[]>([]);
  const [membersByProject, setMembersByProject] = useState<Record<string, string[]>>({});
  /* Project membership comes back as bare ids, so the workspace roster is
     loaded alongside it to put a name and avatar on each one. */
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [pendingFavorites, setPendingFavorites] = useState<Record<string, boolean>>({});
  /* With no slug in the URL there is nothing to fetch, so the initial state is
     already the final one rather than something an effect has to correct. */
  const [loading, setLoading] = useState(() => !!workspaceSlug);

  useDocumentTitle(t('projects.documentTitle', 'Projects'));

  useEffect(() => {
    if (!workspaceSlug) return;
    let cancelled = false;
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
        if (cancelled) return;
        setWorkspace(null);
        setAllProjects([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    workspaceService
      .listMembers(workspaceSlug)
      .then((list) => {
        if (!cancelled) setWorkspaceMembers(list ?? []);
      })
      .catch(() => {
        /* Avatars fall back to initials from the id if the roster is missing. */
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  /* Member ids per project, for the avatar stack. Failures are swallowed per
     project so one unreadable project does not blank the whole row. */
  useEffect(() => {
    if (!workspaceSlug || allProjects.length === 0) return;
    let cancelled = false;
    Promise.all(
      allProjects.map((project) =>
        projectService
          .listMembers(workspaceSlug, project.id)
          .then(
            (members) =>
              [
                project.id,
                members.map((m) => m.member_id).filter((id): id is string => !!id),
              ] as const,
          )
          .catch(() => [project.id, [] as string[]] as const),
      ),
    ).then((entries) => {
      if (!cancelled) setMembersByProject(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, allProjects]);

  /* The toolbar in the shell writes the search, filter and sort state into the
     URL; the list is derived from it here. */
  const projects = filterProjectsList({
    projects: allProjects,
    state: parseProjectsListSearchParams(searchParams),
    membersByProject,
    favoriteProjectIds,
    currentUserId: user?.id,
  });

  const toggleFavorite = (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!workspace?.slug || pendingFavorites[projectId]) return;

    const isFav = favoriteProjectIds.includes(projectId);
    setPendingFavorites((prev) => ({ ...prev, [projectId]: true }));
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
      .finally(() =>
        setPendingFavorites((prev) => {
          const next = { ...prev };
          delete next[projectId];
          return next;
        }),
      );
  };

  if (loading) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="gap-0 py-4">
            <CardContent className="px-4">
              <div className="flex items-start gap-3">
                <Skeleton className="size-11 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2 pt-0.5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
              <Skeleton className="mt-3 h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!workspace) {
    return (
      <p className="text-muted-foreground text-sm">
        {t('common.workspaceNotFound', 'Workspace not found.')}
      </p>
    );
  }

  const baseUrl = `/${workspace.slug}`;

  const memberById = new Map(
    workspaceMembers.map((member) => [member.member_id ?? member.id, member]),
  );

  /** Up to two initials, falling back to the id when the roster has no entry. */
  const memberInitials = (memberId: string) => {
    const label = memberById.get(memberId)?.member_display_name?.trim();
    if (!label) return memberId.slice(0, 2).toUpperCase();
    return label
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  };

  return (
    <div className="space-y-6 pb-8">
      {/* No page heading or actions: the shell's header carries the breadcrumb,
          the toolbar, and the create button. */}
      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        workspaceSlug={workspace.slug}
        onSuccess={(project) => setAllProjects((prev) => [...prev, project])}
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => {
          const memberIds = membersByProject[project.id] ?? [];
          const visibleMembers = memberIds.slice(0, MAX_AVATARS);
          const extraCount = Math.max(0, memberIds.length - visibleMembers.length);
          const coverUrl = getImageUrl(project.cover_image);
          const isFavorite = favoriteProjectIds.includes(project.id);

          return (
            <Card key={project.id} className="gap-0 py-4">
              <CardContent className="px-4">
                <div className="flex items-start gap-3">
                  {/* The cover image, or its gradient stand-in, is reduced to
                      the icon tile: it identifies the project without taking a
                      third of the card. */}
                  <span
                    className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl"
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
                    <ProjectIconDisplay
                      emoji={project.emoji}
                      icon_prop={project.icon_prop}
                      size={22}
                    />
                  </span>

                  <Link
                    to={`${baseUrl}/projects/${project.id}/issues`}
                    className="min-w-0 flex-1 pt-0.5"
                  >
                    <p className="truncate text-sm font-semibold">{project.name}</p>
                    <Badge variant="secondary" className="mt-1 font-mono text-[10px]">
                      {project.identifier ?? project.id.slice(0, 8)}
                    </Badge>
                  </Link>

                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={(e) => toggleFavorite(e, project.id)}
                    disabled={pendingFavorites[project.id]}
                    aria-label={
                      isFavorite
                        ? t('projects.removeFromFavorites', 'Remove from favorites')
                        : t('projects.addToFavorites', 'Add to favorites')
                    }
                  >
                    <Star className={isFavorite ? 'fill-amber-400 text-amber-400' : ''} />
                  </Button>
                </div>

                <Link to={`${baseUrl}/projects/${project.id}/issues`} className="mt-3 block">
                  <p className="text-muted-foreground line-clamp-2 text-sm">
                    {project.description || t('projects.noDescription', 'No description')}
                  </p>
                </Link>
              </CardContent>

              <CardFooter className="mt-4 flex items-center justify-between gap-2 border-t px-4 pt-3">
                <Link
                  to={`${baseUrl}/projects/${project.id}/issues`}
                  className="flex min-w-0 flex-1 -space-x-2"
                >
                  {visibleMembers.length === 0 ? (
                    <span className="text-muted-foreground text-xs">
                      {t('projects.noMembers', 'No members')}
                    </span>
                  ) : (
                    <>
                      {visibleMembers.map((memberId) => {
                        const member = memberById.get(memberId);
                        return (
                          <Avatar
                            key={memberId}
                            className="border-background size-7 border-2"
                            title={member?.member_display_name ?? member?.member_email ?? undefined}
                          >
                            <AvatarImage
                              src={getImageUrl(member?.member_avatar) ?? ''}
                              alt={member?.member_display_name ?? ''}
                            />
                            <AvatarFallback className="text-[10px]">
                              {memberInitials(memberId)}
                            </AvatarFallback>
                          </Avatar>
                        );
                      })}
                      {extraCount > 0 && (
                        <span
                          className="border-background bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-medium"
                          title={t('projects.extraMembers', '{{count}} more', {
                            count: extraCount,
                          })}
                        >
                          +{extraCount}
                        </span>
                      )}
                    </>
                  )}
                </Link>

                <Button asChild size="icon" variant="ghost">
                  <Link
                    to={`${baseUrl}/settings/projects/${project.id}`}
                    aria-label={t('projects.projectSettings', 'Project settings')}
                  >
                    <Settings2 />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {projects.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center">
          <p className="text-muted-foreground text-sm">
            {allProjects.length > 0
              ? t('projects.noFilterResults', 'No projects match the selected filters.')
              : t('projects.empty', 'No projects yet.')}
          </p>
          {allProjects.length === 0 && (
            <Button variant="outline" onClick={() => setCreateOpen(true)}>
              <Plus />
              {t('projects.createProject', 'New project')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
