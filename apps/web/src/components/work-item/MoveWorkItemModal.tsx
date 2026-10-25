import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderInput } from 'lucide-react';
import { Modal } from '../ui';
import { projectService } from '../../services/projectService';
import { issueService } from '../../services/issueService';
import type { ProjectApiResponse } from '../../api/types';

interface MoveWorkItemModalProps {
  workspaceSlug: string;
  currentProjectId: string;
  issueId: string;
  onMoved: (targetProjectId: string) => void;
}

/**
 * "Move to another project" trigger button + modal for the issue detail page
 * action bar. Opening it fetches the workspace's other projects; picking one
 * moves the issue via issueService.move and hands navigation off to the caller
 * via onMoved.
 */
export function MoveWorkItemModal({
  workspaceSlug,
  currentProjectId,
  issueId,
  onMoved,
}: MoveWorkItemModalProps) {
  const { t } = useTranslation();
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveProjects, setMoveProjects] = useState<ProjectApiResponse[]>([]);
  const [moveLoading, setMoveLoading] = useState(false);
  const [moveSubmitting, setMoveSubmitting] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  const openMove = async () => {
    if (!workspaceSlug) return;
    setMoveOpen(true);
    setMoveError(null);
    setMoveLoading(true);
    try {
      const list = await projectService.list(workspaceSlug);
      setMoveProjects(list.filter((p) => p.id !== currentProjectId));
    } catch {
      setMoveError('Failed to load projects.');
    } finally {
      setMoveLoading(false);
    }
  };

  const handleMove = async (targetProjectId: string) => {
    if (!workspaceSlug) return;
    setMoveSubmitting(true);
    setMoveError(null);
    try {
      await issueService.move(workspaceSlug, currentProjectId, issueId, targetProjectId);
      setMoveOpen(false);
      onMoved(targetProjectId);
    } catch (err) {
      const apiError =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      setMoveError(apiError ?? 'Failed to move work item.');
    } finally {
      setMoveSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void openMove()}
        className="inline-flex shrink-0 items-center gap-1 rounded-(--radius-md) border border-(--border-subtle) px-2 py-1 text-xs text-(--txt-secondary) transition-colors hover:bg-(--bg-layer-1-hover)"
      >
        <FolderInput className="h-3.5 w-3.5" />
        {t('common.move', 'Move')}
      </button>
      <Modal open={moveOpen} onClose={() => setMoveOpen(false)} title="Move work item to project">
        <div className="space-y-3">
          <p className="text-sm text-(--txt-tertiary)">
            {t(
              'views.move.description',
              'Choose a destination project. The work item gets a new ID there; its state, parent, labels, and cycle/module links are cleared, and any sub-items are detached.',
            )}
          </p>
          {moveError ? (
            <p className="rounded-(--radius-md) bg-(--bg-danger-subtle) px-3 py-2 text-sm text-(--txt-danger)">
              {moveError}
            </p>
          ) : null}
          {moveLoading ? (
            <p className="py-6 text-center text-sm text-(--txt-tertiary)">
              {t('views.move.loading', 'Loading projects…')}
            </p>
          ) : moveProjects.length === 0 ? (
            <p className="py-6 text-center text-sm text-(--txt-tertiary)">
              {t('views.move.noProjects', 'No other projects available.')}
            </p>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {moveProjects.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={moveSubmitting}
                    onClick={() => void handleMove(p.id)}
                    className="flex w-full items-center gap-2 rounded-(--radius-md) px-3 py-2 text-left text-sm text-(--txt-primary) transition-colors hover:bg-(--bg-layer-1-hover) disabled:opacity-50"
                  >
                    <span className="shrink-0 rounded-(--radius-sm) bg-(--bg-layer-2) px-1.5 py-0.5 text-xs font-medium text-(--txt-secondary)">
                      {p.identifier ?? p.id.slice(0, 8)}
                    </span>
                    <span className="truncate">{p.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
    </>
  );
}
