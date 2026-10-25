import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button } from '../ui';
import { issueService } from '../../services/issueService';
import { sanitizeHtml } from '../../lib/sanitize';
import type { IssueApiResponse, IssueDescriptionVersionApiResponse } from '../../api/types';

interface DescriptionHistoryModalProps {
  open: boolean;
  onClose: () => void;
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  authorLabel: (userId: string | null | undefined) => string;
  onRestored: (issue: IssueApiResponse) => void;
}

/** Lists a work item's saved description versions and lets the user restore one. */
export function DescriptionHistoryModal({
  open,
  onClose,
  workspaceSlug,
  projectId,
  issueId,
  authorLabel,
  onRestored,
}: DescriptionHistoryModalProps) {
  const { t } = useTranslation();
  const [versions, setVersions] = useState<IssueDescriptionVersionApiResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    issueService
      .listDescriptionVersions(workspaceSlug, projectId, issueId)
      .then((list) => {
        if (!cancelled) setVersions(list ?? []);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load version history.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, workspaceSlug, projectId, issueId]);

  const restore = async (versionId: string) => {
    setRestoringId(versionId);
    setError(null);
    try {
      const updated = await issueService.restoreDescriptionVersion(
        workspaceSlug,
        projectId,
        issueId,
        versionId,
      );
      onRestored(updated);
      onClose();
    } catch {
      setError('Could not restore this version.');
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Description history" className="max-w-2xl">
      {error && (
        <p className="mb-3 rounded-(--radius-md) bg-(--bg-danger-subtle) px-3 py-2 text-sm text-(--txt-danger-primary)">
          {error}
        </p>
      )}
      {loading ? (
        <p className="py-6 text-center text-sm text-(--txt-tertiary)">
          {t('views.descriptionHistory.loading', 'Loading history…')}
        </p>
      ) : versions.length === 0 ? (
        <p className="py-6 text-center text-sm text-(--txt-tertiary)">
          {t(
            'views.descriptionHistory.empty',
            'No previous versions yet. Edits to the description are recorded here.',
          )}
        </p>
      ) : (
        <ul className="max-h-[60vh] space-y-3 overflow-y-auto">
          {versions.map((v) => (
            <li
              key={v.id}
              className="rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="min-w-0 text-xs text-(--txt-tertiary)">
                  <span className="text-(--txt-secondary)">{authorLabel(v.created_by_id)}</span>
                  {' · '}
                  {new Date(v.created_at).toLocaleString()}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={restoringId !== null}
                  onClick={() => restore(v.id)}
                >
                  {restoringId === v.id ? 'Restoring…' : 'Restore'}
                </Button>
              </div>
              <div
                className="prose prose-sm max-h-40 max-w-none overflow-y-auto text-sm text-(--txt-secondary)"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(v.description_html) }}
              />
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
