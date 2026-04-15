import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';

export type TooltipPlacement = 'top' | 'bottom';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  placement?: TooltipPlacement;
  /** Delay before showing (ms). */
  delayMs?: number;
  className?: string;
}

function computeStyle(el: HTMLElement, placement: TooltipPlacement): CSSProperties {
  const r = el.getBoundingClientRect();
  const gap = 8;
  if (placement === 'top') {
    return {
      position: 'fixed',
      left: r.left + r.width / 2,
      top: r.top - gap,
      transform: 'translate(-50%, -100%)',
      zIndex: 10_000,
    };
  }
  return {
    position: 'fixed',
    left: r.left + r.width / 2,
    top: r.bottom + gap,
    transform: 'translateX(-50%)',
    zIndex: 10_000,
  };
}

function mergeDescribedBy(existing: string | null, token: string): string {
  const parts = (existing || '')
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.includes(token)) parts.push(token);
  return parts.join(' ');
}

function removeDescribedBy(existing: string | null, token: string): string | null {
  const next = (existing || '')
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s && s !== token);
  return next.length ? next.join(' ') : null;
}

export function Tooltip({
  content,
  children,
  placement = 'bottom',
  delayMs = 150,
  className,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const id = useId();
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updatePosition = useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    setStyle(computeStyle(t, placement));
  }, [placement]);

  const clearDelay = useCallback(() => {
    if (delayRef.current) {
      clearTimeout(delayRef.current);
      delayRef.current = null;
    }
  }, []);

  const openNow = useCallback(() => {
    updatePosition();
    setOpen(true);
  }, [updatePosition]);

  const show = useCallback(() => {
    clearDelay();
    if (delayMs > 0) {
      delayRef.current = setTimeout(openNow, delayMs);
    } else {
      openNow();
    }
  }, [clearDelay, delayMs, openNow]);

  const hide = useCallback(() => {
    clearDelay();
    setOpen(false);
    setStyle(null);
  }, [clearDelay]);

  const hideIfLeavingTrigger = useCallback(
    (e: FocusEvent<HTMLElement>) => {
      const next = e.relatedTarget as Node | null;
      if (next && e.currentTarget.contains(next)) return;
      hide();
    },
    [hide],
  );

  useEffect(() => () => clearDelay(), [clearDelay]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onScroll = () => updatePosition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    const root = triggerRef.current;
    if (!root) return;
    const focusable = root.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable) return;

    if (open) {
      const next = mergeDescribedBy(focusable.getAttribute('aria-describedby'), id);
      focusable.setAttribute('aria-describedby', next);
      return;
    }

    const next = removeDescribedBy(focusable.getAttribute('aria-describedby'), id);
    if (next) {
      focusable.setAttribute('aria-describedby', next);
    } else {
      focusable.removeAttribute('aria-describedby');
    }
  }, [open, id]);

  return (
    <>
      <span
        ref={triggerRef}
        className="inline-flex max-w-full"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocusCapture={show}
        onBlurCapture={hideIfLeavingTrigger}
        aria-describedby={open ? id : undefined}
      >
        {children}
      </span>
      {open &&
        style &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            style={style}
            className={cn(
              'pointer-events-none max-w-xs rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-layer-1) px-2.5 py-1.5 text-xs leading-snug text-(--txt-primary) shadow-(--shadow-raised)',
              className,
            )}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}
