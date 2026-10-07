import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

/** The enter animation replayed on every navigation. */
const ENTER_CLASSES = [
  'motion-safe:animate-in',
  'motion-safe:fade-in-0',
  'motion-safe:slide-in-from-bottom-1',
  'motion-safe:duration-200',
  'motion-safe:ease-out',
];

interface PageTransitionProps {
  children: ReactNode;
}

/**
 * Fades the routed page in on navigation.
 *
 * The animation is replayed by restarting it on the same element rather than
 * by keying this wrapper on the pathname: a key would unmount the page on every
 * navigation, so moving between two work items would throw away the page's
 * state and refetch from scratch. Removing the classes, forcing a reflow, and
 * adding them back is what restarts a CSS animation on an element that stays
 * mounted.
 *
 * The `motion-safe:` prefix leaves the page static under
 * `prefers-reduced-motion: reduce` — the classes are still toggled, they just
 * resolve to nothing.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const { pathname } = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove(...ENTER_CLASSES);
    /* Reading a layout property flushes the removal, so the re-add below counts
       as a new animation instead of a no-op on a still-running one. */
    void el.offsetWidth;
    el.classList.add(...ENTER_CLASSES);
  }, [pathname]);

  return (
    <div ref={ref} className="flex min-w-0 flex-1 flex-col">
      {children}
    </div>
  );
}
