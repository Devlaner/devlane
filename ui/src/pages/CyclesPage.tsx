import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Avatar, Badge } from '../components/ui';
import { UpdateCycleModal } from '../components/UpdateCycleModal';
import { workspaceService } from '../services/workspaceService';
import { projectService } from '../services/projectService';
import { cycleService } from '../services/cycleService';
import { issueService } from '../services/issueService';
import { stateService } from '../services/stateService';
import { labelService } from '../services/labelService';
import type {
  WorkspaceApiResponse,
  ProjectApiResponse,
  CycleApiResponse,
  WorkspaceMemberApiResponse,
  IssueApiResponse,
  StateApiResponse,
  LabelApiResponse,
} from '../api/types';
import type { Priority } from '../types';
import {
  PROJECT_CYCLES_FILTER_EVENT,
  PROJECT_CYCLES_REFRESH_EVENT,
} from '../lib/projectCyclesEvents';
import { useCycleFavorites } from '../hooks/useCycleFavorites';
import { parseISODateLocal } from '../lib/dateOnly';
import { cn, getImageUrl } from '../lib/utils';

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
const MONTH_ABBR = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function formatCycleDateRange(c: CycleApiResponse): string | null {
  const startRaw = c.start_date?.trim();
  const endRaw = c.end_date?.trim();
  if (!startRaw && !endRaw) return null;
  const parse = (iso: string) => {
    const d = parseISODateLocal(iso);
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

function CycleProgressCircle({ progress }: { progress: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const stroke = Math.max(0, Math.min(100, progress)) / 100;
  return (
    <div className="relative flex size-10 shrink-0 items-center justify-center">
      <svg width="40" height="40" viewBox="0 0 40 40" className="-rotate-90" aria-hidden>
        <circle cx="20" cy="20" r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="3" />
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
      <span className="absolute text-[10px] font-medium text-(--txt-secondary)">{progress}%</span>
    </div>
  );
}

type CycleStatusFilterKey = 'in_progress' | 'yet_to_start' | 'completed' | 'draft';
type DatePresetFilterKey = '1_week' | '2_weeks' | '1_month' | '2_months' | 'custom';

const priorityVariant: Record<Priority, 'danger' | 'warning' | 'default' | 'neutral'> = {
  urgent: 'danger',
  high: 'danger',
  medium: 'warning',
  low: 'default',
  none: 'neutral',
};

interface CyclesFiltersState {
  statusKeys: CycleStatusFilterKey[];
  startDatePresets: DatePresetFilterKey[];
  dueDatePresets: DatePresetFilterKey[];
  startAfter: string | null;
  startBefore: string | null;
  dueAfter: string | null;
  dueBefore: string | null;
}

const IconTrendingUp = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    className="text-(--txt-icon-tertiary)"
    aria-hidden
  >
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);
const IconActivity = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    className="text-(--txt-icon-tertiary)"
    aria-hidden
  >
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);
const IconCycle = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className="text-(--warning-default)"
    aria-hidden
  >
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="3" x2="12" y2="9" />
  </svg>
);
const IconEye = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconBarChart = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    className="text-(--txt-icon-tertiary)"
    aria-hidden
  >
    <line x1="12" y1="20" x2="12" y2="10" />
    <line x1="18" y1="20" x2="18" y2="4" />
    <line x1="6" y1="20" x2="6" y2="16" />
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
const IconMoreVertical = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <circle cx="12" cy="5" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="12" cy="19" r="1.5" />
  </svg>
);
const IconChevronDown = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);
const IconChevronUp = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="m18 15-6-6-6 6" />
  </svg>
);
const IconIssueCount = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <rect width="8" height="8" x="3" y="3" rx="1" />
    <rect width="8" height="8" x="13" y="3" rx="1" />
    <rect width="8" height="8" x="3" y="13" rx="1" />
    <rect width="8" height="8" x="13" y="13" rx="1" />
  </svg>
);
const IconUsers = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export function CyclesPage() {
  const { workspaceSlug, projectId } = useParams<{
    workspaceSlug: string;
    projectId: string;
  }>();
  const [upcomingOpen, setUpcomingOpen] = useState(true);
  const [completedOpen, setCompletedOpen] = useState(true);
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [cycles, setCycles] = useState<CycleApiResponse[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [issues, setIssues] = useState<IssueApiResponse[]>([]);
  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [labels, setLabels] = useState<LabelApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCycleExpanded, setActiveCycleExpanded] = useState(true);
  const [activeCycleTab, setActiveCycleTab] = useState<'priority' | 'assignees' | 'labels'>(
    'priority',
  );
  const [ellipsisMenuOpenId, setEllipsisMenuOpenId] = useState<string | null>(null);
  const [editCycle, setEditCycle] = useState<CycleApiResponse | null>(null);
  const [deleteCycleId, setDeleteCycleId] = useState<string | null>(null);

  const { toggleFavorite, isFavorite } = useCycleFavorites(workspaceSlug, projectId);

  const [filters, setFilters] = useState<CyclesFiltersState>({
    statusKeys: [],
    startDatePresets: [],
    dueDatePresets: [],
    startAfter: null,
    startBefore: null,
    dueAfter: null,
    dueBefore: null,
  });

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
      const t = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      return t >= rangeStartMs && t <= rangeEndMs;
    };

    const matchesPresetUnion = (
      dateIso: string | null | undefined,
      selectedPresets: DatePresetFilterKey[],
      customAfter: string | null,
      customBefore: string | null,
    ) => {
      // Empty selection means "no filtering" (match Plane behavior).
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

    return cycles.filter((c) => {
      return (
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

  const activeCycle = filteredCycles.find((c) => c.status === 'started' || c.status === 'current');
  const activeCycleIssues = useMemo(() => {
    if (!activeCycle) return [];
    return issues.filter((i) => i.cycle_ids?.includes(activeCycle.id));
  }, [issues, activeCycle]);

  const getIssueCount = (cycleId: string) => cycles.find((c) => c.id === cycleId)?.issue_count ?? 0;
  const getProgress = (c: CycleApiResponse) => {
    const total = getIssueCount(c.id);
    if (!total) return 0;
    return c.status === 'completed' ? 100 : 0;
  };
  const cyclePath = (c: CycleApiResponse) =>
    workspace && project ? `/${workspace.slug}/projects/${project.id}/cycles/${c.id}` : '';
  const baseUrl = workspace && project ? `/${workspace.slug}/projects/${project.id}` : '';

  const stateGroupMap: Record<
    string,
    'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled'
  > = {
    backlog: 'backlog',
    unstarted: 'unstarted',
    started: 'started',
    completed: 'completed',
    canceled: 'canceled',
    cancelled: 'canceled',
  };
  const getStateGroup = (stateId: string | null | undefined) => {
    if (!stateId) return undefined;
    const s = states.find((x) => x.id === stateId);
    const g = s?.group?.toLowerCase();
    return g ? stateGroupMap[g] : undefined;
  };

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

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('[data-cycle-ellipsis-menu]')) setEllipsisMenuOpenId(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

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

  const renderCycleRow = (c: CycleApiResponse) => {
    const count = getIssueCount(c.id);
    const dateRange = formatCycleDateRange(c);
    const owner = getOwnerMember(c.owned_by_id);
    const path = cyclePath(c);
    const progress = getProgress(c);
    const isCompleted = c.status === 'completed';
    const canArchive = isCompleted;

    return (
      <div
        key={c.id}
        className="flex items-center gap-3 border-b border-(--border-subtle) last:border-b-0 px-4 py-3 hover:bg-(--bg-layer-1-hover)"
      >
        <CycleProgressCircle progress={progress} />
        <div className="min-w-0 flex-1">
          <Link to={path} className="min-w-0 no-underline" title={c.name}>
            <p className="truncate font-medium text-(--txt-primary)">{c.name}</p>
          </Link>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 text-[13px] text-(--txt-secondary)">
          <IconIssueCount />
          {count}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-[13px] text-(--txt-secondary)">
          <IconCalendar />
          {dateRange ?? 'No dates'}
        </span>
        {owner ? (
          <Avatar
            name={owner.name}
            src={getImageUrl(owner.avatarUrl) ?? undefined}
            size="sm"
            className="h-8 w-8 shrink-0 text-xs"
          />
        ) : (
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded border border-(--border-subtle) border-dashed text-(--txt-icon-tertiary)"
            aria-hidden
          >
            <IconUsers />
          </span>
        )}
        <button
          type="button"
          className="flex size-8 shrink-0 items-center justify-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
          aria-label={isFavorite(c.id) ? 'Remove from favorites' : 'Add to favorites'}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void toggleFavorite(c.id);
          }}
        >
          {isFavorite(c.id) ? (
            <span className="text-amber-500">
              <IconStarFilled />
            </span>
          ) : (
            <IconStar />
          )}
        </button>
        <div className="relative shrink-0" data-cycle-ellipsis-menu>
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
            aria-label="More options"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setEllipsisMenuOpenId((cur) => (cur === c.id ? null : c.id));
            }}
          >
            <IconMoreVertical />
          </button>
          {ellipsisMenuOpenId === c.id && (
            <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setEllipsisMenuOpenId(null);
                  setEditCycle(c);
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
                  window.open(path, '_blank', 'noopener,noreferrer');
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
                    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
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
                disabled={!canArchive}
                className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm text-(--txt-tertiary) disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>Archive</span>
                <span className="text-[11px] leading-tight">
                  Only completed cycles can be archived.
                </span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setEllipsisMenuOpenId(null);
                  setDeleteCycleId(c.id);
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const getStateName = (stateId: string | null | undefined) =>
    stateId ? (states.find((s) => s.id === stateId)?.name ?? '—') : '—';

  function formatShortDate(iso: string | null | undefined): string | null {
    if (!iso?.trim()) return null;
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return null;
    const d = new Date(t);
    return `${MONTH_ABBR[d.getMonth()]} ${pad2(d.getDate())}`;
  }

  return (
    <div className="border-y border-(--border-subtle) border-x-0 rounded-none bg-(--bg-surface-1)">
      {/* Active cycle */}
      <section>
        <button
          type="button"
          onClick={() => setActiveCycleExpanded((e) => !e)}
          className="flex w-full min-h-[44px] items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
        >
          <IconCycle />
          Active cycle
          <span className="ml-auto flex size-4 shrink-0 items-center justify-center text-(--txt-icon-tertiary)">
            {activeCycleExpanded ? <IconChevronUp /> : <IconChevronDown />}
          </span>
        </button>
        {activeCycleExpanded && activeCycle && (
          <>
            {/* Sub-header: progress ring, cycle name, More details, date range, timezone, avatar, favorite, menu */}
            <div className="flex flex-wrap items-center gap-3 border-t border-(--border-subtle) px-4 py-3">
              <CycleProgressCircle progress={activeCycleProgressStats.percentClosed} />
              <div className="min-w-0 flex-1">
                <span className="font-medium text-(--txt-primary)">{activeCycle.name}</span>
              </div>
              <Link
                to={cyclePath(activeCycle)}
                className="flex items-center gap-1.5 text-sm text-(--txt-secondary) hover:text-(--txt-primary)"
              >
                <IconEye />
                More details
              </Link>
              <span className="text-[13px] text-(--txt-secondary)">
                {formatCycleDateRange(activeCycle) ?? 'No dates'}
              </span>
              <span className="text-[13px] text-(--txt-tertiary)">
                {project?.timezone ?? 'UTC'}
              </span>
              {getOwnerMember(activeCycle.owned_by_id) ? (
                <Avatar
                  name={getOwnerMember(activeCycle.owned_by_id)!.name}
                  src={getImageUrl(getOwnerMember(activeCycle.owned_by_id)!.avatarUrl) ?? undefined}
                  size="sm"
                  className="h-8 w-8 shrink-0 text-xs"
                />
              ) : (
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded border border-(--border-subtle) border-dashed text-(--txt-icon-tertiary)"
                  aria-hidden
                >
                  <IconUsers />
                </span>
              )}
              <button
                type="button"
                className="flex size-8 shrink-0 items-center justify-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
                aria-label={
                  isFavorite(activeCycle.id) ? 'Remove from favorites' : 'Add to favorites'
                }
                onClick={() => void toggleFavorite(activeCycle.id)}
              >
                {isFavorite(activeCycle.id) ? (
                  <span className="text-amber-500">
                    <IconStarFilled />
                  </span>
                ) : (
                  <IconStar />
                )}
              </button>
              <div className="relative shrink-0" data-cycle-ellipsis-menu>
                <button
                  type="button"
                  className="flex size-8 items-center justify-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
                  aria-label="More options"
                  onClick={() =>
                    setEllipsisMenuOpenId((cur) => (cur === activeCycle.id ? null : activeCycle.id))
                  }
                >
                  <IconMoreVertical />
                </button>
                {ellipsisMenuOpenId === activeCycle.id && (
                  <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                      onClick={() => {
                        setEllipsisMenuOpenId(null);
                        setEditCycle(activeCycle);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                      onClick={() => {
                        window.open(cyclePath(activeCycle), '_blank', 'noopener,noreferrer');
                        setEllipsisMenuOpenId(null);
                      }}
                    >
                      Open in new tab
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            `${window.location.origin}${cyclePath(activeCycle)}`,
                          );
                        } catch {
                          /* ignore */
                        }
                        setEllipsisMenuOpenId(null);
                      }}
                    >
                      Copy link
                    </button>
                    <div className="my-1 border-t border-(--border-subtle)" />
                    <button
                      type="button"
                      disabled={activeCycle.status !== 'completed'}
                      className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm text-(--txt-tertiary) disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span>Archive</span>
                      <span className="text-[11px] leading-tight">
                        Only completed cycles can be archived.
                      </span>
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                      onClick={() => {
                        setEllipsisMenuOpenId(null);
                        setDeleteCycleId(activeCycle.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Three cards */}
            <div className="grid gap-4 border-t border-(--border-subtle) p-4 sm:grid-cols-3">
              {/* Progress card */}
              <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-(--txt-primary)">Progress</h3>
                  <span className="text-xs text-(--txt-tertiary)">
                    {activeCycleProgressStats.completed}/{activeCycleProgressStats.total} Work item
                    closed
                  </span>
                </div>
                {activeCycleProgressStats.total > 0 ? (
                  <>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-(--bg-layer-2)">
                      <div className="flex h-full">
                        {activeCycleProgressStats.started > 0 && (
                          <div
                            className="bg-(--warning-default)"
                            style={{
                              width: `${(activeCycleProgressStats.started / activeCycleProgressStats.total) * 100}%`,
                            }}
                          />
                        )}
                        {activeCycleProgressStats.backlog > 0 && (
                          <div
                            className="bg-(--border-subtle)"
                            style={{
                              width: `${(activeCycleProgressStats.backlog / activeCycleProgressStats.total) * 100}%`,
                            }}
                          />
                        )}
                        {activeCycleProgressStats.completed > 0 && (
                          <div
                            className="bg-(--success-default)"
                            style={{
                              width: `${(activeCycleProgressStats.completed / activeCycleProgressStats.total) * 100}%`,
                            }}
                          />
                        )}
                      </div>
                    </div>
                    <ul className="mt-3 space-y-1.5 text-[13px]">
                      {activeCycleProgressStats.started > 0 && (
                        <li className="flex items-center gap-2">
                          <span className="size-2 rounded-full bg-(--warning-default)" />
                          Started {activeCycleProgressStats.started} Work item
                          {activeCycleProgressStats.started !== 1 ? 's' : ''}
                        </li>
                      )}
                      {activeCycleProgressStats.backlog > 0 && (
                        <li className="flex items-center gap-2">
                          <span className="size-2 rounded-full bg-(--border-subtle)" />
                          Backlog {activeCycleProgressStats.backlog} Work item
                          {activeCycleProgressStats.backlog !== 1 ? 's' : ''}
                        </li>
                      )}
                      {activeCycleProgressStats.completed > 0 && (
                        <li className="flex items-center gap-2">
                          <span className="size-2 rounded-full bg-(--success-default)" />
                          Completed {activeCycleProgressStats.completed} Work item
                          {activeCycleProgressStats.completed !== 1 ? 's' : ''}
                        </li>
                      )}
                    </ul>
                  </>
                ) : (
                  <div className="mt-4 flex flex-col items-center justify-center py-6">
                    <IconTrendingUp />
                    <p className="mt-2 text-center text-sm text-(--txt-tertiary)">
                      Add work items to the cycle to view its progress
                    </p>
                  </div>
                )}
              </div>

              {/* Burndown card */}
              <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-(--txt-primary)">Work item burndown</h3>
                  <span className="text-xs text-(--txt-tertiary)">
                    Pending work items -{' '}
                    {activeCycleProgressStats.total - activeCycleProgressStats.completed}
                  </span>
                </div>
                {activeCycleProgressStats.total > 0 ? (
                  <div className="mt-4 flex flex-col items-center justify-center py-6">
                    <IconActivity />
                    <p className="mt-2 text-center text-sm text-(--txt-tertiary)">
                      Burndown chart coming soon.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-col items-center justify-center py-6">
                    <IconActivity />
                    <p className="mt-2 text-center text-sm text-(--txt-tertiary)">
                      Add work items to the cycle to view the burndown chart.
                    </p>
                  </div>
                )}
              </div>

              {/* Stats card with tabs */}
              <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-4">
                <div className="flex gap-1 rounded-md bg-(--bg-layer-2) p-0.5">
                  {(['priority', 'assignees', 'labels'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveCycleTab(tab)}
                      className={cn(
                        'flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors',
                        activeCycleTab === tab
                          ? 'bg-(--bg-surface-1) text-(--txt-primary) shadow-sm'
                          : 'text-(--txt-tertiary) hover:text-(--txt-secondary)',
                      )}
                    >
                      {tab === 'priority' && 'Priority work items'}
                      {tab === 'assignees' && 'Assignees'}
                      {tab === 'labels' && 'Labels'}
                    </button>
                  ))}
                </div>
                <div className="mt-3 min-h-[120px]">
                  {activeCycleTab === 'priority' && (
                    <>
                      {activeCycleIssues.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6">
                          <IconBarChart />
                          <p className="mt-2 text-center text-sm text-(--txt-tertiary)">
                            Add work items to view priority breakdown.
                          </p>
                        </div>
                      ) : (
                        <ul className="space-y-2">
                          {[...activeCycleIssues]
                            .sort((a, b) => {
                              const pr = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
                              return (
                                (pr[(a.priority as Priority) ?? 'none'] ?? 99) -
                                (pr[(b.priority as Priority) ?? 'none'] ?? 99)
                              );
                            })
                            .map((issue) => (
                              <li key={issue.id}>
                                <Link
                                  to={`${baseUrl}/issues/${issue.id}`}
                                  className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-(--bg-layer-1-hover)"
                                >
                                  <span className="min-w-0 flex-1 truncate text-(--txt-primary)">
                                    {issue.name}
                                  </span>
                                  <Badge
                                    variant={
                                      priorityVariant[(issue.priority as Priority) ?? 'none']
                                    }
                                    className="!px-1.5 !py-0 text-[10px] shrink-0"
                                  >
                                    {issue.priority ?? '—'}
                                  </Badge>
                                  <Badge
                                    variant="neutral"
                                    className="!px-1.5 !py-0 text-[10px] shrink-0"
                                  >
                                    {getStateName(issue.state_id)}
                                  </Badge>
                                  {issue.target_date && (
                                    <span className="flex items-center gap-1 text-[11px] text-(--txt-tertiary) shrink-0">
                                      <IconCalendar />
                                      {formatShortDate(issue.target_date)}
                                    </span>
                                  )}
                                </Link>
                              </li>
                            ))}
                        </ul>
                      )}
                    </>
                  )}
                  {activeCycleTab === 'assignees' && (
                    <>
                      {activeCycleAssigneeStats.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6">
                          <IconUsers />
                          <p className="mt-2 text-center text-sm text-(--txt-tertiary)">
                            No assignees in this cycle.
                          </p>
                        </div>
                      ) : (
                        <ul className="space-y-2">
                          {activeCycleAssigneeStats.map((s) => {
                            const member = s.memberId
                              ? members.find((m) => m.member_id === s.memberId)
                              : null;
                            const name =
                              member?.member_display_name?.trim() ??
                              member?.member_email?.split('@')[0] ??
                              (s.memberId ? s.memberId.slice(0, 8) : 'Unassigned');
                            return (
                              <li
                                key={s.memberId ?? '__unassigned__'}
                                className="flex items-center justify-between gap-2"
                              >
                                <div className="flex min-w-0 items-center gap-2">
                                  {s.memberId ? (
                                    <Avatar
                                      name={name}
                                      src={getImageUrl(member?.member_avatar ?? null) ?? undefined}
                                      size="sm"
                                      className="h-6 w-6 shrink-0 text-[10px]"
                                    />
                                  ) : (
                                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-(--bg-layer-2) text-(--txt-icon-tertiary)">
                                      <IconUsers />
                                    </span>
                                  )}
                                  <span className="truncate text-sm text-(--txt-primary)">
                                    {name}
                                  </span>
                                </div>
                                <span className="shrink-0 text-[13px] text-(--txt-secondary)">
                                  {s.percent}% of {s.total}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </>
                  )}
                  {activeCycleTab === 'labels' && (
                    <>
                      {activeCycleLabelStats.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6">
                          <IconBarChart />
                          <p className="mt-2 text-center text-sm text-(--txt-tertiary)">
                            No labels in this cycle.
                          </p>
                        </div>
                      ) : (
                        <ul className="space-y-2">
                          {activeCycleLabelStats.map((s) => {
                            const label = s.labelId ? labels.find((l) => l.id === s.labelId) : null;
                            const name = label?.name ?? (s.labelId ? 'Unknown' : 'No labels');
                            const color = label?.color ?? '#6b7280';
                            return (
                              <li
                                key={s.labelId ?? '__no_label__'}
                                className="flex items-center justify-between gap-2"
                              >
                                <div className="flex min-w-0 items-center gap-2">
                                  <span
                                    className="size-3 shrink-0 rounded-full"
                                    style={{ backgroundColor: color }}
                                  />
                                  <span className="truncate text-sm text-(--txt-primary)">
                                    {name}
                                  </span>
                                </div>
                                <span className="shrink-0 text-[13px] text-(--txt-secondary)">
                                  {s.percent}% of {s.total}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
        {activeCycleExpanded && !activeCycle && (
          <p className="border-t border-(--border-subtle) px-4 py-3 text-sm text-(--txt-tertiary)">
            No active cycle.
          </p>
        )}
      </section>

      {/* Upcoming cycle */}
      <section className="border-t border-(--border-subtle)">
        <button
          type="button"
          onClick={() => setUpcomingOpen((o) => !o)}
          className="flex min-h-[44px] w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
        >
          <span className="flex h-2 w-2 rounded-full border-2 border-dashed border-(--brand-default) bg-transparent" />
          Upcoming cycle {upcomingCycles.length}
          <span className="ml-auto">{upcomingOpen ? <IconChevronUp /> : <IconChevronDown />}</span>
        </button>
        {upcomingOpen && (
          <div className="mt-2 rounded-md border border-(--border-subtle) bg-(--bg-surface-1)">
            {upcomingCycles.length === 0 ? (
              <p className="py-4 pl-4 text-sm text-(--txt-tertiary)">No upcoming cycles.</p>
            ) : (
              upcomingCycles.map((c) => renderCycleRow(c))
            )}
          </div>
        )}
      </section>

      {/* Completed cycle */}
      <section className="border-t border-(--border-subtle)">
        <button
          type="button"
          onClick={() => setCompletedOpen((o) => !o)}
          className="flex min-h-[44px] w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
        >
          <span className="flex h-2 w-2 rounded-full bg-(--success-default)" />
          Completed cycle {completedCycles.length}
          <span className="ml-auto">{completedOpen ? <IconChevronUp /> : <IconChevronDown />}</span>
        </button>
        {completedOpen && (
          <div className="mt-2 rounded-md border border-(--border-subtle) bg-(--bg-surface-1)">
            {completedCycles.length === 0 ? (
              <p className="py-4 pl-4 text-sm text-(--txt-tertiary)">No completed cycles.</p>
            ) : (
              completedCycles.map((c) => renderCycleRow(c))
            )}
          </div>
        )}
      </section>

      <UpdateCycleModal
        open={editCycle !== null}
        onClose={() => setEditCycle(null)}
        workspaceSlug={workspaceSlug!}
        projectId={projectId!}
        cycle={editCycle}
        onUpdated={(updated) => {
          setCycles((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          window.dispatchEvent(
            new CustomEvent(PROJECT_CYCLES_REFRESH_EVENT, {
              detail: { workspaceSlug, projectId },
            }),
          );
        }}
      />

      {deleteCycleId && (
        <DeleteCycleConfirm
          cycleName={cycles.find((c) => c.id === deleteCycleId)?.name ?? 'Cycle'}
          onClose={() => setDeleteCycleId(null)}
          onConfirm={async () => {
            if (!workspaceSlug || !projectId || !deleteCycleId) return;
            try {
              await cycleService.delete(workspaceSlug, projectId, deleteCycleId);
              setCycles((prev) => prev.filter((c) => c.id !== deleteCycleId));
              window.dispatchEvent(
                new CustomEvent(PROJECT_CYCLES_REFRESH_EVENT, {
                  detail: { workspaceSlug, projectId },
                }),
              );
            } catch {
              // ignore
            }
            setDeleteCycleId(null);
          }}
        />
      )}
    </div>
  );
}

function DeleteCycleConfirm({
  cycleName,
  onClose,
  onConfirm,
}: {
  cycleName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog">
      <div className="mx-4 w-full max-w-sm rounded-lg border border-(--border-subtle) bg-(--bg-surface-1) p-4 shadow-lg">
        <p className="text-sm text-(--txt-primary)">
          Delete &quot;{cycleName}&quot;? This cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-(--border-subtle) px-3 py-1.5 text-sm font-medium text-(--txt-secondary) hover:bg-(--bg-layer-1-hover)"
            onClick={onClose}
            disabled={deleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-(--bg-danger-primary) px-3 py-1.5 text-sm font-medium text-(--txt-on-color) hover:bg-(--bg-danger-primary-hover) disabled:opacity-50"
            onClick={async () => {
              setDeleting(true);
              await onConfirm();
              setDeleting(false);
            }}
            disabled={deleting}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
