import { useEffect, useState } from 'react';
import { intakeService } from '../../services/intakeService';
import { INTAKE_UPDATED_EVENT } from '../../lib/intakeEvents';

/**
 * Shows the count of intake items awaiting triage for a project, next to its
 * Intake nav link. Fetches lazily (only mounts for an expanded project) and
 * refreshes when IntakePage emits an intake-updated event for this project.
 */
export function IntakeNavBadge({
  workspaceSlug,
  projectId,
}: {
  workspaceSlug: string;
  projectId: string;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      intakeService
        .pendingCount(workspaceSlug, projectId)
        .then((n) => {
          if (!cancelled) setCount(n);
        })
        .catch(() => {
          if (!cancelled) setCount(0);
        });
    };
    load();
    const onUpdate = (e: Event) => {
      if ((e as CustomEvent<{ projectId: string }>).detail?.projectId === projectId) load();
    };
    window.addEventListener(INTAKE_UPDATED_EVENT, onUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener(INTAKE_UPDATED_EVENT, onUpdate);
    };
  }, [workspaceSlug, projectId]);

  if (count <= 0) return null;
  return (
    <span className="ml-auto rounded-full bg-(--brand-default) px-1.5 text-[11px] leading-4 text-white">
      {count}
    </span>
  );
}
