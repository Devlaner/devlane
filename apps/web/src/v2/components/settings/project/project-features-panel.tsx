import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ClockIcon,
  FileTextIcon,
  InboxIcon,
  LayersIcon,
  LayoutGridIcon,
  TimerIcon,
  type LucideProps,
} from 'lucide-react';
import { Switch } from '@/v2/components/ui/switch';
import { SettingRow, SettingsPanel } from '@/v2/components/settings/settings-panel';
import { projectService } from '../../../../services/projectService';
import type { ProjectApiResponse } from '../../../../api/types';

interface ProjectFeaturesPanelProps {
  workspaceSlug: string;
  project: ProjectApiResponse;
  onProjectUpdated: (project: ProjectApiResponse) => void;
}

type FeatureKey =
  | 'cycle_view'
  | 'module_view'
  | 'issue_views_view'
  | 'page_view'
  | 'intake_view'
  | 'is_time_tracking_enabled';

/** Per-project feature toggles; each one persists on change. */
export function ProjectFeaturesPanel({
  workspaceSlug,
  project,
  onProjectUpdated,
}: ProjectFeaturesPanelProps) {
  const { t } = useTranslation();
  /* Seeded from the project and then owned locally: each toggle writes through
     and reverts itself on failure. The page remounts this panel per project,
     which reseeds these. An unsaved project leaves the fields undefined, which
     reads as the API's own defaults. */
  const [values, setValues] = useState<Record<FeatureKey, boolean>>({
    cycle_view: project.cycle_view ?? true,
    module_view: project.module_view ?? true,
    issue_views_view: project.issue_views_view ?? true,
    page_view: project.page_view ?? true,
    intake_view: project.intake_view ?? false,
    is_time_tracking_enabled: project.is_time_tracking_enabled ?? false,
  });

  const toggle = async (key: FeatureKey, next: boolean) => {
    const previous = values[key];
    setValues((v) => ({ ...v, [key]: next }));
    try {
      onProjectUpdated(await projectService.update(workspaceSlug, project.id, { [key]: next }));
    } catch {
      setValues((v) => ({ ...v, [key]: previous }));
    }
  };

  const features: {
    key: FeatureKey;
    label: string;
    desc: string;
    Icon: React.ComponentType<LucideProps>;
  }[] = [
    {
      key: 'cycle_view',
      label: t('settings.features.cycles.label', 'Cycles'),
      desc: t(
        'settings.features.cycles.desc',
        'Timebox work per project and adjust the time period as needed. One cycle can be 2 weeks, the next 1 week.',
      ),
      Icon: ClockIcon,
    },
    {
      key: 'module_view',
      label: t('settings.features.modules.label', 'Modules'),
      desc: t(
        'settings.features.modules.desc',
        'Organize work into sub-projects with dedicated leads and assignees.',
      ),
      Icon: LayoutGridIcon,
    },
    {
      key: 'issue_views_view',
      label: t('settings.features.views.label', 'Views'),
      desc: t(
        'settings.features.views.desc',
        'Save custom sorts, filters, and display options or share them with your team.',
      ),
      Icon: LayersIcon,
    },
    {
      key: 'page_view',
      label: t('settings.features.pages.label', 'Pages'),
      desc: t(
        'settings.features.pages.desc',
        'Create and edit free-form content; notes, docs, anything.',
      ),
      Icon: FileTextIcon,
    },
    {
      key: 'intake_view',
      label: t('settings.features.intake.label', 'Intake'),
      desc: t(
        'settings.features.intake.desc',
        'Let non-members share bugs, feedback, and suggestions; without disrupting your workflow.',
      ),
      Icon: InboxIcon,
    },
  ];

  return (
    <SettingsPanel
      title={t('settings.features.title', 'Projects and work items')}
      description={t('settings.features.subtitle', 'Toggle these on or off this project.')}
    >
      <div className="flex flex-col gap-3">
        {features.map(({ key, label, desc, Icon }) => (
          <SettingRow
            key={key}
            titleId={`feature-${key}-label`}
            title={label}
            description={desc}
            icon={<Icon className="size-4" />}
            control={
              <Switch
                checked={values[key]}
                aria-labelledby={`feature-${key}-label`}
                onCheckedChange={(next) => void toggle(key, next)}
              />
            }
          />
        ))}
      </div>

      <div>
        <h3 className="text-sm font-semibold">
          {t('settings.features.workManagement.title', 'Work management')}
        </h3>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {t(
            'settings.features.workManagement.subtitle',
            'Manage your work and projects with ease.',
          )}
        </p>
      </div>

      <SettingRow
        titleId="feature-time-tracking-label"
        title={t('settings.features.timeTracking.label', 'Time Tracking')}
        description={t(
          'settings.features.timeTracking.desc',
          'Log time spent on work items and projects.',
        )}
        icon={<TimerIcon className="size-4" />}
        control={
          <Switch
            checked={values.is_time_tracking_enabled}
            aria-labelledby="feature-time-tracking-label"
            onCheckedChange={(next) => void toggle('is_time_tracking_enabled', next)}
          />
        }
      />
    </SettingsPanel>
  );
}
