import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="absolute inset-0 bg-(--bg-backdrop)"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={cn(
          "relative z-10 w-full max-w-md rounded-(--radius-lg) border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-overlay)",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-(--border-subtle) px-5 py-4">
          <h2
            id="modal-title"
            className="text-lg font-semibold text-(--txt-primary)"
          >
            {title}
          </h2>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer != null && (
          <div className="flex justify-end gap-2 border-t border-(--border-subtle) px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
