import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { DateRangeModal } from "./DateRangeModal";
import { CollapsibleSection } from "./WorkspaceViewsFiltersShared";
import { DATE_PRESET_LABELS, FILTER_ICONS } from "./WorkspaceViewsFiltersData";
import { DATE_PRESETS } from "../../types/workspaceViewFilters";
import type { DatePreset } from "../../types/workspaceViewFilters";
import { Avatar } from "../ui";
import { getImageUrl } from "../../lib/utils";
import { workspaceService } from "../../services/workspaceService";
import type { WorkspaceMemberApiResponse } from "../../api/types";

export const MODULE_FILTER_PARAM = {
  favorites: "module_favorites",
  status: "module_status",
  lead: "module_lead",
  members: "module_members",
  start_date: "start_date",
  due_date: "due_date",
  start_after: "start_after",
  start_before: "start_before",
  due_after: "due_after",
  due_before: "due_before",
} as const;

const MODULE_STATUSES = [
  { id: "backlog", label: "Backlog" },
  { id: "planned", label: "Planned" },
  { id: "in_progress", label: "In Progress" },
  { id: "paused", label: "Paused" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
] as const;

function parseList(value: string | null): string[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function ModuleStatusIcon({ statusId }: { statusId: string }) {
  if (statusId === "backlog" || statusId === "planned") {
    return (
      <span
        className="flex size-4 shrink-0 items-center justify-center rounded border border-[var(--border-subtle)] border-dashed text-[var(--txt-icon-tertiary)]"
        aria-hidden
      >
        <span className="size-2 rounded-full border border-current border-dashed" />
      </span>
    );
  }
  if (statusId === "in_progress") {
    return (
      <span
        className="flex size-4 shrink-0 items-center justify-center text-amber-500"
        aria-hidden
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      </span>
    );
  }
  if (statusId === "paused") {
    return (
      <span
        className="flex size-4 shrink-0 items-center justify-center text-[var(--txt-icon-tertiary)]"
        aria-hidden
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="10" y1="8" x2="10" y2="16" />
          <line x1="14" y1="8" x2="14" y2="16" />
        </svg>
      </span>
    );
  }
  if (statusId === "completed") {
    return (
      <span
        className="flex size-4 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-green-600"
        aria-hidden
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    );
  }
  if (statusId === "cancelled") {
    return (
      <span
        className="flex size-4 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-500"
        aria-hidden
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </span>
    );
  }
  return null;
}

export interface ModuleFiltersPanelProps {
  workspaceSlug: string;
  /** When provided, called when user clicks Custom (start/due) so parent can close dropdown and show date modal */
  onOpenDateModal?: (which: "start" | "due") => void;
}

export function ModuleFiltersPanel({
  workspaceSlug,
  onOpenDateModal,
}: ModuleFiltersPanelProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [sectionOpen, setSectionOpen] = useState({
    favorites: true,
    status: true,
    lead: true,
    members: true,
    start_date: true,
    due_date: true,
  });

  useEffect(() => {
    if (!workspaceSlug) return;
    let cancelled = false;
    workspaceService
      .listMembers(workspaceSlug)
      .then((list) => {
        if (!cancelled) setMembers(list ?? []);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  const favorites = searchParams.get(MODULE_FILTER_PARAM.favorites) === "1";
  const statusList = parseList(searchParams.get(MODULE_FILTER_PARAM.status));
  const leadIds = parseList(searchParams.get(MODULE_FILTER_PARAM.lead));
  const memberIds = parseList(searchParams.get(MODULE_FILTER_PARAM.members));
  const startDateRaw =
    searchParams.get(MODULE_FILTER_PARAM.start_date)?.trim() ?? "";
  const startDateSelected: DatePreset | "" = DATE_PRESETS.includes(
    startDateRaw as DatePreset,
  )
    ? (startDateRaw as DatePreset)
    : "";
  const dueDateRaw =
    searchParams.get(MODULE_FILTER_PARAM.due_date)?.trim() ?? "";
  const dueDateSelected: DatePreset | "" = DATE_PRESETS.includes(
    dueDateRaw as DatePreset,
  )
    ? (dueDateRaw as DatePreset)
    : "";
  const startAfter =
    searchParams.get(MODULE_FILTER_PARAM.start_after)?.trim() ?? null;
  const startBefore =
    searchParams.get(MODULE_FILTER_PARAM.start_before)?.trim() ?? null;
  const dueAfter =
    searchParams.get(MODULE_FILTER_PARAM.due_after)?.trim() ?? null;
  const dueBefore =
    searchParams.get(MODULE_FILTER_PARAM.due_before)?.trim() ?? null;

  const toggleSection = (key: keyof typeof sectionOpen) => {
    setSectionOpen((s) => ({ ...s, [key]: !s[key] }));
  };

  const openDateModal = (which: "start" | "due") => {
    if (onOpenDateModal) {
      onOpenDateModal(which);
    }
  };

  const updateParams = (updater: (prev: URLSearchParams) => void) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      updater(next);
      return next;
    });
  };

  const filterSearch = (label: string) =>
    !search.trim() || label.toLowerCase().includes(search.trim().toLowerCase());

  const q = (s: string) => s.trim().toLowerCase();
  const filteredMembers = members.filter((m) =>
    q(m.member_display_name ?? m.member_email ?? m.member_id).includes(
      q(search),
    ),
  );
  const displayName = (m: WorkspaceMemberApiResponse) =>
    m.member_display_name?.trim() ?? m.member_email ?? m.member_id.slice(0, 12);

  return (
    <>
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
      <div
        className="min-h-0 flex-1 overflow-y-auto py-1"
        style={{ maxHeight: "min(70vh, 28rem)" }}
      >
        <CollapsibleSection
          title="Favorites"
          open={sectionOpen.favorites}
          onToggle={() => toggleSection("favorites")}
        >
          <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]">
            <input
              type="checkbox"
              checked={favorites}
              onChange={() => {
                updateParams((next) => {
                  if (next.get(MODULE_FILTER_PARAM.favorites) === "1")
                    next.delete(MODULE_FILTER_PARAM.favorites);
                  else next.set(MODULE_FILTER_PARAM.favorites, "1");
                });
              }}
              className="rounded border-[var(--border-subtle)]"
            />
            <span>Favorites</span>
          </label>
        </CollapsibleSection>

        <CollapsibleSection
          title="Status"
          open={sectionOpen.status}
          onToggle={() => toggleSection("status")}
        >
          {MODULE_STATUSES.filter((s) => filterSearch(s.label)).map((s) => (
            <label
              key={s.id}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]"
            >
              <input
                type="checkbox"
                checked={statusList.includes(s.id)}
                onChange={() => {
                  updateParams((next) => {
                    const nextList = statusList.includes(s.id)
                      ? statusList.filter((x) => x !== s.id)
                      : [...statusList, s.id];
                    if (nextList.length)
                      next.set(MODULE_FILTER_PARAM.status, nextList.join(","));
                    else next.delete(MODULE_FILTER_PARAM.status);
                  });
                }}
                className="rounded border-[var(--border-subtle)]"
              />
              <ModuleStatusIcon statusId={s.id} />
              <span>{s.label}</span>
            </label>
          ))}
        </CollapsibleSection>

        <CollapsibleSection
          title="Lead"
          open={sectionOpen.lead}
          onToggle={() => toggleSection("lead")}
        >
          {filteredMembers.slice(0, 8).map((m) => (
            <label
              key={m.member_id}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]"
            >
              <input
                type="checkbox"
                checked={leadIds.includes(m.member_id)}
                onChange={() => {
                  updateParams((next) => {
                    const nextList = leadIds.includes(m.member_id)
                      ? leadIds.filter((id) => id !== m.member_id)
                      : [...leadIds, m.member_id];
                    if (nextList.length)
                      next.set(MODULE_FILTER_PARAM.lead, nextList.join(","));
                    else next.delete(MODULE_FILTER_PARAM.lead);
                  });
                }}
                className="rounded border-[var(--border-subtle)]"
              />
              <Avatar
                name={displayName(m)}
                src={getImageUrl(m.member_avatar) ?? undefined}
                size="sm"
                className="h-6 w-6 shrink-0 text-xs"
              />
              <span className="truncate">{displayName(m)}</span>
            </label>
          ))}
          {filteredMembers.length > 8 && (
            <button
              type="button"
              className="px-3 py-1.5 text-left text-sm text-[var(--brand-default)] hover:underline"
            >
              View all
            </button>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title="Members"
          open={sectionOpen.members}
          onToggle={() => toggleSection("members")}
        >
          {filteredMembers.slice(0, 8).map((m) => (
            <label
              key={m.member_id}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]"
            >
              <input
                type="checkbox"
                checked={memberIds.includes(m.member_id)}
                onChange={() => {
                  updateParams((next) => {
                    const nextList = memberIds.includes(m.member_id)
                      ? memberIds.filter((id) => id !== m.member_id)
                      : [...memberIds, m.member_id];
                    if (nextList.length)
                      next.set(MODULE_FILTER_PARAM.members, nextList.join(","));
                    else next.delete(MODULE_FILTER_PARAM.members);
                  });
                }}
                className="rounded border-[var(--border-subtle)]"
              />
              <Avatar
                name={displayName(m)}
                src={getImageUrl(m.member_avatar) ?? undefined}
                size="sm"
                className="h-6 w-6 shrink-0 text-xs"
              />
              <span className="truncate">{displayName(m)}</span>
            </label>
          ))}
          {filteredMembers.length > 8 && (
            <button
              type="button"
              className="px-3 py-1.5 text-left text-sm text-[var(--brand-default)] hover:underline"
            >
              View all
            </button>
          )}
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
                    e.stopPropagation();
                    if (startDateSelected === "custom") {
                      updateParams((next) => {
                        next.delete(MODULE_FILTER_PARAM.start_date);
                        next.delete(MODULE_FILTER_PARAM.start_after);
                        next.delete(MODULE_FILTER_PARAM.start_before);
                      });
                    } else {
                      openDateModal("start");
                    }
                  }}
                >
                  <input
                    type="radio"
                    name="start_date_filter"
                    checked={startDateSelected === "custom"}
                    readOnly
                    tabIndex={-1}
                    className="border-[var(--border-subtle)]"
                  />
                  <span>{DATE_PRESET_LABELS[d]}</span>
                </label>
              ) : (
                <label
                  key={d}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]"
                >
                  <input
                    type="radio"
                    name="start_date_filter"
                    checked={startDateSelected === d}
                    onChange={() => {
                      updateParams((next) => {
                        if (startDateSelected === d) {
                          next.delete(MODULE_FILTER_PARAM.start_date);
                          next.delete(MODULE_FILTER_PARAM.start_after);
                          next.delete(MODULE_FILTER_PARAM.start_before);
                        } else {
                          next.set(MODULE_FILTER_PARAM.start_date, d);
                          next.delete(MODULE_FILTER_PARAM.start_after);
                          next.delete(MODULE_FILTER_PARAM.start_before);
                        }
                      });
                    }}
                    className="border-[var(--border-subtle)]"
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
                    e.stopPropagation();
                    if (dueDateSelected === "custom") {
                      updateParams((next) => {
                        next.delete(MODULE_FILTER_PARAM.due_date);
                        next.delete(MODULE_FILTER_PARAM.due_after);
                        next.delete(MODULE_FILTER_PARAM.due_before);
                      });
                    } else {
                      openDateModal("due");
                    }
                  }}
                >
                  <input
                    type="radio"
                    name="due_date_filter"
                    checked={dueDateSelected === "custom"}
                    readOnly
                    tabIndex={-1}
                    className="border-[var(--border-subtle)]"
                  />
                  <span>{DATE_PRESET_LABELS[d]}</span>
                </label>
              ) : (
                <label
                  key={d}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]"
                >
                  <input
                    type="radio"
                    name="due_date_filter"
                    checked={dueDateSelected === d}
                    onChange={() => {
                      updateParams((next) => {
                        if (dueDateSelected === d) {
                          next.delete(MODULE_FILTER_PARAM.due_date);
                          next.delete(MODULE_FILTER_PARAM.due_after);
                          next.delete(MODULE_FILTER_PARAM.due_before);
                        } else {
                          next.set(MODULE_FILTER_PARAM.due_date, d);
                          next.delete(MODULE_FILTER_PARAM.due_after);
                          next.delete(MODULE_FILTER_PARAM.due_before);
                        }
                      });
                    }}
                    className="border-[var(--border-subtle)]"
                  />
                  <span>{DATE_PRESET_LABELS[d]}</span>
                </label>
              ),
          )}
        </CollapsibleSection>
      </div>

      {/* Date range modal is rendered in PageHeader when onOpenDateModal is used, so it stays visible after dropdown closes */}
    </>
  );
}
