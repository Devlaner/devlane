import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Modal } from '../../ui';
import { labelService } from '../../../services/labelService';
import type { LabelApiResponse } from '../../../api/types';

interface ProjectLabelModalProps {
  open: boolean;
  onClose: () => void;
  workspaceSlug: string | undefined;
  selectedProjectId: string | null;
  projectLabelEdit: LabelApiResponse | null;
  setProjectLabelEdit: (label: LabelApiResponse | null) => void;
  projectLabelName: string;
  setProjectLabelName: (value: string) => void;
  projectLabelColor: string;
  setProjectLabelColor: (value: string) => void;
  setProjectLabels: (labels: LabelApiResponse[]) => void;
  setProjectLabelModalOpen: (value: boolean) => void;
}

/** Add/edit modal for a project label. */
export function ProjectLabelModal({
  open,
  onClose,
  workspaceSlug,
  selectedProjectId,
  projectLabelEdit,
  setProjectLabelEdit,
  projectLabelName,
  setProjectLabelName,
  projectLabelColor,
  setProjectLabelColor,
  setProjectLabels,
  setProjectLabelModalOpen,
}: ProjectLabelModalProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        projectLabelEdit
          ? t('settings.labels.editTitle', 'Edit label')
          : t('settings.labels.addTitle', 'Add label')
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            disabled={!projectLabelName.trim() || saving}
            onClick={async () => {
              if (!workspaceSlug || !selectedProjectId || !projectLabelName.trim()) return;
              setSaving(true);
              setError(null);
              try {
                if (projectLabelEdit) {
                  await labelService.update(workspaceSlug, selectedProjectId, projectLabelEdit.id, {
                    name: projectLabelName.trim(),
                    color: projectLabelColor,
                  });
                } else {
                  await labelService.create(workspaceSlug, selectedProjectId, {
                    name: projectLabelName.trim(),
                    color: projectLabelColor,
                  });
                }
                const list = await labelService.list(workspaceSlug, selectedProjectId);
                setProjectLabels(list ?? []);
                setProjectLabelModalOpen(false);
                setProjectLabelEdit(null);
              } catch {
                setError(
                  t('settings.labels.error.save', 'Failed to save label. Please try again.'),
                );
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving
              ? t('common.saving', 'Saving…')
              : projectLabelEdit
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
            value={projectLabelName}
            onChange={(e) => setProjectLabelName(e.target.value)}
            className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
            placeholder={t('settings.labels.namePlaceholder', 'e.g. Bug')}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
            {t('common.color', 'Color')}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={projectLabelColor}
              onChange={(e) => setProjectLabelColor(e.target.value)}
              className="h-9 w-14 cursor-pointer rounded border border-(--border-subtle)"
            />
            <input
              type="text"
              value={projectLabelColor}
              onChange={(e) => setProjectLabelColor(e.target.value)}
              className="flex-1 rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
