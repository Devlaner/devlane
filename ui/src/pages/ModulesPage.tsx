import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Avatar } from "../components/ui";
import { UpdateModuleModal } from "../components/UpdateModuleModal";
import { useModulesFilter } from "../contexts/ModulesFilterContext";
import { workspaceService } from "../services/workspaceService";
import { projectService } from "../services/projectService";
import { moduleService } from "../services/moduleService";
import { useModuleFavorites } from "../hooks/useModuleFavorites";
import type {
  WorkspaceApiResponse,
  ProjectApiResponse,
  ModuleApiResponse,
  WorkspaceMemberApiResponse,
} from "../api/types";
import { getImageUrl } from "../lib/utils";
import { slugify } from "../lib/slug";

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
const IconStarFilled = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
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

const MODULE_STATUSES = [
  { id: "backlog", label: "Backlog" },
  { id: "planned", label: "Planned" },
  { id: "in_progress", label: "In Progress" },
  { id: "paused", label: "Paused" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
] as const;

function StatusDot({ statusId }: { statusId: string }) {
  const c =
    statusId === "completed"
      ? "bg-green-500"
      : statusId === "cancelled"
        ? "bg-red-500"
        : statusId === "in_progress"
          ? "bg-amber-500"
          : statusId === "paused"
            ? "bg-gray-400"
            : statusId === "planned"
              ? "bg-blue-500"
              : "bg-gray-300";
  return <span className={`size-2 rounded-full ${c}`} aria-hidden />;
}

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
  const filter = useModulesFilter();
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [modules, setModules] = useState<ModuleApiResponse[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [timelineTimeframe, setTimelineTimeframe] = useState<
    "week" | "month" | "quarter"
  >("week");
  const [timelineFullscreen, setTimelineFullscreen] = useState(false);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const [statusMenuOpenId, setStatusMenuOpenId] = useState<string | null>(null);
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null);
  const [ellipsisMenuOpenId, setEllipsisMenuOpenId] = useState<string | null>(
    null,
  );
  const [editModule, setEditModule] = useState<ModuleApiResponse | null>(null);
  const { favoriteModuleIds, toggleFavorite, isFavorite } = useModuleFavorites(
    workspaceSlug,
    projectId,
  );

  const searchQuery = (filter.search ?? "").trim().toLowerCase();
  const favoritesFilter = filter.favorites;
  const statusFilter = filter.status;
  const startDateList = filter.startDateList;
  const dueDateList = filter.dueDateList;
  const startAfter = filter.startAfter;
  const startBefore = filter.startBefore;
  const dueAfter = filter.dueAfter;
  const dueBefore = filter.dueBefore;

  const filteredModules = useMemo(() => {
    let list = modules;
    if (searchQuery !== "") {
      list = list.filter((m) => m.name.toLowerCase().includes(searchQuery));
    }
    if (favoritesFilter && favoriteModuleIds.length > 0) {
      const favSet = new Set(favoriteModuleIds);
      list = list.filter((m) => favSet.has(m.id));
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
    favoritesFilter,
    favoriteModuleIds,
    statusFilter,
    startDateList,
    dueDateList,
    startAfter,
    startBefore,
    dueAfter,
    dueBefore,
  ]);

  const sortBy = filter.sort || "progress";
  const order = filter.order || "asc";
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
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-module-status-menu]")) return;
      if (target.closest("[data-module-ellipsis-menu]")) return;
      setStatusMenuOpenId(null);
      setEllipsisMenuOpenId(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!workspaceSlug || !projectId) {
      queueMicrotask(() => setLoading(false));
      return;
    }
    let cancelled = false;
    queueMicrotask(() => setLoading(true));
    Promise.all([
      workspaceService.getBySlug(workspaceSlug),
      projectService.get(workspaceSlug, projectId),
      moduleService.list(workspaceSlug, projectId),
      workspaceService.listMembers(workspaceSlug),
    ])
      .then(([w, p, list, mem]) => {
        if (!cancelled) {
          setWorkspace(w ?? null);
          setProject(p ?? null);
          setModules(list ?? []);
          setMembers(mem ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWorkspace(null);
          setProject(null);
          setModules([]);
          setMembers([]);
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

  const modulePath = (m: ModuleApiResponse) =>
    `${baseUrl}/modules/${slugify(m.name)}`;
  const layout = filter.layout;

  const getLeadMember = (leadId: string | null | undefined) => {
    if (!leadId) return null;
    const m = members.find((x) => x.member_id === leadId);
    const name =
      m?.member_display_name?.trim() ??
      m?.member_email?.split("@")[0] ??
      leadId.slice(0, 8);
    return { name, avatarUrl: m?.member_avatar ?? null };
  };

  const renderListLayout = () => (
    <div className="space-y-0 rounded-md border border-(--border-subtle) bg-(--bg-surface-1)">
      {sortedModules.map((mod) => {
        const progress = getProgress(mod);
        const dateRange = formatModuleDateRange(mod);
        const lead = getLeadMember(mod.lead_id ?? null);
        const fav = isFavorite(mod.id);
        const statusLabel =
          MODULE_STATUSES.find((s) => s.id === mod.status)?.label ?? mod.status;
        return (
          <div
            key={mod.id}
            className="flex items-center gap-3 border-b border-(--border-subtle) last:border-b-0 px-4 py-3 hover:bg-(--bg-layer-1-hover)"
          >
            <ModuleProgressCircle progress={progress} />
            <div className="min-w-0 flex-1">
              <Link
                to={modulePath(mod)}
                className="min-w-0 no-underline"
                title={mod.name}
              >
                <p className="truncate font-medium text-(--txt-primary) hover:underline">
                  {mod.name}
                </p>
              </Link>
            </div>
            <span className="shrink-0 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1 text-[13px] text-(--txt-secondary)">
              <span className="flex items-center gap-1.5">
                <IconCalendar />
                {dateRange ?? "Start date → End date"}
              </span>
            </span>
            <div className="relative shrink-0" data-module-status-menu>
              <button
                type="button"
                className="flex items-center gap-2 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setStatusMenuOpenId((cur) => (cur === mod.id ? null : mod.id));
                }}
                disabled={statusSavingId === mod.id}
                aria-haspopup="menu"
                aria-expanded={statusMenuOpenId === mod.id}
              >
                <StatusDot statusId={mod.status} />
                <span>{statusLabel}</span>
                <span className="text-(--txt-icon-tertiary)" aria-hidden>
                  ▾
                </span>
              </button>
              {statusMenuOpenId === mod.id && (
                <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-md border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-raised)">
                  {MODULE_STATUSES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!workspaceSlug || !projectId) return;
                        setStatusSavingId(mod.id);
                        try {
                          const updated = await moduleService.update(
                            workspaceSlug,
                            projectId,
                            mod.id,
                            { status: s.id },
                          );
                          setModules((prev) =>
                            prev.map((x) => (x.id === mod.id ? updated : x)),
                          );
                          setStatusMenuOpenId(null);
                        } finally {
                          setStatusSavingId(null);
                        }
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <StatusDot statusId={s.id} />
                        {s.label}
                      </span>
                      {mod.status === s.id && (
                        <span className="text-(--txt-icon-tertiary)">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {lead ? (
              <Avatar
                name={lead.name}
                src={getImageUrl(lead.avatarUrl) ?? undefined}
                size="sm"
                className="h-8 w-8 shrink-0 text-xs"
              />
            ) : (
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded border border-(--border-subtle) border-dashed text-(--txt-icon-tertiary)"
                aria-hidden
              >
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
              </span>
            )}
            <button
              type="button"
              className="flex size-8 shrink-0 items-center justify-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
              aria-label={fav ? "Remove from favorites" : "Add to favorites"}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleFavorite(mod.id);
              }}
            >
              {fav ? (
                <span className="text-amber-500">
                  <IconStarFilled />
                </span>
              ) : (
                <IconStar />
              )}
            </button>
            <div className="relative shrink-0" data-module-ellipsis-menu>
              <button
                type="button"
                className="flex size-8 items-center justify-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
                aria-label="More options"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setEllipsisMenuOpenId((cur) => (cur === mod.id ? null : mod.id));
                }}
              >
                <IconMoreVertical />
              </button>
              {ellipsisMenuOpenId === mod.id && (
                <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEllipsisMenuOpenId(null);
                      setEditModule(mod);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      window.open(modulePath(mod), "_blank", "noopener,noreferrer");
                      setEllipsisMenuOpenId(null);
                    }}
                  >
                    Open in new tab
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      try {
                        await navigator.clipboard.writeText(
                          `${window.location.origin}${modulePath(mod)}`,
                        );
                      } catch {
                        // ignore
                      }
                      setEllipsisMenuOpenId(null);
                    }}
                  >
                    Copy link
                  </button>
                  <div className="my-1 border-t border-(--border-subtle)" />
                  <button
                    type="button"
                    disabled
                    className="flex w-full cursor-not-allowed flex-col gap-0.5 px-3 py-2 text-left text-sm text-(--txt-tertiary)"
                  >
                    <span>Archive</span>
                    <span className="text-[11px] leading-tight">
                      Only completed or canceled module can be archived.
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled
                    className="flex w-full cursor-not-allowed items-center gap-2 px-3 py-2 text-left text-sm text-(--txt-tertiary)"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
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
            to={modulePath(mod)}
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
    const DAY_WIDTH =
      timelineTimeframe === "week"
        ? 34
        : timelineTimeframe === "month"
          ? 20
          : 14;
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

    const viewStart = (() => {
      const t = new Date(todayStart);
      if (timelineTimeframe === "week") return todayStart - 7 * 86400000;
      if (timelineTimeframe === "month")
        return new Date(t.getFullYear(), t.getMonth(), 1).getTime();
      const qStartMonth = Math.floor(t.getMonth() / 3) * 3;
      return new Date(t.getFullYear(), qStartMonth, 1).getTime();
    })();
    const viewEnd = (() => {
      const t = new Date(todayStart);
      if (timelineTimeframe === "week") return todayStart + 21 * 86400000;
      if (timelineTimeframe === "month")
        return new Date(t.getFullYear(), t.getMonth() + 1, 8).getTime();
      const qStartMonth = Math.floor(t.getMonth() / 3) * 3;
      return new Date(t.getFullYear(), qStartMonth + 3, 8).getTime();
    })();

    const rangeStart = Math.min(...withDates.map((d) => d.startTime), viewStart);
    const rangeEnd = Math.max(...withDates.map((d) => d.endTime), viewEnd);
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
      <div
        className={`flex flex-col gap-0 ${
          timelineFullscreen
            ? "fixed inset-0 z-50 bg-(--bg-screen) p-3"
            : ""
        }`}
      >
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
              onClick={() => {
                const idx = getDayIndex(todayStart);
                const left = Math.max(0, idx * DAY_WIDTH - 200);
                timelineScrollRef.current?.scrollTo({ left, behavior: "smooth" });
              }}
              className="rounded px-2.5 py-1.5 text-sm font-medium text-(--txt-secondary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setTimelineFullscreen((v) => !v)}
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
        <div
          ref={timelineScrollRef}
          className="flex min-h-0 flex-1 overflow-auto border border-(--border-subtle) bg-(--bg-surface-1)"
        >
          <div
            className="sticky left-0 z-20 shrink-0 border-r border-(--border-subtle) bg-(--bg-layer-2)"
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
                        to={modulePath(mod)}
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
          <div className="min-w-0 flex-1">
            <div
              style={{
                width: totalDays * DAY_WIDTH,
                minHeight: ROW_HEIGHT * (withDates.length + 3),
              }}
            >
              <div className="sticky top-0 z-10">
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
                        to={modulePath(mod)}
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
        {favoritesFilter
          ? "No favorite modules. Star modules to add them here."
          : searchQuery
            ? "No modules match your search."
            : "No modules yet."}
      </p>
    );
  }

  const content =
    layout === "gallery"
      ? renderGalleryLayout()
      : layout === "timeline"
        ? renderTimelineLayout()
        : renderListLayout();

  return (
    <>
      {content}
      <UpdateModuleModal
        open={editModule !== null}
        onClose={() => setEditModule(null)}
        workspaceSlug={workspaceSlug!}
        projectId={projectId!}
        module={editModule}
        onUpdated={(updated) => {
          setModules((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
          window.dispatchEvent(new CustomEvent("modules-refresh"));
        }}
      />
    </>
  );
}
