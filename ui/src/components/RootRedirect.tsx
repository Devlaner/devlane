import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { instanceService } from '../services/instanceService';
import { workspaceService } from '../services/workspaceService';

const PageFallback = () => (
  <div className="flex items-center justify-center p-8 text-sm text-(--txt-tertiary)">
    Loading...
  </div>
);

/**
 * At root "/", checks setup status then redirects:
 * - setup required → /setup
 * - authenticated → first workspace /:slug or "no workspaces" message
 */
export function RootRedirect() {
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);
  const [firstSlug, setFirstSlug] = useState<string | null>(null);
  const [noWorkspaces, setNoWorkspaces] = useState(false);

  useEffect(() => {
    let cancelled = false;
    instanceService
      .getSetupStatus()
      .then((res) => {
        if (cancelled) return;
        if (res.setup_required) {
          setSetupRequired(true);
          return;
        }
        setSetupRequired(false);
        return workspaceService.list().then((list) => {
          if (cancelled) return;
          if (list.length > 0) setFirstSlug(list[0].slug);
          else setNoWorkspaces(true);
        });
      })
      .catch(() => {
        if (!cancelled) setSetupRequired(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (setupRequired === null) {
    return <PageFallback />;
  }
  if (setupRequired) {
    return <Navigate to="/setup" replace />;
  }
  if (firstSlug) {
    return <Navigate to={`/${firstSlug}`} replace />;
  }
  if (noWorkspaces) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-(--txt-secondary)">You don’t have any workspaces yet.</p>
        <p className="text-sm text-(--txt-tertiary)">
          Create one from instance admin or use the API to get started.
        </p>
      </div>
    );
  }
  return <PageFallback />;
}
