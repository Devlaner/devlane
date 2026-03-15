import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useWorkspaceViewsState } from "../contexts/WorkspaceViewsStateContext";
import { Badge } from "../components/ui";
import { Dropdown } from "../components/work-item";
import { workspaceService } from "../services/workspaceService";
import { projectService } from "../services/projectService";
import { issueService } from "../services/issueService";
import { stateService } from "../services/stateService";
import { labelService } from "../services/labelService";
import { viewService } from "../services/viewService";
import type {
  WorkspaceApiResponse,
  ProjectApiResponse,
  IssueApiResponse,
  StateApiResponse,
  LabelApiResponse,
  WorkspaceMemberApiResponse,
} from "../api/types";
import type { Priority } from "../types";
import { getImageUrl } from "../lib/utils";
import {
  parseWorkspaceViewFiltersFromSearchParams,
  type StateGroup,
} from "../types/workspaceViewFilters";
import {
  DISPLAY_PROPERTY_KEYS,
  SPREADSHEET_COLUMN_ORDER,
  VIEW_LAYOUTS,
  DISPLAY_PROPERTY_LABELS,
  type DisplayPropertyKey,
  type SortableColumn,
  type SortOrder,
  type ViewLayout,
} from "../types/workspaceViewDisplay";

const IconChevronDown = (props: React.SVGAttributes<SVGSVGElement>) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
    {...props}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);
const IconUser = (props: React.SVGAttributes<SVGSVGElement>) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
    {...props}
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const IconTag = (props: React.SVGAttributes<SVGSVGElement>) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
    {...props}
  >
    <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
  </svg>
);
const IconRadio = (props: React.SVGAttributes<SVGSVGElement>) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
  </svg>
);
const IconBarChart = (props: React.SVGAttributes<SVGSVGElement>) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
    {...props}
  >
    <line x1="12" y1="20" x2="12" y2="10" />
    <line x1="18" y1="20" x2="18" y2="4" />
    <line x1="6" y1="20" x2="6" y2="16" />
  </svg>
);
const IconCalendar = (props: React.SVGAttributes<SVGSVGElement>) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
    {...props}
  >
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const priorityVariant: Record<
  Priority,
  "danger" | "warning" | "default" | "neutral"
> = {
  urgent: "danger",
  high: "danger",
  medium: "warning",
  low: "default",
  none: "neutral",
};

const CELL_TRIGGER_CLASS =
  "flex w-full min-w-0 items-center justify-start gap-2 rounded-none border-0 bg-transparent px-4 py-2 text-left text-sm text-[var(--txt-secondary)] hover:bg-[var(--bg-layer-1-hover)] [&_svg]:shrink-0";

const STATIC_VIEW_IDS = ["all-issues", "assigned", "created", "subscribed"];

function isCustomViewId(viewId: string | undefined): boolean {
  if (!viewId) return false;
  return !STATIC_VIEW_IDS.includes(viewId);
}

export function WorkspaceViewsPage() {
  const { workspaceSlug, viewId } = useParams<{
    workspaceSlug?: string;
    viewId?: string;
  }>();
  const { filters, setFilters, display, setDisplay } = useWorkspaceViewsState();
  const [openCellId, setOpenCellId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [viewNotFound, setViewNotFound] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const viewAppliedRef = useRef(false);
  const prevViewIdRef = useRef<string | undefined>(undefined);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [issues, setIssues] = useState<IssueApiResponse[]>([]);
  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [labels, setLabels] = useState<LabelApiResponse[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const { user: currentUser } = useAuth();

  // When viewing a saved view, fetch it and apply its filters/display to state once (Plane-style; not in URL).
  useEffect(() => {
    if (prevViewIdRef.current !== viewId) {
      prevViewIdRef.current = viewId;
      viewAppliedRef.current = false;
    }
    if (
      !workspaceSlug ||
      !viewId ||
      !isCustomViewId(viewId) ||
      viewAppliedRef.current
    )
      return;
    viewAppliedRef.current = true;
    queueMicrotask(() => setViewLoading(true));
    viewService
      .get(workspaceSlug, viewId)
      .then((view) => {
        setViewNotFound(false);
        const f = view.filters as Record<string, string> | undefined;
        if (f && typeof f === "object") {
          const nextFilters = parseWorkspaceViewFiltersFromSearchParams(
            new URLSearchParams(f as Record<string, string>),
          );
          setFilters(nextFilters);
        }
        const dp = view.display_properties as
          | Record<string, boolean>
          | undefined;
        if (dp && typeof dp === "object") {
          const keys = Object.entries(dp)
            .filter(([, v]) => v)
            .map(([k]) => k)
            .filter((k): k is DisplayPropertyKey =>
              DISPLAY_PROPERTY_KEYS.includes(k as DisplayPropertyKey),
            );
          setDisplay((prev) => ({ ...prev, properties: keys }));
        }
        const df = view.display_filters as Record<string, unknown> | undefined;
        if (df && typeof df === "object") {
          setDisplay((prev) => {
            const next = { ...prev, showSubWorkItems: df.sub_issue === true };
            if (
              typeof df.layout === "string" &&
              VIEW_LAYOUTS.includes(df.layout as ViewLayout)
            ) {
              next.layout = df.layout as ViewLayout;
            }
            return next;
          });
        }
        setViewLoading(false);
      })
      .catch(() => {
        setViewLoading(false);
        setViewNotFound(true);
      });
  }, [workspaceSlug, viewId, setFilters, setDisplay]);

  const filteredIssues = useMemo(() => {
    const stateGroupMap: Record<string, StateGroup> = {
      backlog: "backlog",
      unstarted: "unstarted",
      started: "started",
      completed: "completed",
      canceled: "canceled",
      cancelled: "canceled",
    };
    const getStateGroup = (
      stateId: string | null | undefined,
    ): StateGroup | undefined => {
      if (!stateId) return undefined;
      const s = states.find((x) => x.id === stateId);
      const g = s?.group?.toLowerCase();
      return g ? stateGroupMap[g] : undefined;
    };

    let list = issues;
    if (filters.priority.length) {
      list = list.filter(
        (i) => i.priority && filters.priority.includes(i.priority as Priority),
      );
    }
    if (filters.stateGroup.length) {
      list = list.filter((i) => {
        const g = getStateGroup(i.state_id ?? undefined);
        return g && filters.stateGroup.includes(g);
      });
    }
    if (filters.assigneeIds.length) {
      list = list.filter((i) =>
        i.assignee_ids?.some((id) => filters.assigneeIds.includes(id)),
      );
    }
    if (filters.createdByIds.length) {
      list = list.filter(
        (i) =>
          i.created_by_id && filters.createdByIds.includes(i.created_by_id),
      );
    }
    if (filters.labelIds.length) {
      list = list.filter((i) =>
        i.label_ids?.some((id) => filters.labelIds.includes(id)),
      );
    }
    if (filters.projectIds.length) {
      list = list.filter((i) => filters.projectIds.includes(i.project_id));
    }
    if (filters.grouping !== "all") {
      list = list.filter((i) => {
        const g = getStateGroup(i.state_id ?? undefined);
        if (filters.grouping === "backlog") return g === "backlog";
        if (filters.grouping === "active")
          return g && !["backlog", "completed", "canceled"].includes(g);
        return true;
      });
    }
    const now = new Date();
    const addDays = (d: number) =>
      new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
    // Only apply start date filter when we have a valid range for "custom" (otherwise custom would exclude all)
    const startDateEffective =
      filters.startDate.length &&
      !(
        filters.startDate.includes("custom") &&
        (!filters.startAfter || !filters.startBefore)
      );
    if (startDateEffective) {
      list = list.filter((i) => {
        const sd = i.start_date ? new Date(i.start_date) : null;
        if (!sd) return false;
        return filters.startDate.some((preset) => {
          if (
            preset === "custom" &&
            filters.startAfter &&
            filters.startBefore
          ) {
            const after = new Date(filters.startAfter);
            const before = new Date(filters.startBefore);
            return sd >= after && sd <= before;
          }
          if (preset === "custom") return false;
          const end =
            preset === "1_week"
              ? addDays(7)
              : preset === "2_weeks"
                ? addDays(14)
                : preset === "1_month"
                  ? addDays(30)
                  : preset === "2_months"
                    ? addDays(60)
                    : null;
          return end && sd >= now && sd <= end;
        });
      });
    }
    const dueDateEffective =
      filters.dueDate.length &&
      !(
        filters.dueDate.includes("custom") &&
        (!filters.dueAfter || !filters.dueBefore)
      );
    if (dueDateEffective) {
      list = list.filter((i) => {
        const td = i.target_date ? new Date(i.target_date) : null;
        if (!td) return false;
        return filters.dueDate.some((preset) => {
          if (preset === "custom" && filters.dueAfter && filters.dueBefore) {
            const after = new Date(filters.dueAfter);
            const before = new Date(filters.dueBefore);
            return td >= after && td <= before;
          }
          if (preset === "custom") return false;
          const end =
            preset === "1_week"
              ? addDays(7)
              : preset === "2_weeks"
                ? addDays(14)
                : preset === "1_month"
                  ? addDays(30)
                  : preset === "2_months"
                    ? addDays(60)
                    : null;
          return end && td >= now && td <= end;
        });
      });
    }
    // Static view filters (Plane-style: assigned to me, created by me, subscribed)
    if (viewId === "assigned" && currentUser?.id) {
      list = list.filter((i) => i.assignee_ids?.includes(currentUser.id));
    } else if (viewId === "created" && currentUser?.id) {
      list = list.filter((i) => i.created_by_id === currentUser.id);
    }
    // "subscribed" would filter by issue subscribers when API supports it; for now show all
    return list;
  }, [issues, filters, states, viewId, currentUser]);

  const stateMap = useMemo(() => {
    const m = new Map<string, StateApiResponse>();
    states.forEach((s) => m.set(s.id, s));
    return m;
  }, [states]);

  const memberMap = useMemo(() => {
    const m = new Map<string, WorkspaceMemberApiResponse>();
    members.forEach((mem) => m.set(mem.member_id, mem));
    return m;
  }, [members]);

  const sortedIssues = useMemo(() => {
    const list = [...filteredIssues];
    const prioOrder: Record<string, number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
      none: 4,
    };
    const getVal = (i: IssueApiResponse): string | number => {
      switch (display.sortBy) {
        case "name":
          return i.name ?? "";
        case "created_at":
          return i.created_at ? new Date(i.created_at).getTime() : 0;
        case "updated_at":
          return i.updated_at ? new Date(i.updated_at).getTime() : 0;
        case "priority":
          return prioOrder[i.priority ?? "none"] ?? 5;
        case "state":
          return stateMap.get(i.state_id ?? "")?.name ?? "—";
        case "assignee": {
          const m = memberMap.get(i.assignee_ids?.[0] ?? "");
          return m?.member_display_name ?? m?.member_email ?? "—";
        }
        case "start_date":
          return i.start_date ? new Date(i.start_date).getTime() : 0;
        case "due_date":
          return i.target_date ? new Date(i.target_date).getTime() : 0;
        default:
          return 0;
      }
    };
    list.sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);
      const cmp =
        typeof va === "string" && typeof vb === "string"
          ? va.localeCompare(vb, undefined, { sensitivity: "base" })
          : Number(va) - Number(vb);
      return display.sortOrder === "asc" ? cmp : -cmp;
    });
    return list;
  }, [filteredIssues, display.sortBy, display.sortOrder, stateMap, memberMap]);

  const handleSort = (column: SortableColumn) => {
    const nextOrder: SortOrder =
      display.sortBy === column && display.sortOrder === "desc"
        ? "asc"
        : "desc";
    setDisplay((prev) => ({ ...prev, sortBy: column, sortOrder: nextOrder }));
  };

  useEffect(() => {
    if (!workspaceSlug) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset loading when no slug (kept for future use)
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
      .then((projs) => {
        if (cancelled) return null;
        setProjects(projs ?? []);
        if (!projs?.length) {
          setIssues([]);
          setStates([]);
          setLabels([]);
          setMembers([]);
          return null;
        }
        const n = projs.length;
        return Promise.all([
          workspaceService.listMembers(workspaceSlug),
          ...projs.map((p) =>
            issueService.list(workspaceSlug!, p.id, { limit: 100 }),
          ),
          ...projs.map((p) => stateService.list(workspaceSlug!, p.id)),
          ...projs.map((p) => labelService.list(workspaceSlug!, p.id)),
        ]).then((results) => ({ results, n }));
      })
      .then((payload) => {
        if (cancelled || !payload) return;
        const { results, n } = payload;
        const [mem, ...rest] = results;
        const issueArrays = rest.slice(0, n) as IssueApiResponse[][];
        const stateArrays = rest.slice(n, n * 2) as StateApiResponse[][];
        const labelArrays = rest.slice(n * 2) as LabelApiResponse[][];
        setMembers((mem as WorkspaceMemberApiResponse[]) ?? []);
        setIssues(issueArrays.flat());
        setStates(stateArrays.flat());
        setLabels(labelArrays.flat());
      })
      .catch(() => {
        if (!cancelled) setWorkspace(null);
        setProjects([]);
        setIssues([]);
        setStates([]);
        setLabels([]);
        setMembers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  const getProject = (projectId: string) =>
    projects.find((p) => p.id === projectId);
  const getStateName = (stateId: string | null | undefined) =>
    stateId ? (states.find((s) => s.id === stateId)?.name ?? stateId) : "—";
  const getMember = (
    memberId: string,
  ): WorkspaceMemberApiResponse | undefined =>
    members.find((m) => m.member_id === memberId);
  const getLabel = (labelId: string): LabelApiResponse | undefined =>
    labels.find((l) => l.id === labelId);

  const getMemberLabel = (memberId: string): string => {
    if (currentUser?.id && memberId === currentUser.id) return "You";
    const m = getMember(memberId);
    const display = m?.member_display_name ?? m?.member_email;
    if (display) return display;
    const emailUser = m?.member_email?.split("@")[0]?.trim();
    if (emailUser) return emailUser;
    return "Member";
  };

  const updateIssue = useCallback(
    async (
      issue: IssueApiResponse,
      patch: Partial<{
        priority: Priority;
        assignee_ids: string[];
        label_ids: string[];
        start_date: string | null;
        target_date: string | null;
      }>,
    ) => {
      if (!workspaceSlug) return;
      try {
        await issueService.update(
          workspaceSlug,
          issue.project_id,
          issue.id,
          patch as never,
        );
        setIssues((prev) =>
          prev.map((i) =>
            i.id === issue.id ? { ...i, ...patch } : i,
          ),
        );
      } catch {
        // Optionally show toast; for now silent
      }
    },
    [workspaceSlug],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-[var(--txt-tertiary)]">
        Loading…
      </div>
    );
  }
  if (!workspace) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-[var(--txt-secondary)]">Workspace not found.</p>
        <Link
          to="/"
          className="text-sm font-medium text-[var(--txt-accent-primary)] hover:underline"
        >
          Go to home
        </Link>
      </div>
    );
  }
  if (viewLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-[var(--txt-tertiary)]">
        Loading view…
      </div>
    );
  }
  if (viewNotFound && workspaceSlug) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-lg font-medium text-[var(--txt-primary)]">
          View does not exist
        </p>
        <p className="text-sm text-[var(--txt-secondary)]">
          The view you are looking for does not exist or you don&apos;t have
          permission to view it.
        </p>
        <Link
          to={`/${workspace.slug}/views`}
          className="inline-flex items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] px-3 py-2 text-sm font-medium text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]"
        >
          All work items
        </Link>
      </div>
    );
  }

  const baseUrl = `/${workspace.slug}`;

  // Plane-style: fixed column order, scrollable from Priority onward
  const scrollableColumns = SPREADSHEET_COLUMN_ORDER.filter(
    (k) =>
      k === "created_at" ||
      k === "updated_at" ||
      display.properties.includes(k as DisplayPropertyKey),
  );
  const formatDate = (s: string | undefined | null) =>
    s
      ? new Date(s).toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
        })
      : "—";

  const renderCell = (issue: IssueApiResponse, key: DisplayPropertyKey) => {
    const project = getProject(issue.project_id);
    const displayId = project
      ? `${project.identifier ?? project.id.slice(0, 8)}-${issue.sequence_id ?? issue.id.slice(-4)}`
      : issue.id.slice(-4);
    const assignee = issue.assignee_ids?.[0]
      ? getMember(issue.assignee_ids[0])
      : undefined;
    const firstLabelId = issue.label_ids?.[0];
    const firstLabel = firstLabelId ? getLabel(firstLabelId) : undefined;
    switch (key) {
      case "id":
        return <span className="text-[var(--txt-secondary)]">{displayId}</span>;
      case "assignee":
        return assignee ? (
          <span className="inline-flex items-center gap-2 text-[var(--txt-secondary)]">
            {getImageUrl(assignee.member_avatar) ? (
              <img
                src={getImageUrl(assignee.member_avatar)!}
                alt=""
                className="size-6 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg-layer-2)] text-xs font-medium text-[var(--txt-secondary)]">
                {(
                  assignee.member_display_name ??
                  assignee.member_email ??
                  "?"
                ).charAt(0)}
              </span>
            )}
            <span className="truncate">
              {assignee.member_display_name ?? assignee.member_email ?? "—"}
            </span>
          </span>
        ) : (
          <span className="text-[var(--txt-tertiary)]">—</span>
        );
      case "start_date":
        return (
          <span className="text-[var(--txt-secondary)]">
            {formatDate(issue.start_date ?? undefined)}
          </span>
        );
      case "due_date":
        return (
          <span className="text-[var(--txt-secondary)]">
            {formatDate(issue.target_date ?? undefined)}
          </span>
        );
      case "labels":
        return firstLabel ? (
          <span className="inline-flex items-center gap-2 text-[var(--txt-secondary)]">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{
                backgroundColor: firstLabel.color ?? "var(--txt-icon-tertiary)",
              }}
            />
            {firstLabel.name}
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 text-[var(--txt-tertiary)]">
            <IconTag className="size-3.5 shrink-0 opacity-70" />
            Select labels
          </span>
        );
      case "priority":
        return (
          <span className="inline-flex items-center gap-2 text-[var(--txt-secondary)]">
            <IconBarChart className="size-3.5 shrink-0 text-amber-500" />
            {issue.priority === "none" || !issue.priority
              ? "None"
              : issue.priority}
          </span>
        );
      case "state":
        return (
          <span className="inline-flex items-center gap-2 text-[var(--txt-secondary)]">
            <span className="size-3.5 shrink-0 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-layer-1)]" />
            {getStateName(issue.state_id ?? undefined)}
          </span>
        );
      case "link":
        return (
          <span className="text-[var(--txt-tertiary)]">0 links</span>
        );
      case "attachment_count":
        return (
          <span className="text-[var(--txt-tertiary)]">0 attachments</span>
        );
      case "sub_work_item_count":
        return (
          <span className="text-[var(--txt-tertiary)]">0 sub-work items</span>
        );
      case "estimate":
        return (
          <span className="text-[var(--txt-tertiary)]">Estimate</span>
        );
      case "module":
        return (
          <span className="text-[var(--txt-tertiary)]">Select modules</span>
        );
      case "cycle":
        return (
          <span className="text-[var(--txt-tertiary)]">Select cycle</span>
        );
      default:
        return null;
    }
  };

  const headerLabel = (
    key: (typeof scrollableColumns)[number],
  ): string => {
    if (key === "created_at") return "Created on";
    if (key === "updated_at") return "Updated on";
    return DISPLAY_PROPERTY_LABELS[key as DisplayPropertyKey];
  };
  const totalCols = 1 + scrollableColumns.length;
  const sortableColumnMap: Partial<
    Record<DisplayPropertyKey | "created_at" | "updated_at", SortableColumn>
  > = {
    priority: "priority",
    state: "state",
    assignee: "assignee",
    start_date: "start_date",
    due_date: "due_date",
    created_at: "created_at",
    updated_at: "updated_at",
  };
  const renderSortableTh = (
    column: SortableColumn,
    label: string,
    icon?: React.ReactNode,
    extraClass = "",
  ) => {
    const isActive = display.sortBy === column;
    return (
      <th
        key={column}
        className={`border-r-column-subtle whitespace-nowrap px-4 py-2 font-medium text-[var(--txt-secondary)] last:border-r-0${extraClass}`}
      >
        <button
          type="button"
          onClick={() => handleSort(column)}
          className="inline-flex items-center gap-1.5 hover:text-[var(--txt-primary)]"
        >
          {icon}
          {label}
          <IconChevronDown
            className={`size-4 shrink-0 opacity-60 ${isActive ? "opacity-100" : ""}`}
            style={
              isActive && display.sortOrder === "asc"
                ? { transform: "rotate(180deg)" }
                : undefined
            }
          />
        </button>
      </th>
    );
  };

  if (
    display.layout === "kanban" ||
    display.layout === "calendar" ||
    display.layout === "gantt_chart"
  ) {
    return (
      <div className="-m-[var(--padding-page)] flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center p-8">
          <p className="text-sm text-[var(--txt-tertiary)]">
            {display.layout === "kanban" && "Kanban view is coming soon."}
            {display.layout === "calendar" && "Calendar view is coming soon."}
            {display.layout === "gantt_chart" &&
              "Gantt chart view is coming soon."}
          </p>
        </div>
      </div>
    );
  }

  if (display.layout === "list") {
    return (
      <div className="-m-[var(--padding-page)] flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {sortedIssues.length === 0 ? (
            <div className="px-4 py-16 text-center text-sm text-[var(--txt-tertiary)]">
              No work items yet. Create one from a project&apos;s Work items
              section or add a view to get started.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {sortedIssues.map((issue) => {
                const project = getProject(issue.project_id);
                const issueBaseUrl = project
                  ? `${baseUrl}/projects/${project.id}`
                  : baseUrl;
                return (
                  <li
                    key={issue.id}
                    className="transition-colors hover:bg-[var(--bg-layer-1-hover)]"
                  >
                    <Link
                      to={`${issueBaseUrl}/issues/${issue.id}`}
                      className="flex items-center justify-between px-4 py-3 text-[var(--txt-primary)] no-underline hover:text-[var(--txt-accent-primary)]"
                    >
                      <span className="font-medium">{issue.name}</span>
                      <span className="text-sm text-[var(--txt-secondary)]">
                        {formatDate(issue.created_at)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    );
  }

  const isFirstScrollableColumn = (key: (typeof scrollableColumns)[number]) =>
    scrollableColumns[0] === key;

  const scrollableTh = (key: (typeof scrollableColumns)[number]) => {
    const sortCol = sortableColumnMap[key];
    const label = headerLabel(key);
    const firstColBorder = isFirstScrollableColumn(key)
      ? " border-l border-[var(--border-subtle)]"
      : "";
    if (sortCol) {
      const icon =
        key === "state" ? (
          <IconRadio className="size-4 shrink-0 opacity-70" />
        ) : key === "priority" ? (
          <IconBarChart className="size-4 shrink-0 opacity-70" />
        ) : key === "assignee" ? (
          <IconUser className="size-4 shrink-0 opacity-70" />
        ) : key === "labels" ? (
          <IconTag className="size-4 shrink-0 opacity-70" />
        ) : undefined;
      return (
        <Fragment key={key}>
          {renderSortableTh(sortCol, label, icon, firstColBorder)}
        </Fragment>
      );
    }
    return (
      <th
        key={key}
        className={`border-r-column-subtle whitespace-nowrap px-4 py-2 font-medium text-[var(--txt-secondary)] last:border-r-0${firstColBorder}`}
      >
        <span className="inline-flex items-center gap-1.5">
          {key === "state" && (
            <IconRadio className="size-4 shrink-0 opacity-70" />
          )}
          {key === "priority" && (
            <IconBarChart className="size-4 shrink-0 opacity-70" />
          )}
          {key === "assignee" && (
            <IconUser className="size-4 shrink-0 opacity-70" />
          )}
          {key === "labels" && (
            <IconTag className="size-4 shrink-0 opacity-70" />
          )}
          {label}
        </span>
      </th>
    );
  };

  const scrollableTd = (
    issue: IssueApiResponse,
    key: (typeof scrollableColumns)[number],
  ) => {
    if (key === "created_at") {
      return (
        <span className="text-[var(--txt-secondary)]">
          {formatDate(issue.created_at)}
        </span>
      );
    }
    if (key === "updated_at") {
      return (
        <span className="text-[var(--txt-secondary)]">
          {formatDate(issue.updated_at)}
        </span>
      );
    }
    return renderCell(issue, key as DisplayPropertyKey);
  };

  const editableKeys = ["priority", "assignee", "labels", "start_date", "due_date"];
  const isEditableColumn = (key: string) => editableKeys.includes(key);

  const renderTableCell = (
    issue: IssueApiResponse,
    key: (typeof scrollableColumns)[number],
  ) => {
    if (key === "priority") {
      const displayValue =
        issue.priority === "none" || !issue.priority
          ? "None"
          : (issue.priority as string);
      const priorityTriggerContent = (
        <span className="inline-flex min-w-0 items-center gap-2 text-[var(--txt-secondary)]">
          <IconBarChart className="size-3.5 shrink-0 text-amber-500" />
          <span className="truncate">{displayValue}</span>
        </span>
      );
      return (
        <Dropdown
          id={`${issue.id}-priority`}
          openId={openCellId}
          onOpen={setOpenCellId}
          label="Priority"
          icon={<IconBarChart className="size-3.5 text-amber-500" />}
          displayValue={displayValue}
          triggerClassName={CELL_TRIGGER_CLASS}
          triggerContent={priorityTriggerContent}
          align="right"
          panelClassName="max-h-60 min-w-[160px] overflow-auto rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] py-1 shadow-[var(--shadow-raised)]"
        >
          {(
            ["urgent", "high", "medium", "low", "none"] as Priority[]
          ).map((p) => (
            <button
              key={p}
              type="button"
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--bg-layer-1-hover)]"
              onClick={() => {
                setOpenCellId(null);
                updateIssue(issue, { priority: p });
              }}
            >
              <span className="truncate capitalize text-[var(--txt-primary)]">
                {p}
              </span>
              <Badge variant={priorityVariant[p]} className="text-[10px]">
                {p}
              </Badge>
            </button>
          ))}
        </Dropdown>
      );
    }
    if (key === "assignee") {
      const assignee = issue.assignee_ids?.[0]
        ? getMember(issue.assignee_ids[0])
        : undefined;
      const assigneeIds = issue.assignee_ids ?? [];
      const displayValue = assignee
        ? getMemberLabel(assignee.member_id)
        : "—";
      const assigneeTriggerContent = assignee ? (
        <span className="inline-flex min-w-0 items-center gap-2 text-[var(--txt-secondary)]">
          {getImageUrl(assignee.member_avatar) ? (
            <img
              src={getImageUrl(assignee.member_avatar)!}
              alt=""
              className="size-6 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg-layer-2)] text-xs font-medium text-[var(--txt-secondary)]">
              {(
                assignee.member_display_name ??
                assignee.member_email ??
                "?"
              ).charAt(0)}
            </span>
          )}
          <span className="truncate">
            {assignee.member_display_name ?? assignee.member_email ?? "—"}
          </span>
        </span>
      ) : (
        <span className="text-[var(--txt-tertiary)]">—</span>
      );
      return (
        <Dropdown
          id={`${issue.id}-assignee`}
          openId={openCellId}
          onOpen={setOpenCellId}
          label="Assignees"
          icon={<IconUser className="size-3.5 text-[var(--txt-icon-tertiary)]" />}
          displayValue={displayValue}
          triggerClassName={CELL_TRIGGER_CLASS}
          triggerContent={assigneeTriggerContent}
          align="right"
          panelClassName="max-h-72 min-w-[220px] overflow-auto rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] py-1 shadow-[var(--shadow-raised)]"
        >
          {currentUser && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--bg-layer-1-hover)]"
              onClick={() => {
                const checked = assigneeIds.includes(currentUser.id);
                const next = checked
                  ? assigneeIds.filter((x) => x !== currentUser.id)
                  : [...assigneeIds, currentUser.id];
                updateIssue(issue, { assignee_ids: next });
              }}
            >
              {getImageUrl(currentUser.avatarUrl) ? (
                <img
                  src={getImageUrl(currentUser.avatarUrl)!}
                  alt=""
                  className="size-5 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-200)] text-[10px] font-medium text-[var(--brand-default)]">
                  {currentUser.name?.charAt(0) ?? "?"}
                </span>
              )}
              <span className="truncate text-[var(--txt-primary)]">You</span>
              {assigneeIds.includes(currentUser.id) && (
                <span className="ml-auto text-[var(--txt-tertiary)]">✓</span>
              )}
            </button>
          )}
          {members
            .filter((m) => m.member_id !== currentUser?.id)
            .map((m) => {
              const checked = assigneeIds.includes(m.member_id);
              return (
                <button
                  key={m.id}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--bg-layer-1-hover)]"
                  onClick={() => {
                    const next = checked
                      ? assigneeIds.filter((x) => x !== m.member_id)
                      : [...assigneeIds, m.member_id];
                    updateIssue(issue, { assignee_ids: next });
                  }}
                >
                  {getImageUrl(m.member_avatar) ? (
                    <img
                      src={getImageUrl(m.member_avatar)!}
                      alt=""
                      className="size-5 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--bg-layer-2)] text-[10px] text-[var(--txt-secondary)]">
                      {(m.member_display_name ?? m.member_email ?? "?").charAt(
                        0,
                      )}
                    </span>
                  )}
                  <span className="truncate text-[var(--txt-primary)]">
                    {m.member_display_name ?? m.member_email ?? m.member_id}
                  </span>
                  {checked && (
                    <span className="ml-auto text-[var(--txt-tertiary)]">✓</span>
                  )}
                </button>
              );
            })}
        </Dropdown>
      );
    }
    if (key === "labels") {
      const labelIds = issue.label_ids ?? [];
      const firstLabelId = labelIds[0];
      const firstLabel = firstLabelId ? getLabel(firstLabelId) : undefined;
      const displayValue = firstLabel ? firstLabel.name : "Select labels";
      const labelsTriggerContent = firstLabel ? (
        <span className="inline-flex min-w-0 items-center gap-2 text-[var(--txt-secondary)]">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{
              backgroundColor: firstLabel.color ?? "var(--txt-icon-tertiary)",
            }}
          />
          <span className="truncate">{firstLabel.name}</span>
        </span>
      ) : (
        <span className="inline-flex min-w-0 items-center gap-2 text-[var(--txt-tertiary)]">
          <IconTag className="size-3.5 shrink-0 opacity-70" />
          <span className="truncate">Select labels</span>
        </span>
      );
      return (
        <Dropdown
          id={`${issue.id}-labels`}
          openId={openCellId}
          onOpen={setOpenCellId}
          label="Labels"
          icon={<IconTag className="size-3.5 text-[var(--txt-icon-tertiary)]" />}
          displayValue={displayValue}
          triggerClassName={CELL_TRIGGER_CLASS}
          triggerContent={labelsTriggerContent}
          align="right"
          panelClassName="max-h-72 min-w-[220px] overflow-auto rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] py-1 shadow-[var(--shadow-raised)]"
        >
          {labels.length === 0 ? (
            <div className="px-3 py-2 text-sm text-[var(--txt-tertiary)]">
              No labels.
            </div>
          ) : (
            labels.map((l) => {
              const checked = labelIds.includes(l.id);
              return (
                <button
                  key={l.id}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--bg-layer-1-hover)]"
                  onClick={() => {
                    const next = checked
                      ? labelIds.filter((x) => x !== l.id)
                      : [...labelIds, l.id];
                    updateIssue(issue, { label_ids: next });
                  }}
                >
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        l.color ?? "var(--txt-icon-tertiary)",
                    }}
                  />
                  <span className="truncate text-[var(--txt-primary)]">
                    {l.name}
                  </span>
                  {checked && (
                    <span className="ml-auto text-[var(--txt-tertiary)]">✓</span>
                  )}
                </button>
              );
            })
          )}
        </Dropdown>
      );
    }
    if (key === "start_date") {
      const displayValue = issue.start_date
        ? formatDate(issue.start_date)
        : "—";
      return (
        <Dropdown
          id={`${issue.id}-start_date`}
          openId={openCellId}
          onOpen={setOpenCellId}
          label="Start date"
          icon={<IconCalendar className="size-3.5 text-[var(--txt-icon-tertiary)]" />}
          displayValue={displayValue}
          triggerClassName={CELL_TRIGGER_CLASS}
          align="right"
          panelClassName="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] p-2 shadow-[var(--shadow-raised)]"
        >
          <input
            type="date"
            value={issue.start_date ?? ""}
            onChange={(e) => {
              const v = e.target.value || null;
              updateIssue(issue, { start_date: v });
              setOpenCellId(null);
            }}
            className="rounded border border-[var(--border-subtle)] bg-[var(--bg-layer-1)] px-2 py-1.5 text-sm text-[var(--txt-primary)]"
          />
        </Dropdown>
      );
    }
    if (key === "due_date") {
      const displayValue = issue.target_date
        ? formatDate(issue.target_date)
        : "—";
      return (
        <Dropdown
          id={`${issue.id}-due_date`}
          openId={openCellId}
          onOpen={setOpenCellId}
          label="Due date"
          icon={<IconCalendar className="size-3.5 text-[var(--txt-icon-tertiary)]" />}
          displayValue={displayValue}
          triggerClassName={CELL_TRIGGER_CLASS}
          align="right"
          panelClassName="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] p-2 shadow-[var(--shadow-raised)]"
        >
          <input
            type="date"
            value={issue.target_date ?? ""}
            onChange={(e) => {
              const v = e.target.value || null;
              updateIssue(issue, { target_date: v });
              setOpenCellId(null);
            }}
            className="rounded border border-[var(--border-subtle)] bg-[var(--bg-layer-1)] px-2 py-1.5 text-sm text-[var(--txt-primary)]"
          />
        </Dropdown>
      );
    }
    return (
      <span className="block px-4 py-2">
        {scrollableTd(issue, key)}
      </span>
    );
  };

  return (
    <div className="-m-[var(--padding-page)] flex min-h-0 flex-1 flex-col">
      <div className="flex-1">
        <table className="w-full min-w-max border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-layer-1)]">
              <th className="sticky left-0 z-10 min-w-[200px] whitespace-nowrap border-r border-[var(--border-subtle)] bg-[var(--bg-layer-1)] px-4 py-2">
                {(() => {
                  const isActive = display.sortBy === "name";
                  return (
                    <button
                      type="button"
                      onClick={() => handleSort("name")}
                      className="inline-flex items-center gap-1.5 hover:text-[var(--txt-primary)] font-medium text-[var(--txt-secondary)]"
                    >
                      Work items
                      <IconChevronDown
                        className={`size-4 shrink-0 opacity-60 ${isActive ? "opacity-100" : ""}`}
                        style={
                          isActive && display.sortOrder === "asc"
                            ? { transform: "rotate(180deg)" }
                            : undefined
                        }
                      />
                    </button>
                  );
                })()}
              </th>
              {scrollableColumns.map(scrollableTh)}
            </tr>
          </thead>
          <tbody>
            {sortedIssues.length === 0 ? (
              <tr>
                <td
                  colSpan={totalCols}
                  className="px-4 py-16 text-center text-sm text-[var(--txt-tertiary)]"
                >
                  No work items yet. Create one from a project&apos;s Work items
                  section or add a view to get started.
                </td>
              </tr>
            ) : (
              sortedIssues.map((issue) => {
                const project = getProject(issue.project_id);
                const issueBaseUrl = project
                  ? `${baseUrl}/projects/${project.id}`
                  : baseUrl;
                return (
                  <tr
                    key={issue.id}
                    className="border-b border-[var(--border-subtle)] last:border-b-0 transition-colors"
                  >
                    <td className="sticky left-0 z-10 min-w-[200px] border-r border-[var(--border-subtle)] bg-[var(--bg-surface-1)] px-4 py-2 hover:bg-[var(--bg-layer-1-hover)]">
                      <Link
                        to={`${issueBaseUrl}/issues/${issue.id}`}
                        className="block font-medium text-[var(--txt-primary)] no-underline hover:text-[var(--txt-accent-primary)]"
                      >
                        {display.properties.includes("id") && (
                          <span className="mr-2 text-[var(--txt-secondary)]">
                            {project
                              ? `${project.identifier ?? project.id.slice(0, 8)}-${issue.sequence_id ?? issue.id.slice(-4)}`
                              : issue.id.slice(-4)}
                          </span>
                        )}
                        {issue.name}
                      </Link>
                    </td>
                    {scrollableColumns.map((colKey) => (
                      <td
                        key={colKey}
                        className={
                          isEditableColumn(colKey)
                            ? `border-r-column-subtle p-0 whitespace-nowrap last:border-r-0${isFirstScrollableColumn(colKey) ? " border-l border-[var(--border-subtle)]" : ""}`
                            : `border-r-column-subtle px-4 py-2 whitespace-nowrap last:border-r-0${isFirstScrollableColumn(colKey) ? " border-l border-[var(--border-subtle)]" : ""}`
                        }
                      >
                        {renderTableCell(issue, colKey)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
