import { useEffect, useRef, useState } from "react";
import { Modal, Button, Input, Avatar } from "./ui";
import { DateRangeModal } from "./workspace-views/DateRangeModal";
import { getImageUrl } from "../lib/utils";
import { workspaceService } from "../services/workspaceService";
import { moduleService } from "../services/moduleService";
import type {
  ModuleApiResponse,
  WorkspaceMemberApiResponse,
} from "../api/types";
import { formatISODateDisplay } from "../lib/dateOnly";

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
  if (start && end)
    return `${formatISODateDisplay(start)} → ${formatISODateDisplay(end)}`;
  return start
    ? formatISODateDisplay(start)
    : end
      ? formatISODateDisplay(end)
      : "Start date → End date";
}

export interface UpdateModuleModalProps {
  open: boolean;
  onClose: () => void;
  workspaceSlug: string;
  projectId: string;
  module: ModuleApiResponse | null;
  onUpdated?: (module: ModuleApiResponse) => void;
  openDatePickerOnOpen?: boolean;
}

export function UpdateModuleModal({
  open,
  onClose,
  workspaceSlug,
  projectId,
  module,
  onUpdated,
  openDatePickerOnOpen,
}: UpdateModuleModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("backlog");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [leadDropdownOpen, setLeadDropdownOpen] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const leadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    workspaceService
      .listMembers(workspaceSlug)
      .then((list) => setMembers(list ?? []))
      .catch(() => setMembers([]));
  }, [open, workspaceSlug]);

  useEffect(() => {
    if (!open || !module) return;
    setTitle(module.name ?? "");
    setDescription(module.description ?? "");
    setStartDate(module.start_date ?? null);
    setEndDate(module.target_date ?? null);
    setStatus(module.status ?? "backlog");
    setLeadId(module.lead_id ?? null);
    setLeadSearch("");
    setError(null);
    setDateModalOpen(Boolean(openDatePickerOnOpen));
    setStatusDropdownOpen(false);
    setLeadDropdownOpen(false);
  }, [open, module, openDatePickerOnOpen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (statusRef.current?.contains(target)) return;
      if (leadRef.current?.contains(target)) return;
      setStatusDropdownOpen(false);
      setLeadDropdownOpen(false);
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
  const leadMember = leadId
    ? (members.find((m) => m.member_id === leadId) ?? null)
    : null;

  const statusLabel =
    MODULE_STATUSES.find((s) => s.id === status)?.label ?? status;

  const handleSubmit = async () => {
    if (!module || !workspaceSlug || !projectId) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await moduleService.update(
        workspaceSlug,
        projectId,
        module.id,
        {
          name: title.trim(),
          description: description.trim() || undefined,
          status,
          start_date: startDate,
          target_date: endDate,
          // backend treats "" as clear lead
          lead_id: leadId ?? "",
        },
      );
      onUpdated?.(updated);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update module");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Update module"
        className="max-w-3xl"
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !module}>
              Update Module
            </Button>
          </>
        }
      >
        {error && (
          <p className="mb-3 text-sm text-(--txt-danger-primary)">{error}</p>
        )}
        <div className="space-y-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Module name"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            className="min-h-24 w-full resize-none rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
          />

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setDateModalOpen(true)}
              className="flex items-center gap-2 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
            >
              <span className="text-(--txt-icon-tertiary)" aria-hidden>
                📅
              </span>
              {formatDateRangeDisplay(startDate, endDate)}
            </button>

            <div className="relative" ref={statusRef}>
              <button
                type="button"
                onClick={() => setStatusDropdownOpen((v) => !v)}
                className="flex items-center gap-2 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
              >
                <span className="text-(--txt-icon-tertiary)" aria-hidden>
                  ⏺
                </span>
                {statusLabel}
                <span className="text-(--txt-icon-tertiary)" aria-hidden>
                  ▾
                </span>
              </button>
              {statusDropdownOpen && (
                <div className="absolute left-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)">
                  {MODULE_STATUSES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                      onClick={() => {
                        setStatus(s.id);
                        setStatusDropdownOpen(false);
                      }}
                    >
                      {s.label}
                      {s.id === status && (
                        <span className="text-(--txt-icon-tertiary)">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative" ref={leadRef}>
              <button
                type="button"
                onClick={() => setLeadDropdownOpen((v) => !v)}
                className="flex items-center gap-2 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
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
                    className="h-5 w-5 text-[10px]"
                  />
                ) : (
                  <span className="text-(--txt-icon-tertiary)" aria-hidden>
                    👤
                  </span>
                )}
                Lead
                <span className="text-(--txt-icon-tertiary)" aria-hidden>
                  ▾
                </span>
              </button>
              {leadDropdownOpen && (
                <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-1.5 shadow-(--shadow-raised)">
                  <div className="mb-1.5 flex items-center gap-2 rounded border border-(--border-subtle) bg-(--bg-layer-1) px-2 py-1.5">
                    <span className="text-(--txt-icon-tertiary)" aria-hidden>
                      🔎
                    </span>
                    <input
                      type="text"
                      placeholder="Search"
                      value={leadSearch}
                      onChange={(e) => setLeadSearch(e.target.value)}
                      className="min-w-0 flex-1 bg-transparent text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setLeadId(null);
                        setLeadDropdownOpen(false);
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                    >
                      <span className="truncate">No lead</span>
                      {leadId === null && (
                        <span className="text-(--txt-icon-tertiary)">✓</span>
                      )}
                    </button>
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
                        {leadId === m.member_id && (
                          <span className="text-(--txt-icon-tertiary)">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      <DateRangeModal
        open={dateModalOpen}
        onClose={() => setDateModalOpen(false)}
        title="Date range"
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
