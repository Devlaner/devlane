import { Navigate, useParams } from 'react-router-dom';

/**
 * Legacy `/board` route. The kanban now renders inside the issues page via
 * `?layout=board`, so this page just redirects users (and bookmarks) to the
 * canonical URL.
 */
export function BoardPage() {
  const { workspaceSlug, projectId } = useParams<{
    workspaceSlug: string;
    projectId: string;
  }>();
  if (!workspaceSlug || !projectId) {
    return <Navigate to="/" replace />;
  }
  return <Navigate to={`/${workspaceSlug}/projects/${projectId}/issues?layout=board`} replace />;
}
