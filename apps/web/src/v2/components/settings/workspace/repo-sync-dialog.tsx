import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Button } from '@/v2/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/v2/components/ui/dialog';
import { Label } from '@/v2/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/v2/components/ui/select';
import { Switch } from '@/v2/components/ui/switch';
import { SettingRow } from '@/v2/components/settings/settings-panel';
import { getApiErrorMessage } from '../../../../api/client';
import { integrationService } from '../../../../services/integrationService';
import { stateService } from '../../../../services/stateService';
import type {
  GitHubRepositorySyncResponse,
  ProjectApiResponse,
  StateApiResponse,
} from '../../../../api/types';

interface RepoSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceSlug: string;
  project: ProjectApiResponse;
  /** Initial sync state seeded from the parent so the dialog doesn't refetch it. */
  initialSync: GitHubRepositorySyncResponse | null;
  onSaved: (next: GitHubRepositorySyncResponse) => void;
}

/** The select clears a mapping with the empty string; Radix needs a real value. */
const NONE = '__none__';

/**
 * Per-repo sync settings: auto-link, state transitions on PR events, and the
 * two state mappings that drive them. Without state IDs the engine still posts
 * activity comments but does not move the issue.
 */
export function RepoSyncDialog({
  open,
  onOpenChange,
  workspaceSlug,
  project,
  initialSync,
  onSaved,
}: RepoSyncDialogProps) {
  const { t } = useTranslation();
  const [autoLink, setAutoLink] = useState(true);
  const [autoCloseOnMerge, setAutoCloseOnMerge] = useState(true);
  const [inProgressStateId, setInProgressStateId] = useState(NONE);
  const [doneStateId, setDoneStateId] = useState(NONE);

  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  /* Reseed on open — the sync may have changed elsewhere, and the state list is
     always refetched. */
  useEffect(() => {
    if (!open) return;
    setError('');
    setAutoLink(initialSync?.sync.auto_link ?? true);
    setAutoCloseOnMerge(initialSync?.sync.auto_close_on_merge ?? true);
    setInProgressStateId(initialSync?.sync.in_progress_state_id || NONE);
    setDoneStateId(initialSync?.sync.done_state_id || NONE);
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
      // PATCH expects an empty string to clear a mapping.
      await integrationService.githubUpdateProjectSync(workspaceSlug, project.id, {
        auto_link: autoLink,
        auto_close_on_merge: autoCloseOnMerge,
        in_progress_state_id: inProgressStateId === NONE ? '' : inProgressStateId,
        done_state_id: doneStateId === NONE ? '' : doneStateId,
      });
      // Refetch to surface server-side normalization.
      const next = await integrationService.githubGetProjectSync(workspaceSlug, project.id);
      if (next) onSaved(next);
      onOpenChange(false);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t('integrations.repoSync.title', 'Sync settings for {{name}}', {
              name: project.name,
            })}
          </DialogTitle>
          <DialogDescription>
            {t(
              'integrations.repoSync.description',
              'Choose how pull requests on the linked repository affect this project’s work items.',
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {error && <p className="text-destructive text-sm">{error}</p>}

          <SettingRow
            title={t('integrations.repoSync.autoLink', 'Auto-link PRs to work items')}
            description={t(
              'integrations.repoSync.autoLinkHint',
              'Detect work item references in PR titles, bodies, and branch names; link them automatically.',
            )}
            titleId="repo-sync-auto-link-label"
            control={
              <Switch
                checked={autoLink}
                onCheckedChange={setAutoLink}
                aria-labelledby="repo-sync-auto-link-label"
              />
            }
          />

          <SettingRow
            title={t('integrations.repoSync.autoClose', 'Move state on PR events')}
            description={t(
              'integrations.repoSync.autoCloseHint',
              'When a closing PR merges, move the work item to the Done state. Requires the mapping below.',
            )}
            titleId="repo-sync-auto-close-label"
            control={
              <Switch
                checked={autoCloseOnMerge}
                onCheckedChange={setAutoCloseOnMerge}
                aria-labelledby="repo-sync-auto-close-label"
              />
            }
          />

          <div className="space-y-2">
            <Label htmlFor="repo-sync-in-progress">
              <Trans
                i18nKey="integrations.repoSync.inProgressLabel"
                defaults="“In progress” state <hint>— applied when a PR opens or is reopened</hint>"
                components={{ hint: <span className="text-muted-foreground font-normal" /> }}
              />
            </Label>
            <Select
              value={inProgressStateId}
              onValueChange={setInProgressStateId}
              disabled={loadingStates}
            >
              <SelectTrigger id="repo-sync-in-progress" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>
                  {t('integrations.repoSync.noneOnOpen', 'None — don’t move on open')}
                </SelectItem>
                {startedStates.map((state) => (
                  <SelectItem key={state.id} value={state.id}>
                    {state.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="repo-sync-done">
              <Trans
                i18nKey="integrations.repoSync.doneLabel"
                defaults="“Done” state <hint>— applied when a closing PR merges</hint>"
                components={{ hint: <span className="text-muted-foreground font-normal" /> }}
              />
            </Label>
            <Select value={doneStateId} onValueChange={setDoneStateId} disabled={loadingStates}>
              <SelectTrigger id="repo-sync-done" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>
                  {t('integrations.repoSync.noneOnMerge', 'None — don’t move on merge')}
                </SelectItem>
                {completedStates.map((state) => (
                  <SelectItem key={state.id} value={state.id}>
                    {state.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button disabled={saving || loadingStates} onClick={() => void handleSave()}>
            {saving ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
