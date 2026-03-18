import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Button, Input, Avatar } from "./ui";
import { DateRangeModal } from "./workspace-views/DateRangeModal";
import { getImageUrl } from "../lib/utils";
import { workspaceService } from "../services/workspaceService";
import { moduleService } from "../services/moduleService";
import type { ModuleApiResponse, WorkspaceMemberApiResponse } from "../api/types";

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

export interface UpdateModuleModalProps {
  open: boolean;
  onClose: () => void;
  workspaceSlug: string;
  projectId: string;
  module: ModuleApiResponse | null;
  onUpdated?: (module: ModuleApiResponse) => void;
}

export function UpdateModuleModal({
  open,
  onClose,
  workspaceSlug,
  projectId,
  module,
  onUpdated,
}: UpdateModuleModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("backlog");
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);

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
    setError(null);
    setDateModalOpen(false);
    setStatusDropdownOpen(false);
  }, [open, module]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (statusRef.current?.contains(target)) return;
      setStatusDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const lead = useMemo(() => {
    if (!module?.lead_id) return null;
    const m = members.find((x) => x.member_id === module.lead_id);
    if (!m) return null;
    const name =
      m.member_display_name?.trim() ??
      m.member_email?.split("@")[0] ??
      m.member_id.slice(0, 8);
    return { name, avatarUrl: m.member_avatar ?? null };
  }, [members, module?.lead_id]);

  const statusLabel =
    MODULE_STATUSES.find((s) => s.id === status)?.label ?? status;

  const handleSubmit = async () => {
    if (!module || !workspaceSlug || !projectId) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await moduleService.update(workspaceSlug, projectId, module.id, {
        name: title.trim(),
        description: description.trim() || undefined,
        status,
        start_date: startDate,
        target_date: endDate,
      });
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

            <button
              type="button"
              className="flex items-center gap-2 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1 text-[13px] font-medium text-(--txt-secondary) opacity-60"
              title="Lead editing not available yet"
              disabled
            >
              {lead ? (
                <Avatar
                  name={lead.name}
                  src={getImageUrl(lead.avatarUrl) ?? undefined}
                  size="sm"
                  className="h-5 w-5 text-[10px]"
                />
              ) : (
                <span className="text-(--txt-icon-tertiary)" aria-hidden>
                  👤
                </span>
              )}
              Lead
            </button>
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

