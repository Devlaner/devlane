import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  FolderKanban,
  Globe2,
  LockKeyhole,
  MoreHorizontal,
  Plus,
  SearchX,
  Settings2,
  Star,
  Users,
} from 'lucide-react';
import { CreateProjectDialog } from '@/v2/components/create-project-dialog';
import { PageHeading } from '@/v2/components/page-heading';
import { ProjectsToolbar } from '@/v2/components/projects-toolbar';
import { Avatar, AvatarFallback, AvatarImage } from '@/v2/components/ui/avatar';
import { Badge } from '@/v2/components/ui/badge';
import { Button } from '@/v2/components/ui/button';
import { Card, CardContent, CardFooter } from '@/v2/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/v2/components/ui/dropdown-menu';
import { Skeleton } from '@/v2/components/ui/skeleton';
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
import { ProjectIconDisplay } from '../../components/ProjectIconModal';
import { useAuth } from '../../contexts/AuthContext';
import { useFavorites } from '../../contexts/FavoritesContext';
import { formatDate as formatAbsoluteDate } from '../../i18n/format';
import { useProjectsListPreferences } from '../hooks/useProjectsListPreferences';
import { filterProjectsList } from '../lib/filterProjectsList';
import { PROJECTS_REFRESH_EVENT } from '../lib/projectListEvents';
import { parseProjectsListSearchParams } from '../../lib/projectsListSearchParams';
import { formatRelativeTime } from '../../lib/settingsHelpers';
import { cn, getImageUrl } from '../../lib/utils';
import { favoriteService } from '../../services/favoriteService';
import { projectService } from '../../services/projectService';
import { workspaceService } from '../../services/workspaceService';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import type {
  ProjectApiResponse,
  WorkspaceApiResponse,
  WorkspaceMemberApiResponse,
} from '../../api/types';

const MAX_AVATARS = 3;
const MEMBER_REQUEST_CONCURRENCY = 6;
const PROJECT_SEGMENTS = ['all', 'mine', 'favorites'] as const;
type ProjectSegment = (typeof PROJECT_SEGMENTS)[number];

interface ProjectMembersLoadResult {
  projectId: string;
  memberIds: string[] | null;
}

function hasLoadedProjectMembers(
  result: ProjectMembersLoadResult,
): result is ProjectMembersLoadResult & { memberIds: string[] } {
  return result.memberIds !== null;
}

async function loadProjectMembers(
  workspaceSlug: string,
  projects: ProjectApiResponse[],
): Promise<ProjectMembersLoadResult[]> {
  const results = new Array<ProjectMembersLoadResult>(projects.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < projects.length) {
      const index = nextIndex;
      nextIndex += 1;
      const project = projects[index];
      if (!project) return;

      try {
        const members = await projectService.listMembers(workspaceSlug, project.id);
        results[index] = {
          projectId: project.id,
          memberIds: members
            .map((member) => member.member_id)
            .filter((id): id is string => Boolean(id)),
        };
      } catch {
        results[index] = { projectId: project.id, memberIds: null };
      }
    }
  };

  const workerCount = Math.min(MEMBER_REQUEST_CONCURRENCY, projects.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

function isProjectSegment(value: string): value is ProjectSegment {
  return PROJECT_SEGMENTS.some((segment) => segment === value);
}

interface ProjectActionsProps {
  menuLabel: string;
  openLabel: string;
  settingsLabel: string;
  projectUrl: string;
  settingsUrl: string;
}

function ProjectActions({
  menuLabel,
  openLabel,
  settingsLabel,
  projectUrl,
  settingsUrl,
}: ProjectActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="size-10 sm:size-8"
          aria-label={menuLabel}
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <Link to={projectUrl}>
            <FolderKanban aria-hidden="true" />
            {openLabel}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to={settingsUrl}>
            <Settings2 aria-hidden="true" />
            {settingsLabel}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Icon colors that vanish on the mark's neutral surface fall back to the text token.
const UNUSABLE_MARK_ICON_COLORS = new Set(['#fff', '#ffffff', 'white']);

function markIconProp(
  iconProp: ProjectApiResponse['icon_prop'],
): { name?: string; color?: string } | null | undefined {
  if (!iconProp?.name) return iconProp;
  const color = iconProp.color?.trim().toLowerCase();
  if (color && UNUSABLE_MARK_ICON_COLORS.has(color)) return { name: iconProp.name };
  return iconProp;
}

function ProjectMark({
  project,
  className,
  size = 22,
}: {
  project: ProjectApiResponse;
  className?: string;
  size?: number;
}) {
  const coverUrl = getImageUrl(project.cover_image);
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border',
        coverUrl ? 'border-transparent' : 'border-border/60 bg-muted text-foreground',
        className ?? 'size-11',
      )}
      style={
        coverUrl
          ? {
              backgroundImage: `url(${coverUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    >
      {coverUrl ? <span className="absolute inset-0 bg-black/45" /> : null}
      <ProjectIconDisplay
        className={cn(
          'relative flex items-center justify-center leading-none',
          coverUrl && 'text-white',
        )}
        emoji={project.emoji}
        icon_prop={coverUrl ? { name: project.icon_prop?.name } : markIconProp(project.icon_prop)}
        size={size}
      />
    </span>
  );
}

function validTimestamp(value: string | null | undefined): value is string {
  return Boolean(value && Number.isFinite(Date.parse(value)));
}

function RelativeTimestamp({ value, prefix }: { value?: string | null; prefix: string }) {
  if (!validTimestamp(value)) return <span>—</span>;
  return (
    <time dateTime={value} title={formatAbsoluteDate(value)}>
      {prefix} {formatRelativeTime(value)}
    </time>
  );
}

export function ProjectsListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { favoriteProjectIds, setFavoriteProjectIds } = useFavorites();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  useProjectsListPreferences(workspaceSlug);

  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [allProjects, setAllProjects] = useState<ProjectApiResponse[]>([]);
  const [membersByProject, setMembersByProject] = useState<Record<string, string[]>>({});
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [workspaceMembersLoadError, setWorkspaceMembersLoadError] = useState(false);
  const [memberLoadErrorIds, setMemberLoadErrorIds] = useState<string[]>([]);
  const [pendingFavorites, setPendingFavorites] = useState<Record<string, boolean>>({});
  const [favoriteError, setFavoriteError] = useState('');
  const [favoriteLoadError, setFavoriteLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [loadState, setLoadState] = useState(() => ({
    slug: workspaceSlug ?? '',
    loading: Boolean(workspaceSlug),
    error: false,
  }));

  useDocumentTitle(t('projects.documentTitle', 'Projects'));

  const createOpen = searchParams.get('createProject') === '1';
  const setCreateOpen = (open: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (open) next.set('createProject', '1');
    else next.delete('createProject');
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (!workspaceSlug) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a route change or retry starts a fresh request
    setLoadState({ slug: workspaceSlug, loading: true, error: false });

    Promise.all([
      workspaceService.getBySlug(workspaceSlug),
      projectService.list(workspaceSlug),
      workspaceService
        .listMembers(workspaceSlug)
        .then((members) => ({ members, failed: false }))
        .catch(() => ({ members: [] as WorkspaceMemberApiResponse[], failed: true })),
      favoriteService
        .getFavoriteProjectIds()
        .then((ids) => ({ ids, failed: false }))
        .catch(() => ({ ids: null, failed: true })),
    ])
      .then(([nextWorkspace, projects, rosterResult, favoriteResult]) => {
        if (cancelled) return;
        setWorkspace(nextWorkspace);
        setAllProjects(projects ?? []);
        setWorkspaceMembers(rosterResult.members ?? []);
        setWorkspaceMembersLoadError(rosterResult.failed);
        setMembersByProject({});
        setMemberLoadErrorIds([]);
        setFavoriteLoadError(favoriteResult.failed);
        if (favoriteResult.ids) setFavoriteProjectIds(favoriteResult.ids);
        setLoadState({ slug: workspaceSlug, loading: false, error: false });
      })
      .catch(() => {
        if (cancelled) return;
        setWorkspace(null);
        setAllProjects([]);
        setWorkspaceMembers([]);
        setWorkspaceMembersLoadError(false);
        setMembersByProject({});
        setMemberLoadErrorIds([]);
        setLoadState({ slug: workspaceSlug, loading: false, error: true });
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken, setFavoriteProjectIds, workspaceSlug]);

  useEffect(() => {
    if (!workspaceSlug || workspace?.slug !== workspaceSlug || allProjects.length === 0) return;
    const failedProjectIds = new Set(memberLoadErrorIds);
    const projectsToLoad = allProjects.filter(
      (project) =>
        !Object.prototype.hasOwnProperty.call(membersByProject, project.id) &&
        !failedProjectIds.has(project.id),
    );
    if (projectsToLoad.length === 0) return;

    let cancelled = false;
    loadProjectMembers(workspaceSlug, projectsToLoad).then((entries) => {
      if (cancelled) return;
      const loadedEntries = Object.fromEntries(
        entries.filter(hasLoadedProjectMembers).map((entry) => [entry.projectId, entry.memberIds]),
      );
      setMembersByProject((previous) => ({
        ...previous,
        ...loadedEntries,
      }));
      const failedIds = entries
        .filter((entry) => entry.memberIds === null)
        .map((entry) => entry.projectId);
      if (failedIds.length > 0) {
        setMemberLoadErrorIds((previous) => Array.from(new Set([...previous, ...failedIds])));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [allProjects, memberLoadErrorIds, membersByProject, workspace?.slug, workspaceSlug]);

  const searchState = parseProjectsListSearchParams(searchParams);
  const projects = filterProjectsList({
    projects: allProjects,
    state: searchState,
    membersByProject,
    favoriteProjectIds,
    currentUserId: user?.id,
  });
  const viewMode = searchParams.get('view') === 'grid' ? 'grid' : 'table';
  const segment: ProjectSegment = searchState.favoritesOnly
    ? 'favorites'
    : searchState.myProjectsOnly
      ? 'mine'
      : 'all';

  const favoriteProjectIdSet = useMemo(() => new Set(favoriteProjectIds), [favoriteProjectIds]);
  const memberLoadErrorIdSet = useMemo(() => new Set(memberLoadErrorIds), [memberLoadErrorIds]);
  const memberById = useMemo(
    () => new Map(workspaceMembers.map((member) => [member.member_id ?? member.id, member])),
    [workspaceMembers],
  );

  const memberLabel = (memberId: string) => {
    const member = memberById.get(memberId);
    return (
      member?.member_display_name?.trim() ||
      member?.member_email?.trim() ||
      t('common.member', 'Member')
    );
  };

  const memberInitials = (memberId: string) => {
    const label = memberLabel(memberId);
    return label
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  };

  const projectMemberIds = (project: ProjectApiResponse) =>
    Array.from(
      new Set([
        ...(membersByProject[project.id] ?? []),
        ...(project.project_lead_id ? [project.project_lead_id] : []),
      ]),
    );

  const myProjectCount = user
    ? allProjects.filter((project) => projectMemberIds(project).includes(user.id)).length
    : 0;
  const favoriteCount = allProjects.filter((project) =>
    favoriteProjectIdSet.has(project.id),
  ).length;
  const memberDataPending = allProjects.some(
    (project) =>
      !Object.prototype.hasOwnProperty.call(membersByProject, project.id) &&
      !memberLoadErrorIdSet.has(project.id),
  );
  const memberCountsUnavailable = memberDataPending || memberLoadErrorIds.length > 0;
  const membershipDataAffectsView =
    (memberDataPending || memberLoadErrorIds.length > 0) &&
    (searchState.myProjectsOnly ||
      searchState.memberFilters.length > 0 ||
      searchState.sortField === 'member_count');

  const setSegment = (nextSegment: ProjectSegment) => {
    const next = new URLSearchParams(searchParams);
    next.delete('filter');
    next.delete('myProjects');
    if (nextSegment === 'mine') next.set('myProjects', '1');
    if (nextSegment === 'favorites') next.set('filter', 'favorites');
    setSearchParams(next, { replace: true });
  };

  const clearDiscoveryFilters = () => {
    const next = new URLSearchParams(searchParams);
    [
      'q',
      'filter',
      'myProjects',
      'createdDate',
      'createdAfter',
      'createdBefore',
      'access',
      'lead',
      'members',
    ].forEach((key) => next.delete(key));
    setSearchParams(next, { replace: true });
  };

  const hasDiscoveryFilters =
    Boolean(searchState.searchQuery) ||
    searchState.favoritesOnly ||
    searchState.myProjectsOnly ||
    Boolean(searchState.createdDateFilter) ||
    searchState.accessFilters.length > 0 ||
    searchState.leadFilters.length > 0 ||
    searchState.memberFilters.length > 0;

  const toggleFavorite = (projectId: string) => {
    if (!workspace?.slug || pendingFavorites[projectId]) return;
    const isFavorite = favoriteProjectIdSet.has(projectId);
    setFavoriteError('');
    setPendingFavorites((previous) => ({ ...previous, [projectId]: true }));
    setFavoriteProjectIds((previous) =>
      isFavorite ? previous.filter((id) => id !== projectId) : [...previous, projectId],
    );

    (isFavorite
      ? favoriteService.removeFavorite(workspace.slug, projectId)
      : favoriteService.addFavorite(workspace.slug, projectId)
    )
      .catch(() => {
        setFavoriteProjectIds((previous) =>
          isFavorite
            ? previous.includes(projectId)
              ? previous
              : [...previous, projectId]
            : previous.filter((id) => id !== projectId),
        );
        setFavoriteError(
          t('projects.favoriteError', 'The favorite could not be updated. Please try again.'),
        );
      })
      .finally(() =>
        setPendingFavorites((previous) => {
          const next = { ...previous };
          delete next[projectId];
          return next;
        }),
      );
  };

  const renderMemberStack = (project: ProjectApiResponse) => {
    if (memberLoadErrorIdSet.has(project.id)) {
      return (
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Users className="size-3.5" aria-hidden="true" />
          {t('projects.membersUnavailable', 'Members unavailable')}
        </span>
      );
    }

    if (!Object.prototype.hasOwnProperty.call(membersByProject, project.id)) {
      return (
        <span aria-label={t('projects.loadingMembers', 'Loading members')}>
          <Skeleton className="h-7 w-28" />
        </span>
      );
    }

    const memberIds = projectMemberIds(project);
    const visibleMembers = memberIds.slice(0, MAX_AVATARS);
    const extraCount = Math.max(0, memberIds.length - visibleMembers.length);
    const names = memberIds.map(memberLabel);

    if (memberIds.length === 0) {
      return (
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Users className="size-3.5" aria-hidden="true" />
          {t('projects.noMembers', 'No members')}
        </span>
      );
    }

    return (
      <div
        className="flex min-w-0 items-center gap-2"
        role="group"
        aria-label={t('projects.memberList', 'Members: {{members}}', { members: names.join(', ') })}
      >
        <span className="flex shrink-0 -space-x-2" aria-hidden="true">
          {visibleMembers.map((memberId) => {
            const member = memberById.get(memberId);
            return (
              <Avatar key={memberId} className="border-background size-7 border-2">
                <AvatarImage src={getImageUrl(member?.member_avatar) ?? ''} alt="" />
                <AvatarFallback className="text-[10px]">{memberInitials(memberId)}</AvatarFallback>
              </Avatar>
            );
          })}
          {extraCount > 0 && (
            <span className="border-background bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-medium">
              +{extraCount}
            </span>
          )}
        </span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {t('projects.memberCount', '{{count}} members', { count: memberIds.length })}
        </span>
      </div>
    );
  };

  if (loadState.slug !== (workspaceSlug ?? '') || loadState.loading) {
    return (
      <div
        className="space-y-6 pb-8"
        aria-busy="true"
        aria-label={t('projects.loading', 'Loading projects')}
      >
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-11 w-80 max-w-full" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="gap-4 py-5 shadow-none">
              <CardContent className="space-y-4 px-5">
                <div className="flex items-start gap-3">
                  <Skeleton className="size-11 shrink-0 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                </div>
                <Skeleton className="h-10 w-full" />
              </CardContent>
              <CardFooter className="border-t px-5 pt-4">
                <Skeleton className="h-7 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (loadState.error || !workspace) {
    return (
      <div
        className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center"
        role="alert"
      >
        <span className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-full">
          <FolderKanban aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-xl font-semibold">
          {t('projects.loadErrorTitle', 'Projects could not be loaded')}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-md text-sm">
          {t(
            'projects.loadErrorDescription',
            'Check your connection and try again. Your project data has not been changed.',
          )}
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-5"
          onClick={() => setReloadToken((value) => value + 1)}
        >
          {t('common.retry', 'Try again')}
        </Button>
      </div>
    );
  }

  const baseUrl = `/${workspace.slug}`;

  return (
    <div className="space-y-6 pb-8">
      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        workspaceSlug={workspace.slug}
        members={workspaceMembers}
        onSuccess={(project) => {
          setAllProjects((previous) => [...previous, project]);
          window.dispatchEvent(new CustomEvent(PROJECTS_REFRESH_EVENT));
        }}
      />

      <PageHeading
        title={t('projects.documentTitle', 'Projects')}
        description={t(
          'projects.pageDescription',
          'Organize work, people, and delivery across your workspace.',
        )}
        summary={t(
          'projects.summary',
          '{{projects}} projects · {{mine}} joined · {{favorites}} favorites',
          {
            projects: allProjects.length,
            mine: memberCountsUnavailable ? '—' : myProjectCount,
            favorites: favoriteCount,
          },
        )}
      />

      <ProjectsToolbar
        members={workspaceMembers}
        scopeControl={
          <ToggleGroup
            type="single"
            value={segment}
            onValueChange={(value) => {
              if (isProjectSegment(value)) setSegment(value);
            }}
            variant="default"
            size="sm"
            spacing={1}
            className="bg-muted/60 w-fit max-w-full shrink-0 touch-pan-x overflow-x-auto rounded-lg p-1 sm:p-0.5"
            aria-label={t('projects.scope', 'Project scope')}
          >
            <ToggleGroupItem
              value="all"
              className="h-11 min-w-0 gap-1.5 px-3 data-[state=on]:bg-background data-[state=on]:shadow-xs sm:h-8 sm:px-2.5"
            >
              {t('common.all', 'All')}
              <span className="text-muted-foreground min-w-3 text-center text-xs font-normal tabular-nums">
                {allProjects.length}
              </span>
            </ToggleGroupItem>
            <ToggleGroupItem
              value="mine"
              className="h-11 min-w-0 gap-1.5 px-3 data-[state=on]:bg-background data-[state=on]:shadow-xs sm:h-8 sm:px-2.5"
            >
              {t('header.projects.myProjects', 'My projects')}
              <span className="text-muted-foreground min-w-3 text-center text-xs font-normal tabular-nums">
                {memberCountsUnavailable ? '—' : myProjectCount}
              </span>
            </ToggleGroupItem>
            <ToggleGroupItem
              value="favorites"
              className="h-11 min-w-0 gap-1.5 px-3 data-[state=on]:bg-background data-[state=on]:shadow-xs sm:h-8 sm:px-2.5"
            >
              {t('common.favorites', 'Favorites')}
              <span className="text-muted-foreground min-w-3 text-center text-xs font-normal tabular-nums">
                {favoriteCount}
              </span>
            </ToggleGroupItem>
          </ToggleGroup>
        }
      />

      {workspaceMembersLoadError && (
        <div
          className="border-destructive/40 bg-destructive/5 flex flex-col gap-3 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <p>
            {t(
              'projects.rosterLoadError',
              'Workspace members could not be loaded. People filters and lead selection are temporarily unavailable.',
            )}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() => setReloadToken((value) => value + 1)}
          >
            {t('common.retry', 'Try again')}
          </Button>
        </div>
      )}

      {favoriteLoadError && (
        <div
          className="border-destructive/40 bg-destructive/5 flex flex-col gap-3 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <p>
            {t(
              'projects.favoriteLoadError',
              'Favorites could not be loaded. The project list is still available.',
            )}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() => setReloadToken((value) => value + 1)}
          >
            {t('common.retry', 'Try again')}
          </Button>
        </div>
      )}

      {membershipDataAffectsView && (
        <div
          className="border-border bg-muted/40 flex flex-col gap-3 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          role={memberDataPending ? 'status' : 'alert'}
          aria-busy={memberDataPending || undefined}
        >
          <p>
            {memberDataPending
              ? t('projects.membersLoadingNotice', 'Member data is still loading.')
              : t(
                  'projects.membersPartialNotice',
                  'Member-based results cannot be shown because some member data is unavailable.',
                )}
          </p>
          {!memberDataPending && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() => setReloadToken((value) => value + 1)}
            >
              {t('common.retry', 'Try again')}
            </Button>
          )}
        </div>
      )}

      {favoriteError && (
        <p className="text-destructive text-sm" role="alert">
          {favoriteError}
        </p>
      )}

      {!membershipDataAffectsView && projects.length > 0 && viewMode === 'grid' && (
        <section
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          aria-label={t('projects.gridLabel', 'Project cards')}
        >
          {projects.map((project) => {
            const projectUrl = `${baseUrl}/projects/${project.id}/issues`;
            const settingsUrl = `${baseUrl}/settings/projects/${project.id}`;
            const isFavorite = favoriteProjectIdSet.has(project.id);
            const isPrivate = project.network === 0;
            const leadLabel = project.project_lead_id
              ? memberLabel(project.project_lead_id)
              : t('projects.unassignedLead', 'Unassigned lead');

            return (
              <Card
                key={project.id}
                className="group gap-0 overflow-hidden py-0 shadow-none transition-[border-color,background-color] hover:border-foreground/20 hover:bg-muted/20"
              >
                <CardContent className="flex min-h-48 flex-col px-5 py-5">
                  <div className="flex items-start gap-3">
                    <ProjectMark project={project} />
                    <div className="min-w-0 flex-1">
                      <Link
                        to={projectUrl}
                        className="rounded-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="line-clamp-1">{project.name}</span>
                      </Link>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className="font-mono text-[10px]">
                          {project.identifier ?? project.id.slice(0, 8)}
                        </Badge>
                        <Badge variant="outline">
                          {isPrivate ? (
                            <LockKeyhole aria-hidden="true" />
                          ) : (
                            <Globe2 aria-hidden="true" />
                          )}
                          {isPrivate
                            ? t('project.create.accessSecret', 'Private')
                            : t('project.create.accessPublic', 'Public')}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="size-10 sm:size-8"
                        onClick={() => toggleFavorite(project.id)}
                        disabled={pendingFavorites[project.id]}
                        aria-busy={pendingFavorites[project.id] || undefined}
                        aria-pressed={isFavorite}
                        aria-label={`${
                          isFavorite
                            ? t('projects.removeFromFavorites', 'Remove from favorites')
                            : t('projects.addToFavorites', 'Add to favorites')
                        }: ${project.name}`}
                      >
                        <Star
                          aria-hidden="true"
                          className={isFavorite ? 'fill-amber-400 text-amber-400' : ''}
                        />
                      </Button>
                      <ProjectActions
                        menuLabel={t('projects.projectMenu', '{{project}} actions', {
                          project: project.name,
                        })}
                        openLabel={t('projects.openWorkItems', 'Open work items')}
                        settingsLabel={t('projects.projectSettings', 'Project settings')}
                        projectUrl={projectUrl}
                        settingsUrl={settingsUrl}
                      />
                    </div>
                  </div>

                  <Link
                    to={projectUrl}
                    className="text-muted-foreground mt-4 block rounded-sm text-sm leading-6 underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="line-clamp-2">
                      {project.description || t('projects.noDescription', 'No description')}
                    </span>
                  </Link>

                  <div className="text-muted-foreground mt-auto flex items-center gap-2 pt-5 text-xs">
                    <span className="font-medium text-foreground">{t('common.lead', 'Lead')}:</span>
                    <span className="truncate">{leadLabel}</span>
                  </div>
                </CardContent>

                <CardFooter className="flex flex-wrap justify-between gap-3 border-t px-5 py-3.5">
                  {renderMemberStack(project)}
                  <span className="text-muted-foreground ml-auto text-xs">
                    <RelativeTimestamp
                      value={project.updated_at ?? project.created_at}
                      prefix={t('common.updated', 'Updated')}
                    />
                  </span>
                </CardFooter>
              </Card>
            );
          })}
        </section>
      )}

      {!membershipDataAffectsView && projects.length > 0 && viewMode === 'table' && (
        <section
          className="overflow-hidden rounded-xl border"
          aria-label={t('projects.tableLabel', 'Projects table')}
        >
          <Table>
            <TableCaption className="sr-only">
              {t(
                'projects.tableCaption',
                'Workspace projects, access, leads, members, and updates',
              )}
            </TableCaption>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-72 px-4">{t('common.project', 'Project')}</TableHead>
                <TableHead className="w-40 px-3">{t('common.access', 'Access')}</TableHead>
                <TableHead className="hidden min-w-40 px-3 md:table-cell">
                  {t('common.lead', 'Lead')}
                </TableHead>
                <TableHead className="min-w-40 px-3">{t('common.members', 'Members')}</TableHead>
                <TableHead className="hidden min-w-36 px-3 lg:table-cell">
                  {t('common.updated', 'Updated')}
                </TableHead>
                <TableHead className="w-24 px-3 text-right">
                  <span className="sr-only">{t('common.actions', 'Actions')}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => {
                const projectUrl = `${baseUrl}/projects/${project.id}/issues`;
                const settingsUrl = `${baseUrl}/settings/projects/${project.id}`;
                const isFavorite = favoriteProjectIdSet.has(project.id);
                const isPrivate = project.network === 0;
                return (
                  <TableRow
                    key={project.id}
                    className="cursor-pointer"
                    onClick={(event) => {
                      const target = event.target as HTMLElement;
                      if (target.closest('a, button, input, select, textarea, [role="menuitem"]')) {
                        return;
                      }
                      navigate(projectUrl);
                    }}
                  >
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ProjectMark project={project} className="size-8 rounded-md" size={16} />
                        <div className="min-w-0">
                          <Link
                            to={projectUrl}
                            className="block max-w-72 truncate rounded-sm font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {project.name}
                          </Link>
                          <span className="text-muted-foreground block max-w-72 truncate text-xs">
                            {project.identifier ?? project.id.slice(0, 8)}
                            {project.description ? ` · ${project.description}` : ''}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-3">
                      <Badge variant="outline">
                        {isPrivate ? (
                          <LockKeyhole aria-hidden="true" />
                        ) : (
                          <Globe2 aria-hidden="true" />
                        )}
                        {isPrivate
                          ? t('project.create.accessSecret', 'Private')
                          : t('project.create.accessPublic', 'Public')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden max-w-48 truncate px-3 md:table-cell">
                      {project.project_lead_id
                        ? memberLabel(project.project_lead_id)
                        : t('projects.unassignedLead', 'Unassigned lead')}
                    </TableCell>
                    <TableCell className="px-3">{renderMemberStack(project)}</TableCell>
                    <TableCell className="text-muted-foreground hidden px-3 text-xs lg:table-cell">
                      <RelativeTimestamp
                        value={project.updated_at ?? project.created_at}
                        prefix={t('common.updated', 'Updated')}
                      />
                    </TableCell>
                    <TableCell className="px-3">
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          className="size-10 sm:size-8"
                          onClick={() => toggleFavorite(project.id)}
                          disabled={pendingFavorites[project.id]}
                          aria-busy={pendingFavorites[project.id] || undefined}
                          aria-pressed={isFavorite}
                          aria-label={`${
                            isFavorite
                              ? t('projects.removeFromFavorites', 'Remove from favorites')
                              : t('projects.addToFavorites', 'Add to favorites')
                          }: ${project.name}`}
                        >
                          <Star
                            aria-hidden="true"
                            className={isFavorite ? 'fill-amber-400 text-amber-400' : ''}
                          />
                        </Button>
                        <ProjectActions
                          menuLabel={t('projects.projectMenu', '{{project}} actions', {
                            project: project.name,
                          })}
                          openLabel={t('projects.openWorkItems', 'Open work items')}
                          settingsLabel={t('projects.projectSettings', 'Project settings')}
                          projectUrl={projectUrl}
                          settingsUrl={settingsUrl}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>
      )}

      {!membershipDataAffectsView &&
        projects.length === 0 &&
        !(favoriteLoadError && searchState.favoritesOnly) && (
          <Card className="items-center gap-0 border-dashed px-6 py-14 text-center shadow-none">
            <span className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
              {allProjects.length === 0 ? (
                <FolderKanban aria-hidden="true" />
              ) : (
                <SearchX aria-hidden="true" />
              )}
            </span>
            <CardContent className="mt-4 max-w-md px-0">
              <h2 className="font-semibold">
                {allProjects.length === 0
                  ? t('projects.emptyTitle', 'Create your first project')
                  : t('projects.noFilterResultsTitle', 'No projects found')}
              </h2>
              <p className="text-muted-foreground mt-2 text-sm leading-6">
                {allProjects.length === 0
                  ? t(
                      'projects.emptyDescription',
                      'Projects bring work items, cycles, modules, and teammates together in one place.',
                    )
                  : t(
                      'projects.noFilterResults',
                      'No projects match the current search and filters.',
                    )}
              </p>
              <Button
                type="button"
                className="mt-5"
                variant={allProjects.length === 0 ? 'default' : 'outline'}
                onClick={
                  allProjects.length === 0 ? () => setCreateOpen(true) : clearDiscoveryFilters
                }
              >
                {allProjects.length === 0 ? (
                  <Plus aria-hidden="true" />
                ) : (
                  <SearchX aria-hidden="true" />
                )}
                {allProjects.length === 0
                  ? t('projects.createProject', 'New project')
                  : t('common.clearFilters', 'Clear filters')}
              </Button>
            </CardContent>
          </Card>
        )}

      {hasDiscoveryFilters && !membershipDataAffectsView && (
        <p className="sr-only" aria-live="polite">
          {t('projects.visibleCount', '{{count}} projects visible', { count: projects.length })}
        </p>
      )}
    </div>
  );
}
