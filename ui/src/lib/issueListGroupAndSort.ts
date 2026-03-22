import type {
  IssueApiResponse,
  StateApiResponse,
  LabelApiResponse,
  CycleApiResponse,
  ModuleApiResponse,
  WorkspaceMemberApiResponse,
} from '../api/types';
import type { SavedViewGroupBy, SavedViewOrderBy } from './projectSavedViewDisplay';

const NONE_STATE_KEY = '__no_state__';
const ALL_GROUP_KEY = '__all__';
const NONE_CYCLE_KEY = '__no_cycle__';
const NONE_MODULE_KEY = '__no_module__';
const NONE_LABEL_KEY = '__no_label__';
const NONE_ASSIGNEE_KEY = '__no_assignee__';
const NONE_CREATOR_KEY = '__no_creator__';

const PRIORITY_RANK: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

function pushUniq(arr: string[], id: string) {
  if (!arr.includes(id)) arr.push(id);
}

export function sortIssuesByOrder(
  list: IssueApiResponse[],
  orderBy: SavedViewOrderBy,
): IssueApiResponse[] {
  const out = [...list];
  switch (orderBy) {
    case 'manual':
      return out.sort((a, b) => {
        const so = (a.sort_order ?? 0) - (b.sort_order ?? 0);
        if (so !== 0) return so;
        const seq = (a.sequence_id ?? 0) - (b.sequence_id ?? 0);
        if (seq !== 0) return seq;
        return a.name.localeCompare(b.name);
      });
    case 'last_created':
      return out.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    case 'last_updated':
      return out.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
    case 'start_date':
      return out.sort((a, b) => {
        const as = a.start_date ? new Date(a.start_date).getTime() : Infinity;
        const bs = b.start_date ? new Date(b.start_date).getTime() : Infinity;
        return as - bs;
      });
    case 'due_date':
      return out.sort((a, b) => {
        const ad = a.target_date ? new Date(a.target_date).getTime() : Infinity;
        const bd = b.target_date ? new Date(b.target_date).getTime() : Infinity;
        return ad - bd;
      });
    case 'priority':
      return out.sort((a, b) => {
        const pa = PRIORITY_RANK[a.priority ?? 'none'] ?? 99;
        const pb = PRIORITY_RANK[b.priority ?? 'none'] ?? 99;
        return pa - pb;
      });
    default:
      return out;
  }
}

export interface GroupedIssuesResult {
  order: string[];
  groups: Map<string, IssueApiResponse[]>;
  title: (key: string) => string;
  isFlat: boolean;
}

export function buildGroupedIssues(params: {
  baseForGrouping: IssueApiResponse[];
  groupBy: SavedViewGroupBy;
  orderBy: SavedViewOrderBy;
  showEmptyGroups: boolean;
  states: StateApiResponse[];
  cycles: CycleApiResponse[];
  modules: ModuleApiResponse[];
  labels: LabelApiResponse[];
  members: WorkspaceMemberApiResponse[];
}): GroupedIssuesResult {
  const {
    baseForGrouping,
    groupBy,
    orderBy,
    showEmptyGroups,
    states,
    cycles,
    modules,
    labels,
    members,
  } = params;

  const sortIn = (arr: IssueApiResponse[]) => sortIssuesByOrder([...arr], orderBy);

  const sortedStates = [...states].sort(
    (a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || a.name.localeCompare(b.name),
  );

  const getStateName = (stateKey: string) => {
    if (stateKey === NONE_STATE_KEY) return 'No state';
    return states.find((s) => s.id === stateKey)?.name ?? stateKey;
  };

  if (groupBy === 'none') {
    const m = new Map<string, IssueApiResponse[]>();
    m.set(ALL_GROUP_KEY, sortIn(baseForGrouping));
    return {
      order: [ALL_GROUP_KEY],
      groups: m,
      title: () => '',
      isFlat: true,
    };
  }

  if (groupBy === 'states') {
    const map = new Map<string, IssueApiResponse[]>();
    for (const issue of baseForGrouping) {
      const key = issue.state_id?.trim() ? issue.state_id : NONE_STATE_KEY;
      const arr = map.get(key) ?? [];
      arr.push(issue);
      map.set(key, arr);
    }
    let ordered: string[];
    if (showEmptyGroups) {
      ordered = sortedStates.map((s) => s.id);
      ordered.push(NONE_STATE_KEY);
      for (const k of ordered) {
        if (!map.has(k)) map.set(k, []);
      }
      for (const id of map.keys()) pushUniq(ordered, id);
    } else {
      ordered = [];
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
    }
    for (const k of ordered) {
      const arr = map.get(k);
      if (arr) map.set(k, sortIn(arr));
    }
    return { order: ordered, groups: map, title: getStateName, isFlat: false };
  }

  if (groupBy === 'priority') {
    const map = new Map<string, IssueApiResponse[]>();
    for (const issue of baseForGrouping) {
      const key = issue.priority?.trim() || 'none';
      const arr = map.get(key) ?? [];
      arr.push(issue);
      map.set(key, arr);
    }
    let ordered: string[];
    if (showEmptyGroups) {
      ordered = ['urgent', 'high', 'medium', 'low', 'none'];
      for (const k of ordered) {
        if (!map.has(k)) map.set(k, []);
      }
      for (const id of map.keys()) pushUniq(ordered, id);
    } else {
      ordered = [];
      for (const p of ['urgent', 'high', 'medium', 'low', 'none']) {
        if (map.has(p)) ordered.push(p);
      }
      for (const id of map.keys()) pushUniq(ordered, id);
    }
    for (const k of ordered) {
      const arr = map.get(k);
      if (arr) map.set(k, sortIn(arr));
    }
    return {
      order: ordered,
      groups: map,
      title: (k) => (k === 'none' ? 'None' : k.charAt(0).toUpperCase() + k.slice(1)),
      isFlat: false,
    };
  }

  if (groupBy === 'cycle') {
    const map = new Map<string, IssueApiResponse[]>();
    for (const issue of baseForGrouping) {
      const cid = issue.cycle_ids?.[0]?.trim();
      const key = cid ?? NONE_CYCLE_KEY;
      const arr = map.get(key) ?? [];
      arr.push(issue);
      map.set(key, arr);
    }
    const cyclesSorted = [...cycles].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    let ordered: string[];
    if (showEmptyGroups) {
      ordered = [...cyclesSorted.map((c) => c.id), NONE_CYCLE_KEY];
      for (const k of ordered) {
        if (!map.has(k)) map.set(k, []);
      }
      for (const id of map.keys()) pushUniq(ordered, id);
    } else {
      ordered = [];
      for (const c of cyclesSorted) {
        if (map.has(c.id)) ordered.push(c.id);
      }
      for (const id of map.keys()) pushUniq(ordered, id);
    }
    for (const k of ordered) {
      const arr = map.get(k);
      if (arr) map.set(k, sortIn(arr));
    }
    return {
      order: ordered,
      groups: map,
      title: (k) =>
        k === NONE_CYCLE_KEY ? 'No cycle' : (cycles.find((c) => c.id === k)?.name ?? k),
      isFlat: false,
    };
  }

  if (groupBy === 'module') {
    const map = new Map<string, IssueApiResponse[]>();
    for (const issue of baseForGrouping) {
      const mid = issue.module_ids?.[0]?.trim();
      const key = mid ?? NONE_MODULE_KEY;
      const arr = map.get(key) ?? [];
      arr.push(issue);
      map.set(key, arr);
    }
    const modulesSorted = [...modules].sort((a, b) => a.name.localeCompare(b.name));
    let ordered: string[];
    if (showEmptyGroups) {
      ordered = [...modulesSorted.map((m) => m.id), NONE_MODULE_KEY];
      for (const k of ordered) {
        if (!map.has(k)) map.set(k, []);
      }
      for (const id of map.keys()) pushUniq(ordered, id);
    } else {
      ordered = [];
      for (const mod of modulesSorted) {
        if (map.has(mod.id)) ordered.push(mod.id);
      }
      for (const id of map.keys()) pushUniq(ordered, id);
    }
    for (const k of ordered) {
      const arr = map.get(k);
      if (arr) map.set(k, sortIn(arr));
    }
    return {
      order: ordered,
      groups: map,
      title: (k) =>
        k === NONE_MODULE_KEY ? 'No module' : (modules.find((m) => m.id === k)?.name ?? k),
      isFlat: false,
    };
  }

  if (groupBy === 'labels') {
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
    const labelOrder = [...labels].sort((a, b) => a.name.localeCompare(b.name)).map((l) => l.id);
    let ordered: string[];
    if (showEmptyGroups) {
      ordered = [...labelOrder, NONE_LABEL_KEY];
      for (const k of ordered) {
        if (!map.has(k)) map.set(k, []);
      }
      for (const id of map.keys()) pushUniq(ordered, id);
    } else {
      ordered = [];
      for (const id of labelOrder) {
        if (map.has(id)) ordered.push(id);
      }
      for (const id of map.keys()) pushUniq(ordered, id);
    }
    for (const k of ordered) {
      const arr = map.get(k);
      if (arr) map.set(k, sortIn(arr));
    }
    return {
      order: ordered,
      groups: map,
      title: (k) =>
        k === NONE_LABEL_KEY ? 'No labels' : (labels.find((l) => l.id === k)?.name ?? k),
      isFlat: false,
    };
  }

  if (groupBy === 'assignees') {
    const map = new Map<string, IssueApiResponse[]>();
    for (const issue of baseForGrouping) {
      const aid = issue.assignee_ids?.[0]?.trim();
      const key = aid ?? NONE_ASSIGNEE_KEY;
      const arr = map.get(key) ?? [];
      arr.push(issue);
      map.set(key, arr);
    }
    if (showEmptyGroups && !map.has(NONE_ASSIGNEE_KEY)) {
      map.set(NONE_ASSIGNEE_KEY, []);
    }
    const memberName = (uid: string) => {
      const m = members.find((x) => x.member_id === uid);
      return m?.member_display_name?.trim() || m?.member_email?.split('@')[0]?.trim() || 'Member';
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
      title: (k) => (k === NONE_ASSIGNEE_KEY ? 'Unassigned' : memberName(k)),
      isFlat: false,
    };
  }

  if (groupBy === 'created_by') {
    const map = new Map<string, IssueApiResponse[]>();
    for (const issue of baseForGrouping) {
      const uid = issue.created_by_id?.trim();
      const key = uid ?? NONE_CREATOR_KEY;
      const arr = map.get(key) ?? [];
      arr.push(issue);
      map.set(key, arr);
    }
    if (showEmptyGroups && !map.has(NONE_CREATOR_KEY)) {
      map.set(NONE_CREATOR_KEY, []);
    }
    const memberName = (uid: string) => {
      const m = members.find((x) => x.member_id === uid);
      return m?.member_display_name?.trim() || m?.member_email?.split('@')[0]?.trim() || 'Member';
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
      title: (k) => (k === NONE_CREATOR_KEY ? 'Unknown' : memberName(k)),
      isFlat: false,
    };
  }

  const m = new Map<string, IssueApiResponse[]>();
  m.set(ALL_GROUP_KEY, sortIn(baseForGrouping));
  return {
    order: [ALL_GROUP_KEY],
    groups: m,
    title: () => '',
    isFlat: true,
  };
}
