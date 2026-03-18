import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";

const IconExternal = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);
const IconLink = () => (
  <svg
    width="14"
    height="14"
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
const IconMoreVertical = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="19" r="1" />
  </svg>
);

const DROPDOWN_Z_INDEX = 9999;

export function WorkspaceViewsEllipsisMenu() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    top: number;
    right: number;
  } | null>(null);

  const fullUrl =
    typeof window !== "undefined"
      ? window.location.href
      : `${location.pathname}${location.search}`;

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      queueMicrotask(() => setPosition(null));
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    queueMicrotask(() =>
      setPosition({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      }),
    );
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleOpenInNewTab = () => {
    window.open(fullUrl, "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setOpen(false);
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex size-8 items-center justify-center rounded-md border border-transparent text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2) hover:text-(--txt-icon-secondary)"
        aria-label="More options"
      >
        <IconMoreVertical />
      </button>
      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            className="min-w-[180px] rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)"
            style={{
              position: "fixed",
              top: position.top,
              right: position.right,
              zIndex: DROPDOWN_Z_INDEX,
            }}
          >
            <button
              type="button"
              onClick={handleOpenInNewTab}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
            >
              <span className="text-(--txt-icon-tertiary)">
                <IconExternal />
              </span>
              Open in new tab
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
            >
              <span className="text-(--txt-icon-tertiary)">
                <IconLink />
              </span>
              Copy link
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
