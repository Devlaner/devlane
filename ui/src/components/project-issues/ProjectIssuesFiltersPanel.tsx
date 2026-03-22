import { useState } from 'react';
import { Avatar } from '../ui';
import { CollapsibleSection } from '../workspace-views/WorkspaceViewsFiltersShared';
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
    priority: true,
    state: true,
    assignee: true,
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
          title="Priority"
          open={sectionOpen.priority}
          onToggle={() => toggleSection('priority')}
        >
          {PRIORITIES.filter((p) => filterSearch(PRIORITY_LABELS[p])).map((p) => (
            <label
              key={p}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
            >
              <input
                type="checkbox"
                checked={filters.priorities.includes(p)}
                onChange={() => {
                  setFilters((prev) => ({
                    ...prev,
                    priorities: prev.priorities.includes(p)
                      ? prev.priorities.filter((x) => x !== p)
                      : [...prev.priorities, p],
                  }));
                }}
                className="rounded border-(--border-subtle)"
              />
              <span className="flex size-4 shrink-0 items-center justify-center">
                {PRIORITY_ICONS[p]}
              </span>
              <span>{PRIORITY_LABELS[p]}</span>
            </label>
          ))}
        </CollapsibleSection>

        <CollapsibleSection
          title="State"
          open={sectionOpen.state}
          onToggle={() => toggleSection('state')}
        >
          {STATE_GROUPS.filter((g) => filterSearch(STATE_GROUP_LABELS[g])).map((g) => (
            <label
              key={g}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
            >
              <input
                type="checkbox"
                checked={filters.stateGroups.includes(g)}
                onChange={() => {
                  setFilters((prev) => ({
                    ...prev,
                    stateGroups: prev.stateGroups.includes(g)
                      ? prev.stateGroups.filter((x) => x !== g)
                      : [...prev.stateGroups, g],
                  }));
                }}
                className="rounded border-(--border-subtle)"
              />
              <span className="flex size-4 shrink-0 items-center justify-center">
                {STATE_GROUP_ICONS[g]}
              </span>
              <span>{STATE_GROUP_LABELS[g]}</span>
            </label>
          ))}
        </CollapsibleSection>

        <CollapsibleSection
          title="Assignee"
          open={sectionOpen.assignee}
          onToggle={() => toggleSection('assignee')}
        >
          {currentUserId && (filterSearch('You') || filterSearch(currentUserName)) && (
            <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)">
              <input
                type="checkbox"
                checked={filters.assigneeIds.some(
                  (id) => normalizeUuidKey(id) === normalizeUuidKey(currentUserId),
                )}
                onChange={() => {
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
                className="rounded border-(--border-subtle)"
              />
              {getImageUrl(currentUserAvatarUrl) ? (
                <img
                  src={getImageUrl(currentUserAvatarUrl)!}
                  alt=""
                  className="size-5 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-(--brand-200) text-[10px] font-medium text-(--brand-default)">
                  {currentUserName.charAt(0).toUpperCase()}
                </span>
              )}
              <span>You</span>
            </label>
          )}
          {filteredMembers
            .filter((m) => normalizeUuidKey(m.member_id) !== normalizeUuidKey(currentUserId))
            .map((m) => (
              <label
                key={m.id}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
              >
                <input
                  type="checkbox"
                  checked={filters.assigneeIds.some(
                    (id) => normalizeUuidKey(id) === normalizeUuidKey(m.member_id),
                  )}
                  onChange={() => {
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
                  className="rounded border-(--border-subtle)"
                />
                <Avatar
                  name={displayName(m)}
                  src={getImageUrl(m.member_avatar) ?? undefined}
                  size="sm"
                  className="h-5 w-5 shrink-0 text-[10px]"
                />
                <span className="truncate">{displayName(m)}</span>
              </label>
            ))}
        </CollapsibleSection>

        <CollapsibleSection
          title="Start date"
          open={sectionOpen.start_date}
          onToggle={() => toggleSection('start_date')}
        >
          {DATE_PRESETS.filter((d) => filterSearch(DATE_PRESET_LABELS[d])).map((d) =>
            d === 'custom' ? (
              <label
                key={d}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
              >
                <input
                  type="checkbox"
                  checked={hasCustomStart}
                  onChange={() => {
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
                  className="rounded border-(--border-subtle)"
                />
                <span>{DATE_PRESET_LABELS[d]}</span>
              </label>
            ) : (
              <label
                key={d}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
              >
                <input
                  type="checkbox"
                  checked={!hasCustomStart && filters.startDate.includes(d)}
                  onChange={() => {
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
                  className="rounded border-(--border-subtle)"
                />
                <span>{DATE_PRESET_LABELS[d]}</span>
              </label>
            ),
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title="Due date"
          open={sectionOpen.due_date}
          onToggle={() => toggleSection('due_date')}
        >
          {DATE_PRESETS.filter((d) => filterSearch(DATE_PRESET_LABELS[d])).map((d) =>
            d === 'custom' ? (
              <label
                key={d}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
              >
                <input
                  type="checkbox"
                  checked={hasCustomDue}
                  onChange={() => {
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
                  className="rounded border-(--border-subtle)"
                />
                <span>{DATE_PRESET_LABELS[d]}</span>
              </label>
            ) : (
              <label
                key={d}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
              >
                <input
                  type="checkbox"
                  checked={!hasCustomDue && filters.dueDate.includes(d)}
                  onChange={() => {
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
                  className="rounded border-(--border-subtle)"
                />
                <span>{DATE_PRESET_LABELS[d]}</span>
              </label>
            ),
          )}
        </CollapsibleSection>
      </div>
    </>
  );
}
