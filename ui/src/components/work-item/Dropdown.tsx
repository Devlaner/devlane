import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Must be above modal root (`z-10050`) so dropdowns work inside modals.
const DROPDOWN_Z_INDEX = 10100;
const VIEWPORT_PADDING = 8;
const PANEL_GAP = 4;

export interface DropdownProps {
  id: string;
  openId: string | null;
  onOpen: (id: string | null) => void;
  label: string;
  icon: React.ReactNode;
  displayValue: string;
  children: React.ReactNode;
  compact?: boolean;
  panelClassName?: string;
  /** When 'right', panel's right edge aligns with trigger's right edge (opens toward left). Default 'left'. */
  align?: 'left' | 'right';
  /** Optional class for the trigger button (e.g. table cell style: full width, hover only). */
  triggerClassName?: string;
  /** Optional custom trigger content (when set, icon and displayValue are ignored and this is rendered inside the trigger). */
  triggerContent?: React.ReactNode;
  /** Optional tooltip (native title) for trigger button. */
  triggerTitle?: string;
  /** Optional accessible name for trigger button. */
  triggerAriaLabel?: string;
  disabled?: boolean;
  /** When true, clicking elsewhere inside an open dialog still closes this dropdown. */
  allowDismissInsideDialog?: boolean;
}

export function Dropdown({
  id,
  openId,
  onOpen,
  label,
  icon,
  displayValue,
  children,
  compact = false,
  panelClassName,
  align = 'left',
  triggerClassName,
  triggerContent,
  triggerTitle,
  triggerAriaLabel,
  disabled = false,
  allowDismissInsideDialog = false,
}: DropdownProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    top: number;
    left?: number;
    right?: number;
    maxHeight?: number;
  } | null>(null);
  const open = openId === id;

  const defaultTriggerClass = compact
    ? 'inline-flex min-w-0 items-center gap-1 rounded border border-(--border-subtle) bg-(--bg-layer-2) px-1.5 py-1 text-xs text-(--txt-secondary) hover:bg-(--bg-layer-2-hover) [&_svg]:size-3'
    : 'inline-flex min-w-0 items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1.5 text-sm text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)';

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      // Intentional: clear position when dropdown closes (kept for future use)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPosition(null);
      return;
    }
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const panelRect = panelRef.current?.getBoundingClientRect();
    const panelHeight = panelRect?.height ?? 0;
    const panelWidth = panelRect?.width ?? 0;

    const availableBelow = window.innerHeight - triggerRect.bottom - VIEWPORT_PADDING - PANEL_GAP;
    const availableAbove = triggerRect.top - VIEWPORT_PADDING - PANEL_GAP;

    // Prefer opening below, but flip above when below space is tighter.
    let top = triggerRect.bottom + PANEL_GAP;
    if (panelHeight > 0 && availableBelow < panelHeight && availableAbove > availableBelow) {
      top = Math.max(VIEWPORT_PADDING, triggerRect.top - panelHeight - PANEL_GAP);
    }

    // Always constrain panel within viewport and allow internal scrolling.
    const maxHeight = Math.max(120, Math.max(availableBelow, availableAbove));

    if (align === 'right') {
      const unclampedRight = window.innerWidth - triggerRect.right;
      const maxRight = Math.max(
        VIEWPORT_PADDING,
        window.innerWidth - panelWidth - VIEWPORT_PADDING,
      );
      const right = Math.min(Math.max(unclampedRight, VIEWPORT_PADDING), maxRight);
      setPosition({ top, right, maxHeight });
    } else {
      const unclampedLeft = triggerRect.left;
      const maxLeft = Math.max(VIEWPORT_PADDING, window.innerWidth - panelWidth - VIEWPORT_PADDING);
      const left = Math.min(Math.max(unclampedLeft, VIEWPORT_PADDING), maxLeft);
      setPosition({ top, left, maxHeight });
    }
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const targetEl = target as HTMLElement | null;
      // If a modal is open (e.g. date-range picker), don't close the dropdown
      // when the user clicks inside the modal (modal is portaled to `body`).
      if (!allowDismissInsideDialog && targetEl?.closest?.('[role="dialog"]')) return;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        onOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onOpen, allowDismissInsideDialog]);

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => onOpen(open ? null : id)}
        className={triggerClassName ?? defaultTriggerClass}
        title={triggerTitle}
        aria-label={triggerAriaLabel}
      >
        {triggerContent ?? (
          <>
            <span className="shrink-0 text-(--txt-icon-tertiary)">{icon}</span>
            <span className="truncate">{displayValue || label}</span>
          </>
        )}
      </button>
      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            className={
              panelClassName ??
              'max-h-60 min-w-35 overflow-auto rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)'
            }
            style={{
              position: 'fixed',
              top: position.top,
              ...(position.left !== undefined && { left: position.left }),
              ...(position.right !== undefined && { right: position.right }),
              ...(position.maxHeight !== undefined && { maxHeight: position.maxHeight }),
              zIndex: DROPDOWN_Z_INDEX,
            }}
          >
            {children}
          </div>,
          document.body,
        )}
    </div>
  );
}
