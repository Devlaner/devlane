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
    return <div className="text-(--txt-secondary)">Project not found.</div>;
  }

  const baseUrl = `/${workspace.slug}/projects/${project.id}`;
  const layout =
    (searchParams.get("layout") as "list" | "gallery" | "timeline") || "list";
  const [timelineTimeframe, setTimelineTimeframe] = useState<
    "week" | "month" | "quarter"
  >("week");

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
    const DAY_WIDTH = 28;
    const ROW_HEIGHT = 40;
    const LEFT_WIDTH = 220;
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();

    const withDates = sortedModules.map((mod) => {
      const start = mod.start_date ? new Date(mod.start_date) : null;
      const end = mod.target_date ? new Date(mod.target_date) : null;
      const startTime = start?.getTime() ?? end?.getTime() ?? todayStart;
      const endTime = end?.getTime() ?? start?.getTime() ?? todayStart;
      const durationDays =
        start && end
          ? Math.max(
              0,
              Math.ceil(
                (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
              ) + 1,
            )
          : 0;
      return { mod, start, end, startTime, endTime, durationDays };
    });

    const rangeStart = Math.min(
      ...withDates.map((d) => d.startTime),
      todayStart - 14 * 24 * 60 * 60 * 1000,
    );
    const rangeEnd = Math.max(
      ...withDates.map((d) => d.endTime),
      todayStart + 60 * 24 * 60 * 60 * 1000,
    );
    const totalDays = Math.ceil(
      (rangeEnd - rangeStart) / (24 * 60 * 60 * 1000),
    );
    const days: Date[] = [];
    for (let i = 0; i < totalDays; i++) {
      days.push(new Date(rangeStart + i * 24 * 60 * 60 * 1000));
    }

    const getDayIndex = (t: number) =>
      Math.floor((t - rangeStart) / (24 * 60 * 60 * 1000));
    const weekNum = (d: Date) => {
      return Math.ceil(
        (d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7,
      );
    };

    const monthGroups: { label: string; startIdx: number; span: number }[] = [];
    let i = 0;
    while (i < days.length) {
      const d = days[i];
      const label = `${MONTH_ABBR[d.getMonth()]} ${d.getFullYear()}`;
      const startIdx = i;
      while (
        i < days.length &&
        days[i].getMonth() === d.getMonth() &&
        days[i].getFullYear() === d.getFullYear()
      )
        i++;
      monthGroups.push({ label, startIdx, span: i - startIdx });
    }

    return (
      <div className="flex flex-col gap-0">
        <div className="flex items-center justify-between border-b border-(--border-subtle) bg-(--bg-layer-2) px-4 py-2">
          <span className="text-sm font-medium text-(--txt-secondary)">
            {sortedModules.length} Module{sortedModules.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-1">
            {(["week", "month", "quarter"] as const).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimelineTimeframe(tf)}
                className={`rounded px-2.5 py-1.5 text-sm font-medium capitalize ${
                  timelineTimeframe === tf
                    ? "bg-(--brand-200) text-(--brand-default)"
                    : "text-(--txt-secondary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
                }`}
              >
                {tf}
              </button>
            ))}
            <button
              type="button"
              className="rounded px-2.5 py-1.5 text-sm font-medium text-(--txt-secondary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
            >
              Today
            </button>
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
              aria-label="Full screen"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex overflow-x-auto border border-(--border-subtle) bg-(--bg-surface-1)">
          <div
            className="shrink-0 border-r border-(--border-subtle) bg-(--bg-layer-2)"
            style={{ width: LEFT_WIDTH }}
          >
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-(--border-subtle)">
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-(--txt-secondary)">
                    Modules
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-(--txt-secondary)">
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody>
                {withDates.map(({ mod, durationDays }) => (
                  <tr
                    key={mod.id}
                    className="border-b border-(--border-subtle) last:border-b-0"
                  >
                    <td className="px-3 py-2">
                      <Link
                        to={`${baseUrl}/modules/${mod.id}`}
                        className="flex items-center gap-2 text-sm text-(--txt-primary) no-underline hover:text-(--brand-default)"
                      >
                        <span className="flex size-4 shrink-0 items-center justify-center text-(--txt-icon-tertiary)">
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            aria-hidden
                          >
                            <circle cx="12" cy="12" r="9" />
                            <path d="M12 6v6l4 2" />
                          </svg>
                        </span>
                        <span className="min-w-0 truncate">{mod.name}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-sm text-(--txt-secondary)">
                      {durationDays > 0 ? `${durationDays} days` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div
              style={{
                width: totalDays * DAY_WIDTH,
                minHeight: ROW_HEIGHT * (withDates.length + 3),
              }}
            >
              {/* Month row */}
              <div
                className="flex border-b border-(--border-subtle) bg-(--bg-layer-2)"
                style={{ height: 28 }}
              >
                {monthGroups.map((g) => (
                  <div
                    key={g.startIdx}
                    className="shrink-0 border-r border-(--border-subtle) px-1 py-1 text-xs font-medium text-(--txt-secondary)"
                    style={{ width: g.span * DAY_WIDTH }}
                  >
                    {g.label}
                  </div>
                ))}
              </div>
              {/* Week row */}
              <div
                className="flex border-b border-(--border-subtle) bg-(--bg-layer-2)"
                style={{ height: 24 }}
              >
                {days
                  .filter((_, i) => i % 7 === 0)
                  .map((d, idx) => (
                    <div
                      key={idx}
                      className="shrink-0 border-r border-(--border-subtle) px-0.5 py-0.5 text-[10px] text-(--txt-tertiary)"
                      style={{ width: 7 * DAY_WIDTH }}
                    >
                      Week {weekNum(d)}
                    </div>
                  ))}
              </div>
              {/* Days row */}
              <div
                className="flex border-b border-(--border-subtle) bg-(--bg-layer-2)"
                style={{ height: 28 }}
              >
                {days.map((d, idx) => {
                  const isToday = d.getTime() === todayStart;
                  return (
                    <div
                      key={idx}
                      className={`shrink-0 border-r border-(--border-subtle) px-0.5 py-1 text-center text-[11px] ${
                        isToday
                          ? "bg-(--brand-200) font-medium text-(--brand-default)"
                          : "text-(--txt-secondary)"
                      }`}
                      style={{ width: DAY_WIDTH }}
                    >
                      {d.getDate()}{" "}
                      {["Su", "M", "Tu", "W", "Th", "F", "Sa"][d.getDay()]}
                    </div>
                  );
                })}
              </div>
              {/* Module bars */}
              {withDates.map(({ mod, startTime, endTime }) => {
                const startIdx = Math.max(0, getDayIndex(startTime));
                const endIdx = Math.min(days.length - 1, getDayIndex(endTime));
                const left = startIdx * DAY_WIDTH;
                const width = Math.max(
                  DAY_WIDTH,
                  (endIdx - startIdx + 1) * DAY_WIDTH,
                );
                return (
                  <div
                    key={mod.id}
                    className="flex items-center border-b border-(--border-subtle) last:border-b-0"
                    style={{ height: ROW_HEIGHT }}
                  >
                    <div
                      className="relative h-6"
                      style={{ width: totalDays * DAY_WIDTH }}
                    >
                      <Link
                        to={`${baseUrl}/modules/${mod.id}`}
                        className="absolute top-1/2 -translate-y-1/2 rounded bg-(--brand-200) px-2 py-1 text-xs font-medium text-(--brand-default) no-underline hover:bg-(--brand-default) hover:text-white"
                        style={{ left, width, minWidth: 40 }}
                      >
                        <span className="block truncate">{mod.name}</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
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
