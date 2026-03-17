import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Avatar } from "../components/ui";
import { workspaceService } from "../services/workspaceService";
import { projectService } from "../services/projectService";
import { moduleService } from "../services/moduleService";
import type {
  WorkspaceApiResponse,
  ProjectApiResponse,
  ModuleApiResponse,
} from "../api/types";

/** Zero-pad a number to 2 digits. */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatModuleDateRange(mod: ModuleApiResponse): string | null {
  const startRaw = mod.start_date?.trim();
  const endRaw = mod.target_date?.trim();
  if (!startRaw && !endRaw) return null;

  const parse = (iso: string) => {
    const d = new Date(iso);
    return { m: d.getMonth(), d: d.getDate(), y: d.getFullYear() };
  };

  if (startRaw && endRaw) {
    const s = parse(startRaw);
    const e = parse(endRaw);
    if (s.y === e.y && s.m === e.m) {
      return `${MONTH_ABBR[s.m]} ${pad2(s.d)} - ${pad2(e.d)}, ${s.y}`;
    }
    if (s.y === e.y) {
      return `${MONTH_ABBR[s.m]} ${pad2(s.d)} - ${MONTH_ABBR[e.m]} ${pad2(e.d)}, ${s.y}`;
    }
    return `${MONTH_ABBR[s.m]} ${pad2(s.d)}, ${s.y} - ${MONTH_ABBR[e.m]} ${pad2(e.d)}, ${e.y}`;
  }

  const single = parse((startRaw ?? endRaw)!);
  return `${MONTH_ABBR[single.m]} ${pad2(single.d)}, ${single.y}`;
}

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
  const [searchParams] = useSearchParams();
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [modules, setModules] = useState<ModuleApiResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const searchQuery = (searchParams.get("search") ?? "").trim().toLowerCase();
  const filteredModules =
    searchQuery === ""
      ? modules
      : modules.filter((m) => m.name.toLowerCase().includes(searchQuery));

  useEffect(() => {
    const handler = () => {
      if (!workspaceSlug || !projectId) return;
      moduleService
        .list(workspaceSlug, projectId)
        .then((list) => setModules(list ?? []))
        .catch(() => {});
    };
    window.addEventListener("modules-refresh", handler);
    return () => window.removeEventListener("modules-refresh", handler);
  }, [workspaceSlug, projectId]);

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
  const layout =
    (searchParams.get("layout") as "list" | "gallery" | "timeline") || "list";

  const renderListLayout = () => (
    <div className="space-y-2">
      {filteredModules.map((mod) => {
        const progress = getProgress(mod);
        const dateRange = formatModuleDateRange(mod);
        return (
          <Link
            key={mod.id}
            to={`${baseUrl}/modules/${mod.id}`}
            className="flex items-center gap-4 px-4 py-3 no-underline transition-colors hover:bg-[var(--bg-layer-1-hover)]"
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
            <Avatar name={workspace.name} size="sm" className="ml-1" />
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
      })}
    </div>
  );

  const renderGalleryLayout = () => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {filteredModules.map((mod) => {
        const progress = getProgress(mod);
        const dateRange = formatModuleDateRange(mod);
        return (
          <Link
            key={mod.id}
            to={`${baseUrl}/modules/${mod.id}`}
            className="flex flex-col gap-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] p-4 no-underline transition-colors hover:bg-[var(--bg-layer-1-hover)]"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 flex-1 truncate font-medium text-[var(--txt-primary)]">
                {mod.name}
              </p>
              <ModuleProgressCircle progress={progress} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px]">
              {dateRange !== null && (
                <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] px-2.5 py-1 text-[var(--txt-secondary)]">
                  {dateRange}
                </span>
              )}
              <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] px-2.5 py-1 text-[var(--txt-secondary)]">
                {mod.status}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );

  const renderTimelineLayout = () => {
    const withDates = filteredModules
      .map((m) => ({
        mod: m,
        start: m.start_date ? new Date(m.start_date) : null,
        end: m.target_date ? new Date(m.target_date) : null,
      }))
      .sort((a, b) => {
        const aTime = a.start?.getTime() ?? a.end?.getTime() ?? 0;
        const bTime = b.start?.getTime() ?? b.end?.getTime() ?? 0;
        return aTime - bTime;
      });

    return (
      <div className="space-y-3 border-l border-[var(--border-subtle)] pl-4">
        {withDates.map(({ mod, start, end }) => {
          const progress = getProgress(mod);
          const dateRange = formatModuleDateRange(mod);
          return (
            <div key={mod.id} className="relative pl-4">
              <div className="absolute left-0 top-3 h-2 w-2 -translate-x-1/2 rounded-full bg-[var(--brand-default)]" />
              <Link
                to={`${baseUrl}/modules/${mod.id}`}
                className="flex items-center gap-3 rounded-md px-3 py-2 no-underline transition-colors hover:bg-[var(--bg-layer-1-hover)]"
              >
                <ModuleProgressCircle progress={progress} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--txt-primary)]">
                    {mod.name}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--txt-secondary)]">
                    {dateRange ?? "No dates"}
                  </p>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    );
  };

  if (filteredModules.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--txt-tertiary)]">
        {searchQuery ? "No modules match your search." : "No modules yet."}
      </p>
    );
  }

  if (layout === "gallery") return renderGalleryLayout();
  if (layout === "timeline") return renderTimelineLayout();
  return renderListLayout();
}
