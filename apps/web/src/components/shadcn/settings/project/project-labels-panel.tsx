import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlusIcon, TagIcon } from 'lucide-react';
import { Button } from '@/components/shadcn/ui/button';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/shadcn/ui/empty';
import { Skeleton } from '@/components/shadcn/ui/skeleton';
import { SettingsPanel } from '@/components/shadcn/settings/settings-panel';
import {
  ProjectItemDialog,
  type ProjectItemValues,
} from '@/components/shadcn/settings/project/project-item-dialog';
import { labelService } from '../../../../services/labelService';
import type { LabelApiResponse } from '../../../../api/types';

interface ProjectLabelsPanelProps {
  workspaceSlug: string;
  projectId: string;
}

const DEFAULT_LABEL_COLOR = '#6366f1';

/** Project labels: create, recolour, rename, delete. */
export function ProjectLabelsPanel({ workspaceSlug, projectId }: ProjectLabelsPanelProps) {
  const { t } = useTranslation();
  const [labels, setLabels] = useState<LabelApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LabelApiResponse | null>(null);
  const [initial, setInitial] = useState<ProjectItemValues>({
    name: '',
    color: DEFAULT_LABEL_COLOR,
    group: '',
  });

  const refresh = useCallback(async () => {
    setLabels((await labelService.list(workspaceSlug, projectId)) ?? []);
  }, [workspaceSlug, projectId]);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      setLoading(true);
      labelService
        .list(workspaceSlug, projectId)
        .then((list) => {
          if (!cancelled) setLabels(list ?? []);
        })
        .catch(() => {
          if (!cancelled) setLabels([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId]);

  return (
    <SettingsPanel
      title={t('settings.labels.title', 'Labels')}
      description={t(
        'settings.labels.subtitle',
        'Create custom labels to categorize and organize your work items.',
      )}
      actions={
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setInitial({ name: '', color: DEFAULT_LABEL_COLOR, group: '' });
            setDialogOpen(true);
          }}
        >
          <PlusIcon />
          {t('settings.labels.add', 'Add label')}
        </Button>
      }
    >
      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : labels.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TagIcon />
            </EmptyMedia>
            <EmptyTitle>{t('settings.labels.empty', 'No labels yet.')}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {labels.map((label) => (
            <div
              key={label.id}
              className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: label.color ?? DEFAULT_LABEL_COLOR }}
                  aria-hidden
                />
                <span className="truncate text-sm font-medium">{label.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(label);
                    setInitial({
                      name: label.name,
                      color: label.color ?? DEFAULT_LABEL_COLOR,
                      group: '',
                    });
                    setDialogOpen(true);
                  }}
                >
                  {t('common.edit', 'Edit')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={async () => {
                    try {
                      await labelService.delete(workspaceSlug, projectId, label.id);
                      await refresh();
                    } catch {
                      /* The list stays as-is on failure. */
                    }
                  }}
                >
                  {t('common.delete', 'Delete')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ProjectItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing !== null}
        initial={initial}
        title={
          editing
            ? t('settings.labels.editTitle', 'Edit label')
            : t('settings.labels.addTitle', 'Add label')
        }
        namePlaceholder={t('settings.labels.namePlaceholder', 'e.g. Bug')}
        onSubmit={async ({ name, color }) => {
          if (editing) {
            await labelService.update(workspaceSlug, projectId, editing.id, { name, color });
          } else {
            await labelService.create(workspaceSlug, projectId, { name, color });
          }
          await refresh();
        }}
      />
    </SettingsPanel>
  );
}
