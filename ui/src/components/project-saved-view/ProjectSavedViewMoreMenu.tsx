import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { viewService } from "../../services/viewService";
import { PROJECT_VIEWS_REFRESH_EVENT } from "../../lib/projectViewsEvents";

const IconEdit = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

const IconOpenTab = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" x2="21" y1="14" y2="3" />
  </svg>
);

const IconLink = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const IconTrash = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const IconMoreVertical = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden
  >
    <circle cx="12" cy="5" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="12" cy="19" r="1.5" />
  </svg>
);

export function ProjectSavedViewMoreMenu({
  workspaceSlug,
  projectId,
  viewId,
}: {
  workspaceSlug: string;
  projectId: string;
  viewId: string;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const baseUrl = `/${workspaceSlug}/projects/${projectId}`;
  const viewUrl = `${baseUrl}/views/${viewId}`;
  const fullUrl = `${window.location.origin}${viewUrl}`;

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const openEdit = () => {
    setOpen(false);
    void navigate(`${baseUrl}/views?edit=${encodeURIComponent(viewId)}`);
  };

  const openInNewTab = () => {
    setOpen(false);
    window.open(fullUrl, "_blank", "noopener,noreferrer");
  };

  const copyLink = async () => {
    setOpen(false);
    try {
      await navigator.clipboard.writeText(fullUrl);
    } catch {
      window.prompt("Copy link:", fullUrl);
    }
  };

  const deleteView = async () => {
    setOpen(false);
    if (!window.confirm("Delete this view? This cannot be undone.")) {
      return;
    }
    setBusy(true);
    try {
      await viewService.remove(workspaceSlug, viewId);
      window.dispatchEvent(new CustomEvent(PROJECT_VIEWS_REFRESH_EVENT));
      void navigate(`${baseUrl}/views`);
    } catch {
      window.alert("Could not delete this view. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        disabled={busy}
        className="flex size-8 items-center justify-center rounded-md border border-(--border-subtle) bg-(--bg-layer-2) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2-hover) disabled:opacity-50"
        aria-label="More options"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <IconMoreVertical />
      </button>
      {open ? (
        <div
          className="absolute right-0 z-50 mt-1.5 min-w-52 rounded-lg border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)"
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
            onClick={openEdit}
          >
            <span className="text-(--txt-icon-secondary)">
              <IconEdit />
            </span>
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
            onClick={openInNewTab}
          >
            <span className="text-(--txt-icon-secondary)">
              <IconOpenTab />
            </span>
            Open in new tab
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
            onClick={() => void copyLink()}
          >
            <span className="text-(--txt-icon-secondary)">
              <IconLink />
            </span>
            Copy link
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-(--txt-danger-primary) hover:bg-(--bg-danger-subtle)"
            onClick={() => void deleteView()}
          >
            <span className="text-(--txt-danger-primary)">
              <IconTrash />
            </span>
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}
