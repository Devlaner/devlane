import { type Dispatch, type SetStateAction, useState } from 'react';
import {
  CollapsibleSection,
  FiltersPanelOptionRow,
} from '../workspace-views/WorkspaceViewsFiltersShared';
import { Avatar } from '../ui';
import { getImageUrl, normalizeUuidKey } from '../../lib/utils';
import type {
  CycleApiResponse,
  LabelApiResponse,
  StateApiResponse,
  WorkspaceMemberApiResponse,
} from '../../api/types';
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
  STATE_GROUP_LABELS,
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

function stateGroupForState(s: StateApiResponse) {
  const g = s.group?.toLowerCase();
  const sg = g ? API_GROUP_TO_PLANE[g] : undefined;
  return sg ?? 'unstarted';
}

export interface ModuleWorkItemsFiltersPanelProps {
  filters: ModuleWorkItemsFiltersState;
  setFilters: Dispatch<SetStateAction<ModuleWorkItemsFiltersState>>;
  states: StateApiResponse[];
  cycles: CycleApiResponse[];
  labels: LabelApiResponse[];
  members: WorkspaceMemberApiResponse[];
  currentUserId: string | null | undefined;
  currentUserName: string;
  currentUserAvatarUrl: string | null | undefined;
  onRequestDueCustom: () => void;
  onRequestStartCustom: () => void;
}

export function ModuleWorkItemsFiltersPanel({
  filters,
  setFilters,
  states,
  cycles,
  labels,
  members,
  currentUserId,
  currentUserName,
  currentUserAvatarUrl,
  onRequestDueCustom,
  onRequestStartCustom,
}: ModuleWorkItemsFiltersPanelProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState({
    priority: true,
    state: true,
    assignee: true,
    cycle: true,
    mention: true,
    created_by: true,
    label: true,
    work_item_grouping: true,
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

  const emptyFilterHint = (
    <div className="px-3 py-1.5 text-sm italic text-(--txt-tertiary)">No matches found</div>
  );

  const filteredCycles = cycles.filter((c) => filterSearch(c.name));
  const filteredLabels = labels.filter((l) => filterSearch(l.name));

  const groupOrder: StateGroup[] = ['backlog', 'unstarted', 'started', 'completed', 'canceled'];
  const stateIdsByGroup = groupOrder.reduce(
    (acc, g) => {
      acc[g] = [];
      return acc;
    },
    {} as Record<StateGroup, string[]>,
  );
  for (const s of states) {
    const sg = stateGroupForState(s);
    stateIdsByGroup[sg].push(s.id);
  }

  const togglePriority = (p: string) => {
    setFilters((prev) => {
      const next = new Set(prev.priorityKeys);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return { ...prev, priorityKeys: [...next] };
    });
  };

  const toggleStateGroup = (g: StateGroup) => {
    const ids = stateIdsByGroup[g];
    setFilters((prev) => {
      const next = new Set(prev.stateIds);
      const allSelected = ids.length > 0 && ids.every((id) => next.has(id));
      for (const id of ids) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return { ...prev, stateIds: [...next] };
    });
  };

  const toggleAssignee = (memberId: string) => {
    setFilters((prev) => {
      const key = normalizeUuidKey(memberId);
      const has = prev.assigneeMemberIds.some((id) => normalizeUuidKey(id) === key);
      return {
        ...prev,
        assigneeMemberIds: has
          ? prev.assigneeMemberIds.filter((id) => normalizeUuidKey(id) !== key)
          : [...prev.assigneeMemberIds, memberId],
      };
    });
  };

  const toggleIdInArray = (
    arrKey: 'cycleIds' | 'mentionedUserIds' | 'createdByIds' | 'labelIds',
  ) => {
    return (id: string) => {
      setFilters((prev) => {
        const key = normalizeUuidKey(id);
        const current = prev[arrKey];
        const has = current.some((x) => normalizeUuidKey(x) === key);
        const next = has ? current.filter((x) => normalizeUuidKey(x) !== key) : [...current, id];
        return { ...prev, [arrKey]: next } as ModuleWorkItemsFiltersState;
      });
    };
  };

  const toggleCycle = toggleIdInArray('cycleIds');
  const toggleMentionUser = toggleIdInArray('mentionedUserIds');
  const toggleCreatedBy = toggleIdInArray('createdByIds');
  const toggleLabel = toggleIdInArray('labelIds');

  const memberDisplayName = (m: WorkspaceMemberApiResponse) =>
    m.member_display_name?.trim() ||
    m.member_email?.split('@')[0]?.trim() ||
    (m.member_id ? m.member_id.slice(0, 12) : 'Member');

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
          {(() => {
            const matchingGroups = groupOrder.filter((g) => filterSearch(STATE_GROUP_LABELS[g]));
            if (matchingGroups.length === 0) return emptyFilterHint;

            return (
              <div className="max-h-48 overflow-y-auto">
                {matchingGroups.map((g) => {
                  const ids = stateIdsByGroup[g] ?? [];
                  const checked =
                    ids.length > 0 && ids.every((id) => filters.stateIds.includes(id));
                  return (
                    <FiltersPanelOptionRow
                      key={g}
                      checked={checked}
                      onToggle={() => toggleStateGroup(g)}
                      icon={STATE_GROUP_ICONS[g]}
                      label={STATE_GROUP_LABELS[g]}
                    />
                  );
                })}
              </div>
            );
          })()}
        </CollapsibleSection>

        <CollapsibleSection
          title="Assignee"
          open={open.assignee}
          onToggle={() => toggle('assignee')}
          titleClassName={PLANE_SECTION_TITLE}
        >
          {(() => {
            const youMatches =
              Boolean(currentUserId) && (filterSearch('You') || filterSearch(currentUserName));
            const excludingYou = currentUserId
              ? filteredMembers.filter(
                  (m) => normalizeUuidKey(m.member_id) !== normalizeUuidKey(currentUserId),
                )
              : filteredMembers;

            if (!youMatches && excludingYou.length === 0) return emptyFilterHint;

            return (
              <div className="max-h-52 overflow-y-auto">
                {youMatches && currentUserId ? (
                  <FiltersPanelOptionRow
                    checked={filters.assigneeMemberIds.some(
                      (id) => normalizeUuidKey(id) === normalizeUuidKey(currentUserId),
                    )}
                    onToggle={() => toggleAssignee(currentUserId)}
                    icon={
                      currentUserAvatarUrl ? (
                        <Avatar
                          name={currentUserName}
                          src={getImageUrl(currentUserAvatarUrl) ?? undefined}
                          size="sm"
                          className="h-5 w-5 shrink-0 text-[10px]"
                        />
                      ) : (
                        <span className="flex size-5 items-center justify-center rounded-full bg-(--brand-200) text-[10px] font-medium text-(--brand-default)">
                          {currentUserName.charAt(0).toUpperCase()}
                        </span>
                      )
                    }
                    label="You"
                  />
                ) : null}
                {excludingYou.map((m) => {
                  const id = m.member_id;
                  const label = memberDisplayName(m);
                  return (
                    <FiltersPanelOptionRow
                      key={m.id}
                      checked={filters.assigneeMemberIds.some(
                        (aid) => normalizeUuidKey(aid) === normalizeUuidKey(id),
                      )}
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
            );
          })()}
        </CollapsibleSection>

        <CollapsibleSection
          title="Cycle"
          open={open.cycle}
          onToggle={() => toggle('cycle')}
          titleClassName={PLANE_SECTION_TITLE}
        >
          {filteredCycles.length === 0 ? (
            emptyFilterHint
          ) : (
            <div className="max-h-52 overflow-y-auto">
              {filteredCycles.map((c) => (
                <FiltersPanelOptionRow
                  key={c.id}
                  checked={filters.cycleIds.some(
                    (id) => normalizeUuidKey(id) === normalizeUuidKey(c.id),
                  )}
                  onToggle={() => toggleCycle(c.id)}
                  icon={
                    <span
                      className="flex size-3 shrink-0 items-center justify-center rounded-full bg-amber-500/20"
                      aria-hidden
                    />
                  }
                  label={c.name}
                />
              ))}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title="Mention"
          open={open.mention}
          onToggle={() => toggle('mention')}
          titleClassName={PLANE_SECTION_TITLE}
        >
          {(() => {
            const youMatches =
              Boolean(currentUserId) && (filterSearch('You') || filterSearch(currentUserName));
            const excludingYou = currentUserId
              ? filteredMembers.filter(
                  (m) => normalizeUuidKey(m.member_id) !== normalizeUuidKey(currentUserId),
                )
              : filteredMembers;
            if (!youMatches && excludingYou.length === 0) return emptyFilterHint;

            return (
              <div className="max-h-52 overflow-y-auto">
                {youMatches && currentUserId ? (
                  <FiltersPanelOptionRow
                    checked={filters.mentionedUserIds.some(
                      (id) => normalizeUuidKey(id) === normalizeUuidKey(currentUserId),
                    )}
                    onToggle={() => toggleMentionUser(currentUserId)}
                    icon={
                      currentUserAvatarUrl ? (
                        <Avatar
                          name={currentUserName}
                          src={getImageUrl(currentUserAvatarUrl) ?? undefined}
                          size="sm"
                          className="h-5 w-5 shrink-0 text-[10px]"
                        />
                      ) : (
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-(--brand-200) text-[10px] font-medium text-(--brand-default)">
                          {currentUserName.charAt(0).toUpperCase()}
                        </span>
                      )
                    }
                    label="You"
                  />
                ) : null}
                {excludingYou.map((m) => {
                  const id = m.member_id;
                  const label = memberDisplayName(m);
                  return (
                    <FiltersPanelOptionRow
                      key={m.id}
                      checked={filters.mentionedUserIds.some(
                        (uid) => normalizeUuidKey(uid) === normalizeUuidKey(id),
                      )}
                      onToggle={() => toggleMentionUser(id)}
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
            );
          })()}
        </CollapsibleSection>

        <CollapsibleSection
          title="Created by"
          open={open.created_by}
          onToggle={() => toggle('created_by')}
          titleClassName={PLANE_SECTION_TITLE}
        >
          {filteredMembers.length === 0 ? (
            emptyFilterHint
          ) : (
            <div className="max-h-52 overflow-y-auto">
              {filteredMembers.map((m) => {
                const id = m.member_id;
                const label = memberDisplayName(m);
                return (
                  <FiltersPanelOptionRow
                    key={m.id}
                    checked={filters.createdByIds.some(
                      (cid) => normalizeUuidKey(cid) === normalizeUuidKey(id),
                    )}
                    onToggle={() => toggleCreatedBy(id)}
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
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title="Label"
          open={open.label}
          onToggle={() => toggle('label')}
          titleClassName={PLANE_SECTION_TITLE}
        >
          {filteredLabels.length === 0 ? (
            emptyFilterHint
          ) : (
            <div className="max-h-52 overflow-y-auto">
              {filteredLabels.map((l) => (
                <FiltersPanelOptionRow
                  key={l.id}
                  checked={filters.labelIds.some(
                    (id) => normalizeUuidKey(id) === normalizeUuidKey(l.id),
                  )}
                  onToggle={() => toggleLabel(l.id)}
                  icon={
                    <span
                      className="size-3.5 shrink-0 rounded-full border border-(--border-subtle)"
                      style={{
                        backgroundColor: l.color ? l.color : 'transparent',
                        borderColor: 'transparent',
                      }}
                      aria-hidden
                    />
                  }
                  label={l.name}
                />
              ))}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title="Work item Grouping"
          open={open.work_item_grouping}
          onToggle={() => toggle('work_item_grouping')}
          titleClassName={PLANE_SECTION_TITLE}
        >
          <FiltersPanelOptionRow
            checked={filters.workItemGrouping === 'all'}
            onToggle={() => setFilters((prev) => ({ ...prev, workItemGrouping: 'all' }))}
            label="All Work items"
            radio
          />
          <FiltersPanelOptionRow
            checked={filters.workItemGrouping === 'active'}
            onToggle={() => setFilters((prev) => ({ ...prev, workItemGrouping: 'active' }))}
            label="Active Work items"
            radio
          />
          <FiltersPanelOptionRow
            checked={filters.workItemGrouping === 'backlog'}
            onToggle={() => setFilters((prev) => ({ ...prev, workItemGrouping: 'backlog' }))}
            label="Backlog Work items"
            radio
          />
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
      </div>
    </>
  );
}
