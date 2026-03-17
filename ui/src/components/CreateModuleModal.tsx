import { useState, useEffect, useRef } from "react";
import { Modal, Button, Input, Avatar } from "./ui";
import { DateRangeModal } from "./workspace-views/DateRangeModal";
import { getImageUrl } from "../lib/utils";
import { moduleService } from "../services/moduleService";
import { workspaceService } from "../services/workspaceService";
import type { ModuleApiResponse } from "../api/types";
import type { WorkspaceMemberApiResponse } from "../api/types";

const MODULE_STATUSES = [
  { id: "backlog", label: "Backlog" },
  { id: "planned", label: "Planned" },
  { id: "in_progress", label: "In Progress" },
  { id: "paused", label: "Paused" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
] as const;

function formatDateRangeDisplay(
  start: string | null,
  end: string | null,
): string {
  if (!start && !end) return "Start date → End date";
  const fmt = (s: string) =>
    new Date(s).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  if (start && end) return `${fmt(start)} → ${fmt(end)}`;
  return start ? fmt(start) : end ? fmt(end) : "Start date → End date";
}

export interface CreateModuleModalProps {
  open: boolean;
  onClose: () => void;
  workspaceSlug: string;
  projectId: string;
  projectName: string;
  onCreated?: (module: ModuleApiResponse) => void;
}

export function CreateModuleModal({
  open,
  onClose,
  workspaceSlug,
  projectId,
  projectName,
  onCreated,
}: CreateModuleModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("backlog");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [leadDropdownOpen, setLeadDropdownOpen] = useState(false);
  const [membersDropdownOpen, setMembersDropdownOpen] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const [membersSearch, setMembersSearch] = useState("");
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const leadRef = useRef<HTMLDivElement>(null);
  const membersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !workspaceSlug) return;
    workspaceService
      .listMembers(workspaceSlug)
      .then((list) => setMembers(list ?? []))
      .catch(() => setMembers([]));
  }, [open, workspaceSlug]);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setDescription("");
      setStartDate(null);
      setEndDate(null);
      setStatus("backlog");
      setLeadId(null);
      setMemberIds([]);
      setError(null);
      setLeadSearch("");
      setMembersSearch("");
      setStatusDropdownOpen(false);
      setLeadDropdownOpen(false);
      setMembersDropdownOpen(false);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (statusRef.current?.contains(target)) return;
      if (leadRef.current?.contains(target)) return;
      if (membersRef.current?.contains(target)) return;
      setStatusDropdownOpen(false);
      setLeadDropdownOpen(false);
      setMembersDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const q = (s: string) => s.trim().toLowerCase();
  const filteredLead = members.filter((m) =>
    q(m.member_display_name ?? m.member_email ?? m.member_id).includes(
      q(leadSearch),
    ),
  );
  const filteredMembers = members.filter((m) =>
    q(m.member_display_name ?? m.member_email ?? m.member_id).includes(
      q(membersSearch),
    ),
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const created = await moduleService.create(workspaceSlug, projectId, {
        name: title.trim(),
        description: description.trim() || undefined,
        status: status || "backlog",
        start_date: startDate || undefined,
        target_date: endDate || undefined,
      });
      onClose();
      onCreated?.(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create module.");
    } finally {
      setSubmitting(false);
    }
  };

  const statusLabel =
    MODULE_STATUSES.find((s) => s.id === status)?.label ?? status;
  const leadMember = leadId
    ? members.find((m) => m.member_id === leadId)
    : null;
  const selectedMembers = memberIds
    .map((id) => members.find((m) => m.member_id === id))
    .filter(Boolean) as WorkspaceMemberApiResponse[];

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Create module"
        className="max-w-lg"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-module-form"
              disabled={submitting || !title.trim()}
            >
              Create Module
            </Button>
          </>
        }
      >
        <div className="mb-3 text-sm text-(--txt-secondary)">{projectName}</div>
        <form
          id="create-module-form"
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            autoFocus
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              rows={3}
              className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setDateModalOpen(true)}
              className="flex items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
            >
              <span className="text-(--txt-icon-tertiary)" aria-hidden>
                <CalendarIcon />
              </span>
              {formatDateRangeDisplay(startDate, endDate)}
            </button>

            <div className="relative" ref={statusRef}>
              <button
                type="button"
                onClick={() => setStatusDropdownOpen((o) => !o)}
                className="flex items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
              >
                <span className="text-(--txt-icon-tertiary)" aria-hidden>
                  <BacklogIcon />
                </span>
                {statusLabel}
                <ChevronDownIcon />
              </button>
              {statusDropdownOpen && (
                <div className="absolute left-0 top-full z-10 mt-1 min-w-[180px] rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)">
                  {MODULE_STATUSES.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setStatus(opt.id);
                        setStatusDropdownOpen(false);
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                    >
                      {opt.label}
                      {status === opt.id && (
                        <span className="text-(--txt-primary)">
                          <CheckIcon />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative" ref={leadRef}>
              <button
                type="button"
                onClick={() => setLeadDropdownOpen((o) => !o)}
                className="flex items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
              >
                {leadMember ? (
                  <Avatar
                    name={
                      leadMember.member_display_name ??
                      leadMember.member_email ??
                      leadMember.member_id
                    }
                    src={getImageUrl(leadMember.member_avatar) ?? undefined}
                    size="sm"
                    className="h-6 w-6 text-xs"
                  />
                ) : (
                  <LeadIcon />
                )}
                Lead
                <ChevronDownIcon />
              </button>
              {leadDropdownOpen && (
                <div className="absolute left-0 top-full z-10 mt-1 w-64 rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-1.5 shadow-(--shadow-raised)">
                  <div className="mb-1.5 flex items-center gap-2 rounded border border-(--border-subtle) bg-(--bg-layer-1) px-2 py-1.5">
                    <SearchIcon />
                    <input
                      type="text"
                      placeholder="Search"
                      value={leadSearch}
                      onChange={(e) => setLeadSearch(e.target.value)}
                      className="min-w-0 flex-1 bg-transparent text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {filteredLead.map((m) => (
                      <button
                        key={m.member_id}
                        type="button"
                        onClick={() => {
                          setLeadId(
                            leadId === m.member_id ? null : m.member_id,
                          );
                          setLeadDropdownOpen(false);
                        }}
                        className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                      >
                        <span className="flex items-center gap-2 truncate">
                          <Avatar
                            name={
                              m.member_display_name ??
                              m.member_email ??
                              m.member_id
                            }
                            src={getImageUrl(m.member_avatar) ?? undefined}
                            size="sm"
                            className="h-6 w-6 text-xs"
                          />
                          {m.member_display_name?.trim() ??
                            m.member_email ??
                            m.member_id.slice(0, 8)}
                        </span>
                        {leadId === m.member_id && <CheckIcon />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={membersRef}>
              <button
                type="button"
                onClick={() => setMembersDropdownOpen((o) => !o)}
                className="flex items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
              >
                <MembersIcon />
                Members
                {selectedMembers.length > 0 && (
                  <span className="flex -space-x-1.5">
                    {selectedMembers.map((m) => (
                      <Avatar
                        key={m.member_id}
                        name={
                          m.member_display_name ?? m.member_email ?? m.member_id
                        }
                        src={getImageUrl(m.member_avatar) ?? undefined}
                        size="sm"
                        className="h-6 w-6 border-2 border-(--bg-layer-2) text-xs"
                      />
                    ))}
                  </span>
                )}
                <ChevronDownIcon />
              </button>
              {membersDropdownOpen && (
                <div className="absolute left-0 top-full z-10 mt-1 w-64 rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-1.5 shadow-(--shadow-raised)">
                  <div className="mb-1.5 flex items-center gap-2 rounded border border-(--border-subtle) bg-(--bg-layer-1) px-2 py-1.5">
                    <SearchIcon />
                    <input
                      type="text"
                      placeholder="Search"
                      value={membersSearch}
                      onChange={(e) => setMembersSearch(e.target.value)}
                      className="min-w-0 flex-1 bg-transparent text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {filteredMembers.map((m) => {
                      const selected = memberIds.includes(m.member_id);
                      return (
                        <button
                          key={m.member_id}
                          type="button"
                          onClick={() => {
                            setMemberIds(
                              selected
                                ? memberIds.filter((id) => id !== m.member_id)
                                : [...memberIds, m.member_id],
                            );
                          }}
                          className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                        >
                          <span className="flex items-center gap-2 truncate">
                            <Avatar
                              name={
                                m.member_display_name ??
                                m.member_email ??
                                m.member_id
                              }
                              src={getImageUrl(m.member_avatar) ?? undefined}
                              size="sm"
                              className="h-6 w-6 text-xs"
                            />
                            {m.member_display_name?.trim() ??
                              m.member_email ??
                              m.member_id.slice(0, 8)}
                          </span>
                          {selected && <CheckIcon />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <p className="text-sm text-(--txt-danger-primary)">{error}</p>
          )}
        </form>
      </Modal>

      <DateRangeModal
        open={dateModalOpen}
        onClose={() => setDateModalOpen(false)}
        title="Start date → End date"
        after={startDate}
        before={endDate}
        onApply={(after, before) => {
          setStartDate(after);
          setEndDate(before);
          setDateModalOpen(false);
        }}
      />
    </>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function BacklogIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeDasharray="2 2"
      aria-hidden
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
    </svg>
  );
}
function ChevronDownIcon() {
  return (
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
}
function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="shrink-0 text-(--txt-icon-tertiary)"
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}
function LeadIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="text-(--txt-icon-tertiary)"
      aria-hidden
    >
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      <line x1="16" y1="11" x2="22" y2="11" />
      <line x1="19" y1="8" x2="19" y2="14" />
    </svg>
  );
}
function MembersIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="text-(--txt-icon-tertiary)"
      aria-hidden
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
