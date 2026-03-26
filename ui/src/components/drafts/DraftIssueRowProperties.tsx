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
import {
  PRIORITY_ICONS,
  PRIORITY_LABELS,
  STATE_GROUP_ICONS,
} from '../workspace-views/WorkspaceViewsFiltersData';
import { findWorkspaceMemberByUserId, getImageUrl } from '../../lib/utils';

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

/** Plane-style start date: calendar + clock accent (simplified). */
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

const IconCircleSlash = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <circle cx="12" cy="12" r="10" />
    <path d="m4.9 4.9 14.2 14.2" />
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

const IconMoreHorizontal = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <circle cx="5" cy="12" r="1.75" />
    <circle cx="12" cy="12" r="1.75" />
    <circle cx="19" cy="12" r="1.75" />
  </svg>
);

function stateGroupIcon(group: string | undefined) {
  const g = (group ?? 'backlog').toLowerCase() as StateGroup;
  return STATE_GROUP_ICONS[g] ?? STATE_GROUP_ICONS.backlog;
}

const propBtnSquare =
  'relative flex size-7 shrink-0 items-center justify-center rounded border border-(--border-subtle) bg-(--bg-surface-1) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) disabled:pointer-events-none disabled:opacity-40';

export interface DraftIssueRowPropertiesProps {
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
  onPublish: () => void;
  onDelete: () => void;
}

export function DraftIssueRowProperties({
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
  onPublish,
  onDelete,
}: DraftIssueRowPropertiesProps) {
  const startInputRef = useRef<HTMLInputElement>(null);
  const dueInputRef = useRef<HTMLInputElement>(null);
  const [stateSearch, setStateSearch] = useState('');
  const [prioritySearch, setPrioritySearch] = useState('');
  const [labelSearch, setLabelSearch] = useState('');

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
    .map((id) => labels.find((l) => l.id === id)?.name)
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
      { group: 'todo', label: 'Todo' },
      { group: 'in_progress', label: 'In Progress' },
      { group: 'done', label: 'Done' },
      { group: 'cancelled', label: 'Cancelled' },
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
    if (!q) return labels;
    return labels.filter((l) => l.name.toLowerCase().includes(q));
  }, [labels, labelSearch]);

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

      {/* Blocked — visual parity (no API yet) */}
      <button
        type="button"
        className={propBtnSquare}
        title="Blocked"
        disabled={busy}
        aria-label="Blocked"
      >
        <IconCircleSlash />
      </button>

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
            className="w-full rounded border border-(--border-subtle) bg-(--bg-surface-1) px-2 py-1 text-xs text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:border-(--border-strong) focus:outline-none"
          />
        </div>
        {filteredLabels.length === 0 ? (
          <div className="px-3 py-2 text-[13px] text-(--txt-tertiary)">Type to add a new label</div>
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
        triggerContent={
          <span
            className="flex size-4.5 items-center justify-center [&_svg]:size-3.5"
            title={`Priority ${PRIORITY_LABELS[pri]}`}
          >
            {PRIORITY_ICONS[pri] ?? PRIORITY_ICONS.none}
          </span>
        }
        panelClassName={panelClass}
      >
        <div className="sticky top-0 z-10 border-b border-(--border-subtle) bg-(--bg-surface-1) p-1.5">
          <input
            type="text"
            placeholder="Search"
            value={prioritySearch}
            onChange={(e) => setPrioritySearch(e.target.value)}
            className="w-full rounded border border-(--border-subtle) bg-(--bg-surface-1) px-2 py-1 text-xs text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:border-(--border-strong) focus:outline-none"
          />
        </div>
        {filteredPriorities.map((p) => (
          <button
            key={p}
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-(--bg-layer-1-hover)"
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
              <span className="[&_svg]:size-3.5">{PRIORITY_ICONS[p]}</span>
            </span>
            <span className="flex-1">{PRIORITY_LABELS[p]}</span>
            {pri === p ? <span className="text-(--txt-icon-secondary)">✓</span> : null}
          </button>
        ))}
      </Dropdown>

      {/* Visibility — no border (Plane-style) */}
      <button
        type="button"
        className="flex size-7 shrink-0 items-center justify-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
        title="Visibility"
        aria-label="Visibility"
      >
        <IconEye />
      </button>

      {/* More — no border; menu aligned like Plane quick actions */}
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
            className="absolute right-0 z-20 mt-1 min-w-36 rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)"
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-[13px] text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
              onClick={() => onPublish()}
            >
              Publish
            </button>
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-[13px] text-(--txt-danger-primary) hover:bg-(--bg-layer-1-hover)"
              onClick={() => onDelete()}
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
