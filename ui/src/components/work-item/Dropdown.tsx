import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const DROPDOWN_Z_INDEX = 9999;

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
  disabled?: boolean;
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
  disabled = false,
}: DropdownProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    top: number;
    left?: number;
    right?: number;
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
    const rect = triggerRef.current.getBoundingClientRect();
    if (align === 'right') {
      setPosition({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    } else {
      setPosition({ top: rect.bottom + 4, left: rect.left });
    }
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const targetEl = target as HTMLElement | null;
      // If a modal is open (e.g. date-range picker), don't close the dropdown
      // when the user clicks inside the modal (modal is portaled to `body`).
      if (targetEl?.closest?.('[role="dialog"]')) return;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        onOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onOpen]);

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => onOpen(open ? null : id)}
        className={triggerClassName ?? defaultTriggerClass}
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
              'max-h-60 min-w-[140px] overflow-auto rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)'
            }
            style={{
              position: 'fixed',
              top: position.top,
              ...(position.left !== undefined && { left: position.left }),
              ...(position.right !== undefined && { right: position.right }),
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
