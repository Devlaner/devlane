import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { Dropdown } from "../work-item";
import { DateRangeModal } from "./DateRangeModal";
import { useWorkspaceViewsState } from "../../contexts/WorkspaceViewsStateContext";
import { workspaceService } from "../../services/workspaceService";
import { projectService } from "../../services/projectService";
import { stateService } from "../../services/stateService";
import { labelService } from "../../services/labelService";
import { useAuth } from "../../contexts/AuthContext";
import {
  type WorkspaceViewFilters,
  type Priority,
  type StateGroup,
  type DatePreset,
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

const IconUrgent = () => (
  <span className="flex size-4 items-center justify-center text-[10px] text-red-500">
    !
  </span>
);
const IconHigh = () => (
  <span className="inline-flex size-4 items-end justify-center gap-px text-amber-500">
    <span className="h-2.5 w-0.5 rounded-sm bg-current" />
    <span className="h-3.5 w-0.5 rounded-sm bg-current" />
  </span>
);
const IconMedium = () => (
  <span className="inline-flex size-4 items-end justify-center gap-px text-yellow-500">
    <span className="h-2 w-0.5 rounded-sm bg-current" />
    <span className="h-2.5 w-0.5 rounded-sm bg-current" />
  </span>
);
const IconLow = () => (
  <span className="inline-flex size-4 items-end justify-center gap-px text-blue-500">
    <span className="h-1.5 w-0.5 rounded-sm bg-current" />
    <span className="h-2 w-0.5 rounded-sm bg-current" />
  </span>
);
const IconNone = () => (
  <span className="flex size-4 items-center justify-center text-[10px] text-[var(--txt-icon-tertiary)]">
    —
  </span>
);

const PRIORITY_ICONS: Record<Priority, ReactNode> = {
  urgent: <IconUrgent />,
  high: <IconHigh />,
  medium: <IconMedium />,
  low: <IconLow />,
  none: <IconNone />,
};

const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "None",
};

const IconBacklog = () => (
  <span className="flex size-4 items-center justify-center rounded-full border border-[var(--border-subtle)]" />
);
const IconUnstarted = () => (
  <span className="flex size-4 items-center justify-center rounded-full border-2 border-[var(--border-subtle)]" />
);
const IconStarted = () => (
  <span className="flex size-4 items-center justify-center rounded-full border-2 border-amber-500 bg-amber-500/20" />
);
const IconCompleted = () => (
  <span className="flex size-4 items-center justify-center rounded-full bg-green-500 text-white text-[10px]">
    ✓
  </span>
);
const IconCanceled = () => (
  <span className="flex size-4 items-center justify-center rounded-full border border-[var(--border-subtle)] text-[10px] text-[var(--txt-tertiary)]">
    ✕
  </span>
);

const STATE_GROUP_ICONS: Record<StateGroup, ReactNode> = {
  backlog: <IconBacklog />,
  unstarted: <IconUnstarted />,
  started: <IconStarted />,
  completed: <IconCompleted />,
  canceled: <IconCanceled />,
};

const STATE_GROUP_LABELS: Record<StateGroup, string> = {
  backlog: "Backlog",
  unstarted: "Unstarted",
  started: "Started",
  completed: "Completed",
  canceled: "Canceled",
};

const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  "1_week": "1 week from now",
  "2_weeks": "2 weeks from now",
  "1_month": "1 month from now",
  "2_months": "2 months from now",
  custom: "Custom",
};

const IconFilter = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
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
const IconSearch = () => (
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
    <path d="m21 21-4.35-4.35" />
  </svg>
);
const IconProject = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);

function CollapsibleSection({
  title,
  open: controlledOpen,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-[var(--border-subtle)] last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]"
      >
        {title}
        <span className="text-[var(--txt-icon-tertiary)]">
          {controlledOpen ? <IconChevronUp /> : <IconChevronDown />}
        </span>
      </button>
      {controlledOpen && <div className="pb-1">{children}</div>}
    </div>
  );
}

export interface WorkspaceViewsFiltersDropdownProps {
  openId: string | null;
  onOpen: (id: string | null) => void;
}

export function WorkspaceViewsFiltersDropdown({
  openId,
  onOpen,
}: WorkspaceViewsFiltersDropdownProps) {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { filters, setFilters } = useWorkspaceViewsState();
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
              stateService.list(workspaceSlug!, p.id),
              labelService.list(workspaceSlug!, p.id),
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

  const updateFilters = useCallback(
    (updater: (prev: WorkspaceViewFilters) => WorkspaceViewFilters) => {
      setFilters(updater);
    },
    [setFilters],
  );

  const toggleSection = (key: string) => {
    setSectionOpen((s) => ({ ...s, [key]: !s[key] }));
  };

  const allLabels = Object.values(labelsByProject).flat();
  const filterSearch = (label: string) =>
    !search.trim() || label.toLowerCase().includes(search.trim().toLowerCase());

  return (
    <>
      <Dropdown
        id="workspace-views-filters"
        openId={openId}
        onOpen={onOpen}
        label="Filters"
        icon={<IconFilter />}
        displayValue="Filters"
        panelClassName="flex min-w-[280px] max-h-[min(70vh,28rem)] flex-col rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] shadow-[var(--shadow-raised)] overflow-hidden"
        align="right"
      >
        <div className="sticky top-0 shrink-0 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-1)] p-2">
          <div className="flex items-center gap-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-layer-1)] px-2 py-1.5">
            <span className="shrink-0 text-[var(--txt-icon-tertiary)]">
              <IconSearch />
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
        <div
          className="min-h-0 flex-1 overflow-y-auto py-1"
          style={LONG_LIST_PANEL_STYLE}
        >
          <CollapsibleSection
            title="Priority"
            open={sectionOpen.priority}
            onToggle={() => toggleSection("priority")}
          >
            {PRIORITIES.filter((p) => filterSearch(PRIORITY_LABELS[p])).map(
              (p) => (
                <label
                  key={p}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]"
                >
                  <input
                    type="checkbox"
                    checked={filters.priority.includes(p)}
                    onChange={() => {
                      updateFilters((prev) => ({
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
              ),
            )}
          </CollapsibleSection>

          <CollapsibleSection
            title="State group"
            open={sectionOpen.state_group}
            onToggle={() => toggleSection("state_group")}
          >
            {STATE_GROUPS.filter((g) =>
              filterSearch(STATE_GROUP_LABELS[g]),
            ).map((g) => (
              <label
                key={g}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]"
              >
                <input
                  type="checkbox"
                  checked={filters.stateGroup.includes(g)}
                  onChange={() => {
                    updateFilters((prev) => ({
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
            ))}
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
                    updateFilters((prev) => ({
                      ...prev,
                      assigneeIds: prev.assigneeIds.includes(currentUser.id)
                        ? prev.assigneeIds.filter((id) => id !== currentUser.id)
                        : [...prev.assigneeIds, currentUser.id],
                    }));
                  }}
                  className="rounded border-[var(--border-subtle)]"
                />
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-200)] text-[10px] font-medium text-[var(--brand-default)]">
                  {currentUser.name?.charAt(0) ?? "?"}
                </span>
                <span>You</span>
              </label>
            )}
            {members
              .filter((m) =>
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
                      updateFilters((prev) => ({
                        ...prev,
                        assigneeIds: prev.assigneeIds.includes(m.member_id)
                          ? prev.assigneeIds.filter((id) => id !== m.member_id)
                          : [...prev.assigneeIds, m.member_id],
                      }));
                    }}
                    className="rounded border-[var(--border-subtle)]"
                  />
                  {m.member_avatar ? (
                    <img
                      src={m.member_avatar}
                      alt=""
                      className="size-5 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--bg-layer-2)] text-[10px] text-[var(--txt-secondary)]">
                      {(m.member_display_name ?? m.member_email ?? "?").charAt(
                        0,
                      )}
                    </span>
                  )}
                  <span className="truncate">
                    {m.member_display_name ?? m.member_email ?? m.member_id}
                  </span>
                </label>
              ))}
            <button
              type="button"
              className="px-3 py-1.5 text-left text-sm text-[var(--brand-default)] hover:underline"
            >
              View all
            </button>
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
                    updateFilters((prev) => ({
                      ...prev,
                      createdByIds: prev.createdByIds.includes(currentUser.id)
                        ? prev.createdByIds.filter(
                            (id) => id !== currentUser.id,
                          )
                        : [...prev.createdByIds, currentUser.id],
                    }));
                  }}
                  className="rounded border-[var(--border-subtle)]"
                />
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-200)] text-[10px] font-medium text-[var(--brand-default)]">
                  {currentUser.name?.charAt(0) ?? "?"}
                </span>
                <span>You</span>
              </label>
            )}
            {members
              .filter((m) =>
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
                      updateFilters((prev) => ({
                        ...prev,
                        createdByIds: prev.createdByIds.includes(m.member_id)
                          ? prev.createdByIds.filter((id) => id !== m.member_id)
                          : [...prev.createdByIds, m.member_id],
                      }));
                    }}
                    className="rounded border-[var(--border-subtle)]"
                  />
                  {m.member_avatar ? (
                    <img
                      src={m.member_avatar}
                      alt=""
                      className="size-5 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--bg-layer-2)] text-[10px] text-[var(--txt-secondary)]">
                      {(m.member_display_name ?? m.member_email ?? "?").charAt(
                        0,
                      )}
                    </span>
                  )}
                  <span className="truncate">
                    {m.member_display_name ?? m.member_email ?? m.member_id}
                  </span>
                </label>
              ))}
            <button
              type="button"
              className="px-3 py-1.5 text-left text-sm text-[var(--brand-default)] hover:underline"
            >
              View all
            </button>
          </CollapsibleSection>

          <CollapsibleSection
            title="Label"
            open={sectionOpen.label}
            onToggle={() => toggleSection("label")}
          >
            {allLabels.length === 0 ? (
              <p className="px-3 py-2 text-sm text-[var(--txt-tertiary)]">
                No labels in workspace. Add labels in a project to filter by
                them.
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
                        updateFilters((prev) => ({
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
                      updateFilters((prev) => ({
                        ...prev,
                        projectIds: prev.projectIds.includes(p.id)
                          ? prev.projectIds.filter((id) => id !== p.id)
                          : [...prev.projectIds, p.id],
                      }));
                    }}
                    className="rounded border-[var(--border-subtle)]"
                  />
                  <span className="text-[var(--txt-icon-tertiary)]">
                    <IconProject />
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
                    updateFilters((prev) => ({ ...prev, grouping: g }))
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
            {DATE_PRESETS.filter((d) =>
              filterSearch(DATE_PRESET_LABELS[d]),
            ).map((d) =>
              d === "custom" ? (
                <label
                  key={d}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]"
                  onClick={(e) => {
                    e.preventDefault();
                    onOpen(null);
                    setDateRangeModal("start");
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
                      updateFilters((prev) => ({
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
            {DATE_PRESETS.filter((d) =>
              filterSearch(DATE_PRESET_LABELS[d]),
            ).map((d) =>
              d === "custom" ? (
                <label
                  key={d}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]"
                  onClick={(e) => {
                    e.preventDefault();
                    onOpen(null);
                    setDateRangeModal("due");
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
                      updateFilters((prev) => ({
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
      </Dropdown>
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
            updateFilters((prev) => ({
              ...prev,
              startDate: prev.startDate.includes("custom")
                ? prev.startDate
                : [...prev.startDate, "custom"],
              startAfter: after,
              startBefore: before,
            }));
          } else {
            updateFilters((prev) => ({
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
