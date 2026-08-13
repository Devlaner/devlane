import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/v2/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/v2/components/ui/alert-dialog';
import { Input } from '@/v2/components/ui/input';
import { Label } from '@/v2/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/v2/components/ui/select';
import { Textarea } from '@/v2/components/ui/textarea';
import {
  SettingsPanel,
  SettingRow,
  apiErrorMessage,
} from '@/v2/components/settings/settings-panel';
import { TimezoneCombobox } from '@/v2/components/settings/timezone-combobox';
import { CoverImageModal } from '../../../../components/CoverImageModal';
import { ProjectIconDisplay, ProjectIconModal } from '../../../../components/ProjectIconModal';
import { getImageUrl } from '../../../../lib/utils';
import { projectService } from '../../../../services/projectService';
import type { ProjectApiResponse } from '../../../../api/types';

interface ProjectGeneralPanelProps {
  workspaceSlug: string;
  project: ProjectApiResponse;
  onProjectUpdated: (project: ProjectApiResponse) => void;
  onProjectArchived: (projectId: string) => void;
}

/** Project identity: cover, icon, name, description, visibility, and timezone. */
export function ProjectGeneralPanel({
  workspaceSlug,
  project,
  onProjectUpdated,
  onProjectArchived,
}: ProjectGeneralPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const [timezone, setTimezone] = useState(project.timezone ?? 'UTC');
  /* The API stores visibility as a number: 2 is public, 0 is secret. */
  const [network, setNetwork] = useState(project.network === 0 ? 'private' : 'public');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverOpen, setCoverOpen] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    setName(project.name);
    setDescription(project.description ?? '');
    setTimezone(project.timezone ?? 'UTC');
    setNetwork(project.network === 0 ? 'private' : 'public');
  }, [project.id, project.name, project.description, project.timezone, project.network]);

  const coverUrl = getImageUrl(project.cover_image);

  const save = async () => {
    if (!name.trim()) return;
    setError(null);
    setSaving(true);
    try {
      onProjectUpdated(
        await projectService.update(workspaceSlug, project.id, {
          name: name.trim(),
          description,
          timezone,
        }),
      );
    } catch (e) {
      setError(apiErrorMessage(e, t('settings.project.updateError', 'Failed to update project')));
    } finally {
      setSaving(false);
    }
  };

  const changeNetwork = async (value: string) => {
    const previous = network;
    setNetwork(value);
    try {
      onProjectUpdated(
        await projectService.update(workspaceSlug, project.id, {
          network: value === 'public' ? 2 : 0,
        }),
      );
    } catch {
      setNetwork(previous);
    }
  };

  const archive = async () => {
    setArchiving(true);
    try {
      await projectService.archive(workspaceSlug, project.id);
      onProjectArchived(project.id);
      navigate(`/${workspaceSlug}/projects`);
    } catch {
      setError(t('settings.project.archive.error', 'Failed to archive project.'));
      setArchiving(false);
    }
  };

  return (
    <SettingsPanel
      title={t('settings.project.generalTitle', 'General')}
      description={t(
        'settings.project.generalDescription',
        'How this project appears across the workspace.',
      )}
    >
      <div className="relative">
        <div
          className="bg-muted h-36 w-full overflow-hidden rounded-lg bg-cover bg-center"
          style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
        />
        <Button
          variant="secondary"
          size="sm"
          className="absolute right-2 bottom-2"
          onClick={() => setCoverOpen(true)}
        >
          {t('settings.cover.change', 'Change cover')}
        </Button>
        <div className="flex items-end gap-3 px-4">
          <button
            type="button"
            onClick={() => setIconOpen(true)}
            className="bg-background ring-background focus-visible:ring-ring -mt-6 flex size-12 items-center justify-center rounded-xl ring-4 focus-visible:ring-2 focus-visible:outline-none"
            aria-label={t('settings.project.changeIcon', 'Change project icon')}
          >
            <ProjectIconDisplay emoji={project.emoji} icon_prop={project.icon_prop} size={24} />
          </button>
          <div className="min-w-0 pb-1">
            <p className="truncate text-base font-semibold">{name || project.name}</p>
            <p className="text-muted-foreground text-sm">{project.identifier}</p>
          </div>
        </div>
      </div>

      <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="project-name">{t('settings.project.name', 'Project name')}</Label>
          <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="project-description">{t('common.description', 'Description')}</Label>
          <Textarea
            id="project-description"
            rows={3}
            value={description}
            placeholder={t('settings.project.descriptionPlaceholder', 'Description...')}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-identifier">{t('settings.project.id', 'Project ID')}</Label>
          <Input id="project-identifier" value={project.identifier} readOnly disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-network">{t('settings.project.visibility', 'Visibility')}</Label>
          <Select value={network} onValueChange={(value) => void changeNetwork(value)}>
            <SelectTrigger id="project-network" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">{t('settings.project.public', 'Public')}</SelectItem>
              <SelectItem value="private">{t('settings.project.private', 'Private')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="project-timezone">
            {t('settings.project.timezone', 'Project Timezone')}
          </Label>
          <div className="max-w-sm">
            <TimezoneCombobox id="project-timezone" value={timezone} onChange={setTimezone} />
          </div>
        </div>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
      <div className="flex items-center gap-3">
        <Button disabled={saving || !name.trim()} onClick={() => void save()}>
          {saving
            ? t('common.updating', 'Updating…')
            : t('settings.project.update', 'Update project')}
        </Button>
        {project.created_at && (
          <p className="text-muted-foreground text-sm">
            {t('settings.project.createdOn', 'Created on {{date}}', {
              date: new Date(project.created_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              }),
            })}
          </p>
        )}
      </div>

      <SettingRow
        title={t('settings.project.archive.title', 'Archive project')}
        description={t(
          'settings.project.archive.description',
          'Hide this project and its work from the workspace. You can restore it later from Archives.',
        )}
        control={
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            disabled={archiving}
            onClick={() => setArchiveOpen(true)}
          >
            {archiving
              ? t('settings.project.archive.busy', 'Archiving…')
              : t('settings.project.archive.title', 'Archive project')}
          </Button>
        }
      />

      <AlertDialog open={archiveOpen} onOpenChange={(open) => !archiving && setArchiveOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('settings.project.archive.confirmTitle', 'Archive this project?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'settings.project.archive.description',
                'Hide this project and its work from the workspace. You can restore it later from Archives.',
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>
              {t('common.cancel', 'Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={archiving}
              onClick={(e) => {
                e.preventDefault();
                void archive();
              }}
            >
              {archiving
                ? t('settings.project.archive.busy', 'Archiving…')
                : t('settings.project.archive.confirm', 'Archive')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CoverImageModal
        open={coverOpen}
        onClose={() => setCoverOpen(false)}
        onSelect={async (url) => {
          try {
            onProjectUpdated(
              await projectService.update(workspaceSlug, project.id, { cover_image: url }),
            );
          } catch {
            /* The modal surfaces upload failures itself. */
          }
        }}
        title={t('settings.project.selectCover', 'Select project cover')}
      />
      <ProjectIconModal
        open={iconOpen}
        onClose={() => setIconOpen(false)}
        currentEmoji={project.emoji}
        currentIconProp={project.icon_prop}
        onSelect={async (selection) => {
          try {
            const payload =
              selection.emoji != null
                ? { emoji: selection.emoji, icon_prop: undefined }
                : { emoji: undefined, icon_prop: selection.icon_prop ?? undefined };
            onProjectUpdated(await projectService.update(workspaceSlug, project.id, payload));
          } catch {
            /* The modal surfaces failures itself. */
          }
        }}
        title={t('settings.project.iconModalTitle', 'Project icon')}
      />
    </SettingsPanel>
  );
}
