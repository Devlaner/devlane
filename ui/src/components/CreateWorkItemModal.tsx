import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Input } from "./ui";
import { Dropdown, DatePickerTrigger, SelectParentModal } from "./work-item";
import { stateService } from "../services/stateService";
import { labelService } from "../services/labelService";
import { issueService } from "../services/issueService";
import { cycleService } from "../services/cycleService";
import { moduleService } from "../services/moduleService";
import { workspaceService } from "../services/workspaceService";
import type {
  StateApiResponse,
  LabelApiResponse,
  IssueApiResponse,
  ProjectApiResponse,
} from "../api/types";
import type { Priority } from "../types";

const IconCog = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconCircleSlash = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="m4.9 4.9 14.2 14.2" />
  </svg>
);
const IconUsers = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const IconTag = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
  </svg>
);
const IconCalendar = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const IconCycle = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);
const IconGrid = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect width="7" height="7" x="3" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="14" rx="1" />
    <rect width="7" height="7" x="3" y="14" rx="1" />
  </svg>
);
const IconLink2 = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);
const IconTruck = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
    <path d="M15 18h2" />
    <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
  </svg>
);
const IconBuilding = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
    <path d="M9 22v-4h6v4" />
    <path d="M8 6h.01" />
    <path d="M16 6h.01" />
    <path d="M12 6h.01" />
    <path d="M12 10h.01" />
    <path d="M12 14h.01" />
    <path d="M16 10h.01" />
    <path d="M8 10h.01" />
    <path d="M8 14h.01" />
    <path d="M16 14h.01" />
  </svg>
);

const PRIORITIES: Priority[] = ["urgent", "high", "medium", "low", "none"];

export interface CreateWorkItemModalProps {
  open: boolean;
  onClose: () => void;
  workspaceSlug: string;
  projects: ProjectApiResponse[];
  defaultProjectId?: string;
  createError?: string | null;
  onSave?: (data: {
    title: string;
    description: string;
    projectId: string;
    stateId?: string;
    priority?: Priority;
    assigneeId?: string | null;
    assigneeIds?: string[];
    labelIds?: string[];
    startDate?: string;
    dueDate?: string;
    cycleId?: string | null;
    moduleId?: string | null;
    parentId?: string | null;
  }) => void;
}

export function CreateWorkItemModal({
  open,
  onClose,
  workspaceSlug,
  projects,
  defaultProjectId,
  createError,
  onSave,
}: CreateWorkItemModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState(
    defaultProjectId ?? projects[0]?.id ?? "",
  );
  const [createMore, setCreateMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const [stateId, setStateId] = useState<string>("");
  const [priority, setPriority] = useState<Priority>("none");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [cycleId, setCycleId] = useState<string | null>(null);
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [parentModalOpen, setParentModalOpen] = useState(false);

  const [projectSearch, setProjectSearch] = useState("");
  const [stateSearch, setStateSearch] = useState("");
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [labelSearch, setLabelSearch] = useState("");
  const [cycleSearch, setCycleSearch] = useState("");
  const [moduleSearch, setModuleSearch] = useState("");
  const [createLabelLoading, setCreateLabelLoading] = useState(false);
  const [createLabelError, setCreateLabelError] = useState<string | null>(null);

  useEffect(() => {
    if (!openDropdown) {
      setProjectSearch("");
      setStateSearch("");
      setAssigneeSearch("");
      setLabelSearch("");
      setCycleSearch("");
      setModuleSearch("");
      setCreateLabelError(null);
    }
  }, [openDropdown]);

  const selectedProject =
    projects.find((p) => p.id === projectId) ?? projects[0];
  const pid = selectedProject?.id ?? "";

  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [labels, setLabels] = useState<LabelApiResponse[]>([]);
  const [issues, setIssues] = useState<IssueApiResponse[]>([]);
  const [cycles, setCycles] = useState<Array<{ id: string; name: string }>>([]);
  const [modules, setModules] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>(
    [],
  );

  useEffect(() => {
    if (!workspaceSlug || !pid) {
      setStates([]);
      setLabels([]);
      setIssues([]);
      setCycles([]);
      setModules([]);
      return;
    }
    let cancelled = false;
    Promise.all([
      stateService.list(workspaceSlug, pid),
      labelService.list(workspaceSlug, pid),
      issueService.list(workspaceSlug, pid, { limit: 100 }),
      cycleService.list(workspaceSlug, pid),
      moduleService.list(workspaceSlug, pid),
    ])
      .then(([st, lab, iss, cy, mod]) => {
        if (!cancelled) {
          setStates(st ?? []);
          setLabels(lab ?? []);
          setIssues(iss ?? []);
          setCycles((cy ?? []).map((c) => ({ id: c.id, name: c.name })));
          setModules((mod ?? []).map((m) => ({ id: m.id, name: m.name })));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStates([]);
          setLabels([]);
          setIssues([]);
          setCycles([]);
          setModules([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, pid]);

  useEffect(() => {
    if (!workspaceSlug) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    workspaceService
      .listMembers(workspaceSlug)
      .then((list) => {
        if (cancelled) return;
        setMembers(
          (list ?? []).map((m) => ({
            id: m.member_id,
            name:
              (m.member_display_name && m.member_display_name.trim()) ||
              (m.member_email && m.member_email.split("@")[0]) ||
              "Member",
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  const stateName = stateId ? states.find((s) => s.id === stateId)?.name : "";
  const assigneeNames =
    assigneeIds
      .map((id) => members.find((m) => m.id === id)?.name ?? id.slice(0, 8))
      .filter(Boolean)
      .join(", ") || "";
  const labelNames =
    labelIds
      .map((id) => labels.find((l) => l.id === id)?.name)
      .filter(Boolean)
      .join(", ") || "";
  const cycleName = cycleId ? cycles.find((c) => c.id === cycleId)?.name : "";
  const moduleName = moduleId
    ? modules.find((m) => m.id === moduleId)?.name
    : "";
  const parentTitle = parentId
    ? issues.find((i) => i.id === parentId)?.name
    : "";

  const q = (s: string) => s.toLowerCase().trim();
  const filteredProjects = projects.filter((p) =>
    q(p.name).includes(q(projectSearch)),
  );
  const filteredStates = states.filter((s) =>
    q(s.name).includes(q(stateSearch)),
  );
  const filteredUsers = members.filter(
    (u) =>
      q(u.name).includes(q(assigneeSearch)) ||
      q(u.id).includes(q(assigneeSearch)),
  );
  const filteredLabels = labels.filter((l) =>
    q(l.name).includes(q(labelSearch)),
  );
  const filteredCycles = cycles.filter((c) =>
    q(c.name).includes(q(cycleSearch)),
  );
  const filteredModules = modules.filter((m) =>
    q(m.name).includes(q(moduleSearch)),
  );

  useEffect(() => {
    if (open) {
      setProjectId(defaultProjectId ?? projects[0]?.id ?? "");
      setTitle("");
      setDescription("");
      setStateId("");
      setPriority("none");
      setAssigneeIds([]);
      setLabelIds([]);
      setStartDate("");
      setDueDate("");
      setCycleId(null);
      setModuleId(null);
      setParentId(null);
      setOpenDropdown(null);
      setParentModalOpen(false);
    }
  }, [open, defaultProjectId, projects]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (parentModalOpen) setParentModalOpen(false);
        else if (openDropdown) setOpenDropdown(null);
        else onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose, openDropdown, parentModalOpen]);

  const handleSave = async () => {
    if (!title.trim()) return;
    if (onSave) {
      setSubmitting(true);
      try {
        await onSave({
          title,
          description,
          projectId,
          stateId: stateId || undefined,
          priority: priority !== "none" ? priority : undefined,
          assigneeIds: assigneeIds.length ? assigneeIds : undefined,
          assigneeId: assigneeIds[0] ?? undefined,
          labelIds: labelIds.length ? labelIds : undefined,
          startDate: startDate || undefined,
          dueDate: dueDate || undefined,
          cycleId: cycleId ?? undefined,
          moduleId: moduleId ?? undefined,
          parentId: parentId ?? undefined,
        });
        if (!createMore) onClose();
        else {
          setTitle("");
          setDescription("");
          setStateId("");
          setPriority("none");
          setAssigneeIds([]);
          setLabelIds([]);
          setStartDate("");
          setDueDate("");
          setCycleId(null);
          setModuleId(null);
          setParentId(null);
        }
      } finally {
        setSubmitting(false);
      }
    } else {
      if (!createMore) onClose();
      else {
        setTitle("");
        setDescription("");
        setStateId("");
        setPriority("none");
        setAssigneeIds([]);
        setLabelIds([]);
        setStartDate("");
        setDueDate("");
        setCycleId(null);
        setModuleId(null);
        setParentId(null);
      }
    }
  };

  const handleDiscard = () => {
    setTitle("");
    setDescription("");
    onClose();
  };

  const toggleLabel = (id: string) => {
    setLabelIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleCreateLabel = async () => {
    const name = labelSearch.trim();
    if (!name || !workspaceSlug || !pid) return;
    setCreateLabelError(null);
    setCreateLabelLoading(true);
    try {
      const created = await labelService.create(workspaceSlug, pid, { name });
      setLabels((prev) => [...prev, created]);
      setLabelIds((prev) => [...prev, created.id]);
      setLabelSearch("");
      setOpenDropdown(null);
    } catch (err) {
      setCreateLabelError(
        err instanceof Error ? err.message : "Failed to create label.",
      );
    } finally {
      setCreateLabelLoading(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-work-item-title"
      >
        <div
          className="absolute inset-0 bg-(--bg-backdrop)"
          onClick={onClose}
          aria-hidden
        />
        <div
          className="relative z-10 w-full max-w-4xl rounded-(--radius-lg) border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-overlay)"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-5 pt-5 pb-2">
            <h2
              id="create-work-item-title"
              className="text-xl font-bold text-(--txt-primary)"
            >
              Create new work item
            </h2>
            <div className="mt-2">
              <Dropdown
                id="project"
                openId={openDropdown}
                onOpen={setOpenDropdown}
                label="Select project"
                icon={
                  selectedProject?.name.includes("Logistics") ? (
                    <IconTruck />
                  ) : (
                    <IconBuilding />
                  )
                }
                displayValue={selectedProject?.name ?? ""}
                panelClassName="flex min-w-[160px] max-h-52 flex-col rounded border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-raised)"
              >
                <div className="sticky top-0 border-b border-(--border-subtle) bg-(--bg-surface-1) p-1.5">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    className="w-full rounded border border-(--border-subtle) bg-(--bg-surface-1) px-2 py-1 text-xs placeholder:text-(--txt-placeholder) focus:outline-none focus:border-(--border-strong)"
                  />
                </div>
                <div className="overflow-auto py-0.5 [&_button]:px-2 [&_button]:py-1 [&_button]:text-xs">
                  {filteredProjects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setProjectId(p.id);
                        setOpenDropdown(null);
                      }}
                      className="w-full text-left text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </Dropdown>
            </div>
          </div>

          <div className="px-5 py-4">
            <Input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mb-3 border-(--border-subtle)"
            />
            <textarea
              placeholder="Click to add description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="mb-4 w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none focus:border-(--border-strong)"
            />
            <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1">
              <Dropdown
                id="state"
                openId={openDropdown}
                onOpen={setOpenDropdown}
                label="Backlog"
                icon={<IconCog />}
                displayValue={stateName || "Backlog"}
                compact
                panelClassName="flex min-w-[120px] max-h-52 flex-col rounded border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-raised)"
              >
                <div className="sticky top-0 border-b border-(--border-subtle) bg-(--bg-surface-1) p-1.5">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={stateSearch}
                    onChange={(e) => setStateSearch(e.target.value)}
                    className="w-full rounded border border-(--border-subtle) bg-(--bg-surface-1) px-2 py-1 text-xs placeholder:text-(--txt-placeholder) focus:outline-none focus:border-(--border-strong)"
                  />
                </div>
                <div className="overflow-auto py-0.5 [&_button]:px-2 [&_button]:py-1 [&_button]:text-xs">
                  {filteredStates.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setStateId(s.id);
                        setOpenDropdown(null);
                      }}
                      className="w-full text-left text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </Dropdown>
              <Dropdown
                id="priority"
                openId={openDropdown}
                onOpen={setOpenDropdown}
                label="None"
                icon={<IconCircleSlash />}
                displayValue={
                  priority === "none"
                    ? "None"
                    : priority.charAt(0).toUpperCase() + priority.slice(1)
                }
                compact
                panelClassName="max-h-52 min-w-[110px] overflow-auto rounded border border-(--border-subtle) bg-(--bg-surface-1) py-0.5 shadow-(--shadow-raised) [&_button]:px-2 [&_button]:py-1 [&_button]:text-xs"
              >
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setPriority(p);
                      setOpenDropdown(null);
                    }}
                    className="w-full text-left capitalize text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                  >
                    {p}
                  </button>
                ))}
              </Dropdown>
              <Dropdown
                id="assignees"
                openId={openDropdown}
                onOpen={setOpenDropdown}
                label="Assignees"
                icon={<IconUsers />}
                displayValue={assigneeNames || "Add assignees"}
                compact
                panelClassName="flex min-w-[120px] max-h-52 flex-col rounded border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-raised)"
              >
                <div className="sticky top-0 border-b border-(--border-subtle) bg-(--bg-surface-1) p-1.5">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={assigneeSearch}
                    onChange={(e) => setAssigneeSearch(e.target.value)}
                    className="w-full rounded border border-(--border-subtle) bg-(--bg-surface-1) px-2 py-1 text-xs placeholder:text-(--txt-placeholder) focus:outline-none focus:border-(--border-strong)"
                  />
                </div>
                <div className="overflow-auto py-0.5 [&_button]:px-2 [&_button]:py-1 [&_button]:text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setAssigneeIds([]);
                      setOpenDropdown(null);
                    }}
                    className="w-full text-left text-(--txt-tertiary) hover:bg-(--bg-layer-1-hover)"
                  >
                    No assignee
                  </button>
                  {filteredUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() =>
                        setAssigneeIds((prev) =>
                          prev.includes(u.id)
                            ? prev.filter((x) => x !== u.id)
                            : [...prev, u.id],
                        )
                      }
                      className="w-full text-left text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                    >
                      {u.name} {assigneeIds.includes(u.id) ? "✓" : ""}
                    </button>
                  ))}
                </div>
              </Dropdown>
              <Dropdown
                id="labels"
                openId={openDropdown}
                onOpen={setOpenDropdown}
                label="Labels"
                icon={<IconTag />}
                displayValue={labelNames}
                compact
                panelClassName="flex min-w-[120px] max-h-52 flex-col rounded border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-raised)"
              >
                <div className="sticky top-0 border-b border-(--border-subtle) bg-(--bg-surface-1) p-1.5">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={labelSearch}
                    onChange={(e) => setLabelSearch(e.target.value)}
                    className="w-full rounded border border-(--border-subtle) bg-(--bg-surface-1) px-2 py-1 text-xs placeholder:text-(--txt-placeholder) focus:outline-none focus:border-(--border-strong)"
                  />
                </div>
                <div className="overflow-auto py-0.5 [&_button]:px-2 [&_button]:py-1 [&_button]:text-xs">
                  {filteredLabels.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => {
                        toggleLabel(l.id);
                      }}
                      className="w-full text-left text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                    >
                      {l.name}
                    </button>
                  ))}
                  {labelSearch.trim() &&
                    !labels.some(
                      (l) =>
                        l.name.toLowerCase() ===
                        labelSearch.trim().toLowerCase(),
                    ) && (
                      <>
                        <div className="my-1 border-t border-(--border-subtle)" />
                        <button
                          type="button"
                          onClick={handleCreateLabel}
                          disabled={createLabelLoading}
                          className="w-full text-left text-(--brand-default) hover:bg-(--bg-layer-1-hover) disabled:opacity-50"
                        >
                          {createLabelLoading
                            ? "Creating…"
                            : `Create label "${labelSearch.trim()}"`}
                        </button>
                        {createLabelError && (
                          <p className="px-2 py-1 text-xs text-red-600">
                            {createLabelError}
                          </p>
                        )}
                      </>
                    )}
                </div>
              </Dropdown>
              <DatePickerTrigger
                label="Start date"
                icon={<IconCalendar />}
                value={startDate}
                onChange={setStartDate}
                placeholder="Start date"
              />
              <DatePickerTrigger
                label="Due date"
                icon={<IconCalendar />}
                value={dueDate}
                onChange={setDueDate}
                placeholder="Due date"
              />
              <Dropdown
                id="cycle"
                openId={openDropdown}
                onOpen={setOpenDropdown}
                label="Cycle"
                icon={<IconCycle />}
                displayValue={cycleName || "No cycle"}
                compact
                panelClassName="flex min-w-[120px] max-h-52 flex-col rounded border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-raised)"
              >
                <div className="sticky top-0 border-b border-(--border-subtle) bg-(--bg-surface-1) p-1.5">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={cycleSearch}
                    onChange={(e) => setCycleSearch(e.target.value)}
                    className="w-full rounded border border-(--border-subtle) bg-(--bg-surface-1) px-2 py-1 text-xs placeholder:text-(--txt-placeholder) focus:outline-none focus:border-(--border-strong)"
                  />
                </div>
                <div className="overflow-auto py-0.5 [&_button]:px-2 [&_button]:py-1 [&_button]:text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setCycleId(null);
                      setOpenDropdown(null);
                    }}
                    className="w-full text-left text-(--txt-tertiary) hover:bg-(--bg-layer-1-hover)"
                  >
                    No cycle
                  </button>
                  {filteredCycles.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCycleId(c.id);
                        setOpenDropdown(null);
                      }}
                      className="w-full text-left text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </Dropdown>
              <Dropdown
                id="modules"
                openId={openDropdown}
                onOpen={setOpenDropdown}
                label="Modules"
                icon={<IconGrid />}
                displayValue={moduleName ?? ""}
                compact
                panelClassName="flex min-w-[120px] max-h-52 flex-col rounded border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-raised)"
              >
                <div className="sticky top-0 border-b border-(--border-subtle) bg-(--bg-surface-1) p-1.5">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={moduleSearch}
                    onChange={(e) => setModuleSearch(e.target.value)}
                    className="w-full rounded border border-(--border-subtle) bg-(--bg-surface-1) px-2 py-1 text-xs placeholder:text-(--txt-placeholder) focus:outline-none focus:border-(--border-strong)"
                  />
                </div>
                <div className="overflow-auto py-0.5 [&_button]:px-2 [&_button]:py-1 [&_button]:text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setModuleId(null);
                      setOpenDropdown(null);
                    }}
                    className="w-full text-left text-(--txt-tertiary) hover:bg-(--bg-layer-1-hover)"
                  >
                    No module
                  </button>
                  {filteredModules.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setModuleId(m.id);
                        setOpenDropdown(null);
                      }}
                      className="w-full text-left text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </Dropdown>
              <button
                type="button"
                onClick={() => setParentModalOpen(true)}
                className="inline-flex min-w-0 items-center gap-1 rounded border border-(--border-subtle) bg-(--bg-layer-2) px-1.5 py-1 text-xs text-(--txt-secondary) hover:bg-(--bg-layer-2-hover) [&_svg]:size-3"
              >
                <span className="shrink-0 text-(--txt-icon-tertiary)">
                  <IconLink2 />
                </span>
                <span className="truncate">{parentTitle || "Add parent"}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--border-subtle) px-5 py-4">
            <div className="flex flex-col gap-1">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-(--txt-secondary)">
                <span className="relative inline-flex h-5 w-9 shrink-0 rounded-full border border-(--border-subtle) bg-(--bg-layer-2) transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform after:content-[''] has-[:checked]:border-(--brand-default) has-[:checked]:bg-(--brand-default) has-[:checked]:after:translate-x-4">
                  <input
                    type="checkbox"
                    checked={createMore}
                    onChange={(e) => setCreateMore(e.target.checked)}
                    className="sr-only"
                  />
                </span>
                Create more
              </label>
              {createError && (
                <p className="text-sm text-(--txt-danger-primary)">
                  {createError}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={handleDiscard}
                disabled={submitting}
              >
                Discard
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={!title.trim() || submitting}
              >
                {submitting ? "Creating…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <SelectParentModal
        open={parentModalOpen}
        onClose={() => setParentModalOpen(false)}
        issues={issues.map((i) => ({ id: i.id, title: i.name }))}
        value={parentId}
        onChange={(id) => setParentId(id)}
      />
    </>,
    document.body,
  );
}
