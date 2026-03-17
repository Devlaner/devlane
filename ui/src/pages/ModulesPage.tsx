import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Avatar } from "../components/ui";
import { MODULE_FILTER_PARAM } from "../components/workspace-views";
import { workspaceService } from "../services/workspaceService";
import { projectService } from "../services/projectService";
import { moduleService } from "../services/moduleService";
import type {
  WorkspaceApiResponse,
  ProjectApiResponse,
  ModuleApiResponse,
} from "../api/types";

function parseList(value: string | null): string[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

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
      <span className="absolute text-[10px] font-medium text-(--txt-secondary)">
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
  const statusFilter = parseList(searchParams.get(MODULE_FILTER_PARAM.status));
  const startDateList = parseList(
    searchParams.get(MODULE_FILTER_PARAM.start_date),
  );
  const dueDateList = parseList(searchParams.get(MODULE_FILTER_PARAM.due_date));
  const startAfter =
    searchParams.get(MODULE_FILTER_PARAM.start_after)?.trim() ?? null;
  const startBefore =
    searchParams.get(MODULE_FILTER_PARAM.start_before)?.trim() ?? null;
  const dueAfter =
    searchParams.get(MODULE_FILTER_PARAM.due_after)?.trim() ?? null;
  const dueBefore =
    searchParams.get(MODULE_FILTER_PARAM.due_before)?.trim() ?? null;

  const filteredModules = useMemo(() => {
    let list = modules;
    if (searchQuery !== "") {
      list = list.filter((m) => m.name.toLowerCase().includes(searchQuery));
    }
    if (statusFilter.length > 0) {
      const allowed = new Set(statusFilter.map((s) => s.toLowerCase()));
      list = list.filter((m) => allowed.has((m.status ?? "").toLowerCase()));
    }
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const addDays = (d: Date, n: number) =>
      new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
    const toDate = (iso: string) => new Date(iso.slice(0, 10));
    const inRange = (value: Date, min: Date, max: Date) =>
      value.getTime() >= min.getTime() && value.getTime() <= max.getTime();
    const matchStartPreset = (d: Date, preset: string) => {
      if (preset === "1_week") return inRange(d, today, addDays(today, 7));
      if (preset === "2_weeks") return inRange(d, today, addDays(today, 14));
      if (preset === "1_month") return inRange(d, today, addDays(today, 30));
      if (preset === "2_months") return inRange(d, today, addDays(today, 60));
      return false;
    };
    if (startDateList.length > 0) {
      const hasCustomStart = startDateList.includes("custom");
      list = list.filter((m) => {
        const sd = m.start_date?.trim();
        if (!sd) return false;
        const d = toDate(sd);
        if (hasCustomStart)
          return (
            startAfter !== null &&
            startBefore !== null &&
            inRange(d, toDate(startAfter), toDate(startBefore))
          );
        return startDateList.some((p) => matchStartPreset(d, p));
      });
    }
    if (dueDateList.length > 0) {
      const hasCustomDue = dueDateList.includes("custom");
      list = list.filter((m) => {
        const td = m.target_date?.trim();
        if (!td) return false;
        const d = toDate(td);
        if (hasCustomDue)
          return (
            dueAfter !== null &&
            dueBefore !== null &&
            inRange(d, toDate(dueAfter), toDate(dueBefore))
          );
        return dueDateList.some((p) => matchStartPreset(d, p));
      });
    }
    return list;
  }, [
    modules,
    searchQuery,
    statusFilter,
    startDateList,
    dueDateList,
    startAfter,
    startBefore,
    dueAfter,
    dueBefore,
  ]);

  const sortBy = searchParams.get("sort") || "progress";
  const order = searchParams.get("order") || "asc";
  const sortedModules = [...filteredModules].sort((a, b) => {
    const getProgress = (mod: ModuleApiResponse) => {
      const total = mod.issue_count ?? 0;
      const done = 0;
      return total === 0 ? 0 : Math.round((done / total) * 100);
    };
    let cmp = 0;
    switch (sortBy) {
      case "name":
        cmp = (a.name ?? "").localeCompare(b.name ?? "");
        break;
      case "progress":
        cmp = getProgress(a) - getProgress(b);
        break;
      case "work_items":
        cmp = (a.issue_count ?? 0) - (b.issue_count ?? 0);
        break;
      case "due_date":
        cmp = (a.target_date ?? "").localeCompare(b.target_date ?? "");
        break;
      case "created_date":
        cmp = (a.created_at ?? "").localeCompare(b.created_at ?? "");
        break;
      case "manual":
        cmp = (a.sort_order ?? 0) - (b.sort_order ?? 0);
        break;
      default:
        cmp = getProgress(a) - getProgress(b);
    }
    return order === "desc" ? -cmp : cmp;
  });

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
      <div className="flex items-center justify-center p-8 text-sm text-(--txt-tertiary)">
        Loading…
      </div>
    );
  }
  if (!workspace || !project) {
    return (
      <div className="text-(--txt-secondary)">Project not found.</div>
    );
  }

  const baseUrl = `/${workspace.slug}/projects/${project.id}`;
  const layout =
    (searchParams.get("layout") as "list" | "gallery" | "timeline") || "list";

  const renderListLayout = () => (
    <div className="space-y-2">
      {sortedModules.map((mod) => {
        const progress = getProgress(mod);
        const dateRange = formatModuleDateRange(mod);
        return (
          <Link
            key={mod.id}
            to={`${baseUrl}/modules/${mod.id}`}
            className="flex items-center gap-4 px-4 py-3 no-underline transition-colors hover:bg-(--bg-layer-1-hover)"
          >
            <ModuleProgressCircle progress={progress} />
            <p className="min-w-0 flex-1 font-medium text-(--txt-primary)">
              {mod.name}
            </p>
            {dateRange !== null && (
              <span className="shrink-0 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1 text-[13px] text-(--txt-secondary)">
                {dateRange}
              </span>
            )}
            <span className="shrink-0 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1 text-[13px] text-(--txt-secondary)">
              {mod.status}
            </span>
            <Avatar name={workspace.name} size="sm" className="ml-1" />
            <button
              type="button"
              className="flex size-8 shrink-0 items-center justify-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
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
              className="flex size-8 shrink-0 items-center justify-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
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
      {sortedModules.map((mod) => {
        const progress = getProgress(mod);
        const dateRange = formatModuleDateRange(mod);
        return (
          <Link
            key={mod.id}
            to={`${baseUrl}/modules/${mod.id}`}
            className="flex flex-col gap-3 rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-4 no-underline transition-colors hover:bg-(--bg-layer-1-hover)"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 flex-1 truncate font-medium text-(--txt-primary)">
                {mod.name}
              </p>
              <ModuleProgressCircle progress={progress} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px]">
              {dateRange !== null && (
                <span className="rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1 text-(--txt-secondary)">
                  {dateRange}
                </span>
              )}
              <span className="rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1 text-(--txt-secondary)">
                {mod.status}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );

  const renderTimelineLayout = () => {
    const withDates = sortedModules
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
      <div className="space-y-3 border-l border-(--border-subtle) pl-4">
        {withDates.map(({ mod }) => {
          const progress = getProgress(mod);
          const dateRange = formatModuleDateRange(mod);
          return (
            <div key={mod.id} className="relative pl-4">
              <div className="absolute left-0 top-3 h-2 w-2 -translate-x-1/2 rounded-full bg-(--brand-default)" />
              <Link
                to={`${baseUrl}/modules/${mod.id}`}
                className="flex items-center gap-3 rounded-md px-3 py-2 no-underline transition-colors hover:bg-(--bg-layer-1-hover)"
              >
                <ModuleProgressCircle progress={progress} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-(--txt-primary)">
                    {mod.name}
                  </p>
                  <p className="mt-0.5 text-xs text-(--txt-secondary)">
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
      <p className="py-8 text-center text-sm text-(--txt-tertiary)">
        {searchQuery ? "No modules match your search." : "No modules yet."}
      </p>
    );
  }

  if (layout === "gallery") return renderGalleryLayout();
  if (layout === "timeline") return renderTimelineLayout();
  return renderListLayout();
}
