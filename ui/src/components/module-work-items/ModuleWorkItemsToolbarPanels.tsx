import { type Dispatch, type SetStateAction, useState } from 'react';
import {
  CollapsibleSection,
  FiltersPanelOptionRow,
} from '../workspace-views/WorkspaceViewsFiltersShared';
import { Avatar } from '../ui';
import { getImageUrl } from '../../lib/utils';
import type { StateApiResponse, WorkspaceMemberApiResponse } from '../../api/types';
import {
  type ModuleDueDatePreset,
  type ModuleWorkItemsFiltersState,
} from '../../lib/moduleWorkItemsPrefs';
import {
  DATE_PRESET_LABELS,
  FILTER_ICONS,
  PRIORITY_ICONS,
  PRIORITY_LABELS,
  STATE_GROUP_ICONS,
} from '../workspace-views/WorkspaceViewsFiltersData';
import {
  DATE_PRESETS,
  type DatePreset,
  type Priority,
  PRIORITIES,
  type StateGroup,
} from '../../types/workspaceViewFilters';

const DUE_PRESETS: { id: ModuleDueDatePreset; label: string }[] = [
  { id: 'overdue', label: 'Overdue' },
  { id: 'this_week', label: 'Due this week' },
  { id: 'no_due', label: 'No due date' },
  { id: 'custom', label: 'Custom' },
];

const PLANE_SECTION_TITLE = 'text-[13px] font-medium text-(--txt-tertiary)';

const API_GROUP_TO_PLANE: Record<string, StateGroup> = {
  backlog: 'backlog',
  unstarted: 'unstarted',
  started: 'started',
  completed: 'completed',
  canceled: 'canceled',
  cancelled: 'canceled',
};

function stateRowIcon(s: StateApiResponse) {
  const g = s.group?.toLowerCase();
  const sg = g ? API_GROUP_TO_PLANE[g] : undefined;
  if (sg) return STATE_GROUP_ICONS[sg];
  return STATE_GROUP_ICONS.unstarted;
}

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
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState({
    priority: true,
    state: true,
    assignee: true,
    due: true,
    start: true,
  });

  const toggle = (key: keyof typeof open) => setOpen((o) => ({ ...o, [key]: !o[key] }));

  const q = (s: string) => s.trim().toLowerCase();
  const filterSearch = (label: string) =>
    !search.trim() || label.toLowerCase().includes(search.trim().toLowerCase());

  const filteredMembers = members.filter((m) =>
    q(m.member_display_name ?? m.member_email ?? m.member_id).includes(q(search)),
  );

  const filteredStates = states.filter((s) => filterSearch(s.name));

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

  const hasCustomStart = filters.startDatePresets.includes('custom');
  const toggleStartPreset = (d: Exclude<DatePreset, 'custom'>) => {
    setFilters((prev) => {
      const hadCustom = prev.startDatePresets.includes('custom');
      const rest = prev.startDatePresets.filter((x) => x !== 'custom');
      const nextRest = rest.includes(d) ? rest.filter((x) => x !== d) : [...rest, d];
      return { ...prev, startDatePresets: hadCustom ? [...nextRest, 'custom'] : nextRest };
    });
  };

  return (
    <>
      <div className="sticky top-0 z-1 shrink-0 border-b border-(--border-subtle) bg-(--bg-surface-1) p-2.5">
        <div className="flex items-center gap-2 rounded-md border border-(--border-subtle) bg-(--bg-layer-1) px-2 py-1.5">
          <span className="shrink-0 text-(--txt-icon-tertiary)">
            <FILTER_ICONS.search />
          </span>
          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        <CollapsibleSection
          title="Priority"
          open={open.priority}
          onToggle={() => toggle('priority')}
          titleClassName={PLANE_SECTION_TITLE}
        >
          {PRIORITIES.filter((p) => filterSearch(PRIORITY_LABELS[p])).map((p) => (
            <FiltersPanelOptionRow
              key={p}
              checked={filters.priorityKeys.includes(p)}
              onToggle={() => togglePriority(p)}
              icon={PRIORITY_ICONS[p as Priority]}
              label={PRIORITY_LABELS[p as Priority]}
            />
          ))}
        </CollapsibleSection>

        <CollapsibleSection
          title="State"
          open={open.state}
          onToggle={() => toggle('state')}
          titleClassName={PLANE_SECTION_TITLE}
        >
          {filterSearch('No state') ? (
            <FiltersPanelOptionRow
              checked={filters.stateIds.includes('__none__')}
              onToggle={() => toggleState('__none__')}
              icon={STATE_GROUP_ICONS.backlog}
              label="No state"
            />
          ) : null}
          <div className="max-h-48 overflow-y-auto">
            {filteredStates.map((s) => (
              <FiltersPanelOptionRow
                key={s.id}
                checked={filters.stateIds.includes(s.id)}
                onToggle={() => toggleState(s.id)}
                icon={stateRowIcon(s)}
                label={s.name}
              />
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Assignee"
          open={open.assignee}
          onToggle={() => toggle('assignee')}
          titleClassName={PLANE_SECTION_TITLE}
        >
          <div className="max-h-52 overflow-y-auto">
            {filteredMembers.map((m) => {
              const id = m.member_id;
              const label =
                m.member_display_name?.trim() || m.member_email?.split('@')[0]?.trim() || 'Member';
              return (
                <FiltersPanelOptionRow
                  key={m.id}
                  checked={filters.assigneeMemberIds.includes(id)}
                  onToggle={() => toggleAssignee(id)}
                  icon={
                    <Avatar
                      name={label}
                      src={getImageUrl(m.member_avatar) ?? undefined}
                      size="sm"
                      className="h-5 w-5 shrink-0 text-[10px]"
                    />
                  }
                  label={label}
                />
              );
            })}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Due date"
          open={open.due}
          onToggle={() => toggle('due')}
          titleClassName={PLANE_SECTION_TITLE}
        >
          {DUE_PRESETS.filter((pr) => filterSearch(pr.label)).map((pr) => (
            <FiltersPanelOptionRow
              key={pr.id}
              checked={filters.duePresets.includes(pr.id)}
              onToggle={() => {
                if (pr.id === 'custom') {
                  let openPicker = false;
                  setFilters((p) => {
                    if (p.duePresets.includes('custom')) {
                      return {
                        ...p,
                        duePresets: p.duePresets.filter((x) => x !== 'custom'),
                        dueAfter: null,
                        dueBefore: null,
                      };
                    }
                    openPicker = true;
                    return { ...p, duePresets: [...p.duePresets, 'custom'] };
                  });
                  if (openPicker) queueMicrotask(() => onRequestDueCustom());
                } else {
                  setFilters((p) => {
                    const has = p.duePresets.includes(pr.id);
                    const next = has
                      ? p.duePresets.filter((x) => x !== pr.id)
                      : [...p.duePresets, pr.id];
                    return { ...p, duePresets: next };
                  });
                }
              }}
              label={
                pr.id === 'custom' &&
                filters.duePresets.includes('custom') &&
                (filters.dueAfter || filters.dueBefore) ? (
                  <span className="flex flex-col gap-0.5">
                    <span>{pr.label}</span>
                    <span className="text-[11px] font-normal text-(--txt-tertiary)">
                      {[filters.dueAfter, filters.dueBefore].filter(Boolean).join(' → ')}
                    </span>
                  </span>
                ) : (
                  pr.label
                )
              }
            />
          ))}
        </CollapsibleSection>

        <CollapsibleSection
          title="Start date"
          open={open.start}
          onToggle={() => toggle('start')}
          titleClassName={PLANE_SECTION_TITLE}
        >
          {DATE_PRESETS.filter((d) => filterSearch(DATE_PRESET_LABELS[d])).map((d) =>
            d === 'custom' ? (
              <FiltersPanelOptionRow
                key={d}
                checked={hasCustomStart}
                onToggle={() => {
                  if (hasCustomStart) {
                    setFilters((prev) => ({
                      ...prev,
                      startDatePresets: prev.startDatePresets.filter((x) => x !== 'custom'),
                      startAfter: null,
                      startBefore: null,
                    }));
                  } else {
                    let openPicker = false;
                    setFilters((prev) => {
                      if (prev.startDatePresets.includes('custom')) {
                        return prev;
                      }
                      openPicker = true;
                      return { ...prev, startDatePresets: [...prev.startDatePresets, 'custom'] };
                    });
                    if (openPicker) queueMicrotask(() => onRequestStartCustom());
                  }
                }}
                label={DATE_PRESET_LABELS[d]}
              />
            ) : (
              <FiltersPanelOptionRow
                key={d}
                checked={filters.startDatePresets.includes(d)}
                onToggle={() => toggleStartPreset(d)}
                label={DATE_PRESET_LABELS[d]}
              />
            ),
          )}
        </CollapsibleSection>
      </div>
    </>
  );
}
