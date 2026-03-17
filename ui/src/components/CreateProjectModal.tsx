import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Input } from "./ui";
import { CoverImageModal } from "./CoverImageModal";
import {
  ProjectIconDisplay,
  ProjectIconModal,
  type ProjectIconSelection,
} from "./ProjectIconModal";
import { projectService } from "../services/projectService";
import type {
  ProjectApiResponse,
  WorkspaceMemberApiResponse,
} from "../api/types";
import { useAuth } from "../contexts/AuthContext";
import { workspaceService } from "../services/workspaceService";
import { ProjectNetworkSelect } from "./ProjectNetworkSelect";
import { ProjectLeadSelect } from "./ProjectLeadSelect";

export interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  workspaceSlug: string;
  onSuccess?: (project: ProjectApiResponse) => void;
}

const COVER_GRADIENTS = [
  "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)",
  "linear-gradient(135deg, #0ea5e9 0%, #38bdf8 50%, #7dd3fc 100%)",
  "linear-gradient(135deg, #10b981 0%, #34d399 50%, #6ee7b7 100%)",
  "linear-gradient(135deg, #f59e0b 0%, #fbbf24 50%, #fcd34d 100%)",
  "linear-gradient(135deg, #ec4899 0%, #f472b6 50%, #f9a8d4 100%)",
];

const IconInfo = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);

const IconX = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

export function CreateProjectModal({
  open,
  onClose,
  workspaceSlug,
  onSuccess,
}: CreateProjectModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState<string | null>(null);
  const [iconProp, setIconProp] =
    useState<ProjectIconSelection["icon_prop"]>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [network, setNetwork] = useState<"public" | "private">("public");
  const [projectLeadId, setProjectLeadId] = useState<string | null>(null);
  const [workspaceMembers, setWorkspaceMembers] = useState<
    WorkspaceMemberApiResponse[]
  >([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [coverModalOpen, setCoverModalOpen] = useState(false);
  const [iconModalOpen, setIconModalOpen] = useState(false);

  const handleClose = () => {
    setName("");
    setIdentifier("");
    setDescription("");
    setEmoji(null);
    setIconProp(null);
    setCoverImage(null);
    setNetwork("public");
    setProjectLeadId(null);
    setError("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Project name is required.");
      return;
    }
    setSubmitting(true);
    try {
      const payload: Parameters<typeof projectService.create>[1] = {
        name: name.trim(),
        identifier: identifier.trim() || undefined,
        description: description.trim() || undefined,
        cover_image: coverImage || undefined,
        emoji: emoji ?? undefined,
        icon_prop: iconProp ?? undefined,
        guest_view_all_features: network === "public" ? true : undefined,
        project_lead_id: projectLeadId ?? undefined,
      };

      const project = await projectService.create(workspaceSlug, payload);
      onSuccess?.(project);
      handleClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create project.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    // Load workspace members for project lead dropdown
    workspaceService
      .listMembers(workspaceSlug)
      .then((members) => setWorkspaceMembers(members))
      .catch(() => {
        // ignore for create modal; dropdown will just be empty
      });

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose, workspaceSlug]);

  if (!open) return null;

  const coverStyle =
    coverImage != null
      ? {
          backgroundImage: `url(${coverImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : {
          background: COVER_GRADIENTS[0],
        };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-project-modal-title"
    >
      <h2 id="create-project-modal-title" className="sr-only">
        Create project
      </h2>
      <div
        className="absolute inset-0 bg-(--bg-backdrop)"
        onClick={handleClose}
        aria-hidden
      />
      <div
        className="relative z-10 w-full max-w-2xl overflow-hidden rounded-(--radius-lg) border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-overlay)"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cover + Close */}
        <div className="relative h-36 w-full shrink-0" style={coverStyle}>
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-black/20 text-white hover:bg-black/30 focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label="Close"
          >
            <IconX />
          </button>
          <button
            type="button"
            onClick={() => setCoverModalOpen(true)}
            className="absolute bottom-3 right-3 rounded-md bg-white/20 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur-sm hover:bg-white/30"
          >
            Choose image
          </button>
        </div>

        {/* Icon overlapping cover */}
        <div className="px-5 -mt-6 relative z-10">
          <button
            type="button"
            onClick={() => setIconModalOpen(true)}
            className="flex size-12 items-center justify-center rounded-lg border-2 border-(--bg-surface-1) bg-(--bg-layer-2) text-2xl shadow-sm hover:bg-(--bg-layer-transparent-hover) focus:outline-none focus:ring-2 focus:ring-(--border-strong)"
            aria-label="Change project icon"
          >
            <ProjectIconDisplay
              emoji={emoji ?? undefined}
              icon_prop={iconProp ?? undefined}
              size={24}
            />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 pb-5 pt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Project name"
                required
                autoFocus
                disabled={submitting}
                className="w-full"
              />
            </div>
            <div className="relative">
              <Input
                value={identifier}
                onChange={(e) =>
                  setIdentifier(
                    e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""),
                  )
                }
                placeholder="e.g. PROJ"
                disabled={submitting}
                className="w-full pr-9"
              />
              <span
                className="absolute right-3 top-9 text-(--txt-icon-tertiary)"
                title="Short identifier used in issue IDs (e.g. PROJ-123)"
              >
                <IconInfo />
              </span>
            </div>
          </div>
          <div className="mt-4">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              rows={3}
              disabled={submitting}
              className="min-h-[72px] w-full resize-y rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none focus:ring-2 focus:ring-(--border-strong)"
            />
          </div>

          {/* Network + Project Lead (under description, side by side) */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ProjectNetworkSelect
              value={network}
              onChange={setNetwork}
              disabled={submitting}
            />
            <ProjectLeadSelect
              value={projectLeadId}
              members={workspaceMembers}
              onChange={setProjectLeadId}
              disabled={submitting || !user}
            />
          </div>

          {error && (
            <p className="mt-3 text-sm text-(--txt-danger-primary)">{error}</p>
          )}

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-2 border-t border-(--border-subtle) pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? "Creating…" : "Create project"}
            </Button>
          </div>
        </form>

        {/* Cover and icon selection modals (reused from settings) */}
        <CoverImageModal
          open={coverModalOpen}
          onClose={() => setCoverModalOpen(false)}
          onSelect={(url) => {
            setCoverImage(url);
            setCoverModalOpen(false);
          }}
          title="Select project cover"
        />
        <ProjectIconModal
          open={iconModalOpen}
          onClose={() => setIconModalOpen(false)}
          onSelect={(selection) => {
            if (selection.emoji != null) {
              setEmoji(selection.emoji);
              setIconProp(null);
            } else {
              setEmoji(null);
              setIconProp(selection.icon_prop ?? null);
            }
            setIconModalOpen(false);
          }}
          title="Project icon"
        />
      </div>
    </div>,
    document.body,
  );
}
