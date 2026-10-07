import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArchiveIcon, CircleXIcon } from 'lucide-react';
import { Label } from '@/v2/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/v2/components/ui/select';
import { Switch } from '@/v2/components/ui/switch';
import { SettingRow, SettingsPanel } from '@/v2/components/settings/settings-panel';
import { projectService } from '../../../../services/projectService';
import type { ProjectApiResponse } from '../../../../api/types';

interface ProjectAutomationsPanelProps {
  workspaceSlug: string;
  project: ProjectApiResponse;
  onProjectUpdated: (project: ProjectApiResponse) => void;
}

const MONTH_OPTIONS = [1, 3, 6, 12];

/**
 * Auto-archive and auto-close. Both are stored as a month count where 0 means
 * off, so the toggle and the month select write the same field.
 */
export function ProjectAutomationsPanel({
  workspaceSlug,
  project,
  onProjectUpdated,
}: ProjectAutomationsPanelProps) {
  const { t } = useTranslation();
  const [archiveMonths, setArchiveMonths] = useState(project.archive_in ?? 0);
  const [closeMonths, setCloseMonths] = useState(project.close_in ?? 0);
  const [savingArchive, setSavingArchive] = useState(false);
  const [savingClose, setSavingClose] = useState(false);

  useEffect(() => {
    setArchiveMonths(project.archive_in ?? 0);
    setCloseMonths(project.close_in ?? 0);
  }, [project.id, project.archive_in, project.close_in]);

  const monthLabel = (months: number) =>
    months === 1
      ? t('settings.automations.months.one', '1 month')
      : t('settings.automations.months.other', '{{count}} months', { count: months });

  const persist = async (
    field: 'archive_in' | 'close_in',
    months: number,
    apply: (value: number) => void,
    previous: number,
    setSaving: (value: boolean) => void,
  ) => {
    apply(months);
    setSaving(true);
    try {
      onProjectUpdated(await projectService.update(workspaceSlug, project.id, { [field]: months }));
    } catch {
      apply(previous);
    } finally {
      setSaving(false);
    }
  };

  /* A disabled automation still remembers a sensible period for when it is
     switched back on. */
  const archiveEnabled = archiveMonths > 0;
  const closeEnabled = closeMonths > 0;

  return (
    <SettingsPanel
      title={t('settings.automations.title', 'Automations')}
      description={t(
        'settings.automations.subtitle',
        'Configure automated actions to streamline your project management workflow and reduce manual tasks.',
      )}
    >
      <div className="flex flex-col gap-3">
        <SettingRow
          titleId="auto-archive-label"
          title={t('settings.automations.autoArchive.title', 'Auto-archive closed work items')}
          description={t(
            'settings.automations.autoArchive.desc',
            'Devlane will auto archive work items that have been completed or canceled.',
          )}
          icon={<ArchiveIcon className="size-4" />}
          control={
            <Switch
              checked={archiveEnabled}
              disabled={savingArchive}
              aria-labelledby="auto-archive-label"
              onCheckedChange={(next) =>
                void persist(
                  'archive_in',
                  next ? 3 : 0,
                  setArchiveMonths,
                  archiveMonths,
                  setSavingArchive,
                )
              }
            />
          }
        >
          {archiveEnabled && (
            <div className="mt-2 flex items-center gap-2">
              <Label htmlFor="auto-archive-months" className="text-muted-foreground text-sm">
                {t('settings.automations.archiveAfter', 'Archive after')}
              </Label>
              <Select
                value={String(archiveMonths)}
                disabled={savingArchive}
                onValueChange={(value) =>
                  void persist(
                    'archive_in',
                    Number(value),
                    setArchiveMonths,
                    archiveMonths,
                    setSavingArchive,
                  )
                }
              >
                <SelectTrigger id="auto-archive-months" size="sm" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_OPTIONS.map((months) => (
                    <SelectItem key={months} value={String(months)}>
                      {monthLabel(months)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground text-sm">
                {t('settings.automations.ofInactivity', 'of inactivity')}
              </span>
            </div>
          )}
        </SettingRow>

        <SettingRow
          titleId="auto-close-label"
          title={t('settings.automations.autoClose.title', 'Auto-close work items')}
          description={t(
            'settings.automations.autoClose.desc',
            "Devlane will automatically close work items that haven't been completed or canceled.",
          )}
          icon={<CircleXIcon className="size-4" />}
          control={
            <Switch
              checked={closeEnabled}
              disabled={savingClose}
              aria-labelledby="auto-close-label"
              onCheckedChange={(next) =>
                void persist('close_in', next ? 3 : 0, setCloseMonths, closeMonths, setSavingClose)
              }
            />
          }
        >
          {closeEnabled && (
            <div className="mt-2 flex items-center gap-2">
              <Label htmlFor="auto-close-months" className="text-muted-foreground text-sm">
                {t('settings.automations.closeAfter', 'Close after')}
              </Label>
              <Select
                value={String(closeMonths)}
                disabled={savingClose}
                onValueChange={(value) =>
                  void persist(
                    'close_in',
                    Number(value),
                    setCloseMonths,
                    closeMonths,
                    setSavingClose,
                  )
                }
              >
                <SelectTrigger id="auto-close-months" size="sm" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_OPTIONS.map((months) => (
                    <SelectItem key={months} value={String(months)}>
                      {monthLabel(months)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground text-sm">
                {t('settings.automations.ofInactivity', 'of inactivity')}
              </span>
            </div>
          )}
        </SettingRow>
      </div>
    </SettingsPanel>
  );
}
