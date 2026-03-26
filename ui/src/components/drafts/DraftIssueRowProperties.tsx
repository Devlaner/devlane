import { useMemo, useRef, useState } from 'react';
import { Dropdown } from '../work-item/Dropdown';
import { Avatar } from '../ui';
import type {
  IssueApiResponse,
  ProjectApiResponse,
  StateApiResponse,
  LabelApiResponse,
  CycleApiResponse,
  ModuleApiResponse,
  WorkspaceMemberApiResponse,
} from '../../api/types';
import type { Priority } from '../../types';
import type { StateGroup } from '../../types/workspaceViewFilters';
import { PRIORITY_LABELS } from '../workspace-views/WorkspaceViewsFiltersData';
import { findWorkspaceMemberByUserId, getImageUrl } from '../../lib/utils';
import { labelService } from '../../services/labelService';

const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low', 'none'];
const PRIORITY_TILE: Record<Priority, string> = {
  urgent: 'border-red-200 bg-red-50 text-red-600',
  high: 'border-orange-200 bg-orange-50 text-orange-600',
  medium: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  low: 'border-blue-200 bg-blue-50 text-blue-600',
  none: 'border-(--border-subtle) bg-(--bg-layer-1) text-(--txt-icon-tertiary)',
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function IconBacklogStatus() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle
        cx="7"
        cy="7"
        r="5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeDasharray="1.2 2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconTodoStatus() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function IconInProgressStatus() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" opacity="0.35" />
      <circle cx="7" cy="7" r="4.2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function IconDoneStatus() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="5" fill="currentColor" opacity="0.2" />
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M4.3 7.2 6.3 9.1 9.7 5.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCancelledStatus() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="5" fill="currentColor" opacity="0.12" />
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M5.1 5.1 8.9 8.9M8.9 5.1 5.1 8.9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function stateIconByGroup(group: string | undefined) {
  const g = (group ?? 'backlog').toLowerCase() as StateGroup;
  switch (g) {
    case 'unstarted':
      return <IconTodoStatus />;
    case 'started':
      return <IconInProgressStatus />;
    case 'completed':
      return <IconDoneStatus />;
    case 'canceled':
      return <IconCancelledStatus />;
    case 'backlog':
    default:
      return <IconBacklogStatus />;
  }
}

function IconPriorityUrgent() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 4.2v3.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="7" cy="9.9" r="0.8" fill="currentColor" />
    </svg>
  );
}

function IconPriorityBars({ level }: { level: 1 | 2 | 3 }) {
  const bars = level === 3 ? [9.7, 7.9, 6.1] : level === 2 ? [9.7, 7.9] : [9.7];
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      {bars.map((y, idx) => (
        <path
          key={idx}
          d={`M4.2 ${y}h5.6`}
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

function IconPriorityNone() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" opacity="0.9" />
      <path d="M4.1 4.1 9.9 9.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function priorityIcon(p: Priority) {
  switch (p) {
    case 'urgent':
      return <IconPriorityUrgent />;
    case 'high':
      return <IconPriorityBars level={3} />;
    case 'medium':
      return <IconPriorityBars level={2} />;
    case 'low':
      return <IconPriorityBars level={1} />;
    case 'none':
    default:
      return <IconPriorityNone />;
  }
}

function IconStartDateProperty() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0" aria-hidden>
      <rect
        x="2.25"
        y="2.75"
        width="11.5"
        height="10.5"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.15"
      />
      <path d="M2.25 6.25h11.5" stroke="currentColor" strokeWidth="1.15" />
      <circle cx="11.25" cy="10.75" r="2.15" stroke="currentColor" strokeWidth="1" />
      <path
        d="M11.25 9.4v1.35l.75.55"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconDueDateProperty() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0" aria-hidden>
      <rect
        x="2.25"
        y="2.75"
        width="11.5"
        height="10.5"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.15"
      />
      <path d="M2.25 6.25h11.5" stroke="currentColor" strokeWidth="1.15" />
      <path
        d="M7.15 9.35 8.4 10.6l2.5-2.5"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const IconChevronDown = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className="shrink-0 text-(--txt-icon-tertiary)"
    aria-hidden
  >
    <path d="m6 9 6 6 6-6" />
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

const IconLayoutGrid = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <rect width="7" height="7" x="3" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="14" rx="1" />
    <rect width="7" height="7" x="3" y="14" rx="1" />
  </svg>
);

const IconCycle = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);

const IconMoreHorizontal = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <circle cx="5" cy="12" r="1.75" />
    <circle cx="12" cy="12" r="1.75" />
    <circle cx="19" cy="12" r="1.75" />
  </svg>
);

const IconEdit = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
);

const IconCopy = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

const IconMoveToIssues = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M3 9h18" />
    <path d="M9 3v18" />
  </svg>
);

const IconTrash = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);

function stateGroupIcon(group: string | undefined) {
  return stateIconByGroup(group);
}

const propBtnSquare =
  'relative flex size-7 shrink-0 items-center justify-center rounded border border-(--border-subtle) bg-(--bg-surface-1) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) disabled:pointer-events-none disabled:opacity-40';

export interface DraftIssueRowPropertiesProps {
  workspaceSlug: string;
  issue: IssueApiResponse;
  project: ProjectApiResponse | undefined;
  states: StateApiResponse[];
  labels: LabelApiResponse[];
  modules: ModuleApiResponse[];
  cycles: CycleApiResponse[];
  members: WorkspaceMemberApiResponse[];
  busy: boolean;
  openDropdownId: string | null;
  setOpenDropdownId: (id: string | null) => void;
  onPatch: (issue: IssueApiResponse, payload: Record<string, unknown>) => Promise<void>;
  onModuleChange: (issue: IssueApiResponse, moduleId: string | null) => Promise<void>;
  onCycleChange: (issue: IssueApiResponse, cycleId: string | null) => Promise<void>;
  onToggleRowMenu: () => void;
  rowMenuOpen: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onMoveToIssues: () => void;
  onDelete: () => void;
}

export function DraftIssueRowProperties({
  workspaceSlug,
  issue,
  project,
  states,
  labels,
  modules,
  cycles,
  members,
  busy,
  openDropdownId,
  setOpenDropdownId,
  onPatch,
  onModuleChange,
  onCycleChange,
  onToggleRowMenu,
  rowMenuOpen,
  onEdit,
  onDuplicate,
  onMoveToIssues,
  onDelete,
}: DraftIssueRowPropertiesProps) {
  const startInputRef = useRef<HTMLInputElement>(null);
  const dueInputRef = useRef<HTMLInputElement>(null);
  const [stateSearch, setStateSearch] = useState('');
  const [prioritySearch, setPrioritySearch] = useState('');
  const [labelSearch, setLabelSearch] = useState('');
  const [createLabelLoading, setCreateLabelLoading] = useState(false);
  const [createLabelError, setCreateLabelError] = useState<string | null>(null);
  const [localLabels, setLocalLabels] = useState<LabelApiResponse[]>(labels);
  if (localLabels !== labels && labels.length >= 0) {
    // keep local options in sync with prop updates
    setLocalLabels(labels);
  }

  const pri = (issue.priority ?? 'none') as Priority;
  const currentState = states.find((s) => s.id === issue.state_id);
  const stateName = currentState?.name ?? 'Backlog';
  const primaryAssigneeId =
    issue.assignee_ids && issue.assignee_ids.length > 0 ? issue.assignee_ids[0] : null;
  const assigneeMember = findWorkspaceMemberByUserId(members, primaryAssigneeId);
  const assigneeName =
    assigneeMember?.member_display_name?.trim() ||
    assigneeMember?.member_email?.split('@')[0] ||
    (primaryAssigneeId ? primaryAssigneeId.slice(0, 8) : '');
  const assigneeAvatar = assigneeMember?.member_avatar?.trim();
  const labelNames = (issue.label_ids ?? [])
    .map((id) => localLabels.find((l) => l.id === id)?.name)
    .filter((n): n is string => Boolean(n));
  const currentModuleId = issue.module_ids?.[0] ?? null;
  const moduleCount = issue.module_ids?.length ?? 0;
  const currentCycleId = issue.cycle_ids?.[0] ?? null;
  const cycleName = currentCycleId ? cycles.find((c) => c.id === currentCycleId)?.name : '';
  const stateOptions = useMemo(() => {
    const byGroup = new Map<string, StateApiResponse>();
    for (const s of states) {
      const g = (s.group ?? '').toLowerCase();
      if (!g) continue;
      if (!byGroup.has(g)) byGroup.set(g, s);
    }
    // Plane drafts shows these groups in this order
    const ORDER: Array<{ group: string; label: string }> = [
      { group: 'backlog', label: 'Backlog' },
      { group: 'unstarted', label: 'Todo' },
      { group: 'started', label: 'In Progress' },
      { group: 'completed', label: 'Done' },
      { group: 'canceled', label: 'Cancelled' },
    ];
    return ORDER.map(({ group, label }) => {
      const st = byGroup.get(group);
      return { group, label, id: st?.id ?? null };
    });
  }, [states]);

  const filteredStateOptions = useMemo(() => {
    const q = stateSearch.trim().toLowerCase();
    if (!q) return stateOptions;
    return stateOptions.filter((o) => o.label.toLowerCase().includes(q));
  }, [stateOptions, stateSearch]);

  const filteredPriorities = useMemo(() => {
    const q = prioritySearch.trim().toLowerCase();
    if (!q) return PRIORITIES;
    return PRIORITIES.filter((p) => PRIORITY_LABELS[p].toLowerCase().includes(q));
  }, [prioritySearch]);

  const filteredLabels = useMemo(() => {
    const q = labelSearch.trim().toLowerCase();
    if (!q) return localLabels;
    return localLabels.filter((l) => l.name.toLowerCase().includes(q));
  }, [localLabels, labelSearch]);

  const canCreateLabel = useMemo(() => {
    const name = labelSearch.trim();
    if (!name) return false;
    return !localLabels.some((l) => l.name.toLowerCase() === name.toLowerCase());
  }, [labelSearch, localLabels]);

  const handleCreateLabel = async () => {
    const name = labelSearch.trim();
    if (!name || !workspaceSlug) return;
    setCreateLabelError(null);
    setCreateLabelLoading(true);
    try {
      const created = await labelService.create(workspaceSlug, issue.project_id, { name });
      setLocalLabels((prev) => [...prev, created]);
      const cur = issue.label_ids ?? [];
      if (!cur.includes(created.id)) {
        void onPatch(issue, { label_ids: [...cur, created.id] });
      }
      setLabelSearch('');
      setOpenDropdownId(null);
    } catch (err) {
      setCreateLabelError(err instanceof Error ? err.message : 'Failed to create label.');
    } finally {
      setCreateLabelLoading(false);
    }
  };

  const toggleLabel = (labelId: string) => {
    const cur = issue.label_ids ?? [];
    const next = cur.includes(labelId) ? cur.filter((x) => x !== labelId) : [...cur, labelId];
    void onPatch(issue, { label_ids: next });
  };

  const panelClass =
    'max-h-64 min-w-[180px] overflow-auto rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)';

  const showModules = Boolean(project?.module_view);
  const showCycles = Boolean(project?.cycle_view);

  const moduleLabel =
    moduleCount > 1
      ? `${moduleCount} Modules`
      : moduleCount === 1
        ? (modules.find((m) => m.id === currentModuleId)?.name ?? '1 Module')
        : 'No module';

  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      {/* State —  StateDropdown border-with-text + dashed */}
      <Dropdown
        id={`${issue.id}:state`}
        openId={openDropdownId}
        onOpen={setOpenDropdownId}
        label="State"
        icon={<span />}
        displayValue=""
        align="right"
        disabled={busy}
        triggerClassName="inline-flex h-7 max-w-[10rem] min-w-0 items-center gap-1 rounded border border-(--border-subtle) bg-(--bg-surface-1) px-2 text-[12px] font-medium text-(--txt-primary) hover:bg-(--bg-layer-1-hover) disabled:opacity-40"
        triggerContent={
          <>
            <span className="flex size-3.5 shrink-0 items-center justify-center text-(--txt-icon-tertiary) [&_svg]:size-3.5">
              {stateGroupIcon(currentState?.group)}
            </span>
            <span className="truncate">{stateName}</span>
            <IconChevronDown />
          </>
        }
        panelClassName={panelClass}
      >
        <div className="sticky top-0 z-10 border-b border-(--border-subtle) bg-(--bg-surface-1) p-1.5">
          <input
            type="text"
            placeholder="Search"
            value={stateSearch}
            onChange={(e) => setStateSearch(e.target.value)}
            className="w-full rounded border border-(--border-subtle) bg-(--bg-surface-1) px-2 py-1 text-xs text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:border-(--border-strong) focus:outline-none"
          />
        </div>
        {filteredStateOptions.length === 0 ? (
          <div className="px-3 py-2 text-[13px] text-(--txt-tertiary)">No states</div>
        ) : (
          <>
            {filteredStateOptions.map((opt) => {
              const currentGroup = (currentState?.group ?? 'backlog').toLowerCase();
              const isSelected =
                currentGroup === opt.group ||
                (!!opt.id && issue.state_id === opt.id) ||
                (!opt.id && !issue.state_id && opt.group === 'backlog');
              return (
                <button
                  key={opt.group}
                  type="button"
                  className={cx(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-(--txt-primary) hover:bg-(--bg-layer-1-hover)',
                    isSelected && 'bg-(--bg-layer-1)',
                  )}
                  onClick={() => {
                    void onPatch(issue, { state_id: opt.id });
                    setOpenDropdownId(null);
                  }}
                >
                  <span className="flex size-3.5 shrink-0 items-center justify-center text-(--txt-icon-tertiary) [&_svg]:size-3.5">
                    {stateGroupIcon(opt.group)}
                  </span>
                  <span className="flex-1 truncate">{opt.label}</span>
                  {isSelected ? <span className="text-(--txt-icon-secondary)">✓</span> : null}
                </button>
              );
            })}
          </>
        )}
      </Dropdown>

      {/* Priority — Plane PriorityDropdown border-without-text */}
      <Dropdown
        id={`${issue.id}:priority`}
        openId={openDropdownId}
        onOpen={setOpenDropdownId}
        label="Priority"
        icon={<span />}
        displayValue=""
        align="right"
        disabled={busy}
        triggerClassName={propBtnSquare}
        triggerAriaLabel="Priority"
        triggerTitle={`Priority ${PRIORITY_LABELS[pri]}`}
        triggerContent={
          <span className="flex size-4.5 items-center justify-center [&_svg]:size-3.5">
            {priorityIcon(pri)}
          </span>
        }
        panelClassName="w-56 overflow-hidden rounded-md border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-raised)"
      >
        <div className="border-b border-(--border-subtle) bg-(--bg-surface-1) p-2">
          <div className="flex items-center gap-2 rounded-md bg-(--bg-layer-1) px-2 py-1.5 text-(--txt-secondary)">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              placeholder="Search"
              value={prioritySearch}
              onChange={(e) => setPrioritySearch(e.target.value)}
              className="w-full bg-transparent text-[13px] text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
            />
          </div>
        </div>
        <div className="p-1">
          {filteredPriorities.map((p) => {
            const selected = pri === p;
            return (
              <button
                key={p}
                type="button"
                className={cx(
                  'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[13px] hover:bg-(--bg-layer-1-hover)',
                  selected && 'bg-(--bg-layer-1)',
                )}
                onClick={() => {
                  void onPatch(issue, { priority: p });
                  setOpenDropdownId(null);
                }}
              >
                <span
                  className={cx(
                    'flex size-6 items-center justify-center rounded-md border',
                    PRIORITY_TILE[p],
                  )}
                >
                  <span className="[&_svg]:size-3.5">{priorityIcon(p)}</span>
                </span>
                <span className="flex-1">{PRIORITY_LABELS[p]}</span>
                {selected ? <span className="text-(--txt-icon-secondary)">✓</span> : null}
              </button>
            );
          })}
        </div>
      </Dropdown>

      {/* Labels */}
      <Dropdown
        id={`${issue.id}:labels`}
        openId={openDropdownId}
        onOpen={setOpenDropdownId}
        label="Labels"
        icon={<IconTag />}
        displayValue=""
        align="right"
        disabled={busy}
        triggerClassName={propBtnSquare}
        triggerContent={
          <span
            className={labelNames.length ? '' : 'opacity-50'}
            title={`Labels ${labelNames[0] ?? 'None'}`}
          >
            <IconTag />
          </span>
        }
        panelClassName={panelClass}
      >
        <div className="sticky top-0 z-10 border-b border-(--border-subtle) bg-(--bg-surface-1) p-1.5">
          <input
            type="text"
            placeholder="Search"
            value={labelSearch}
            onChange={(e) => setLabelSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canCreateLabel && !createLabelLoading) {
                e.preventDefault();
                void handleCreateLabel();
              }
            }}
            className="w-full rounded border border-(--border-subtle) bg-(--bg-surface-1) px-2 py-1 text-xs text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:border-(--border-strong) focus:outline-none"
          />
        </div>
        {filteredLabels.length === 0 ? (
          <div className="px-3 py-2 text-[13px] text-(--txt-tertiary)">
            {canCreateLabel ? 'Press Enter to create label' : 'Type to add a new label'}
          </div>
        ) : (
          filteredLabels.map((l) => {
            const on = (issue.label_ids ?? []).includes(l.id);
            return (
              <button
                key={l.id}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-(--bg-layer-1-hover)"
                onClick={() => toggleLabel(l.id)}
              >
                <span className="w-4 text-(--txt-accent-primary)">{on ? '✓' : ''}</span>
                {l.name}
              </button>
            );
          })
        )}
        {canCreateLabel ? (
          <>
            <div className="my-1 border-t border-(--border-subtle)" />
            <button
              type="button"
              onClick={() => void handleCreateLabel()}
              disabled={createLabelLoading}
              className="w-full px-3 py-2 text-left text-[13px] text-(--brand-default) hover:bg-(--bg-layer-1-hover) disabled:opacity-50"
            >
              {createLabelLoading ? 'Creating…' : `Create label "${labelSearch.trim()}"`}
            </button>
            {createLabelError ? (
              <div className="px-3 pb-2 text-[12px] text-(--txt-danger-primary)">
                {createLabelError}
              </div>
            ) : null}
          </>
        ) : null}
      </Dropdown>

      {/* Start date — icon-only + hidden date input (Plane DateDropdown border-without-text) */}
      <div
        className={`${propBtnSquare}${busy ? ' pointer-events-none opacity-40' : ''}`}
        title={`Start date ${issue.start_date ? issue.start_date.slice(0, 10) : 'None'}`}
      >
        <IconStartDateProperty />
        <input
          ref={startInputRef}
          type="date"
          disabled={busy}
          className="absolute inset-0 cursor-pointer opacity-0"
          value={issue.start_date?.slice(0, 10) ?? ''}
          aria-label="Start date"
          onChange={(e) => {
            const v = e.target.value;
            void onPatch(issue, { start_date: v || null });
          }}
        />
      </div>

      {/* Due date */}
      <div
        className={`${propBtnSquare}${busy ? ' pointer-events-none opacity-40' : ''}`}
        title={`Due date ${issue.target_date ? issue.target_date.slice(0, 10) : 'None'}`}
      >
        <IconDueDateProperty />
        <input
          ref={dueInputRef}
          type="date"
          disabled={busy}
          className="absolute inset-0 cursor-pointer opacity-0"
          value={issue.target_date?.slice(0, 10) ?? ''}
          aria-label="Due date"
          onChange={(e) => {
            const v = e.target.value;
            void onPatch(issue, { target_date: v || null });
          }}
        />
      </div>

      {/* Assignee — icon / avatar + chevron in bordered control */}
      <Dropdown
        id={`${issue.id}:assignee`}
        openId={openDropdownId}
        onOpen={setOpenDropdownId}
        label="Assignee"
        icon={<IconUser />}
        displayValue=""
        align="right"
        disabled={busy}
        triggerClassName="inline-flex h-7 items-center gap-0.5 rounded border border-(--border-subtle) bg-(--bg-surface-1) pl-1 pr-1 hover:bg-(--bg-layer-1-hover) disabled:opacity-40"
        triggerContent={
          <>
            <span className="flex size-6 items-center justify-center">
              {primaryAssigneeId ? (
                <Avatar
                  name={assigneeName || '?'}
                  src={getImageUrl(assigneeAvatar || null) ?? undefined}
                  size="sm"
                  className="h-5 w-5 text-[9px]"
                />
              ) : (
                <span className="text-(--txt-icon-tertiary)">
                  <IconUser />
                </span>
              )}
            </span>
            <IconChevronDown />
          </>
        }
        panelClassName={panelClass}
      >
        <button
          type="button"
          className="block w-full px-3 py-2 text-left text-[13px] text-(--txt-tertiary) hover:bg-(--bg-layer-1-hover)"
          onClick={() => {
            void onPatch(issue, { assignee_ids: [] });
            setOpenDropdownId(null);
          }}
        >
          Unassigned
        </button>
        {members.map((m) => {
          const uid = m.member_id ?? m.id;
          const nm =
            m.member_display_name?.trim() || m.member_email?.split('@')[0] || uid.slice(0, 8);
          return (
            <button
              key={m.id}
              type="button"
              className="block w-full px-3 py-2 text-left text-[13px] text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
              onClick={() => {
                void onPatch(issue, { assignee_ids: [uid] });
                setOpenDropdownId(null);
              }}
            >
              {nm}
            </button>
          );
        })}
      </Dropdown>

      {/* Modules — Plane ModuleDropdown icon */}
      {showModules ? (
        <Dropdown
          id={`${issue.id}:module`}
          openId={openDropdownId}
          onOpen={setOpenDropdownId}
          label="Modules"
          icon={<IconLayoutGrid />}
          displayValue=""
          align="right"
          disabled={busy}
          triggerClassName="inline-flex h-7 max-w-[10rem] min-w-0 items-center gap-1 rounded border border-(--border-subtle) bg-(--bg-surface-1) px-2 text-[12px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-1-hover) disabled:opacity-40"
          triggerContent={
            <>
              <span className="shrink-0 text-(--txt-icon-tertiary)">
                <IconLayoutGrid />
              </span>
              <span className="min-w-0 flex-1 truncate">{moduleLabel}</span>
              <IconChevronDown />
            </>
          }
          panelClassName={panelClass}
        >
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-[13px] text-(--txt-tertiary) hover:bg-(--bg-layer-1-hover)"
            onClick={() => {
              void onModuleChange(issue, null);
              setOpenDropdownId(null);
            }}
          >
            No module
          </button>
          {modules.map((mod) => (
            <button
              key={mod.id}
              type="button"
              className="block w-full px-3 py-2 text-left text-[13px] text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
              onClick={() => {
                void onModuleChange(issue, mod.id);
                setOpenDropdownId(null);
              }}
            >
              {mod.name}
            </button>
          ))}
        </Dropdown>
      ) : null}

      {/* Cycles — Plane CycleDropdown border-with-text */}
      {showCycles ? (
        <Dropdown
          id={`${issue.id}:cycle`}
          openId={openDropdownId}
          onOpen={setOpenDropdownId}
          label="Cycle"
          icon={<IconCycle />}
          displayValue=""
          align="right"
          disabled={busy}
          triggerClassName="inline-flex h-7 max-w-[10rem] min-w-0 items-center gap-1 rounded border border-(--border-subtle) bg-(--bg-surface-1) px-2 text-[12px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-1-hover) disabled:opacity-40"
          triggerContent={
            <>
              <span className="shrink-0 text-(--txt-icon-tertiary)">
                <IconCycle />
              </span>
              <span className="min-w-0 flex-1 truncate">{cycleName || 'No cycle'}</span>
              <IconChevronDown />
            </>
          }
          panelClassName={panelClass}
        >
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-[13px] text-(--txt-tertiary) hover:bg-(--bg-layer-1-hover)"
            onClick={() => {
              void onCycleChange(issue, null);
              setOpenDropdownId(null);
            }}
          >
            No cycle
          </button>
          {cycles.map((cy) => (
            <button
              key={cy.id}
              type="button"
              className="block w-full px-3 py-2 text-left text-[13px] text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
              onClick={() => {
                void onCycleChange(issue, cy.id);
                setOpenDropdownId(null);
              }}
            >
              {cy.name}
            </button>
          ))}
        </Dropdown>
      ) : null}

      {/* Quick actions — ⋯ menu (Plane: Edit, Make a copy, Move to issues, Delete) */}
      <div className="relative shrink-0" data-draft-actions>
        <button
          type="button"
          className="flex size-7 items-center justify-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary) disabled:opacity-40"
          aria-expanded={rowMenuOpen}
          aria-label="More options"
          disabled={busy}
          onClick={() => onToggleRowMenu()}
        >
          <IconMoreHorizontal />
        </button>
        {rowMenuOpen ? (
          <div
            className="absolute right-0 z-20 mt-1 min-w-44 rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)"
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
              onClick={() => onEdit()}
            >
              <IconEdit />
              Edit
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
              onClick={() => onDuplicate()}
            >
              <IconCopy />
              Make a copy
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
              onClick={() => onMoveToIssues()}
            >
              <IconMoveToIssues />
              Move to issues
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-(--txt-danger-primary) hover:bg-(--bg-layer-1-hover)"
              onClick={() => onDelete()}
            >
              <IconTrash />
              Delete
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
