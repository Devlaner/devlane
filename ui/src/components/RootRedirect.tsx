import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { authService } from '../services/authService';
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
 * - authenticated + has workspaces → first workspace /:slug
 * - authenticated + no workspaces + creation allowed → /create-workspace
 * - authenticated + no workspaces + creation restricted → info message
 */
export function RootRedirect() {
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);
  const [firstSlug, setFirstSlug] = useState<string | null>(null);
  const [noWorkspaces, setNoWorkspaces] = useState(false);
  const [wsCreationDisabled, setWsCreationDisabled] = useState(false);

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
        return Promise.all([workspaceService.list(), authService.getAuthConfig()]).then(
          ([list, config]) => {
            if (cancelled) return;
            if (list.length > 0) {
              setFirstSlug(list[0].slug);
            } else {
              setWsCreationDisabled(config?.is_workspace_creation_disabled ?? false);
              setNoWorkspaces(true);
            }
          },
        );
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
    if (!wsCreationDisabled) {
      return <Navigate to="/create-workspace" replace />;
    }
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-(--txt-secondary)">You don&apos;t have any workspaces yet.</p>
        <p className="text-sm text-(--txt-tertiary)">
          Workspace creation is restricted. Ask your instance admin to invite you to a workspace.
        </p>
      </div>
    );
  }
  return <PageFallback />;
}
