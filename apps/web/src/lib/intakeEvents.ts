/**
 * Dispatched by IntakePage after a triage action changes the pending count;
 * the sidebar intake badge listens and refetches. Detail carries the project id
 * so a badge only refreshes for the affected project.
 */
export const INTAKE_UPDATED_EVENT = 'intake-updated';

export function emitIntakeUpdated(projectId: string) {
  window.dispatchEvent(
    new CustomEvent<{ projectId: string }>(INTAKE_UPDATED_EVENT, {
      detail: { projectId },
    }),
  );
}
