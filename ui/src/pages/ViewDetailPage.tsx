import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Badge, Avatar, Button } from "../components/ui";
import { CreateWorkItemModal } from "../components/CreateWorkItemModal";
import { useProjectSavedViewDisplay } from "../contexts/ProjectSavedViewDisplayContext";
import { useWorkspaceViewsState } from "../contexts/WorkspaceViewsStateContext";
import { workspaceService } from "../services/workspaceService";
import { projectService } from "../services/projectService";
import { issueService } from "../services/issueService";
import { stateService } from "../services/stateService";
import { labelService } from "../services/labelService";
import { cycleService } from "../services/cycleService";
import { moduleService } from "../services/moduleService";
import { viewService } from "../services/viewService";
import type {
  IssueApiResponse,
  IssueViewApiResponse,
  WorkspaceApiResponse,
  ProjectApiResponse,
  StateApiResponse,
  LabelApiResponse,
  WorkspaceMemberApiResponse,
  CycleApiResponse,
  ModuleApiResponse,
} from "../api/types";
import type { Priority } from "../types";
import type {
  SavedViewDisplayPropertyId,
  SavedViewOrderBy,
} from "../lib/projectSavedViewDisplay";
import { getImageUrl } from "../lib/utils";
import { parseWorkspaceViewFiltersFromSearchParams } from "../types/workspaceViewFilters";

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

const NONE_STATE_KEY = "__no_state__";
const ALL_GROUP_KEY = "__all__";
const NONE_CYCLE_KEY = "__no_cycle__";
const NONE_MODULE_KEY = "__no_module__";
const NONE_LABEL_KEY = "__no_label__";
const NONE_ASSIGNEE_KEY = "__no_assignee__";
const NONE_CREATOR_KEY = "__no_creator__";

const PRIORITY_RANK: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

function sortIssuesList(
  list: IssueApiResponse[],
  orderBy: SavedViewOrderBy,
): IssueApiResponse[] {
  const out = [...list];
  switch (orderBy) {
    case "manual":
      return out.sort((a, b) => {
        const so = (a.sort_order ?? 0) - (b.sort_order ?? 0);
        if (so !== 0) return so;
        const seq = (a.sequence_id ?? 0) - (b.sequence_id ?? 0);
        if (seq !== 0) return seq;
        return a.name.localeCompare(b.name);
      });
    case "last_created":
      return out.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    case "last_updated":
      return out.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
    case "start_date":
      return out.sort((a, b) => {
        const as = a.start_date ? new Date(a.start_date).getTime() : Infinity;
        const bs = b.start_date ? new Date(b.start_date).getTime() : Infinity;
        return as - bs;
      });
    case "due_date":
      return out.sort((a, b) => {
        const ad = a.target_date ? new Date(a.target_date).getTime() : Infinity;
        const bd = b.target_date ? new Date(b.target_date).getTime() : Infinity;
        return ad - bd;
      });
    case "priority":
      return out.sort((a, b) => {
        const pa = PRIORITY_RANK[a.priority ?? "none"] ?? 99;
        const pb = PRIORITY_RANK[b.priority ?? "none"] ?? 99;
        return pa - pb;
      });
    default:
      return out;
  }
}

function formatShortDate(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleDateString();
}

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
const IconTag = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
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
const IconPlus = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </svg>
);
const IconLinkOut = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" x2="21" y1="14" y2="3" />
  </svg>
);

type GroupedSections = {
  order: string[];
  groups: Map<string, IssueApiResponse[]>;
  title: (sectionKey: string) => string;
};

function pushUniq(arr: string[], id: string) {
  if (!arr.includes(id)) arr.push(id);
}

export function ViewDetailPage() {
  const { settings } = useProjectSavedViewDisplay();
  const { filters: workspaceViewFilters, setFilters: setWorkspaceViewFilters } =
    useWorkspaceViewsState();
  const { workspaceSlug, projectId, viewId } = useParams<{
    workspaceSlug: string;
    projectId: string;
    viewId: string;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createError, setCreateError] = useState<string | null>(null);
  const [view, setView] = useState<IssueViewApiResponse | null>(null);
  const [issues, setIssues] = useState<IssueApiResponse[]>([]);
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [labels, setLabels] = useState<LabelApiResponse[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [cycles, setCycles] = useState<CycleApiResponse[]>([]);
  const [modules, setModules] = useState<ModuleApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetchIssues = () => {
    if (!workspaceSlug || !projectId) return;
    issueService
      .list(workspaceSlug, projectId, { limit: 500 })
      .then(setIssues)
      .catch(() => {});
  };

  useEffect(() => {
    if (!workspaceSlug || !viewId) {
      queueMicrotask(() => {
        setLoading(false);
        setError("View not found.");
      });
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
    });
    viewService
      .get(workspaceSlug, viewId)
      .then((data) => {
        if (!cancelled) setView(data ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setView(null);
          setError("Unable to load this view.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, viewId]);

  // Keep the shared “Filters” dropdown state in sync with this saved view.
  // We treat the saved view's `filters` JSON as the same key/value shape that
  // `workspaceViewFiltersToSearchParams()` produces on the way into the API.
  useEffect(() => {
    if (!view || !viewId) return;
    const raw = view.filters;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;

    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (v == null) continue;
      const s = String(v).trim();
      if (s) params.set(k, s);
    }

    const next = parseWorkspaceViewFiltersFromSearchParams(params);
    setWorkspaceViewFilters(next);
  }, [setWorkspaceViewFilters, view, viewId]);

  useEffect(() => {
    if (!workspaceSlug || !projectId) return;
    let cancelled = false;
    queueMicrotask(() => setIssuesLoading(true));
    Promise.all([
      workspaceService.getBySlug(workspaceSlug),
      projectService.get(workspaceSlug, projectId),
      projectService.list(workspaceSlug),
      issueService.list(workspaceSlug, projectId, { limit: 500 }),
      stateService.list(workspaceSlug, projectId),
      labelService.list(workspaceSlug, projectId),
      workspaceService.listMembers(workspaceSlug),
      cycleService.list(workspaceSlug, projectId),
      moduleService.list(workspaceSlug, projectId),
    ])
      .then(([w, p, list, iss, st, lab, mem, cy, mod]) => {
        if (cancelled) return;
        setWorkspace(w);
        setProject(p);
        setProjects(list ?? []);
        setIssues(iss ?? []);
        setStates(st ?? []);
        setLabels(lab ?? []);
        setMembers(mem ?? []);
        setCycles(cy ?? []);
        setModules(mod ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setWorkspace(null);
          setProject(null);
          setProjects([]);
          setIssues([]);
          setStates([]);
          setLabels([]);
          setMembers([]);
          setCycles([]);
          setModules([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIssuesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId]);

  const filteredIssues = useMemo(() => {
    if (!view) return [];
    const stateGroupMap: Record<
      string,
      "backlog" | "unstarted" | "started" | "completed" | "canceled"
    > = {
      backlog: "backlog",
      unstarted: "unstarted",
      started: "started",
      completed: "completed",
      canceled: "canceled",
    };

    const getStateGroup = (stateId: string | null | undefined) => {
      if (!stateId) return undefined;
      const s = states.find((x) => x.id === stateId);
      const g = s?.group?.toLowerCase();
      return g ? stateGroupMap[g] : undefined;
    };

    let list = [...issues];
    const f = workspaceViewFilters;

    if (f.priority.length) {
      list = list.filter(
        (i) => i.priority && f.priority.includes(i.priority as Priority),
      );
    }
    if (f.stateGroup.length) {
      list = list.filter((i) => {
        const g = getStateGroup(i.state_id ?? undefined);
        return g && f.stateGroup.includes(g);
      });
    }
    if (f.assigneeIds.length) {
      list = list.filter((i) =>
        i.assignee_ids?.some((id) => f.assigneeIds.includes(id)),
      );
    }
    if (f.createdByIds.length) {
      list = list.filter(
        (i) => i.created_by_id && f.createdByIds.includes(i.created_by_id),
      );
    }
    if (f.labelIds.length) {
      list = list.filter((i) =>
        i.label_ids?.some((id) => f.labelIds.includes(id)),
      );
    }
    if (f.projectIds.length) {
      list = list.filter((i) => f.projectIds.includes(i.project_id));
    }
    if (f.grouping !== "all") {
      list = list.filter((i) => {
        const g = getStateGroup(i.state_id ?? undefined);
        if (f.grouping === "backlog") return g === "backlog";
        if (f.grouping === "active")
          return g && !["backlog", "completed", "canceled"].includes(g);
        return true;
      });
    }

    const now = new Date();
    const addDays = (d: number) =>
      new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

    // Only apply start date filter when we have a valid range for "custom".
    const startDateEffective =
      f.startDate.length &&
      !(
        f.startDate.includes("custom") &&
        (!f.startAfter || !f.startBefore)
      );
    if (startDateEffective) {
      list = list.filter((i) => {
        const sd = i.start_date ? new Date(i.start_date) : null;
        if (!sd) return false;
        return f.startDate.some((preset) => {
          if (
            preset === "custom" &&
            f.startAfter &&
            f.startBefore
          ) {
            const after = new Date(f.startAfter);
            const before = new Date(f.startBefore);
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
      f.dueDate.length &&
      !(
        f.dueDate.includes("custom") &&
        (!f.dueAfter || !f.dueBefore)
      );
    if (dueDateEffective) {
      list = list.filter((i) => {
        const td = i.target_date ? new Date(i.target_date) : null;
        if (!td) return false;
        return f.dueDate.some((preset) => {
          if (
            preset === "custom" &&
            f.dueAfter &&
            f.dueBefore
          ) {
            const after = new Date(f.dueAfter);
            const before = new Date(f.dueBefore);
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

    const queryText =
      (view.query &&
      typeof view.query === "object" &&
      typeof (view.query as Record<string, unknown>).search === "string"
        ? ((view.query as Record<string, unknown>).search as string)
        : null) ?? null;
    if (queryText && queryText.trim()) {
      const q = queryText.trim().toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q));
    }

    return list;
  }, [issues, view, workspaceViewFilters, states]);

  const sortedStates = useMemo(
    () =>
      [...states].sort(
        (a, b) =>
          (a.sequence ?? 0) - (b.sequence ?? 0) || a.name.localeCompare(b.name),
      ),
    [states],
  );

  const subWorkCountByParentId = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of issues) {
      const pid = i.parent_id?.trim();
      if (!pid) continue;
      m.set(pid, (m.get(pid) ?? 0) + 1);
    }
    return m;
  }, [issues]);

  const baseForGrouping = useMemo(() => {
    let list = filteredIssues;
    if (!settings.showSubWorkItems) {
      list = list.filter((i) => !i.parent_id?.trim());
    }
    return list;
  }, [filteredIssues, settings.showSubWorkItems]);

  const groupedSections: GroupedSections = useMemo(() => {
    const orderBy = settings.orderBy;
    const sortIn = (arr: IssueApiResponse[]) =>
      sortIssuesList([...arr], orderBy);

    const groupBy = settings.groupBy;

    const getStateName = (stateKey: string) => {
      if (stateKey === NONE_STATE_KEY) return "No state";
      return states.find((s) => s.id === stateKey)?.name ?? stateKey;
    };

    if (groupBy === "none") {
      const m = new Map<string, IssueApiResponse[]>();
      m.set(ALL_GROUP_KEY, sortIn(baseForGrouping));
      return {
        order: [ALL_GROUP_KEY],
        groups: m,
        title: () => "All work items",
      };
    }

    if (groupBy === "states") {
      const map = new Map<string, IssueApiResponse[]>();
      for (const issue of baseForGrouping) {
        const key = issue.state_id?.trim() ? issue.state_id : NONE_STATE_KEY;
        const arr = map.get(key) ?? [];
        arr.push(issue);
        map.set(key, arr);
      }
      const ordered: string[] = [];
      const seen = new Set<string>();
      for (const s of sortedStates) {
        if (map.has(s.id)) {
          ordered.push(s.id);
          seen.add(s.id);
        }
      }
      for (const id of map.keys()) {
        if (!seen.has(id)) pushUniq(ordered, id);
      }
      for (const k of ordered) {
        const arr = map.get(k);
        if (arr) map.set(k, sortIn(arr));
      }
      return { order: ordered, groups: map, title: getStateName };
    }

    if (groupBy === "priority") {
      const map = new Map<string, IssueApiResponse[]>();
      for (const issue of baseForGrouping) {
        const key = issue.priority?.trim() || "none";
        const arr = map.get(key) ?? [];
        arr.push(issue);
        map.set(key, arr);
      }
      const ordered: string[] = [];
      for (const p of ["urgent", "high", "medium", "low", "none"]) {
        if (map.has(p)) ordered.push(p);
      }
      for (const id of map.keys()) pushUniq(ordered, id);
      for (const k of ordered) {
        const arr = map.get(k);
        if (arr) map.set(k, sortIn(arr));
      }
      return {
        order: ordered,
        groups: map,
        title: (k) =>
          k === "none" ? "None" : k.charAt(0).toUpperCase() + k.slice(1),
      };
    }

    if (groupBy === "cycle") {
      const map = new Map<string, IssueApiResponse[]>();
      for (const issue of baseForGrouping) {
        const cid = issue.cycle_ids?.[0]?.trim();
        const key = cid ?? NONE_CYCLE_KEY;
        const arr = map.get(key) ?? [];
        arr.push(issue);
        map.set(key, arr);
      }
      const ordered: string[] = [];
      for (const c of [...cycles].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
      )) {
        if (map.has(c.id)) ordered.push(c.id);
      }
      for (const id of map.keys()) pushUniq(ordered, id);
      for (const k of ordered) {
        const arr = map.get(k);
        if (arr) map.set(k, sortIn(arr));
      }
      return {
        order: ordered,
        groups: map,
        title: (k) =>
          k === NONE_CYCLE_KEY
            ? "No cycle"
            : (cycles.find((c) => c.id === k)?.name ?? k),
      };
    }

    if (groupBy === "module") {
      const map = new Map<string, IssueApiResponse[]>();
      for (const issue of baseForGrouping) {
        const mid = issue.module_ids?.[0]?.trim();
        const key = mid ?? NONE_MODULE_KEY;
        const arr = map.get(key) ?? [];
        arr.push(issue);
        map.set(key, arr);
      }
      const ordered: string[] = [];
      for (const mod of [...modules].sort((a, b) =>
        a.name.localeCompare(b.name),
      )) {
        if (map.has(mod.id)) ordered.push(mod.id);
      }
      for (const id of map.keys()) pushUniq(ordered, id);
      for (const k of ordered) {
        const arr = map.get(k);
        if (arr) map.set(k, sortIn(arr));
      }
      return {
        order: ordered,
        groups: map,
        title: (k) =>
          k === NONE_MODULE_KEY
            ? "No module"
            : (modules.find((m) => m.id === k)?.name ?? k),
      };
    }

    if (groupBy === "labels") {
      const firstLabel = (issue: IssueApiResponse) => {
        const ids = [...(issue.label_ids ?? [])].sort((a, b) => {
          const na = labels.find((l) => l.id === a)?.name ?? a;
          const nb = labels.find((l) => l.id === b)?.name ?? b;
          return na.localeCompare(nb);
        });
        return ids[0] ?? NONE_LABEL_KEY;
      };
      const map = new Map<string, IssueApiResponse[]>();
      for (const issue of baseForGrouping) {
        const key = firstLabel(issue);
        const arr = map.get(key) ?? [];
        arr.push(issue);
        map.set(key, arr);
      }
      const labelOrder = [...labels]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((l) => l.id);
      const ordered: string[] = [];
      for (const id of labelOrder) {
        if (map.has(id)) ordered.push(id);
      }
      for (const id of map.keys()) pushUniq(ordered, id);
      for (const k of ordered) {
        const arr = map.get(k);
        if (arr) map.set(k, sortIn(arr));
      }
      return {
        order: ordered,
        groups: map,
        title: (k) =>
          k === NONE_LABEL_KEY
            ? "No labels"
            : (labels.find((l) => l.id === k)?.name ?? k),
      };
    }

    if (groupBy === "assignees") {
      const map = new Map<string, IssueApiResponse[]>();
      for (const issue of baseForGrouping) {
        const aid = issue.assignee_ids?.[0]?.trim();
        const key = aid ?? NONE_ASSIGNEE_KEY;
        const arr = map.get(key) ?? [];
        arr.push(issue);
        map.set(key, arr);
      }
      const memberName = (uid: string) => {
        const m = members.find((x) => x.member_id === uid);
        return (
          m?.member_display_name?.trim() ||
          m?.member_email?.split("@")[0]?.trim() ||
          "Member"
        );
      };
      const ordered: string[] = [];
      const ids = [...map.keys()].filter((k) => k !== NONE_ASSIGNEE_KEY);
      ids.sort((a, b) => memberName(a).localeCompare(memberName(b)));
      for (const id of ids) ordered.push(id);
      if (map.has(NONE_ASSIGNEE_KEY)) ordered.push(NONE_ASSIGNEE_KEY);
      for (const k of ordered) {
        const arr = map.get(k);
        if (arr) map.set(k, sortIn(arr));
      }
      return {
        order: ordered,
        groups: map,
        title: (k) => (k === NONE_ASSIGNEE_KEY ? "Unassigned" : memberName(k)),
      };
    }

    if (groupBy === "created_by") {
      const map = new Map<string, IssueApiResponse[]>();
      for (const issue of baseForGrouping) {
        const uid = issue.created_by_id?.trim();
        const key = uid ?? NONE_CREATOR_KEY;
        const arr = map.get(key) ?? [];
        arr.push(issue);
        map.set(key, arr);
      }
      const memberName = (uid: string) => {
        const m = members.find((x) => x.member_id === uid);
        return (
          m?.member_display_name?.trim() ||
          m?.member_email?.split("@")[0]?.trim() ||
          "Member"
        );
      };
      const ordered: string[] = [];
      const ids = [...map.keys()].filter((k) => k !== NONE_CREATOR_KEY);
      ids.sort((a, b) => memberName(a).localeCompare(memberName(b)));
      for (const id of ids) ordered.push(id);
      if (map.has(NONE_CREATOR_KEY)) ordered.push(NONE_CREATOR_KEY);
      for (const k of ordered) {
        const arr = map.get(k);
        if (arr) map.set(k, sortIn(arr));
      }
      return {
        order: ordered,
        groups: map,
        title: (k) => (k === NONE_CREATOR_KEY ? "Unknown" : memberName(k)),
      };
    }

    const m = new Map<string, IssueApiResponse[]>();
    m.set(ALL_GROUP_KEY, sortIn(baseForGrouping));
    return {
      order: [ALL_GROUP_KEY],
      groups: m,
      title: () => "All work items",
    };
  }, [
    baseForGrouping,
    cycles,
    labels,
    members,
    modules,
    settings.groupBy,
    settings.orderBy,
    sortedStates,
    states,
  ]);

  const getIssueStateName = (stateId: string | null | undefined) =>
    stateId ? (states.find((s) => s.id === stateId)?.name ?? stateId) : "—";

  const getLabelNames = (labelIds: string[] = []) =>
    labelIds
      .map((id) => labels.find((l) => l.id === id)?.name)
      .filter((name): name is string => Boolean(name));

  const getUser = (userId: string | null) => {
    if (!userId) return null;
    const m = members.find((x) => x.member_id === userId);
    const display = m?.member_display_name?.trim();
    const emailUser = m?.member_email?.split("@")[0]?.trim();
    const name = display || emailUser || "Member";
    const avatarUrl = m?.member_avatar ?? null;
    return { id: userId, name, avatarUrl };
  };

  const createOpen = Boolean(projectId && searchParams.get("create") === "1");

  const handleCloseCreate = () => {
    setCreateError(null);
    const next = new URLSearchParams(searchParams);
    next.delete("create");
    setSearchParams(next, { replace: true });
  };

  const handleCreateSave = async (data: {
    title: string;
    description?: string;
    projectId: string;
    stateId?: string;
    priority?: Priority;
    assigneeIds?: string[];
    labelIds?: string[];
    startDate?: string;
    dueDate?: string;
    cycleId?: string | null;
    moduleId?: string | null;
    parentId?: string | null;
  }) => {
    if (!workspaceSlug || !data.title.trim()) return;
    setCreateError(null);
    try {
      const created = await issueService.create(workspaceSlug, data.projectId, {
        name: data.title.trim(),
        description: data.description || undefined,
        state_id: data.stateId || undefined,
        priority: data.priority || undefined,
        assignee_ids: data.assigneeIds?.length ? data.assigneeIds : undefined,
        label_ids: data.labelIds?.length ? data.labelIds : undefined,
        start_date: data.startDate || undefined,
        target_date: data.dueDate || undefined,
        parent_id: data.parentId || undefined,
      });
      if (created?.id) {
        if (data.cycleId) {
          await cycleService.addIssue(
            workspaceSlug,
            data.projectId,
            data.cycleId,
            created.id,
          );
        }
        if (data.moduleId) {
          await moduleService.addIssue(
            workspaceSlug,
            data.projectId,
            data.moduleId,
            created.id,
          );
        }
      }
      refetchIssues();
      handleCloseCreate();
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to create work item",
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-(--txt-tertiary)">
        Loading view...
      </div>
    );
  }

  if (!view) {
    return (
      <div className="px-6 py-8">
        <p className="text-sm text-(--txt-secondary)">
          {error ?? "View not found."}
        </p>
        {workspaceSlug && projectId && (
          <Link
            to={`/${workspaceSlug}/projects/${projectId}/views`}
            className="mt-3 inline-block text-sm text-(--brand-default) hover:underline"
          >
            Back to views
          </Link>
        )}
      </div>
    );
  }

  if (!workspace || !project) {
    return (
      <div className="px-6 py-8 text-sm text-(--txt-secondary)">
        {issuesLoading ? "Loading project..." : "Project not found."}
      </div>
    );
  }

  const baseUrl = `/${workspace.slug}/projects/${project.id}`;
  const dp = settings.displayProperties;

  const hasCol = (id: SavedViewDisplayPropertyId) => dp.has(id);

  const openCreate = () => {
    const next = new URLSearchParams(searchParams);
    next.set("create", "1");
    setSearchParams(next);
  };

  const cycleName = (issue: IssueApiResponse) => {
    const id = issue.cycle_ids?.[0];
    return id ? (cycles.find((c) => c.id === id)?.name ?? "—") : "—";
  };

  const moduleName = (issue: IssueApiResponse) => {
    const id = issue.module_ids?.[0];
    return id ? (modules.find((m) => m.id === id)?.name ?? "—") : "—";
  };

  return (
    <div className="min-h-0 flex-1 overflow-auto px-(--padding-page) py-4">
      <div className="mx-auto max-w-5xl space-y-6">
        {groupedSections.order.map((sectionKey) => {
          const sectionIssues = groupedSections.groups.get(sectionKey) ?? [];
          if (!sectionIssues.length) return null;
          const title = groupedSections.title(sectionKey);
          return (
            <section key={sectionKey} className="space-y-2">
              <h2 className="flex items-center gap-2 text-base font-semibold text-(--txt-primary)">
                {title}{" "}
                <span className="font-normal text-(--txt-tertiary)">
                  {sectionIssues.length}
                </span>
                <button
                  type="button"
                  className="flex size-7 items-center justify-center rounded-md text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
                  aria-label="Add work item"
                  onClick={openCreate}
                >
                  <IconPlus />
                </button>
              </h2>
              <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1)">
                <ul className="divide-y divide-(--border-subtle)">
                  {sectionIssues.map((issue) => {
                    const primaryAssigneeId =
                      issue.assignee_ids && issue.assignee_ids.length > 0
                        ? issue.assignee_ids[0]
                        : null;
                    const assignee = getUser(primaryAssigneeId);
                    const labelNames = getLabelNames(issue.label_ids ?? []);
                    const displayId = `${project.identifier ?? project.id.slice(0, 8)}-${issue.sequence_id ?? issue.id.slice(-4)}`;
                    const startStr = formatShortDate(issue.start_date);
                    const dueStr = formatShortDate(issue.target_date);
                    const subN = subWorkCountByParentId.get(issue.id) ?? 0;
                    const issueUrl = `${baseUrl}/issues/${issue.id}`;
                    return (
                      <li key={issue.id}>
                        <Link
                          to={issueUrl}
                          className="flex min-h-12 items-center gap-3 px-4 py-2.5 no-underline transition-colors hover:bg-(--bg-layer-1-hover)"
                        >
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {hasCol("id") ? (
                              <>
                                <span className="font-medium text-(--txt-accent-primary)">
                                  {displayId}
                                </span>
                                <span className="ml-2 text-(--txt-primary)">
                                  {issue.name}
                                </span>
                              </>
                            ) : (
                              <span className="text-(--txt-primary)">
                                {issue.name}
                              </span>
                            )}
                          </span>
                          <div className="flex shrink-0 flex-wrap items-center gap-2 text-(--txt-icon-tertiary)">
                            {hasCol("state") ? (
                              <span
                                title={getIssueStateName(
                                  issue.state_id ?? undefined,
                                )}
                              >
                                <Badge
                                  variant="neutral"
                                  className="text-xs font-medium"
                                >
                                  {getIssueStateName(
                                    issue.state_id ?? undefined,
                                  )}
                                </Badge>
                              </span>
                            ) : null}
                            {hasCol("priority") ? (
                              <span
                                title={issue.priority ?? ""}
                                className="flex size-6 items-center justify-center"
                              >
                                <Badge
                                  variant={
                                    priorityVariant[
                                      (issue.priority as Priority) ?? "none"
                                    ]
                                  }
                                  className="!px-1.5 !py-0 text-[10px]"
                                >
                                  {issue.priority ?? "—"}
                                </Badge>
                              </span>
                            ) : null}
                            {hasCol("start_date") ? (
                              <span
                                className="max-w-[4.5rem] truncate text-[11px] text-(--txt-secondary)"
                                title={issue.start_date ?? ""}
                              >
                                {startStr ?? "—"}
                              </span>
                            ) : null}
                            {hasCol("due_date") ? (
                              <span
                                className="flex size-6 items-center justify-center"
                                title={dueStr ?? "Due date"}
                              >
                                <IconCalendar />
                              </span>
                            ) : null}
                            {hasCol("assignee") ? (
                              <span
                                className="flex size-6 items-center justify-center"
                                title={assignee?.name ?? "Unassigned"}
                              >
                                {assignee ? (
                                  <Avatar
                                    name={assignee.name}
                                    src={
                                      getImageUrl(assignee.avatarUrl) ??
                                      undefined
                                    }
                                    size="sm"
                                    className="h-6 w-6 text-[10px]"
                                  />
                                ) : (
                                  <IconUser />
                                )}
                              </span>
                            ) : null}
                            {hasCol("labels") ? (
                              <span
                                className="flex size-6 items-center justify-center"
                                title={
                                  labelNames.length
                                    ? labelNames.join(", ")
                                    : "Labels"
                                }
                              >
                                {labelNames.length > 0 ? (
                                  <IconTag />
                                ) : (
                                  <span className="opacity-40">
                                    <IconTag />
                                  </span>
                                )}
                              </span>
                            ) : null}
                            {hasCol("sub_work_count") ? (
                              <span
                                className="min-w-6 text-center text-[11px] text-(--txt-secondary)"
                                title="Sub-work items"
                              >
                                {subN}
                              </span>
                            ) : null}
                            {hasCol("attachment_count") ? (
                              <span
                                className="min-w-6 text-center text-[11px] text-(--txt-secondary)"
                                title="Attachments"
                              >
                                —
                              </span>
                            ) : null}
                            {hasCol("estimate") ? (
                              <span className="text-[11px] text-(--txt-secondary)">
                                —
                              </span>
                            ) : null}
                            {hasCol("module") ? (
                              <span
                                className="max-w-[5rem] truncate text-[11px] text-(--txt-secondary)"
                                title="Module"
                              >
                                {moduleName(issue)}
                              </span>
                            ) : null}
                            {hasCol("cycle") ? (
                              <span
                                className="max-w-[5rem] truncate text-[11px] text-(--txt-secondary)"
                                title="Cycle"
                              >
                                {cycleName(issue)}
                              </span>
                            ) : null}
                            {hasCol("link") ? (
                              <a
                                href={issueUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex size-6 items-center justify-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
                                title="Open in new tab"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <IconLinkOut />
                              </a>
                            ) : null}
                            <button
                              type="button"
                              className="flex size-6 items-center justify-center rounded hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
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
                      </li>
                    );
                  })}
                </ul>
                <div className="border-t border-(--border-subtle) px-4 py-2.5">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-md border border-dashed border-(--border-subtle) bg-transparent px-3 py-2 text-sm font-medium text-(--txt-secondary) hover:border-(--border-strong) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
                    onClick={openCreate}
                  >
                    <IconPlus />
                    New work item
                  </button>
                </div>
              </div>
            </section>
          );
        })}

        {!issuesLoading && filteredIssues.length === 0 && (
          <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1)">
            <div className="flex flex-col items-center justify-center gap-4 px-4 py-12">
              <p className="text-sm text-(--txt-tertiary)">
                No work items match this view.
              </p>
              <Button size="sm" className="gap-1.5" onClick={openCreate}>
                <IconPlus />
                New work item
              </Button>
            </div>
          </div>
        )}

        <CreateWorkItemModal
          open={createOpen}
          onClose={handleCloseCreate}
          workspaceSlug={workspace.slug}
          projects={projects}
          defaultProjectId={project.id}
          onSave={handleCreateSave}
          createError={createError}
        />
      </div>
    </div>
  );
}
