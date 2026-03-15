import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui";
import { CreateWorkItemModal } from "../components/CreateWorkItemModal";
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
import {
  parseWorkspaceViewFiltersFromSearchParams,
  type StateGroup,
} from "../types/workspaceViewFilters";
import {
  parseWorkspaceViewDisplayFromSearchParams,
  DISPLAY_PROPERTY_KEYS,
  type DisplayPropertyKey,
  type SortableColumn,
  type SortOrder,
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
  const location = useLocation();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
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
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = parseWorkspaceViewFiltersFromSearchParams(searchParams);
  const display = parseWorkspaceViewDisplayFromSearchParams(searchParams);
  const { user: currentUser } = useAuth();

  // When viewing a saved view, fetch it and apply its filters/display to URL once (Plane-style).
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
        const params = new URLSearchParams();
        const f = view.filters as Record<string, string> | undefined;
        if (f && typeof f === "object") {
          Object.entries(f).forEach(([k, v]) => {
            if (v != null && v !== "") params.set(k, String(v));
          });
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
          if (keys.length) params.set("display", keys.join(","));
        }
        const df = view.display_filters as Record<string, unknown> | undefined;
        if (df?.sub_issue === true) params.set("show_sub", "1");
        setViewLoading(false);
        navigate(
          { pathname: location.pathname, search: params.toString() },
          { replace: true },
        );
      })
      .catch(() => {
        setViewLoading(false);
        setViewNotFound(true);
      });
  }, [workspaceSlug, viewId, navigate, location.pathname]);

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
        case "state": {
          const s = states.find((x) => x.id === i.state_id);
          return s?.name ?? "—";
        }
        case "assignee": {
          const m = members.find((x) => x.member_id === i.assignee_ids?.[0]);
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
  }, [filteredIssues, display.sortBy, display.sortOrder, states, members]);

  const handleSort = (column: SortableColumn) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        const nextOrder: SortOrder =
          display.sortBy === column && display.sortOrder === "desc"
            ? "asc"
            : "desc";
        next.set("sort_by", column);
        next.set("order", nextOrder);
        return next;
      },
      { replace: true },
    );
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

  const optionalColumns = display.properties;
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
            {assignee.member_avatar ? (
              <img
                src={assignee.member_avatar}
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
          <span className="text-[var(--txt-tertiary)]">—</span>
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
      case "sub_work_item_count":
      case "attachment_count":
      case "link":
      case "estimate":
      case "module":
      case "cycle":
        return <span className="text-[var(--txt-tertiary)]">—</span>;
      default:
        return null;
    }
  };

  const headerLabels: Record<DisplayPropertyKey, string> = {
    id: "ID",
    assignee: "Assignees",
    start_date: "Start date",
    due_date: "Due date",
    labels: "Labels",
    priority: "Priority",
    state: "State",
    sub_work_item_count: "Sub-work item count",
    attachment_count: "Attachment count",
    link: "Link",
    estimate: "Estimate",
    module: "Module",
    cycle: "Cycle",
  };
  const totalCols = 3 + optionalColumns.length;
  const sortableColumnMap: Partial<Record<DisplayPropertyKey, SortableColumn>> =
    {
      priority: "priority",
      state: "state",
      assignee: "assignee",
      start_date: "start_date",
      due_date: "due_date",
    };
  const renderSortableTh = (
    column: SortableColumn,
    label: string,
    icon?: React.ReactNode,
  ) => {
    const isActive = display.sortBy === column;
    return (
      <th
        key={column}
        className="px-4 py-3.5 font-medium text-[var(--txt-secondary)]"
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
      <div className="flex h-full flex-col">
        <h1 className="mb-4 text-lg font-semibold text-[var(--txt-primary)]">
          Work items
        </h1>
        <div className="flex flex-1 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] p-8">
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
      <div className="flex h-full flex-col">
        <h1 className="mb-4 text-lg font-semibold text-[var(--txt-primary)]">
          Work items
        </h1>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-1)]">
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
        {sortedIssues.length > 0 && (
          <div className="mt-4 flex justify-start">
            <Button
              size="sm"
              variant="secondary"
              className="gap-1.5 border-dashed text-[13px] font-medium"
              onClick={() => setCreateOpen(true)}
            >
              New work item
            </Button>
          </div>
        )}
        <CreateWorkItemModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          workspaceSlug={workspace.slug}
          projects={projects}
          defaultProjectId={projects[0]?.id}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <h1 className="mb-4 text-lg font-semibold text-[var(--txt-primary)]">
        Work items
      </h1>
      <div className="min-h-0 flex-1 overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-1)]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-layer-1)]">
              {renderSortableTh("name", "Work items")}
              {renderSortableTh("created_at", "Created on")}
              {renderSortableTh("updated_at", "Updated on")}
              {optionalColumns.map((key) => {
                const sortCol = sortableColumnMap[key];
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
                      {renderSortableTh(sortCol, headerLabels[key], icon)}
                    </Fragment>
                  );
                }
                return (
                  <th
                    key={key}
                    className="px-4 py-3.5 font-medium text-[var(--txt-secondary)]"
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
                      {headerLabels[key]}
                    </span>
                  </th>
                );
              })}
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
                    className="border-b border-[var(--border-subtle)] last:border-b-0 transition-colors hover:bg-[var(--bg-layer-1-hover)]"
                  >
                    <td className="px-4 py-3.5">
                      <Link
                        to={`${issueBaseUrl}/issues/${issue.id}`}
                        className="block font-medium text-[var(--txt-primary)] no-underline hover:text-[var(--txt-accent-primary)]"
                      >
                        {issue.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-[var(--txt-secondary)]">
                      {formatDate(issue.created_at)}
                    </td>
                    <td className="px-4 py-3.5 text-[var(--txt-secondary)]">
                      {formatDate(issue.updated_at)}
                    </td>
                    {optionalColumns.map((key) => (
                      <td key={key} className="px-4 py-3.5">
                        {renderCell(issue, key)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {sortedIssues.length > 0 && (
        <div className="mt-4 flex justify-start">
          <Button
            size="sm"
            variant="secondary"
            className="gap-1.5 border-dashed text-[13px] font-medium"
            onClick={() => setCreateOpen(true)}
          >
            New work item
          </Button>
        </div>
      )}

      <CreateWorkItemModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        workspaceSlug={workspace.slug}
        projects={projects}
        defaultProjectId={projects[0]?.id}
      />
    </div>
  );
}
