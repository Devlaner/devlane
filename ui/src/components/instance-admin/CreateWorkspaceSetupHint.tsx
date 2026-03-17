import { Button } from "../ui";

const IconWorkspace = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
    <path d="M3 9 12 3l9 6" />
    <path d="M12 3v6" />
  </svg>
);

interface CreateWorkspaceSetupHintProps {
  onDismiss: () => void;
}

export function CreateWorkspaceSetupHint({
  onDismiss,
}: CreateWorkspaceSetupHintProps) {
  return (
    <div
      className="fixed bottom-6 right-6 z-50 w-full max-w-sm rounded-(--radius-lg) border border-(--border-subtle) bg-(--bg-surface-1) p-4 shadow-(--shadow-overlay)"
      role="dialog"
      aria-label="Create workspace"
    >
      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-(--txt-primary)">
            Create workspace
          </h3>
          <p className="mt-1 text-xs text-(--txt-secondary)">
            Instance setup is complete. Welcome to your Devlane instance. Start
            your journey by creating your first workspace.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" type="button" onClick={onDismiss}>
              Create workspace
            </Button>
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={onDismiss}
            >
              Close
            </Button>
          </div>
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-(--bg-accent-subtle) text-(--txt-accent-primary)">
          <IconWorkspace />
        </span>
      </div>
    </div>
  );
}
