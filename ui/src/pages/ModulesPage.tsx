import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { workspaceService } from "../services/workspaceService";
import { projectService } from "../services/projectService";
import { moduleService } from "../services/moduleService";
import type {
  WorkspaceApiResponse,
  ProjectApiResponse,
  ModuleApiResponse,
} from "../api/types";

const IconSearch = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);
const IconFilter = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);
const IconCalendar = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const IconUser = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const IconStar = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);
const IconMoreVertical = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden
  >
    <circle cx="12" cy="5" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="12" cy="19" r="1.5" />
  </svg>
);
const IconChevronDown = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);
const IconLuggage = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M6 20h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z" />
    <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

export function ModulesPage() {
  const { workspaceSlug, projectId } = useParams<{
    workspaceSlug: string;
    projectId: string;
  }>();
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [modules, setModules] = useState<ModuleApiResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceSlug || !projectId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset loading when no slug/project (kept for future use)
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      workspaceService.getBySlug(workspaceSlug),
      projectService.get(workspaceSlug, projectId),
      moduleService.list(workspaceSlug, projectId),
    ])
      .then(([w, p, list]) => {
        if (!cancelled) {
          setWorkspace(w ?? null);
          setProject(p ?? null);
          setModules(list ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWorkspace(null);
          setProject(null);
          setModules([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId]);

  const getIssueCount = (moduleId: string) =>
    modules.find((m) => m.id === moduleId)?.issue_count ?? 0;
  const getTotalIssues = (moduleId: string) => getIssueCount(moduleId);
  const getProgress = (moduleId: string) => {
    const total = getTotalIssues(moduleId);
    const done = 0;
    return total === 0 ? 0 : Math.round((done / total) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-[var(--txt-tertiary)]">
        Loading…
      </div>
    );
  }
  if (!workspace || !project) {
    return (
      <div className="text-[var(--txt-secondary)]">Project not found.</div>
    );
  }

  const baseUrl = `/${workspace.slug}/projects/${project.id}`;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-2-hover)]"
          aria-label="Search"
        >
          <IconSearch />
        </button>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] px-2.5 py-1.5 text-[13px] font-medium text-[var(--txt-secondary)] hover:bg-[var(--bg-layer-2-hover)]"
        >
          ↑ Name <IconChevronDown />
        </button>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] px-2.5 py-1.5 text-[13px] font-medium text-[var(--txt-secondary)] hover:bg-[var(--bg-layer-2-hover)]"
        >
          <IconFilter /> Filters <IconChevronDown />
        </button>
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] text-[var(--brand-default)] hover:bg-[var(--bg-layer-2-hover)]"
          aria-label="List view"
          title="List view"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </button>
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-md border border-transparent text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-2)] hover:text-[var(--txt-icon-secondary)]"
          aria-label="Grid view"
          title="Grid view"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect width="7" height="7" x="3" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="14" rx="1" />
            <rect width="7" height="7" x="3" y="14" rx="1" />
          </svg>
        </button>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] px-2.5 py-1.5 text-[13px] font-medium text-[var(--txt-secondary)] hover:bg-[var(--bg-layer-2-hover)]"
        >
          <IconCalendar /> Start date → End date
        </button>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] px-2.5 py-1.5 text-[13px] font-medium text-[var(--txt-secondary)] hover:bg-[var(--bg-layer-2-hover)]"
        >
          <IconLuggage /> Backlog
        </button>
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-md text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-2)] hover:text-[var(--txt-icon-secondary)]"
          aria-label="Assignees"
        >
          <IconUser />
        </button>
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-md text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-2)] hover:text-[var(--txt-icon-secondary)]"
          aria-label="Favorite"
        >
          <IconStar />
        </button>
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-md text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-2)] hover:text-[var(--txt-icon-secondary)]"
          aria-label="More"
        >
          <IconMoreVertical />
        </button>
      </div>

      {/* Module list */}
      <div className="space-y-2">
        {modules.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--txt-tertiary)]">
            No modules yet.
          </p>
        ) : (
          modules.map((mod) => {
            const progress = getProgress(mod.id);
            return (
              <Link
                key={mod.id}
                to={`${baseUrl}/modules/${mod.id}`}
                className="flex items-center gap-4 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] px-4 py-3 no-underline transition-colors hover:bg-[var(--bg-layer-1-hover)]"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-[var(--border-subtle)] bg-[var(--bg-layer-2)] text-sm font-medium text-[var(--txt-secondary)]">
                  {progress}%
                </div>
                <div className="min-w-0 flex-1 border-l border-[var(--border-subtle)] pl-4">
                  <p className="font-medium text-[var(--txt-primary)]">
                    {mod.name}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1 text-[var(--txt-icon-tertiary)]">
                  <span
                    className="flex size-8 items-center justify-center rounded hover:bg-[var(--bg-layer-1-hover)] hover:text-[var(--txt-icon-secondary)]"
                    title="Start date → End date"
                  >
                    <IconCalendar />
                  </span>
                  <span
                    className="flex size-8 items-center justify-center rounded hover:bg-[var(--bg-layer-1-hover)] hover:text-[var(--txt-icon-secondary)]"
                    title="Backlog"
                  >
                    <IconLuggage />
                  </span>
                  <span
                    className="flex size-8 items-center justify-center rounded hover:bg-[var(--bg-layer-1-hover)] hover:text-[var(--txt-icon-secondary)]"
                    title="Assignees"
                  >
                    <IconUser />
                  </span>
                  <span
                    className="flex size-8 items-center justify-center rounded hover:bg-[var(--bg-layer-1-hover)] hover:text-[var(--txt-icon-secondary)]"
                    title="Favorite"
                  >
                    <IconStar />
                  </span>
                  <button
                    type="button"
                    className="flex size-8 items-center justify-center rounded hover:bg-[var(--bg-layer-1-hover)] hover:text-[var(--txt-icon-secondary)]"
                    aria-label="More options"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <IconMoreVertical />
                  </button>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
