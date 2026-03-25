import { useState } from 'react';
import { Avatar } from '../ui';
import { CollapsibleSection, FiltersPanelOptionRow } from '../workspace-views/WorkspaceViewsFiltersShared';
import {
  DATE_PRESET_LABELS,
  FILTER_ICONS,
  PRIORITY_ICONS,
  PRIORITY_LABELS,
  STATE_GROUP_ICONS,
  STATE_GROUP_LABELS,
} from '../workspace-views/WorkspaceViewsFiltersData';
import { DATE_PRESETS, PRIORITIES, STATE_GROUPS } from '../../types/workspaceViewFilters';
import type { ProjectIssuesFiltersState } from '../../lib/projectIssuesEvents';
import type { WorkspaceMemberApiResponse } from '../../api/types';
import { getImageUrl, normalizeUuidKey } from '../../lib/utils';

export interface ProjectIssuesFiltersPanelProps {
  search: string;
  onSearchChange: (v: string) => void;
  filters: ProjectIssuesFiltersState;
  setFilters: React.Dispatch<React.SetStateAction<ProjectIssuesFiltersState>>;
  members: WorkspaceMemberApiResponse[];
  currentUserId: string | null | undefined;
  currentUserName: string;
  currentUserAvatarUrl: string | null | undefined;
  onOpenCustomStart: () => void;
  onOpenCustomDue: () => void;
}

export function ProjectIssuesFiltersPanel({
  search,
  onSearchChange,
  filters,
  setFilters,
  members,
  currentUserId,
  currentUserName,
  currentUserAvatarUrl,
  onOpenCustomStart,
  onOpenCustomDue,
}: ProjectIssuesFiltersPanelProps) {
  const [sectionOpen, setSectionOpen] = useState({
    cycle: true,
    mention: true,
    priority: true,
    state: true,
    assignee: true,
    created_by: true,
    label: true,
    work_item_grouping: true,
    start_date: true,
    due_date: true,
  });

  const toggleSection = (key: keyof typeof sectionOpen) => {
    setSectionOpen((s) => ({ ...s, [key]: !s[key] }));
  };

  const filterSearch = (label: string) =>
    !search.trim() || label.toLowerCase().includes(search.trim().toLowerCase());

  const q = (s: string) => s.trim().toLowerCase();
  const filteredMembers = members.filter((m) =>
    q(m.member_display_name ?? m.member_email ?? m.member_id).includes(q(search)),
  );
  const creatorMembers = filteredMembers;

  const displayName = (m: WorkspaceMemberApiResponse) =>
    m.member_display_name?.trim() ?? m.member_email ?? m.member_id.slice(0, 12);

  const hasCustomStart = filters.startDate.includes('custom');
  const hasCustomDue = filters.dueDate.includes('custom');

  return (
    <>
      <div className="sticky top-0 shrink-0 border-b border-(--border-subtle) bg-(--bg-surface-1) p-2">
        <div className="flex items-center gap-2 rounded border border-(--border-subtle) bg-(--bg-layer-1) px-2 py-1.5">
          <span className="shrink-0 text-(--txt-icon-tertiary)">
            <FILTER_ICONS.search />
          </span>
          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        <CollapsibleSection
          title="Cycle"
          open={sectionOpen.cycle}
          onToggle={() => toggleSection('cycle')}
          titleClassName="text-(--txt-tertiary)"
        >
          <FiltersPanelOptionRow checked={false} onToggle={() => {}} label="Cycle 1" />
          <FiltersPanelOptionRow checked={false} onToggle={() => {}} label="Cycle 2" />
          <FiltersPanelOptionRow checked={false} onToggle={() => {}} label="test-cycle" />
        </CollapsibleSection>

        <CollapsibleSection
          title="Mention"
          open={sectionOpen.mention}
          onToggle={() => toggleSection('mention')}
          titleClassName="text-(--txt-tertiary)"
        >
          {currentUserId && (filterSearch('You') || filterSearch(currentUserName)) && (
            <FiltersPanelOptionRow
              checked={false}
              onToggle={() => {}}
              icon={
                getImageUrl(currentUserAvatarUrl) ? (
                  <img
                    src={getImageUrl(currentUserAvatarUrl)!}
                    alt=""
                    className="size-5 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-(--brand-200) text-[10px] font-medium text-(--brand-default)">
                    {currentUserName.charAt(0).toUpperCase()}
                  </span>
                )
              }
              label="You"
            />
          )}
          {filteredMembers
            .filter((m) => normalizeUuidKey(m.member_id) !== normalizeUuidKey(currentUserId))
            .map((m) => (
              <FiltersPanelOptionRow
                key={`mention-${m.id}`}
                checked={false}
                onToggle={() => {}}
                icon={
                  <Avatar
                    name={displayName(m)}
                    src={getImageUrl(m.member_avatar) ?? undefined}
                    size="sm"
                    className="h-5 w-5 shrink-0 text-[10px]"
                  />
                }
                label={displayName(m)}
              />
            ))}
        </CollapsibleSection>

        <CollapsibleSection
          title="Priority"
          open={sectionOpen.priority}
          onToggle={() => toggleSection('priority')}
          titleClassName="text-(--txt-tertiary)"
        >
          {PRIORITIES.filter((p) => filterSearch(PRIORITY_LABELS[p])).map((p) => (
            <FiltersPanelOptionRow
              key={p}
              checked={filters.priorities.includes(p)}
              onToggle={() => {
                setFilters((prev) => ({
                  ...prev,
                  priorities: prev.priorities.includes(p)
                    ? prev.priorities.filter((x) => x !== p)
                    : [...prev.priorities, p],
                }));
              }}
              icon={PRIORITY_ICONS[p]}
              label={PRIORITY_LABELS[p]}
            />
          ))}
        </CollapsibleSection>

        <CollapsibleSection
          title="State"
          open={sectionOpen.state}
          onToggle={() => toggleSection('state')}
          titleClassName="text-(--txt-tertiary)"
        >
          {STATE_GROUPS.filter((g) => filterSearch(STATE_GROUP_LABELS[g])).map((g) => (
            <FiltersPanelOptionRow
              key={g}
              checked={filters.stateGroups.includes(g)}
              onToggle={() => {
                setFilters((prev) => ({
                  ...prev,
                  stateGroups: prev.stateGroups.includes(g)
                    ? prev.stateGroups.filter((x) => x !== g)
                    : [...prev.stateGroups, g],
                }));
              }}
              icon={STATE_GROUP_ICONS[g]}
              label={STATE_GROUP_LABELS[g]}
            />
          ))}
        </CollapsibleSection>

        <CollapsibleSection
          title="Assignee"
          open={sectionOpen.assignee}
          onToggle={() => toggleSection('assignee')}
          titleClassName="text-(--txt-tertiary)"
        >
          {currentUserId && (filterSearch('You') || filterSearch(currentUserName)) && (
            <FiltersPanelOptionRow
              checked={filters.assigneeIds.some(
                (id) => normalizeUuidKey(id) === normalizeUuidKey(currentUserId),
              )}
              onToggle={() => {
                setFilters((prev) => {
                  const has = prev.assigneeIds.some(
                    (id) => normalizeUuidKey(id) === normalizeUuidKey(currentUserId),
                  );
                  return {
                    ...prev,
                    assigneeIds: has
                      ? prev.assigneeIds.filter(
                          (id) => normalizeUuidKey(id) !== normalizeUuidKey(currentUserId),
                        )
                      : [...prev.assigneeIds, currentUserId],
                  };
                });
              }}
              icon={
                getImageUrl(currentUserAvatarUrl) ? (
                  <img
                    src={getImageUrl(currentUserAvatarUrl)!}
                    alt=""
                    className="size-5 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-(--brand-200) text-[10px] font-medium text-(--brand-default)">
                    {currentUserName.charAt(0).toUpperCase()}
                  </span>
                )
              }
              label="You"
            />
          )}
          {filteredMembers
            .filter((m) => normalizeUuidKey(m.member_id) !== normalizeUuidKey(currentUserId))
            .map((m) => (
              <FiltersPanelOptionRow
                key={m.id}
                checked={filters.assigneeIds.some(
                  (id) => normalizeUuidKey(id) === normalizeUuidKey(m.member_id),
                )}
                onToggle={() => {
                  setFilters((prev) => {
                    const has = prev.assigneeIds.some(
                      (id) => normalizeUuidKey(id) === normalizeUuidKey(m.member_id),
                    );
                    return {
                      ...prev,
                      assigneeIds: has
                        ? prev.assigneeIds.filter(
                            (id) => normalizeUuidKey(id) !== normalizeUuidKey(m.member_id),
                          )
                        : [...prev.assigneeIds, m.member_id],
                    };
                  });
                }}
                icon={
                  <Avatar
                    name={displayName(m)}
                    src={getImageUrl(m.member_avatar) ?? undefined}
                    size="sm"
                    className="h-5 w-5 shrink-0 text-[10px]"
                  />
                }
                label={displayName(m)}
              />
            ))}
        </CollapsibleSection>

        <CollapsibleSection
          title="Created by"
          open={sectionOpen.created_by}
          onToggle={() => toggleSection('created_by')}
          titleClassName="text-(--txt-tertiary)"
        >
          {creatorMembers.length === 0 ? (
            <div className="px-3 py-1.5 text-sm text-(--txt-tertiary)">No matches found</div>
          ) : (
            creatorMembers.map((m) => (
              <FiltersPanelOptionRow
                key={`created-${m.id}`}
                checked={filters.createdByIds.some(
                  (id) => normalizeUuidKey(id) === normalizeUuidKey(m.member_id),
                )}
                onToggle={() => {
                  setFilters((prev) => {
                    const has = prev.createdByIds.some(
                      (id) => normalizeUuidKey(id) === normalizeUuidKey(m.member_id),
                    );
                    return {
                      ...prev,
                      createdByIds: has
                        ? prev.createdByIds.filter(
                            (id) => normalizeUuidKey(id) !== normalizeUuidKey(m.member_id),
                          )
                        : [...prev.createdByIds, m.member_id],
                    };
                  });
                }}
                icon={
                  <Avatar
                    name={displayName(m)}
                    src={getImageUrl(m.member_avatar) ?? undefined}
                    size="sm"
                    className="h-5 w-5 shrink-0 text-[10px]"
                  />
                }
                label={displayName(m)}
              />
            ))
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title="Label"
          open={sectionOpen.label}
          onToggle={() => toggleSection('label')}
          titleClassName="text-(--txt-tertiary)"
        >
          <div className="px-3 py-1.5 text-sm italic text-(--txt-tertiary)">No matches found</div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Work item Grouping"
          open={sectionOpen.work_item_grouping}
          onToggle={() => toggleSection('work_item_grouping')}
          titleClassName="text-(--txt-tertiary)"
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
          open={sectionOpen.start_date}
          onToggle={() => toggleSection('start_date')}
          titleClassName="text-(--txt-tertiary)"
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
                      startDate: prev.startDate.filter((x) => x !== 'custom'),
                      startAfter: null,
                      startBefore: null,
                    }));
                  } else {
                    setFilters((prev) => ({
                      ...prev,
                      startDate: prev.startDate.includes('custom')
                        ? prev.startDate
                        : [...prev.startDate, 'custom'],
                    }));
                    onOpenCustomStart();
                  }
                }}
                label={DATE_PRESET_LABELS[d]}
              />
            ) : (
              <FiltersPanelOptionRow
                key={d}
                checked={!hasCustomStart && filters.startDate.includes(d)}
                onToggle={() => {
                  setFilters((prev) => {
                    if (hasCustomStart) {
                      const next = prev.startDate.filter((x) => x !== 'custom');
                      const withD = next.includes(d) ? next.filter((x) => x !== d) : [...next, d];
                      return {
                        ...prev,
                        startDate: withD,
                        startAfter: null,
                        startBefore: null,
                      };
                    }
                    const presets = prev.startDate.filter((x) => x !== 'custom');
                    const nextList = presets.includes(d)
                      ? presets.filter((x) => x !== d)
                      : [...presets, d];
                    return { ...prev, startDate: nextList };
                  });
                }}
                label={DATE_PRESET_LABELS[d]}
              />
            ),
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title="Due date"
          open={sectionOpen.due_date}
          onToggle={() => toggleSection('due_date')}
          titleClassName="text-(--txt-tertiary)"
        >
          {DATE_PRESETS.filter((d) => filterSearch(DATE_PRESET_LABELS[d])).map((d) =>
            d === 'custom' ? (
              <FiltersPanelOptionRow
                key={d}
                checked={hasCustomDue}
                onToggle={() => {
                  if (hasCustomDue) {
                    setFilters((prev) => ({
                      ...prev,
                      dueDate: prev.dueDate.filter((x) => x !== 'custom'),
                      dueAfter: null,
                      dueBefore: null,
                    }));
                  } else {
                    setFilters((prev) => ({
                      ...prev,
                      dueDate: prev.dueDate.includes('custom')
                        ? prev.dueDate
                        : [...prev.dueDate, 'custom'],
                    }));
                    onOpenCustomDue();
                  }
                }}
                label={DATE_PRESET_LABELS[d]}
              />
            ) : (
              <FiltersPanelOptionRow
                key={d}
                checked={!hasCustomDue && filters.dueDate.includes(d)}
                onToggle={() => {
                  setFilters((prev) => {
                    if (hasCustomDue) {
                      const next = prev.dueDate.filter((x) => x !== 'custom');
                      const withD = next.includes(d) ? next.filter((x) => x !== d) : [...next, d];
                      return {
                        ...prev,
                        dueDate: withD,
                        dueAfter: null,
                        dueBefore: null,
                      };
                    }
                    const presets = prev.dueDate.filter((x) => x !== 'custom');
                    const nextList = presets.includes(d)
                      ? presets.filter((x) => x !== d)
                      : [...presets, d];
                    return { ...prev, dueDate: nextList };
                  });
                }}
                label={DATE_PRESET_LABELS[d]}
              />
            ),
          )}
        </CollapsibleSection>
      </div>
    </>
  );
}
