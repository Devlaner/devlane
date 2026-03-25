import { type Dispatch, type SetStateAction, useState } from 'react';
import { CollapsibleSection } from '../workspace-views/WorkspaceViewsFiltersShared';
import { Avatar } from '../ui';
import { getImageUrl } from '../../lib/utils';
import type { StateApiResponse, WorkspaceMemberApiResponse } from '../../api/types';
import {
  type ModuleDueDatePreset,
  type ModuleWorkItemsDisplayState,
  type ModuleWorkItemsFiltersState,
} from '../../lib/moduleWorkItemsPrefs';

const PRIORITIES = ['urgent', 'high', 'medium', 'low', 'none'] as const;

const DUE_PRESETS: { id: ModuleDueDatePreset; label: string }[] = [
  { id: 'none', label: 'Any due date' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'this_week', label: 'Due this week' },
  { id: 'no_due', label: 'No due date' },
  { id: 'custom', label: 'Custom range…' },
];

export interface ModuleWorkItemsFiltersPanelProps {
  filters: ModuleWorkItemsFiltersState;
  setFilters: Dispatch<SetStateAction<ModuleWorkItemsFiltersState>>;
  states: StateApiResponse[];
  members: WorkspaceMemberApiResponse[];
  onRequestDueCustom: () => void;
  onRequestStartCustom: () => void;
}

export function ModuleWorkItemsFiltersPanel({
  filters,
  setFilters,
  states,
  members,
  onRequestDueCustom,
  onRequestStartCustom,
}: ModuleWorkItemsFiltersPanelProps) {
  const [open, setOpen] = useState({
    priority: true,
    state: true,
    assignee: true,
    due: true,
    start: false,
  });

  const toggle = (key: keyof typeof open) => setOpen((o) => ({ ...o, [key]: !o[key] }));

  const togglePriority = (p: string) => {
    setFilters((prev) => {
      const next = new Set(prev.priorityKeys);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return { ...prev, priorityKeys: [...next] };
    });
  };

  const toggleState = (stateId: string) => {
    setFilters((prev) => {
      const next = new Set(prev.stateIds);
      if (next.has(stateId)) next.delete(stateId);
      else next.add(stateId);
      return { ...prev, stateIds: [...next] };
    });
  };

  const toggleAssignee = (memberId: string) => {
    setFilters((prev) => {
      const next = new Set(prev.assigneeMemberIds);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return { ...prev, assigneeMemberIds: [...next] };
    });
  };

  return (
    <div className="w-80 max-h-[min(70vh,28rem)] overflow-y-auto py-1">
      <CollapsibleSection title="Priority" open={open.priority} onToggle={() => toggle('priority')}>
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
          {PRIORITIES.map((p) => {
            const on = filters.priorityKeys.includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => togglePriority(p)}
                className={`rounded-md border px-2 py-1 text-[12px] font-medium capitalize transition-colors ${
                  on
                    ? 'border-(--brand-default) bg-(--brand-default) text-white'
                    : 'border-(--border-subtle) bg-(--bg-layer-1) text-(--txt-secondary) hover:bg-(--bg-layer-1-hover)'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="State" open={open.state} onToggle={() => toggle('state')}>
        <div className="max-h-40 space-y-0.5 overflow-y-auto px-2 pb-2">
          <button
            type="button"
            onClick={() => toggleState('__none__')}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] ${
              filters.stateIds.includes('__none__')
                ? 'bg-(--bg-accent-subtle) font-medium text-(--txt-accent-primary)'
                : 'text-(--txt-secondary) hover:bg-(--bg-layer-1-hover)'
            }`}
          >
            No state
          </button>
          {states.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => toggleState(s.id)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] ${
                filters.stateIds.includes(s.id)
                  ? 'bg-(--bg-accent-subtle) font-medium text-(--txt-accent-primary)'
                  : 'text-(--txt-secondary) hover:bg-(--bg-layer-1-hover)'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </CollapsibleSection>
      <CollapsibleSection
        title="Assignees"
        open={open.assignee}
        onToggle={() => toggle('assignee')}
      >
        <div className="max-h-44 space-y-0.5 overflow-y-auto px-2 pb-2">
          {members.map((m) => {
            const id = m.member_id;
            const label =
              m.member_display_name?.trim() || m.member_email?.split('@')[0]?.trim() || 'Member';
            const on = filters.assigneeMemberIds.includes(id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleAssignee(id)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] ${
                  on
                    ? 'bg-(--bg-accent-subtle) font-medium text-(--txt-accent-primary)'
                    : 'text-(--txt-secondary) hover:bg-(--bg-layer-1-hover)'
                }`}
              >
                <Avatar
                  name={label}
                  src={getImageUrl(m.member_avatar) ?? undefined}
                  size="sm"
                  className="size-6 text-[10px]"
                />
                <span className="min-w-0 truncate">{label}</span>
              </button>
            );
          })}
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="Due date" open={open.due} onToggle={() => toggle('due')}>
        <div className="flex flex-col gap-0.5 px-2 pb-2">
          {DUE_PRESETS.map((pr) => (
            <button
              key={pr.id}
              type="button"
              onClick={() => {
                if (pr.id === 'custom') {
                  setFilters((p) => ({ ...p, duePreset: 'custom' }));
                  onRequestDueCustom();
                } else {
                  setFilters((p) => ({
                    ...p,
                    duePreset: pr.id,
                    dueAfter: null,
                    dueBefore: null,
                  }));
                }
              }}
              className={`rounded-md px-2 py-1.5 text-left text-[13px] ${
                filters.duePreset === pr.id
                  ? 'bg-(--bg-accent-subtle) font-medium text-(--txt-accent-primary)'
                  : 'text-(--txt-secondary) hover:bg-(--bg-layer-1-hover)'
              }`}
            >
              {pr.label}
              {pr.id === 'custom' &&
                filters.duePreset === 'custom' &&
                (filters.dueAfter || filters.dueBefore) && (
                  <span className="mt-0.5 block text-[11px] font-normal text-(--txt-tertiary)">
                    {[filters.dueAfter, filters.dueBefore].filter(Boolean).join(' → ')}
                  </span>
                )}
            </button>
          ))}
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="Start date" open={open.start} onToggle={() => toggle('start')}>
        <div className="px-2 pb-2">
          <button
            type="button"
            onClick={() => onRequestStartCustom()}
            className="w-full rounded-md border border-(--border-subtle) bg-(--bg-layer-1) px-2 py-1.5 text-left text-[13px] text-(--txt-secondary) hover:bg-(--bg-layer-1-hover)"
          >
            Custom range…
          </button>
          {(filters.startAfter || filters.startBefore) && (
            <p className="mt-1 text-[11px] text-(--txt-tertiary)">
              {[filters.startAfter, filters.startBefore].filter(Boolean).join(' → ')}
            </p>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}

export interface ModuleWorkItemsDisplayPanelProps {
  display: ModuleWorkItemsDisplayState;
  setDisplay: Dispatch<SetStateAction<ModuleWorkItemsDisplayState>>;
}

export function ModuleWorkItemsDisplayPanel({
  display,
  setDisplay,
}: ModuleWorkItemsDisplayPanelProps) {
  const [open, setOpen] = useState({ layout: true, props: true });
  const toggle = (key: keyof typeof open) => setOpen((o) => ({ ...o, [key]: !o[key] }));

  const rowToggle = (key: keyof ModuleWorkItemsDisplayState) => {
    setDisplay((p) => ({ ...p, [key]: !p[key] }));
  };

  return (
    <div className="w-72 max-h-[min(70vh,28rem)] overflow-y-auto py-1">
      <CollapsibleSection title="Layout" open={open.layout} onToggle={() => toggle('layout')}>
        <div className="space-y-0.5 px-2 pb-2">
          {(
            [
              [false, 'All work items'],
              [true, 'Group by state'],
            ] as const
          ).map(([val, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => setDisplay((p) => ({ ...p, groupByState: val }))}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] ${
                display.groupByState === val
                  ? 'bg-(--bg-accent-subtle) font-medium text-(--txt-accent-primary)'
                  : 'text-(--txt-secondary) hover:bg-(--bg-layer-1-hover)'
              }`}
            >
              <span
                className={`flex size-3.5 shrink-0 items-center justify-center rounded-full border-2 ${
                  display.groupByState === val
                    ? 'border-(--brand-default) bg-(--brand-default)'
                    : 'border-(--border-strong)'
                }`}
              >
                {display.groupByState === val ? (
                  <span className="size-1.5 rounded-full bg-white" />
                ) : null}
              </span>
              {label}
            </button>
          ))}
          <label className="mt-2 flex cursor-pointer items-center gap-2 px-2 py-1.5 text-[13px] text-(--txt-primary) hover:bg-(--bg-layer-1-hover)">
            <input
              type="checkbox"
              className="size-3.5 rounded border-(--border-strong)"
              checked={display.showSubWorkItems}
              onChange={(e) =>
                setDisplay((p) => ({
                  ...p,
                  showSubWorkItems: e.target.checked,
                }))
              }
            />
            Show sub-work items
          </label>
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="Properties" open={open.props} onToggle={() => toggle('props')}>
        <div className="px-2 pb-2">
          {(
            [
              ['showState', 'State'],
              ['showPriority', 'Priority'],
              ['showStartDate', 'Start date'],
              ['showDueDate', 'Due date'],
              ['showAssignee', 'Assignees'],
              ['showModule', 'Module'],
              ['showLabels', 'Labels'],
              ['showVisibility', 'Visibility'],
            ] as const
          ).map(([k, label]) => (
            <label
              key={k}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
            >
              <input
                type="checkbox"
                className="size-3.5 rounded border-(--border-strong)"
                checked={Boolean(display[k])}
                onChange={() => rowToggle(k)}
              />
              {label}
            </label>
          ))}
        </div>
      </CollapsibleSection>
    </div>
  );
}
