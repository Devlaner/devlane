import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { workspaceService } from '../../services/workspaceService';
import { projectService } from '../../services/projectService';
import { issueService } from '../../services/issueService';
import { stateService } from '../../services/stateService';
import { labelService } from '../../services/labelService';
import { cycleService } from '../../services/cycleService';
import { moduleService } from '../../services/moduleService';
import { integrationService } from '../../services/integrationService';
import { attachWorkItemRelations } from '../lib/workItemRelations';
import { buildGroupedIssues, buildSubGroupedIssues } from '../../lib/issueListGroupAndSort';
import {
  cloneDefaultProjectIssuesDisplay,
  fromDisplayPayload,
  parseProjectIssuesDisplay,
  projectIssuesDisplayStorageKey,
  serializeProjectIssuesDisplay,
  type ProjectIssuesDisplayState,
} from '../../lib/projectIssuesDisplay';
import {
  DEFAULT_PROJECT_ISSUES_FILTERS,
  PROJECT_ISSUES_DISPLAY_EVENT,
  PROJECT_ISSUES_FILTER_EVENT,
  type ProjectIssuesDisplayPayload,
  type ProjectIssuesFiltersState,
} from '../../lib/projectIssuesEvents';
import { normalizeUuidKey } from '../../lib/utils';
import type { IssueInlinePatch } from '../../components/work-item/layouts/IssueLayoutTypes';
import type { SavedViewDisplayPropertyId } from '../../lib/projectSavedViewDisplay';
import type { Priority } from '../../types';
import type { StateGroup } from '../../types/workspaceViewFilters';
import type {
  CycleApiResponse,
  GitHubIssueSummaryEntry,
  IssueApiResponse,
  LabelApiResponse,
  ModuleApiResponse,
  ProjectApiResponse,
  StateApiResponse,
  WorkspaceApiResponse,
  WorkspaceMemberApiResponse,
} from '../../api/types';

function issueMentionSearchBlob(issue: IssueApiResponse): string {
  const parts: string[] = [];
  if (issue.name) parts.push(issue.name);
  if (issue.description_html) parts.push(issue.description_html);
  if (issue.description && typeof issue.description === 'object') {
    try {
      parts.push(JSON.stringify(issue.description));
    } catch {
      /* non-serializable rich text */
    }
  }
  return parts.join('\n').toLowerCase();
}

/** Best-effort: match user id (or @-prefixed) in title / description HTML / JSON description. */
function issueMentionsUserId(issue: IssueApiResponse, userId: string): boolean {
  const blob = issueMentionSearchBlob(issue);
  if (!blob) return false;
  const u = userId.toLowerCase().trim();
  if (!u) return false;
  if (blob.includes(`@${u}`)) return true;
  return blob.includes(u);
}

export interface CreateWorkItemPayload {
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
  isDraft?: boolean;
}

/**
 * Everything a project's work item list does apart from drawing it: loading the
 * project's data, applying the filter and display state the toolbars broadcast,
 * grouping and ordering, selection and bulk actions, drag-to-reorder, inline
 * edits and creation.
 *
 * It exists so the shipped list (IssueListPage) and the v2 preview
 * (IssueListPage) behave identically — the v2 work is a redesign, not a
 * reimplementation, and two copies of this logic would drift within a release.
 */
export function useProjectIssuesController(workspaceSlug?: string, projectId?: string) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [issues, setIssues] = useState<IssueApiResponse[]>([]);
  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [labels, setLabels] = useState<LabelApiResponse[]>([]);
  const [cycles, setCycles] = useState<CycleApiResponse[]>([]);
  const [modules, setModules] = useState<ModuleApiResponse[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [prSummary, setPrSummary] = useState<Record<string, GitHubIssueSummaryEntry>>({});
  const [loading, setLoading] = useState(true);
  const [createError, setCreateError] = useState<string | null>(null);
  const [listFilters, setListFilters] = useState<ProjectIssuesFiltersState>(() => ({
    ...DEFAULT_PROJECT_ISSUES_FILTERS,
  }));
  /* Free-text narrowing over the loaded page. The shipped header has no search
     field for this list, so it stays empty there; the v2 toolbar drives it. */
  const [searchQuery, setSearchQuery] = useState('');
  const [listDisplay, setListDisplay] = useState<ProjectIssuesDisplayState>(() =>
    cloneDefaultProjectIssuesDisplay(),
  );
  // Chains reorder saves so rapid drags commit in order (see handleReorder).
  const reorderChain = useRef<Promise<unknown>>(Promise.resolve());
  // Per-issue serialization for inline edits + board drag-to-column: chain
  // PATCHes so rapid updates to the same issue commit in order, and a sequence
  // token so only the latest update's failure triggers a refetch.
  const issueUpdateChains = useRef<Map<string, Promise<void>>>(new Map());
  const issueUpdateSeq = useRef<Map<string, number>>(new Map());
  // Set when any chained update for an issue fails, so the latest update
  // reconciles local state with the server even if it itself succeeded.
  const issueReconcileNeeded = useRef<Map<string, boolean>>(new Map());
  // Latest route key, so a late update-failure reconcile can be discarded if the
  // user has since navigated to a different project. Updated in a layout effect
  // (synchronous, pre-paint) so the guard isn't stale during a route change.
  const routeKeyRef = useRef('');
  useLayoutEffect(() => {
    routeKeyRef.current = `${workspaceSlug ?? ''}/${projectId ?? ''}`;
  }, [workspaceSlug, projectId]);

  const refetchIssues = () => {
    if (!workspaceSlug || !projectId) return;
    issueService
      .list(workspaceSlug, projectId, { limit: 100 })
      .then(setIssues)
      .catch(() => {});
  };

  // Multi-select for bulk actions.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkError, setBulkError] = useState<string | null>(null);
  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const setSelection = (ids: Iterable<string>) => setSelectedIds(new Set(ids));
  const clearSelection = () => {
    setSelectedIds(new Set());
    setBulkError(null);
  };

  const runBulk = async (fn: (slug: string, pid: string, ids: string[]) => Promise<void>) => {
    if (!workspaceSlug || !projectId || visibleSelectedIds.size === 0) return;
    setBulkError(null);
    try {
      await fn(workspaceSlug, projectId, [...visibleSelectedIds]);
      // Only clear the selection once the action actually succeeded.
      clearSelection();
      refetchIssues();
    } catch {
      setBulkError(
        t('workItem.list.bulkActionFailed', 'Bulk action failed. Nothing was changed — try again.'),
      );
      refetchIssues();
    }
  };

  useEffect(() => {
    if (!workspaceSlug || !projectId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset loading when no slug/project (kept for future use)
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    const safeFetch = <T>(promise: Promise<T>, fallback: T): Promise<T> => {
      return Promise.resolve(promise)
        .then((val) => val ?? fallback)
        .catch((err: unknown) => {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.warn('Secondary request ignored (Prevents crashes)', errorMessage);
          return fallback;
        });
    };

    Promise.all([
      workspaceService.getBySlug(workspaceSlug),
      projectService.get(workspaceSlug, projectId),

      safeFetch(projectService.list(workspaceSlug), [] as ProjectApiResponse[]),
      safeFetch(
        issueService.list(workspaceSlug, projectId, { limit: 100 }),
        [] as IssueApiResponse[],
      ),
      safeFetch(stateService.list(workspaceSlug, projectId), [] as StateApiResponse[]),
      safeFetch(labelService.list(workspaceSlug, projectId), [] as LabelApiResponse[]),
      safeFetch(cycleService.list(workspaceSlug, projectId), [] as CycleApiResponse[]),
      safeFetch(moduleService.list(workspaceSlug, projectId), [] as ModuleApiResponse[]),
      safeFetch(workspaceService.listMembers(workspaceSlug), [] as WorkspaceMemberApiResponse[]),
    ])
      .then(([w, p, list, iss, st, lab, cyc, mod, mem]) => {
        if (cancelled) return;
        setWorkspace(w);
        setProject(p);
        setProjects(list);
        setIssues(iss);
        setStates(st);
        setLabels(lab);
        setCycles(cyc);
        setModules(mod);
        setMembers(mem);
      })
      .catch((err) => {
        console.error('Critical error when loading Project or Workspace : ', err);
        if (!cancelled) {
          setWorkspace(null);
          setProject(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId]);

  // Bulk-fetch GitHub PR summaries for the loaded issues. Re-runs when the
  // set of issue IDs changes (stable join key). The service short-circuits to
  // {} for an empty list, and a 404 (no integration / project not linked)
  // also collapses to "no badges" silently.
  const issueIDsKey = useMemo(
    () =>
      issues
        .map((i) => i.id)
        .sort()
        .join(','),
    [issues],
  );
  useEffect(() => {
    if (!workspaceSlug || !projectId) return;
    let cancelled = false;
    const ids = issueIDsKey ? issueIDsKey.split(',') : [];
    integrationService
      .githubIssueSummary(workspaceSlug, projectId, ids)
      .then((map) => {
        if (!cancelled) setPrSummary(map);
      })
      .catch(() => {
        if (!cancelled) setPrSummary({});
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, issueIDsKey]);

  useLayoutEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{
        workspaceSlug: string;
        projectId: string;
        filters: ProjectIssuesFiltersState;
      }>;
      const d = ce.detail;
      if (!d || d.workspaceSlug !== workspaceSlug || d.projectId !== projectId) return;
      setListFilters({ ...DEFAULT_PROJECT_ISSUES_FILTERS, ...d.filters });
    };
    window.addEventListener(PROJECT_ISSUES_FILTER_EVENT, handler);
    return () => window.removeEventListener(PROJECT_ISSUES_FILTER_EVENT, handler);
  }, [workspaceSlug, projectId]);

  /* Display settings are per project and survive a reload. The shipped header
     writes the same key, so the two surfaces read each other's choice instead of
     each keeping its own. Filters deliberately stay in memory — the shipped list
     resets them on reload too. */
  useEffect(() => {
    if (!workspaceSlug || !projectId) return;
    let stored: ProjectIssuesDisplayState | null = null;
    try {
      stored = parseProjectIssuesDisplay(
        localStorage.getItem(projectIssuesDisplayStorageKey(workspaceSlug, projectId)),
      );
    } catch {
      stored = null;
    }
    /* Deferred so the state lands after this effect rather than during it. */
    queueMicrotask(() => setListDisplay(stored ?? cloneDefaultProjectIssuesDisplay()));
  }, [workspaceSlug, projectId]);

  useEffect(() => {
    if (!workspaceSlug || !projectId) return;
    try {
      localStorage.setItem(
        projectIssuesDisplayStorageKey(workspaceSlug, projectId),
        serializeProjectIssuesDisplay(listDisplay),
      );
    } catch {
      /* quota or private mode: the session keeps working, it just won't persist */
    }
  }, [workspaceSlug, projectId, listDisplay]);

  useLayoutEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{
        workspaceSlug: string;
        projectId: string;
        display: ProjectIssuesDisplayPayload;
      }>;
      const d = ce.detail;
      if (!d || d.workspaceSlug !== workspaceSlug || d.projectId !== projectId) return;
      setListDisplay(fromDisplayPayload(d.display));
    };
    window.addEventListener(PROJECT_ISSUES_DISPLAY_EVENT, handler);
    return () => window.removeEventListener(PROJECT_ISSUES_DISPLAY_EVENT, handler);
  }, [workspaceSlug, projectId]);

  const filteredIssues = useMemo(() => {
    const stateGroupMap: Record<string, StateGroup> = {
      backlog: 'backlog',
      unstarted: 'unstarted',
      started: 'started',
      completed: 'completed',
      canceled: 'canceled',
      cancelled: 'canceled',
    };
    const getStateGroup = (stateId: string | null | undefined): StateGroup | undefined => {
      if (!stateId) return undefined;
      const s = states.find((x) => x.id === stateId);
      const g = s?.group?.toLowerCase();
      return g ? stateGroupMap[g] : undefined;
    };

    let list = issues;
    if (listFilters.priorities.length) {
      list = list.filter((i) => {
        const p = (i.priority as Priority) ?? 'none';
        return listFilters.priorities.includes(p);
      });
    }
    if (listFilters.stateGroups.length) {
      list = list.filter((i) => {
        const g = getStateGroup(i.state_id ?? undefined);
        return g && listFilters.stateGroups.includes(g);
      });
    }
    if (listFilters.assigneeIds.length) {
      list = list.filter((i) =>
        i.assignee_ids?.some((aid) =>
          listFilters.assigneeIds.some((fid) => normalizeUuidKey(fid) === normalizeUuidKey(aid)),
        ),
      );
    }
    if (listFilters.createdByIds.length) {
      list = list.filter((i) =>
        listFilters.createdByIds.some(
          (fid) => normalizeUuidKey(fid) === normalizeUuidKey(i.created_by_id),
        ),
      );
    }
    if (listFilters.cycleIds.length) {
      list = list.filter((i) =>
        i.cycle_ids?.some((cid) =>
          listFilters.cycleIds.some((fid) => normalizeUuidKey(fid) === normalizeUuidKey(cid)),
        ),
      );
    }
    if (listFilters.labelIds.length) {
      list = list.filter((i) =>
        i.label_ids?.some((lid) =>
          listFilters.labelIds.some((fid) => normalizeUuidKey(fid) === normalizeUuidKey(lid)),
        ),
      );
    }
    if (listFilters.mentionedUserIds.length) {
      list = list.filter((i) =>
        listFilters.mentionedUserIds.some((uid) => issueMentionsUserId(i, uid)),
      );
    }
    if (listFilters.workItemGrouping === 'active') {
      list = list.filter((i) => {
        const g = getStateGroup(i.state_id ?? undefined);
        return g === 'unstarted' || g === 'started';
      });
    } else if (listFilters.workItemGrouping === 'backlog') {
      list = list.filter((i) => getStateGroup(i.state_id ?? undefined) === 'backlog');
    }
    const now = new Date();
    const addDays = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
    const startDateEffective =
      listFilters.startDate.length &&
      !(
        listFilters.startDate.includes('custom') &&
        (!listFilters.startAfter || !listFilters.startBefore)
      );
    if (startDateEffective) {
      list = list.filter((i) => {
        const sd = i.start_date ? new Date(i.start_date) : null;
        if (!sd) return false;
        return listFilters.startDate.some((preset) => {
          if (preset === 'custom' && listFilters.startAfter && listFilters.startBefore) {
            const after = new Date(listFilters.startAfter);
            const before = new Date(listFilters.startBefore);
            return sd >= after && sd <= before;
          }
          if (preset === 'custom') return false;
          const end =
            preset === '1_week'
              ? addDays(7)
              : preset === '2_weeks'
                ? addDays(14)
                : preset === '1_month'
                  ? addDays(30)
                  : preset === '2_months'
                    ? addDays(60)
                    : null;
          return Boolean(end && sd >= now && sd <= end);
        });
      });
    }
    const dueDateEffective =
      listFilters.dueDate.length &&
      !(
        listFilters.dueDate.includes('custom') &&
        (!listFilters.dueAfter || !listFilters.dueBefore)
      );
    if (dueDateEffective) {
      list = list.filter((i) => {
        const td = i.target_date ? new Date(i.target_date) : null;
        if (!td) return false;
        return listFilters.dueDate.some((preset) => {
          if (preset === 'custom' && listFilters.dueAfter && listFilters.dueBefore) {
            const after = new Date(listFilters.dueAfter);
            const before = new Date(listFilters.dueBefore);
            return td >= after && td <= before;
          }
          if (preset === 'custom') return false;
          const end =
            preset === '1_week'
              ? addDays(7)
              : preset === '2_weeks'
                ? addDays(14)
                : preset === '1_month'
                  ? addDays(30)
                  : preset === '2_months'
                    ? addDays(60)
                    : null;
          return Boolean(end && td >= now && td <= end);
        });
      });
    }
    const needle = searchQuery.trim().toLowerCase();
    if (needle) {
      list = list.filter((i) => {
        const sequence = i.sequence_id != null ? String(i.sequence_id) : '';
        return i.name.toLowerCase().includes(needle) || sequence.includes(needle);
      });
    }
    return list;
  }, [issues, states, listFilters, searchQuery]);

  // Effective selection = selected ids still visible under the current filters.
  // Deriving this (instead of syncing state in an effect) keeps bulk actions
  // scoped to currently-shown items without stale-state churn. Plain consts —
  // the React Compiler handles memoization.
  const visibleIssueIds = new Set(filteredIssues.map((i) => i.id));
  const visibleSelectedIds = new Set([...selectedIds].filter((id) => visibleIssueIds.has(id)));

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
    if (!listDisplay.showSubWorkItems) {
      list = list.filter((i) => !i.parent_id?.trim());
    }
    return list;
  }, [filteredIssues, listDisplay.showSubWorkItems]);

  const groupedIssues = useMemo(
    () =>
      buildGroupedIssues({
        baseForGrouping,
        groupBy: listDisplay.groupBy,
        orderBy: listDisplay.orderBy,
        showEmptyGroups: listDisplay.showEmptyGroups,
        states,
        cycles,
        modules,
        labels,
        members,
      }),
    [
      baseForGrouping,
      listDisplay.groupBy,
      listDisplay.orderBy,
      listDisplay.showEmptyGroups,
      states,
      cycles,
      modules,
      labels,
      members,
    ],
  );

  // Optional second-level grouping (swimlanes). Null unless both a primary and
  // a distinct secondary dimension are selected; layouts fall back to the flat
  // groupedIssues when it's null.
  const subGroupedIssues = useMemo(
    () =>
      buildSubGroupedIssues({
        baseForGrouping,
        groupBy: listDisplay.groupBy,
        subGroupBy: listDisplay.subGroupBy,
        orderBy: listDisplay.orderBy,
        showEmptyGroups: listDisplay.showEmptyGroups,
        states,
        cycles,
        modules,
        labels,
        members,
      }),
    [
      baseForGrouping,
      listDisplay.groupBy,
      listDisplay.subGroupBy,
      listDisplay.orderBy,
      listDisplay.showEmptyGroups,
      states,
      cycles,
      modules,
      labels,
      members,
    ],
  );

  // Stable "now" timestamp used by overdue/relative-date cells. Sampled once
  // at mount via useState's lazy initializer (allowed to be impure) so each
  // row stays pure for the rest of the render-tree's lifetime.
  const [now] = useState(() => Date.now());

  const createParam = searchParams.get('create') === '1';

  useEffect(() => {
    if (createParam && projectId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: open create modal from URL (kept for future use)
      setCreateOpen(true);
    }
  }, [createParam, projectId]);

  const openCreate = () => {
    const next = new URLSearchParams(searchParams);
    next.set('create', '1');
    setSearchParams(next, { replace: true });
    setCreateOpen(true);
  };

  const handleCloseCreate = () => {
    setCreateOpen(false);
    setCreateError(null);
    const next = new URLSearchParams(searchParams);
    next.delete('create');
    setSearchParams(next, { replace: true });
  };

  const handleCreateSave = async (data: CreateWorkItemPayload) => {
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
        is_draft: data.isDraft === true ? true : undefined,
      });
      if (created?.id) {
        const relationsAttached = await attachWorkItemRelations(
          workspaceSlug,
          data.projectId,
          created.id,
          { cycleId: data.cycleId, moduleIds: [data.moduleId] },
        );
        if (!relationsAttached) {
          toast.warning(
            t(
              'workItem.create.relationWarning',
              'Work item created, but one or more planning properties could not be attached.',
            ),
          );
        }
      }
      refetchIssues();
    } catch (err) {
      setCreateError(
        err instanceof Error
          ? err.message
          : t('workItem.list.createFailed', 'Failed to create work item'),
      );
      /* The composer owns its open state so "Create more" can keep it open.
         Rejecting also tells the composer not to treat a failed request as a
         successful save and close over the inline error. */
      throw err;
    }
  };

  const hasCol = (id: SavedViewDisplayPropertyId) => listDisplay.displayProperties.has(id);

  // Build id -> name maps once per render instead of doing an O(cycles) /
  // O(modules) find for every row.
  const cycleNameById = new Map(cycles.map((c) => [c.id, c.name]));
  const moduleNameById = new Map(modules.map((m) => [m.id, m.name]));

  const cycleName = (issue: IssueApiResponse) => {
    const id = issue.cycle_ids?.[0];
    return id ? (cycleNameById.get(id) ?? '—') : '—';
  };

  const moduleName = (issue: IssueApiResponse) => {
    const id = issue.module_ids?.[0];
    return id ? (moduleNameById.get(id) ?? '—') : '—';
  };

  const orderedVisibleIssues = groupedIssues.order.flatMap(
    (sectionKey) => groupedIssues.groups.get(sectionKey) ?? [],
  );

  // Manual drag-to-reorder. We splice the move into the FULL loaded issue set
  // (in manual order) — not just the visible/filtered rows — so hidden items
  // keep consistent positions, then persist the whole canonical order. Saves are
  // chained so rapid drags commit in order (no stale overwrite).
  const handleReorder = (activeId: string, overId: string, after: boolean) => {
    if (!workspaceSlug || !projectId || activeId === overId) return;
    const fullOrdered = [...issues].sort(
      (a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
        (a.sequence_id ?? 0) - (b.sequence_id ?? 0) ||
        a.name.localeCompare(b.name),
    );
    const active = fullOrdered.find((i) => i.id === activeId);
    const without = fullOrdered.filter((i) => i.id !== activeId);
    const overIdx = without.findIndex((i) => i.id === overId);
    if (!active || overIdx === -1) return;
    const insertIdx = after ? overIdx + 1 : overIdx;
    const newOrder = [...without.slice(0, insertIdx), active, ...without.slice(insertIdx)];
    const orderById = new Map(newOrder.map((iss, idx) => [iss.id, (idx + 1) * 1024]));
    setIssues((prev) =>
      prev.map((i) => (orderById.has(i.id) ? { ...i, sort_order: orderById.get(i.id)! } : i)),
    );
    const ids = newOrder.map((i) => i.id);
    reorderChain.current = reorderChain.current
      .catch(() => {})
      .then(() => issueService.reorder(workspaceSlug, projectId, ids))
      .catch(() => refetchIssues());
  };

  const reorderEnabled = listDisplay.orderBy === 'manual';

  // Optimistically apply `patch` to an issue, then persist. PATCHes for the same
  // issue are chained (commit in order); only the latest update's failure
  // refetches, and only while still on the project that initiated it — so a
  // stale older request can't clobber a newer one or a different route's list.
  const persistIssueUpdate = (issueId: string, patch: IssueInlinePatch) => {
    if (!workspaceSlug || !projectId) return;
    const slug = workspaceSlug;
    const pid = projectId;
    const routeKey = `${slug}/${pid}`;
    const seq = (issueUpdateSeq.current.get(issueId) ?? 0) + 1;
    issueUpdateSeq.current.set(issueId, seq);
    setIssues((prev) => prev.map((i) => (i.id === issueId ? { ...i, ...patch } : i)));
    const prevChain = issueUpdateChains.current.get(issueId) ?? Promise.resolve();
    const next = prevChain
      .catch(() => {})
      .then(() => issueService.update(slug, pid, issueId, patch))
      .then(
        () => undefined,
        // Record the failure rather than reverting here — a later update in the
        // chain (possibly to a different field) must not be lost, so we let the
        // newest update reconcile once the chain drains.
        () => {
          issueReconcileNeeded.current.set(issueId, true);
        },
      )
      .then(() => {
        if (issueUpdateSeq.current.get(issueId) !== seq) return;
        if (!issueReconcileNeeded.current.get(issueId)) return;
        issueReconcileNeeded.current.delete(issueId);
        if (routeKeyRef.current !== routeKey) return;
        // Re-fetch just this issue so a rejected PATCH can't leave a stale
        // optimistic value, without clobbering other issues' in-flight edits.
        issueService
          .get(slug, pid, issueId)
          .then((fresh) => setIssues((prev) => prev.map((i) => (i.id === issueId ? fresh : i))))
          .catch(() => {});
      });
    issueUpdateChains.current.set(issueId, next);
  };

  // Board drag-to-column: move the card's state.
  const handleCardMove = (issueId: string, targetStateId: string) => {
    const current = issues.find((i) => i.id === issueId);
    if (!current || current.state_id === targetStateId) return;
    persistIssueUpdate(issueId, { state_id: targetStateId });
  };

  // Inline property edits from list/spreadsheet cells.
  const handleInlineUpdate = (issueId: string, patch: IssueInlinePatch) =>
    persistIssueUpdate(issueId, patch);

  return {
    /* Data */
    workspace,
    project,
    projects,
    issues,
    states,
    labels,
    cycles,
    modules,
    members,
    prSummary,
    loading,
    /* Filter + display state. The shipped header broadcasts changes as window
       events; the v2 toolbars are controlled and call these setters directly. */
    listFilters,
    setListFilters,
    searchQuery,
    setSearchQuery,
    listDisplay,
    setListDisplay,
    /* Derived lists */
    filteredIssues,
    baseForGrouping,
    groupedIssues,
    subGroupedIssues,
    orderedVisibleIssues,
    subWorkCountByParentId,
    hasCol,
    cycleName,
    moduleName,
    now,
    /* Selection + bulk */
    selectedIds,
    visibleSelectedIds,
    toggleSelect,
    setSelection,
    clearSelection,
    runBulk,
    bulkError,
    /* Mutations */
    refetchIssues,
    handleReorder,
    reorderEnabled,
    handleCardMove,
    handleInlineUpdate,
    /* Creation */
    createOpen,
    createError,
    openCreate,
    handleCloseCreate,
    handleCreateSave,
  };
}
