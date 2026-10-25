import { Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

/**
 * Legacy `/board` route. The kanban now renders inside the issues page via
 * `?layout=board`, so this page just redirects users (and bookmarks) to the
 * canonical URL.
 */
export function BoardPage() {
  const { t } = useTranslation();
  const { workspaceSlug, projectId } = useParams<{
    workspaceSlug: string;
    projectId: string;
  }>();
  useDocumentTitle(t('workItem.board.documentTitle', 'Board'));
  if (!workspaceSlug || !projectId) {
    return <Navigate to="/" replace />;
  }
  return <Navigate to={`/${workspaceSlug}/projects/${projectId}/issues?layout=board`} replace />;
}
