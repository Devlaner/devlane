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

/** Format ISO date to "Mon DD, YYYY" */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Format module date range from API (start_date, target_date). Returns null if neither set. */
function formatModuleDateRange(mod: ModuleApiResponse): string | null {
  const start = mod.start_date?.trim();
  const end = mod.target_date?.trim();
  if (start && end) return `${formatDate(start)} - ${formatDate(end)}`;
  if (start) return `From ${formatDate(start)}`;
  if (end) return `Until ${formatDate(end)}`;
  return null;
}

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

/** Circular progress indicator (0–100). */
function ModuleProgressCircle({ progress }: { progress: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const stroke = Math.max(0, Math.min(100, progress)) / 100;
  return (
    <div className="relative flex size-10 shrink-0 items-center justify-center">
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth="3"
        />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke="var(--brand-default)"
          strokeWidth="3"
          strokeDasharray={c}
          strokeDashoffset={c - stroke * c}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-[10px] font-medium text-[var(--txt-secondary)]">
        {progress}%
      </span>
    </div>
  );
}

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

  const getProgress = (mod: ModuleApiResponse) => {
    const total = mod.issue_count ?? 0;
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
    <div className="space-y-2">
      {modules.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--txt-tertiary)]">
          No modules yet.
        </p>
      ) : (
        modules.map((mod) => {
          const progress = getProgress(mod);
          const dateRange = formatModuleDateRange(mod);
          return (
            <Link
              key={mod.id}
              to={`${baseUrl}/modules/${mod.id}`}
              className="flex items-center gap-4 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] px-4 py-3 no-underline transition-colors hover:bg-[var(--bg-layer-1-hover)]"
            >
              <ModuleProgressCircle progress={progress} />
              <p className="min-w-0 flex-1 font-medium text-[var(--txt-primary)]">
                {mod.name}
              </p>
              {dateRange !== null && (
                <span className="shrink-0 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] px-2.5 py-1 text-[13px] text-[var(--txt-secondary)]">
                  {dateRange}
                </span>
              )}
              <span className="shrink-0 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] px-2.5 py-1 text-[13px] text-[var(--txt-secondary)]">
                {mod.status}
              </span>
              <button
                type="button"
                className="flex size-8 shrink-0 items-center justify-center rounded text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-1-hover)] hover:text-[var(--txt-icon-secondary)]"
                aria-label="Assignees"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <IconUser />
              </button>
              <button
                type="button"
                className="flex size-8 shrink-0 items-center justify-center rounded text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-1-hover)] hover:text-[var(--txt-icon-secondary)]"
                aria-label="Favorite"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <IconStar />
              </button>
              <button
                type="button"
                className="flex size-8 shrink-0 items-center justify-center rounded text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-1-hover)] hover:text-[var(--txt-icon-secondary)]"
                aria-label="More options"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <IconMoreVertical />
              </button>
            </Link>
          );
        })
      )}
    </div>
  );
}
