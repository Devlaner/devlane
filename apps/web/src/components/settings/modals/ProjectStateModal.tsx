import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Modal } from '../../ui';
import { stateService } from '../../../services/stateService';
import type { StateApiResponse } from '../../../api/types';

interface ProjectStateModalProps {
  open: boolean;
  onClose: () => void;
  workspaceSlug: string | undefined;
  selectedProjectId: string | null;
  projectStateEdit: StateApiResponse | null;
  setProjectStateEdit: (state: StateApiResponse | null) => void;
  projectStateName: string;
  setProjectStateName: (value: string) => void;
  projectStateColor: string;
  setProjectStateColor: (value: string) => void;
  projectStateGroup: string;
  setProjectStateGroup: (value: string) => void;
  setProjectStates: (states: StateApiResponse[]) => void;
  setProjectStateModalOpen: (value: boolean) => void;
}

/** Add/edit modal for a project workflow state. */
export function ProjectStateModal({
  open,
  onClose,
  workspaceSlug,
  selectedProjectId,
  projectStateEdit,
  setProjectStateEdit,
  projectStateName,
  setProjectStateName,
  projectStateColor,
  setProjectStateColor,
  projectStateGroup,
  setProjectStateGroup,
  setProjectStates,
  setProjectStateModalOpen,
}: ProjectStateModalProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        projectStateEdit
          ? t('settings.states.editTitle', 'Edit state')
          : t('settings.states.addTitle', 'Add state')
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            disabled={!projectStateName.trim() || saving}
            onClick={async () => {
              if (!workspaceSlug || !selectedProjectId || !projectStateName.trim()) return;
              setSaving(true);
              setError(null);
              try {
                if (projectStateEdit) {
                  await stateService.update(workspaceSlug, selectedProjectId, projectStateEdit.id, {
                    name: projectStateName.trim(),
                    color: projectStateColor,
                    group: projectStateGroup,
                  });
                } else {
                  await stateService.create(workspaceSlug, selectedProjectId, {
                    name: projectStateName.trim(),
                    color: projectStateColor,
                    group: projectStateGroup,
                  });
                }
                const list = await stateService.list(workspaceSlug, selectedProjectId);
                setProjectStates(list ?? []);
                setProjectStateModalOpen(false);
                setProjectStateEdit(null);
              } catch {
                setError(
                  t('settings.states.error.save', 'Failed to save state. Please try again.'),
                );
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving
              ? t('common.saving', 'Saving…')
              : projectStateEdit
                ? t('common.save', 'Save')
                : t('common.create', 'Create')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <p className="rounded-(--radius-md) bg-(--bg-danger-subtle) px-3 py-2 text-sm text-(--txt-danger)">
            {error}
          </p>
        ) : null}
        <div>
          <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
            {t('common.name', 'Name')}
          </label>
          <input
            type="text"
            value={projectStateName}
            onChange={(e) => setProjectStateName(e.target.value)}
            className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
            placeholder={t('settings.states.namePlaceholder', 'e.g. In Progress')}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
            {t('common.color', 'Color')}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={projectStateColor}
              onChange={(e) => setProjectStateColor(e.target.value)}
              className="h-9 w-14 cursor-pointer rounded border border-(--border-subtle)"
            />
            <input
              type="text"
              value={projectStateColor}
              onChange={(e) => setProjectStateColor(e.target.value)}
              className="flex-1 rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
            {t('settings.states.group', 'Group')}
          </label>
          <select
            value={projectStateGroup}
            onChange={(e) => setProjectStateGroup(e.target.value)}
            className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
          >
            <option value="backlog">{t('settings.states.group.backlog', 'Backlog')}</option>
            <option value="unstarted">{t('settings.states.group.unstarted', 'Unstarted')}</option>
            <option value="started">{t('settings.states.group.started', 'Started')}</option>
            <option value="completed">{t('settings.states.group.completed', 'Completed')}</option>
            <option value="cancelled">{t('settings.states.group.cancelled', 'Cancelled')}</option>
          </select>
        </div>
      </div>
    </Modal>
  );
}
