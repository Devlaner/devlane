import { useEffect, useState } from 'react';
import { Button, Modal } from '../ui';
import { integrationService } from '../../services/integrationService';
import { stateService } from '../../services/stateService';
import { getApiErrorMessage } from '../../api/client';
import type {
  GitHubRepositorySyncResponse,
  ProjectApiResponse,
  StateApiResponse,
} from '../../api/types';

interface RepoSyncSettingsModalProps {
  open: boolean;
  onClose: () => void;
  workspaceSlug: string;
  project: ProjectApiResponse;
  /** Initial sync state seeded from the parent so the modal doesn't have to refetch. */
  initialSync: GitHubRepositorySyncResponse | null;
  /** Called with the updated sync row after a successful save. */
  onSaved: (next: GitHubRepositorySyncResponse) => void;
}

/**
 * Per-repo sync settings:
 *   - auto_link toggle
 *   - auto_close_on_merge toggle
 *   - in_progress_state_id picker (project's "started" states)
 *   - done_state_id picker      (project's "completed" states)
 *
 * Without state IDs set, the engine still posts activity comments but does not
 * transition the issue's state on PR open / merge.
 */
export function RepoSyncSettingsModal({
  open,
  onClose,
  workspaceSlug,
  project,
  initialSync,
  onSaved,
}: RepoSyncSettingsModalProps) {
  const [autoLink, setAutoLink] = useState(initialSync?.sync.auto_link ?? true);
  const [autoCloseOnMerge, setAutoCloseOnMerge] = useState(
    initialSync?.sync.auto_close_on_merge ?? true,
  );
  const [inProgressStateID, setInProgressStateID] = useState<string>(
    initialSync?.sync.in_progress_state_id ?? '',
  );
  const [doneStateID, setDoneStateID] = useState<string>(initialSync?.sync.done_state_id ?? '');

  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Refresh whenever the modal opens — sync may have changed from another tab
  // and we always want a fresh state list.
  useEffect(() => {
    if (!open) return;
    setError('');
    setAutoLink(initialSync?.sync.auto_link ?? true);
    setAutoCloseOnMerge(initialSync?.sync.auto_close_on_merge ?? true);
    setInProgressStateID(initialSync?.sync.in_progress_state_id ?? '');
    setDoneStateID(initialSync?.sync.done_state_id ?? '');
    setLoadingStates(true);
    stateService
      .list(workspaceSlug, project.id)
      .then((list) => setStates(list ?? []))
      .catch((e) => setError(getApiErrorMessage(e)))
      .finally(() => setLoadingStates(false));
  }, [open, workspaceSlug, project.id, initialSync]);

  const startedStates = states.filter(
    (s) => s.group === 'started' || s.group === 'unstarted' || s.group === 'backlog',
  );
  const completedStates = states.filter((s) => s.group === 'completed' || s.group === 'cancelled');

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      // PATCH expects empty string to clear; null/undefined means "don't change".
      const payload = {
        auto_link: autoLink,
        auto_close_on_merge: autoCloseOnMerge,
        in_progress_state_id: inProgressStateID,
        done_state_id: doneStateID,
      };
      await integrationService.githubUpdateProjectSync(workspaceSlug, project.id, payload);

      // Refetch sync to surface server-side normalization.
      const next = await integrationService.githubGetProjectSync(workspaceSlug, project.id);
      if (next) onSaved(next);
      onClose();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!saving) onClose();
      }}
      title={`Sync settings for ${project.name}`}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              if (!saving) onClose();
            }}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving || loadingStates}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        {error && (
          <div className="rounded-(--radius-md) border border-(--border-danger-subtle) bg-(--bg-danger-subtle) px-3 py-2 text-(--txt-danger-primary)">
            {error}
          </div>
        )}

        <ToggleRow
          label="Auto-link PRs to issues"
          hint="Detect issue references in PR titles, bodies, and branch names; link them automatically."
          checked={autoLink}
          onChange={setAutoLink}
        />

        <ToggleRow
          label="Move issue state on PR events"
          hint="When a closing PR (e.g. “fixes DEV-42”) merges, move the issue to the Done state. Requires the state map below."
          checked={autoCloseOnMerge}
          onChange={setAutoCloseOnMerge}
        />

        <div>
          <label className="mb-1 block text-xs font-medium text-(--txt-secondary)">
            “In progress” state
            <span className="ml-1 text-(--txt-tertiary)">
              — applied when a PR opens or is reopened
            </span>
          </label>
          <select
            value={inProgressStateID}
            onChange={(e) => setInProgressStateID(e.target.value)}
            disabled={loadingStates}
            className="block w-full appearance-none rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-2.5 py-1.5 text-sm text-(--txt-primary) focus:outline-none"
          >
            <option value="">— none (don't move on open) —</option>
            {startedStates.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-(--txt-secondary)">
            “Done” state
            <span className="ml-1 text-(--txt-tertiary)">— applied when a closing PR merges</span>
          </label>
          <select
            value={doneStateID}
            onChange={(e) => setDoneStateID(e.target.value)}
            disabled={loadingStates}
            className="block w-full appearance-none rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-2.5 py-1.5 text-sm text-(--txt-primary) focus:outline-none"
          >
            <option value="">— none (don't move on merge) —</option>
            {completedStates.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-3 rounded border border-(--border-subtle) bg-(--bg-surface-1) p-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-(--txt-primary)">{label}</p>
        <p className="mt-0.5 text-xs text-(--txt-secondary)">{hint}</p>
      </div>
      <span className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-(--neutral-400) has-[:checked]:bg-(--brand-default)">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="pointer-events-none inline-block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
      </span>
    </label>
  );
}
