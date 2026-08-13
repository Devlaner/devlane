import { useEffect, useMemo, useState } from 'react';
import { workspaceService } from '../../services/workspaceService';
import { projectService } from '../../services/projectService';
import {
  cycleService,
  type CycleProgress,
  type CycleProgressResponse,
} from '../../services/cycleService';
import { issueService } from '../../services/issueService';
import { stateService } from '../../services/stateService';
import { labelService } from '../../services/labelService';
import { useWorkspaceFavorites } from '../../hooks/useWorkspaceFavorites';
import { cyclePathSegment } from '../../lib/cycle';
import { parseISODateLocal } from '../../lib/dateOnly';
import {
  PROJECT_CYCLES_FILTER_EVENT,
  PROJECT_CYCLES_REFRESH_EVENT,
} from '../../lib/projectCyclesEvents';
import type {
  CycleApiResponse,
  IssueApiResponse,
  LabelApiResponse,
  ProjectApiResponse,
  StateApiResponse,
  WorkspaceApiResponse,
  WorkspaceMemberApiResponse,
} from '../../api/types';

export type CycleStatusFilterKey = 'in_progress' | 'yet_to_start' | 'completed' | 'draft';
export type DatePresetFilterKey = '1_week' | '2_weeks' | '1_month' | '2_months' | 'custom';

export interface CyclesFiltersState {
  searchQuery: string | null;
  statusKeys: CycleStatusFilterKey[];
  startDatePresets: DatePresetFilterKey[];
  dueDatePresets: DatePresetFilterKey[];
  startAfter: string | null;
  startBefore: string | null;
  dueAfter: string | null;
  dueBefore: string | null;
}

export const DEFAULT_CYCLES_FILTERS: CyclesFiltersState = {
  searchQuery: null,
  statusKeys: [],
  startDatePresets: [],
  dueDatePresets: [],
  startAfter: null,
  startBefore: null,
  dueAfter: null,
  dueBefore: null,
};

type StateGroup = 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';

const STATE_GROUP_MAP: Record<string, StateGroup> = {
  backlog: 'backlog',
  unstarted: 'unstarted',
  started: 'started',
  completed: 'completed',
  canceled: 'canceled',
  cancelled: 'canceled',
};

/**
 * Everything a project's cycles list does apart from drawing it: loading the
 * project's cycles, issues, states, labels and roster, applying the filters the
 * header broadcasts, splitting them into active / upcoming / completed, and
 * deriving the active cycle's progress, assignee and label breakdowns.
 *
 * It exists so the shipped page (CyclesPage) and the v2 preview
 * (CyclesPage) stay one behaviour under two designs.
 */
export function useProjectCyclesController(workspaceSlug?: string, projectId?: string) {
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [cycles, setCycles] = useState<CycleApiResponse[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [issues, setIssues] = useState<IssueApiResponse[]>([]);
  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [labels, setLabels] = useState<LabelApiResponse[]>([]);
  const [activeCycleProgress, setActiveCycleProgress] = useState<{
    cycleId: string;
    progress: CycleProgressResponse;
  } | null>(null);
  const [cycleProgress, setCycleProgress] = useState<Record<string, CycleProgress>>({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CyclesFiltersState>({ ...DEFAULT_CYCLES_FILTERS });

  const { isFavorited, toggleEntity } = useWorkspaceFavorites(workspaceSlug);
  const isFavorite = (id: string) => isFavorited('cycle', id);
  const toggleFavorite = (cycle: { id: string; name: string }) => {
    if (!projectId) return;
    void toggleEntity({
      entity_type: 'cycle',
      entity_id: cycle.id,
      project_id: projectId,
      name: cycle.name,
    });
  };

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
      cycleService.list(workspaceSlug, projectId),
      workspaceService.listMembers(workspaceSlug),
      issueService.list(workspaceSlug, projectId, { limit: 500 }),
      stateService.list(workspaceSlug, projectId),
      labelService.list(workspaceSlug, projectId),
    ])
      .then(([w, p, list, mem, iss, st, lab]) => {
        if (!cancelled) {
          setWorkspace(w ?? null);
          setProject(p ?? null);
          setCycles(list ?? []);
          setMembers(mem ?? []);
          setIssues(iss ?? []);
          setStates(st ?? []);
          setLabels(lab ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWorkspace(null);
          setProject(null);
          setCycles([]);
          setMembers([]);
          setIssues([]);
          setStates([]);
          setLabels([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId]);

  // Real per-cycle completion progress (completed / total by state group).
  useEffect(() => {
    if (!workspaceSlug || !projectId) return;
    let cancelled = false;
    cycleService
      .listProgress(workspaceSlug, projectId)
      .then((p) => {
        if (!cancelled) setCycleProgress(p);
      })
      .catch(() => {
        if (!cancelled) setCycleProgress({});
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId]);

  useEffect(() => {
    if (!workspaceSlug || !projectId) return;

    const handler = (e: Event) => {
      const ce = e as CustomEvent<{
        workspaceSlug?: string;
        projectId?: string;
        filters?: Partial<CyclesFiltersState>;
      }>;
      const d = ce.detail;
      if (
        !d?.workspaceSlug ||
        !d?.projectId ||
        d.workspaceSlug !== workspaceSlug ||
        d.projectId !== projectId
      ) {
        return;
      }
      const next = d.filters;
      if (!next) return;

      setFilters((prev) => ({
        ...prev,
        searchQuery: next.searchQuery ?? prev.searchQuery,
        statusKeys: (next.statusKeys ?? prev.statusKeys) as CycleStatusFilterKey[],
        startDatePresets: (next.startDatePresets ?? prev.startDatePresets) as DatePresetFilterKey[],
        dueDatePresets: (next.dueDatePresets ?? prev.dueDatePresets) as DatePresetFilterKey[],
        startAfter: next.startAfter ?? prev.startAfter,
        startBefore: next.startBefore ?? prev.startBefore,
        dueAfter: next.dueAfter ?? prev.dueAfter,
        dueBefore: next.dueBefore ?? prev.dueBefore,
      }));
    };

    window.addEventListener(PROJECT_CYCLES_FILTER_EVENT, handler as EventListener);
    return () => window.removeEventListener(PROJECT_CYCLES_FILTER_EVENT, handler as EventListener);
  }, [workspaceSlug, projectId]);

  const refresh = () => {
    if (!workspaceSlug || !projectId) return;
    Promise.all([
      cycleService.list(workspaceSlug, projectId),
      issueService.list(workspaceSlug, projectId, { limit: 500 }),
    ])
      .then(([list, iss]) => {
        setCycles(list ?? []);
        setIssues(iss ?? []);
      })
      .catch(() => {});
    cycleService
      .listProgress(workspaceSlug, projectId)
      .then(setCycleProgress)
      .catch(() => setCycleProgress({}));
  };

  useEffect(() => {
    if (!workspaceSlug || !projectId) return;
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ workspaceSlug?: string; projectId?: string }>;
      if (ce.detail?.workspaceSlug !== workspaceSlug || ce.detail?.projectId !== projectId) {
        return;
      }
      Promise.all([
        cycleService.list(workspaceSlug, projectId),
        issueService.list(workspaceSlug, projectId, { limit: 500 }),
      ])
        .then(([list, iss]) => {
          setCycles(list ?? []);
          setIssues(iss ?? []);
        })
        .catch(() => {});
      cycleService
        .listProgress(workspaceSlug, projectId)
        .then(setCycleProgress)
        .catch(() => setCycleProgress({}));
    };
    window.addEventListener(PROJECT_CYCLES_REFRESH_EVENT, handler as EventListener);
    return () => window.removeEventListener(PROJECT_CYCLES_REFRESH_EVENT, handler as EventListener);
  }, [workspaceSlug, projectId]);

  const filteredCycles = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const groupStatuses: Record<CycleStatusFilterKey, string[]> = {
      in_progress: ['started', 'current'],
      yet_to_start: ['upcoming'],
      completed: ['completed'],
      draft: ['draft'],
    };

    const presetDays: Record<DatePresetFilterKey, number | null> = {
      '1_week': 7,
      '2_weeks': 14,
      '1_month': 30,
      '2_months': 60,
      custom: null,
    };

    const inRange = (date: Date, rangeStartMs: number, rangeEndMs: number) => {
      const ts = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      return ts >= rangeStartMs && ts <= rangeEndMs;
    };

    const matchesPresetUnion = (
      dateIso: string | null | undefined,
      selectedPresets: DatePresetFilterKey[],
      customAfter: string | null,
      customBefore: string | null,
    ) => {
      // Empty selection means "no filtering".
      if (selectedPresets.length === 0) return true;
      if (!dateIso) return false;

      const date = parseISODateLocal(dateIso);

      const ranges: Array<{ start: number; end: number }> = [];
      for (const p of selectedPresets) {
        if (p === 'custom') {
          if (!customAfter || !customBefore) continue;
          const a = parseISODateLocal(customAfter);
          const b = parseISODateLocal(customBefore);
          const aMs = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
          const bMs = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
          ranges.push({ start: Math.min(aMs, bMs), end: Math.max(aMs, bMs) });
        } else {
          const days = presetDays[p];
          if (days == null) continue;
          ranges.push({
            start: startOfToday,
            end: startOfToday + days * 24 * 60 * 60 * 1000,
          });
        }
      }

      if (ranges.length === 0) return false;
      return ranges.some((r) => inRange(date, r.start, r.end));
    };

    const matchesStatus = (c: CycleApiResponse) => {
      if (filters.statusKeys.length === 0) return true;
      return filters.statusKeys.some((k) => groupStatuses[k]?.includes(c.status));
    };

    const matchesSearch = (c: CycleApiResponse) => {
      const q = filters.searchQuery?.trim().toLowerCase();
      if (!q) return true;
      return c.name.toLowerCase().includes(q);
    };

    return cycles.filter((c) => {
      return (
        matchesSearch(c) &&
        matchesStatus(c) &&
        matchesPresetUnion(
          c.start_date,
          filters.startDatePresets,
          filters.startAfter,
          filters.startBefore,
        ) &&
        matchesPresetUnion(c.end_date, filters.dueDatePresets, filters.dueAfter, filters.dueBefore)
      );
    });
  }, [cycles, filters]);

  const upcomingCycles = useMemo(() => {
    const list = filteredCycles.filter((c) => c.status === 'upcoming' || c.status === 'draft');
    return [...list].sort((a, b) => {
      // Drafts (no dates) first, then by start_date ascending
      const aStart = a.start_date ? new Date(a.start_date).getTime() : Infinity;
      const bStart = b.start_date ? new Date(b.start_date).getTime() : Infinity;
      if (aStart === Infinity && bStart === Infinity) return 0;
      if (aStart === Infinity) return -1;
      if (bStart === Infinity) return 1;
      return aStart - bStart;
    });
  }, [filteredCycles]);

  const completedCycles = useMemo(() => {
    const list = filteredCycles.filter((c) => c.status === 'completed');
    return [...list].sort((a, b) => {
      const aEnd = a.end_date ? new Date(a.end_date).getTime() : 0;
      const bEnd = b.end_date ? new Date(b.end_date).getTime() : 0;
      return bEnd - aEnd;
    });
  }, [filteredCycles]);

  const activeCycles = useMemo(
    () => filteredCycles.filter((c) => c.status === 'started' || c.status === 'current'),
    [filteredCycles],
  );
  const activeCycle = activeCycles[0] ?? null; // First one for backward compat with stats/cards
  const activeCycleIssues = useMemo(() => {
    if (!activeCycle) return [];
    return issues.filter((i) => i.cycle_ids?.includes(activeCycle.id));
  }, [issues, activeCycle]);

  // Fetch the active cycle's progress snapshot (for the burndown chart). The
  // result is keyed by cycle id so a stale snapshot from a previously active
  // cycle is ignored during render (see activeProgress).
  const activeCycleId = activeCycle?.id;
  useEffect(() => {
    if (!workspaceSlug || !projectId || !activeCycleId) return;
    let cancelled = false;
    cycleService
      .getProgress(workspaceSlug, projectId, activeCycleId)
      .then((snap) => {
        if (!cancelled) setActiveCycleProgress({ cycleId: activeCycleId, progress: snap });
      })
      .catch(() => {
        if (!cancelled) setActiveCycleProgress(null);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, activeCycleId]);

  // Both the burndown total and the per-day completions must come from the same
  // (progress endpoint) source so the baseline matches the curve.
  const activeProgress =
    activeCycleProgress && activeCycleId && activeCycleProgress.cycleId === activeCycleId
      ? activeCycleProgress.progress
      : null;
  const activeBurndownChart = activeProgress?.distribution?.completion_chart;

  const getIssueCount = (cycleId: string) => cycles.find((c) => c.id === cycleId)?.issue_count ?? 0;
  const getProgress = (c: CycleApiResponse) => {
    const p = cycleProgress[c.id];
    const total = p?.total ?? getIssueCount(c.id);
    if (!total) return 0;
    return Math.round(((p?.completed ?? 0) / total) * 100);
  };

  const baseUrl = workspace && project ? `/${workspace.slug}/projects/${project.id}` : '';
  const cyclePath = (c: CycleApiResponse) =>
    workspace && project ? `${baseUrl}/cycles/${cyclePathSegment(c)}` : '';

  const getStateGroup = (stateId: string | null | undefined) => {
    if (!stateId) return undefined;
    const s = states.find((x) => x.id === stateId);
    const g = s?.group?.toLowerCase();
    return g ? STATE_GROUP_MAP[g] : undefined;
  };

  const getStateName = (stateId: string | null | undefined) =>
    stateId ? (states.find((s) => s.id === stateId)?.name ?? '—') : '—';

  const activeCycleProgressStats = (() => {
    if (!activeCycle) return { started: 0, backlog: 0, completed: 0, total: 0, percentClosed: 0 };
    const started = activeCycleIssues.filter((i) => {
      const g = getStateGroup(i.state_id ?? undefined);
      return g && ['started', 'unstarted'].includes(g);
    }).length;
    const backlog = activeCycleIssues.filter((i) => {
      const g = getStateGroup(i.state_id ?? undefined);
      return g === 'backlog';
    }).length;
    const completed = activeCycleIssues.filter((i) => {
      const g = getStateGroup(i.state_id ?? undefined);
      return g && ['completed', 'canceled'].includes(g);
    }).length;
    const total = activeCycleIssues.length;
    const percentClosed = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { started, backlog, completed, total, percentClosed };
  })();

  // Burndown baseline: prefer the progress endpoint's total (same source as the
  // completion chart), falling back to the client-side count before it loads.
  const activeBurndownTotal = activeProgress?.total_issues ?? activeCycleProgressStats.total;

  const activeCycleAssigneeStats = (() => {
    if (!activeCycle) return [];
    const byAssignee = new Map<string, { total: number; completed: number }>();
    for (const i of activeCycleIssues) {
      const ids = i.assignee_ids ?? [];
      if (ids.length === 0) {
        const cur = byAssignee.get('__unassigned__') ?? { total: 0, completed: 0 };
        cur.total += 1;
        const g = getStateGroup(i.state_id ?? undefined);
        if (g && ['completed', 'canceled'].includes(g)) cur.completed += 1;
        byAssignee.set('__unassigned__', cur);
      } else {
        for (const id of ids) {
          const cur = byAssignee.get(id) ?? { total: 0, completed: 0 };
          cur.total += 1;
          const g = getStateGroup(i.state_id ?? undefined);
          if (g && ['completed', 'canceled'].includes(g)) cur.completed += 1;
          byAssignee.set(id, cur);
        }
      }
    }
    return Array.from(byAssignee.entries())
      .map(([id, s]) => ({
        memberId: id === '__unassigned__' ? null : id,
        total: s.total,
        completed: s.completed,
        percent: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  })();

  const activeCycleLabelStats = (() => {
    if (!activeCycle) return [];
    const byLabel = new Map<string, { total: number; completed: number }>();
    for (const i of activeCycleIssues) {
      const ids = i.label_ids ?? [];
      if (ids.length === 0) {
        const cur = byLabel.get('__no_label__') ?? { total: 0, completed: 0 };
        cur.total += 1;
        const g = getStateGroup(i.state_id ?? undefined);
        if (g && ['completed', 'canceled'].includes(g)) cur.completed += 1;
        byLabel.set('__no_label__', cur);
      } else {
        for (const lid of ids) {
          const cur = byLabel.get(lid) ?? { total: 0, completed: 0 };
          cur.total += 1;
          const g = getStateGroup(i.state_id ?? undefined);
          if (g && ['completed', 'canceled'].includes(g)) cur.completed += 1;
          byLabel.set(lid, cur);
        }
      }
    }
    return Array.from(byLabel.entries())
      .map(([id, s]) => ({
        labelId: id === '__no_label__' ? null : id,
        total: s.total,
        completed: s.completed,
        percent: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  })();

  const getOwnerMember = (ownedById: string | null | undefined) => {
    if (!ownedById) return null;
    const m = members.find((x) => x.member_id === ownedById);
    const name =
      m?.member_display_name?.trim() ?? m?.member_email?.split('@')[0] ?? ownedById.slice(0, 8);
    return { name, avatarUrl: m?.member_avatar ?? null };
  };

  /** Deletes a cycle and drops it from the loaded list on success. */
  const deleteCycle = async (cycleId: string) => {
    if (!workspaceSlug || !projectId) return;
    await cycleService.delete(workspaceSlug, projectId, cycleId);
    setCycles((prev) => prev.filter((c) => c.id !== cycleId));
  };

  /** Replaces one cycle in place after an update, without refetching the list. */
  const applyCycleUpdate = (updated: CycleApiResponse) =>
    setCycles((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));

  return {
    /* Data */
    workspace,
    project,
    cycles,
    setCycles,
    members,
    issues,
    states,
    labels,
    cycleProgress,
    loading,
    /* Filters, broadcast by the header */
    filters,
    setFilters,
    /* Derived lists */
    filteredCycles,
    upcomingCycles,
    completedCycles,
    activeCycles,
    activeCycle,
    activeCycleIssues,
    activeProgress,
    activeBurndownChart,
    activeBurndownTotal,
    activeCycleProgressStats,
    activeCycleAssigneeStats,
    activeCycleLabelStats,
    /* Helpers */
    baseUrl,
    cyclePath,
    getIssueCount,
    getProgress,
    getStateGroup,
    getStateName,
    getOwnerMember,
    isFavorite,
    toggleFavorite,
    /* Mutations */
    refresh,
    deleteCycle,
    applyCycleUpdate,
  };
}
