import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Avatar } from '../components/ui';
import { CreateProjectModal } from '../components/CreateProjectModal';
import { workspaceService } from '../services/workspaceService';
import { projectService } from '../services/projectService';
import type { WorkspaceApiResponse, ProjectApiResponse } from '../api/types';

const MAX_AVATARS = 3;

const IconSettings = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
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
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = (searchParams.get('q') ?? '').toLowerCase().trim();
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [allProjects, setAllProjects] = useState<ProjectApiResponse[]>([]);
  const [membersByProject, setMembersByProject] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const createProjectOpen = searchParams.get('createProject') === '1';

  const closeCreateModal = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('createProject');
      return next;
    }, { replace: true });
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
    if (!workspaceSlug || allProjects.length === 0) {
      setMembersByProject({});
      return;
    }
    let cancelled = false;
    Promise.all(
      allProjects.map((p) =>
        projectService
          .listMembers(workspaceSlug, p.id)
          .then((members) => ({ projectId: p.id, memberIds: (members ?? []).map((m) => m.member_id).filter(Boolean) as string[] }))
          .catch(() => ({ projectId: p.id, memberIds: [] as string[] }))
      )
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

  const projects = searchQuery
    ? allProjects.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery) ||
          (p.identifier?.toLowerCase().includes(searchQuery)) ||
          (p.description?.toLowerCase().includes(searchQuery))
      )
    : allProjects;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-[var(--txt-tertiary)]">
        Loading…
      </div>
    );
  }
  if (!workspace) {
    return (
      <div className="text-[var(--txt-secondary)]">
        Workspace not found.
      </div>
    );
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
          const visibleMembers: Array<{ id: string; name: string; avatarUrl?: string | null }> = memberIds
            .slice(0, MAX_AVATARS)
            .map((id) => ({ id, name: id.slice(0, 8), avatarUrl: null }));
          const extraCount = Math.max(0, memberIds.length - visibleMembers.length);

          return (
            <div
              key={project.id}
              className="overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)]"
            >
              <>
                <Link to={`${baseUrl}/projects/${project.id}/issues`} className="block no-underline">
                  {/* Banner with overlay */}
                  <div
                    className="relative h-28 min-h-[7rem] w-full shrink-0 rounded-t-md"
                    style={{ background: getCoverGradient(project.id) }}
                  >
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4 pt-8">
                      <p className="truncate text-base font-semibold text-white">
                        {project.name}
                      </p>
                      <p className="truncate text-sm text-white/90">
                        {project.identifier ?? project.id.slice(0, 8)}
                      </p>
                    </div>
                  </div>
                  {/* Description */}
                  <div className="px-4 py-3">
                    <p className="line-clamp-1 text-sm text-[var(--txt-secondary)]">
                      {project.description || 'No description'}
                    </p>
                  </div>
                </Link>
                {/* Bottom: avatars (link to project) + settings */}
                <div className="flex items-center justify-between gap-2 px-4 py-3">
                  <Link
                    to={`${baseUrl}/projects/${project.id}/issues`}
                    className="flex min-w-0 flex-1 -space-x-2 no-underline"
                  >
                    {visibleMembers.length === 0 ? (
                      <span className="text-xs text-[var(--txt-tertiary)]">No members</span>
                    ) : (
                      <>
                        {visibleMembers.map((user) => (
                          <Avatar
                            key={user.id}
                            name={user.name}
                            src={user.avatarUrl}
                            size="sm"
                            className="h-7 w-7 border-2 border-[var(--bg-surface-1)] text-[10px]"
                          />
                        ))}
                        {extraCount > 0 && (
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-[var(--bg-surface-1)] bg-[var(--bg-layer-2)] text-[10px] font-medium text-[var(--txt-secondary)]"
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
                    className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-1-hover)] hover:text-[var(--txt-icon-secondary)]"
                    aria-label="Project settings"
                  >
                    <IconSettings />
                  </Link>
                </div>
              </>
            </div>
          );
        })}
      </div>
      {projects.length === 0 && (
        <p className="text-sm text-[var(--txt-tertiary)]">No projects yet.</p>
      )}
    </div>
  );
}
