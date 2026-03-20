import { useNavigate } from 'react-router-dom';
import { Button, Card, CardContent } from '../../components/ui';

const IconWorkspace = () => (
  <svg
    width="48"
    height="48"
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

export function InstanceSetupCompletePage() {
  const navigate = useNavigate();

  const handleCreateWorkspace = () => {
    navigate('/instance-admin/workspace/create', {
      replace: true,
      state: { fromSetup: true },
    });
  };

  const handleClose = () => {
    navigate('/instance-admin', { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-(--bg-canvas) px-4 py-8">
      <Card className="w-full max-w-lg border-(--border-subtle) bg-(--bg-surface-1)">
        <CardContent className="p-6">
          <div className="flex gap-6">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold text-(--txt-primary)">Create workspace</h2>
              <p className="mt-2 text-sm text-(--txt-secondary)">
                Instance setup is complete. Welcome to your Devlane instance. Start your journey by
                creating your first workspace.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button type="button" onClick={handleCreateWorkspace} size="lg">
                  Create workspace
                </Button>
                <Button variant="secondary" onClick={handleClose} size="lg" type="button">
                  Close
                </Button>
              </div>
            </div>
            <div className="hidden shrink-0 sm:block">
              <span className="flex size-16 items-center justify-center rounded-full bg-(--bg-accent-subtle) text-(--txt-accent-primary)">
                <IconWorkspace />
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
