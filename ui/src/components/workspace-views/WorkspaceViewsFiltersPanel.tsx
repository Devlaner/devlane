import { useEffect, useState } from "react";
import { DateRangeModal } from "./DateRangeModal";
import { CollapsibleSection } from "./WorkspaceViewsFiltersShared";
import {
  PRIORITY_ICONS,
  PRIORITY_LABELS,
  STATE_GROUP_ICONS,
  STATE_GROUP_LABELS,
  DATE_PRESET_LABELS,
  FILTER_ICONS,
} from "./WorkspaceViewsFiltersData";
import { getImageUrl } from "../../lib/utils";
import { workspaceService } from "../../services/workspaceService";
import { projectService } from "../../services/projectService";
import { stateService } from "../../services/stateService";
import { labelService } from "../../services/labelService";
import { useAuth } from "../../contexts/AuthContext";
import {
  type WorkspaceViewFilters,
  PRIORITIES,
  STATE_GROUPS,
  GROUPING_OPTIONS,
  DATE_PRESETS,
} from "../../types/workspaceViewFilters";
import type {
  WorkspaceMemberApiResponse,
  ProjectApiResponse,
  StateApiResponse,
  LabelApiResponse,
} from "../../api/types";

const LONG_LIST_PANEL_STYLE = { maxHeight: "min(70vh, 28rem)" };

export interface WorkspaceViewsFiltersPanelProps {
  filters: WorkspaceViewFilters;
  onFiltersChange: (
    updater: (prev: WorkspaceViewFilters) => WorkspaceViewFilters,
  ) => void;
  workspaceSlug: string;
  /** When provided (e.g. when inside a dropdown), called before opening date range modal so parent can close */
  onCloseParent?: () => void;
  /** When true, show search and use scrollable panel height; when false, no search and natural height (e.g. in Create View modal) */
  compact?: boolean;
}

export function WorkspaceViewsFiltersPanel({
  filters,
  onFiltersChange,
  workspaceSlug,
  onCloseParent,
  compact = false,
}: WorkspaceViewsFiltersPanelProps) {
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [, setStatesByProject] = useState<Record<string, StateApiResponse[]>>(
    {},
  );
  const [labelsByProject, setLabelsByProject] = useState<
    Record<string, LabelApiResponse[]>
  >({});
  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>({
    priority: true,
    state_group: true,
    assignee: true,
    created_by: true,
    label: true,
    project: true,
    grouping: true,
    start_date: true,
    due_date: true,
  });
  const [dateRangeModal, setDateRangeModal] = useState<"start" | "due" | null>(
    null,
  );

  useEffect(() => {
    if (!workspaceSlug) return;
    let cancelled = false;
    Promise.all([
      workspaceService.listMembers(workspaceSlug),
      projectService.list(workspaceSlug),
    ])
      .then(([mem, proj]) => {
        if (cancelled) return;
        setMembers(mem ?? []);
        setProjects(proj ?? []);
        return proj ?? [];
      })
      .then((proj) => {
        if (cancelled || !proj || !proj.length) return;
        return Promise.all(
          proj.map((p) =>
            Promise.all([
              stateService.list(workspaceSlug, p.id),
              labelService.list(workspaceSlug, p.id),
            ]).then(([s, l]) => ({
              projectId: p.id,
              states: s ?? [],
              labels: l ?? [],
            })),
          ),
        );
      })
      .then((results) => {
        if (cancelled || !results) return;
        const sMap: Record<string, StateApiResponse[]> = {};
        const lMap: Record<string, LabelApiResponse[]> = {};
        results.forEach(({ projectId, states, labels }) => {
          sMap[projectId] = states;
          lMap[projectId] = labels;
        });
        setStatesByProject(sMap);
        setLabelsByProject(lMap);
      })
      .catch(() => {
        if (!cancelled) {
          setMembers([]);
          setProjects([]);
          setStatesByProject({});
          setLabelsByProject({});
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  const toggleSection = (key: string) => {
    setSectionOpen((s) => ({ ...s, [key]: !s[key] }));
  };

  const openDateModal = (which: "start" | "due") => {
    onCloseParent?.();
    setDateRangeModal(which);
  };

  const allLabels = Object.values(labelsByProject).flat();
  const filterSearch = (label: string) =>
    !search.trim() || label.toLowerCase().includes(search.trim().toLowerCase());

  const content = (
    <div
      className={compact ? "min-h-0 flex-1 overflow-y-auto py-1" : "space-y-0"}
      style={compact ? LONG_LIST_PANEL_STYLE : undefined}
    >
      <CollapsibleSection
        title="Priority"
        open={sectionOpen.priority}
        onToggle={() => toggleSection("priority")}
      >
        {PRIORITIES.filter((p) => filterSearch(PRIORITY_LABELS[p])).map((p) => (
          <label
            key={p}
            className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]"
          >
            <input
              type="checkbox"
              checked={filters.priority.includes(p)}
              onChange={() => {
                onFiltersChange((prev) => ({
                  ...prev,
                  priority: prev.priority.includes(p)
                    ? prev.priority.filter((x) => x !== p)
                    : [...prev.priority, p],
                }));
              }}
              className="rounded border-[var(--border-subtle)]"
            />
            <span className="flex size-4 shrink-0 items-center justify-center">
              {PRIORITY_ICONS[p]}
            </span>
            <span>{PRIORITY_LABELS[p]}</span>
          </label>
        ))}
      </CollapsibleSection>

      <CollapsibleSection
        title="State group"
        open={sectionOpen.state_group}
        onToggle={() => toggleSection("state_group")}
      >
        {STATE_GROUPS.filter((g) => filterSearch(STATE_GROUP_LABELS[g])).map(
          (g) => (
            <label
              key={g}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]"
            >
              <input
                type="checkbox"
                checked={filters.stateGroup.includes(g)}
                onChange={() => {
                  onFiltersChange((prev) => ({
                    ...prev,
                    stateGroup: prev.stateGroup.includes(g)
                      ? prev.stateGroup.filter((x) => x !== g)
                      : [...prev.stateGroup, g],
                  }));
                }}
                className="rounded border-[var(--border-subtle)]"
              />
              <span className="flex size-4 shrink-0 items-center justify-center">
                {STATE_GROUP_ICONS[g]}
              </span>
              <span>{STATE_GROUP_LABELS[g]}</span>
            </label>
          ),
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Assignee"
        open={sectionOpen.assignee}
        onToggle={() => toggleSection("assignee")}
      >
        {currentUser && filterSearch("You") && (
          <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]">
            <input
              type="checkbox"
              checked={filters.assigneeIds.includes(currentUser.id)}
              onChange={() => {
                onFiltersChange((prev) => ({
                  ...prev,
                  assigneeIds: prev.assigneeIds.includes(currentUser.id)
                    ? prev.assigneeIds.filter((id) => id !== currentUser.id)
                    : [...prev.assigneeIds, currentUser.id],
                }));
              }}
              className="rounded border-[var(--border-subtle)]"
            />
            {getImageUrl(currentUser.avatarUrl) ? (
              <img
                src={getImageUrl(currentUser.avatarUrl)!}
                alt=""
                className="size-5 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-200)] text-[10px] font-medium text-[var(--brand-default)]">
                {currentUser.name?.charAt(0) ?? "?"}
              </span>
            )}
            <span>You</span>
          </label>
        )}
        {members
          .filter(
            (m) =>
              m.member_id !== currentUser?.id &&
              filterSearch(
                m.member_display_name ?? m.member_email ?? m.member_id,
              ),
          )
          .map((m) => (
            <label
              key={m.id}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]"
            >
              <input
                type="checkbox"
                checked={filters.assigneeIds.includes(m.member_id)}
                onChange={() => {
                  onFiltersChange((prev) => ({
                    ...prev,
                    assigneeIds: prev.assigneeIds.includes(m.member_id)
                      ? prev.assigneeIds.filter((id) => id !== m.member_id)
                      : [...prev.assigneeIds, m.member_id],
                  }));
                }}
                className="rounded border-[var(--border-subtle)]"
              />
              {getImageUrl(m.member_avatar) ? (
                <img
                  src={getImageUrl(m.member_avatar)!}
                  alt=""
                  className="size-5 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--bg-layer-2)] text-[10px] text-[var(--txt-secondary)]">
                  {(m.member_display_name ?? m.member_email ?? "?").charAt(0)}
                </span>
              )}
              <span className="truncate">
                {m.member_display_name ?? m.member_email ?? m.member_id}
              </span>
            </label>
          ))}
      </CollapsibleSection>

      <CollapsibleSection
        title="Created by"
        open={sectionOpen.created_by}
        onToggle={() => toggleSection("created_by")}
      >
        {currentUser && filterSearch("You") && (
          <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]">
            <input
              type="checkbox"
              checked={filters.createdByIds.includes(currentUser.id)}
              onChange={() => {
                onFiltersChange((prev) => ({
                  ...prev,
                  createdByIds: prev.createdByIds.includes(currentUser.id)
                    ? prev.createdByIds.filter((id) => id !== currentUser.id)
                    : [...prev.createdByIds, currentUser.id],
                }));
              }}
              className="rounded border-[var(--border-subtle)]"
            />
            {getImageUrl(currentUser.avatarUrl) ? (
              <img
                src={getImageUrl(currentUser.avatarUrl)!}
                alt=""
                className="size-5 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-200)] text-[10px] font-medium text-[var(--brand-default)]">
                {currentUser.name?.charAt(0) ?? "?"}
              </span>
            )}
            <span>You</span>
          </label>
        )}
        {members
          .filter(
            (m) =>
              m.member_id !== currentUser?.id &&
              filterSearch(
                m.member_display_name ?? m.member_email ?? m.member_id,
              ),
          )
          .map((m) => (
            <label
              key={m.id}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]"
            >
              <input
                type="checkbox"
                checked={filters.createdByIds.includes(m.member_id)}
                onChange={() => {
                  onFiltersChange((prev) => ({
                    ...prev,
                    createdByIds: prev.createdByIds.includes(m.member_id)
                      ? prev.createdByIds.filter((id) => id !== m.member_id)
                      : [...prev.createdByIds, m.member_id],
                  }));
                }}
                className="rounded border-[var(--border-subtle)]"
              />
              {getImageUrl(m.member_avatar) ? (
                <img
                  src={getImageUrl(m.member_avatar)!}
                  alt=""
                  className="size-5 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--bg-layer-2)] text-[10px] text-[var(--txt-secondary)]">
                  {(m.member_display_name ?? m.member_email ?? "?").charAt(0)}
                </span>
              )}
              <span className="truncate">
                {m.member_display_name ?? m.member_email ?? m.member_id}
              </span>
            </label>
          ))}
      </CollapsibleSection>

      <CollapsibleSection
        title="Label"
        open={sectionOpen.label}
        onToggle={() => toggleSection("label")}
      >
        {allLabels.length === 0 ? (
          <p className="px-3 py-2 text-sm text-[var(--txt-tertiary)]">
            No labels in workspace. Add labels in a project to filter by them.
          </p>
        ) : (
          allLabels
            .filter((l) => filterSearch(l.name))
            .map((l) => (
              <label
                key={l.id}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]"
              >
                <input
                  type="checkbox"
                  checked={filters.labelIds.includes(l.id)}
                  onChange={() => {
                    onFiltersChange((prev) => ({
                      ...prev,
                      labelIds: prev.labelIds.includes(l.id)
                        ? prev.labelIds.filter((id) => id !== l.id)
                        : [...prev.labelIds, l.id],
                    }));
                  }}
                  className="rounded border-[var(--border-subtle)]"
                />
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{
                    backgroundColor: l.color ?? "var(--txt-icon-tertiary)",
                  }}
                />
                <span className="truncate">{l.name}</span>
              </label>
            ))
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Project"
        open={sectionOpen.project}
        onToggle={() => toggleSection("project")}
      >
        {projects
          .filter((p) => filterSearch(p.name))
          .map((p) => (
            <label
              key={p.id}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]"
            >
              <input
                type="checkbox"
                checked={filters.projectIds.includes(p.id)}
                onChange={() => {
                  onFiltersChange((prev) => ({
                    ...prev,
                    projectIds: prev.projectIds.includes(p.id)
                      ? prev.projectIds.filter((id) => id !== p.id)
                      : [...prev.projectIds, p.id],
                  }));
                }}
                className="rounded border-[var(--border-subtle)]"
              />
              <span className="text-[var(--txt-icon-tertiary)]">
                <FILTER_ICONS.project />
              </span>
              <span className="truncate">{p.name}</span>
            </label>
          ))}
      </CollapsibleSection>

      <CollapsibleSection
        title="Work item Grouping"
        open={sectionOpen.grouping}
        onToggle={() => toggleSection("grouping")}
      >
        {GROUPING_OPTIONS.map((g) => (
          <label
            key={g}
            className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]"
          >
            <input
              type="radio"
              name="grouping"
              checked={filters.grouping === g}
              onChange={() =>
                onFiltersChange((prev) => ({ ...prev, grouping: g }))
              }
              className="border-[var(--border-subtle)]"
            />
            <span>
              {g === "all"
                ? "All Work items"
                : g === "active"
                  ? "Active Work items"
                  : "Backlog Work items"}
            </span>
          </label>
        ))}
      </CollapsibleSection>

      <CollapsibleSection
        title="Start date"
        open={sectionOpen.start_date}
        onToggle={() => toggleSection("start_date")}
      >
        {DATE_PRESETS.filter((d) => filterSearch(DATE_PRESET_LABELS[d])).map(
          (d) =>
            d === "custom" ? (
              <label
                key={d}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]"
                onClick={(e) => {
                  e.preventDefault();
                  openDateModal("start");
                }}
              >
                <input
                  type="checkbox"
                  checked={filters.startDate.includes("custom")}
                  readOnly
                  tabIndex={-1}
                  className="rounded border-[var(--border-subtle)]"
                />
                <span>{DATE_PRESET_LABELS[d]}</span>
              </label>
            ) : (
              <label
                key={d}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]"
              >
                <input
                  type="checkbox"
                  checked={filters.startDate.includes(d)}
                  onChange={() => {
                    onFiltersChange((prev) => ({
                      ...prev,
                      startDate: prev.startDate.includes(d)
                        ? prev.startDate.filter((x) => x !== d)
                        : [...prev.startDate, d],
                    }));
                  }}
                  className="rounded border-[var(--border-subtle)]"
                />
                <span>{DATE_PRESET_LABELS[d]}</span>
              </label>
            ),
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Due date"
        open={sectionOpen.due_date}
        onToggle={() => toggleSection("due_date")}
      >
        {DATE_PRESETS.filter((d) => filterSearch(DATE_PRESET_LABELS[d])).map(
          (d) =>
            d === "custom" ? (
              <label
                key={d}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]"
                onClick={(e) => {
                  e.preventDefault();
                  openDateModal("due");
                }}
              >
                <input
                  type="checkbox"
                  checked={filters.dueDate.includes("custom")}
                  readOnly
                  tabIndex={-1}
                  className="rounded border-[var(--border-subtle)]"
                />
                <span>{DATE_PRESET_LABELS[d]}</span>
              </label>
            ) : (
              <label
                key={d}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]"
              >
                <input
                  type="checkbox"
                  checked={filters.dueDate.includes(d)}
                  onChange={() => {
                    onFiltersChange((prev) => ({
                      ...prev,
                      dueDate: prev.dueDate.includes(d)
                        ? prev.dueDate.filter((x) => x !== d)
                        : [...prev.dueDate, d],
                    }));
                  }}
                  className="rounded border-[var(--border-subtle)]"
                />
                <span>{DATE_PRESET_LABELS[d]}</span>
              </label>
            ),
        )}
      </CollapsibleSection>
    </div>
  );

  return (
    <>
      {compact && (
        <div className="sticky top-0 shrink-0 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-1)] p-2">
          <div className="flex items-center gap-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-layer-1)] px-2 py-1.5">
            <span className="shrink-0 text-[var(--txt-icon-tertiary)]">
              <FILTER_ICONS.search />
            </span>
            <input
              type="text"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-[var(--txt-primary)] placeholder:text-[var(--txt-placeholder)] focus:outline-none"
            />
          </div>
        </div>
      )}
      {content}
      <DateRangeModal
        open={dateRangeModal !== null}
        onClose={() => setDateRangeModal(null)}
        title={
          dateRangeModal === "start" ? "Start date range" : "Due date range"
        }
        after={
          dateRangeModal === "start" ? filters.startAfter : filters.dueAfter
        }
        before={
          dateRangeModal === "start" ? filters.startBefore : filters.dueBefore
        }
        onApply={(after, before) => {
          if (dateRangeModal === "start") {
            onFiltersChange((prev) => ({
              ...prev,
              startDate: prev.startDate.includes("custom")
                ? prev.startDate
                : [...prev.startDate, "custom"],
              startAfter: after,
              startBefore: before,
            }));
          } else {
            onFiltersChange((prev) => ({
              ...prev,
              dueDate: prev.dueDate.includes("custom")
                ? prev.dueDate
                : [...prev.dueDate, "custom"],
              dueAfter: after,
              dueBefore: before,
            }));
          }
          setDateRangeModal(null);
        }}
      />
    </>
  );
}
