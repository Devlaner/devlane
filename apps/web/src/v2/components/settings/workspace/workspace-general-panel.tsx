import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PencilIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/v2/components/ui/avatar';
import { Button } from '@/v2/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/v2/components/ui/card';
import { Input } from '@/v2/components/ui/input';
import { Label } from '@/v2/components/ui/label';
import { SettingsPanel, apiErrorMessage } from '@/v2/components/settings/settings-panel';
import { UploadImageModal } from '../../../../components/UploadImageModal';
import { getImageUrl } from '../../../../lib/utils';
import { workspaceService } from '../../../../services/workspaceService';
import type { WorkspaceApiResponse } from '../../../../api/types';

interface WorkspaceGeneralPanelProps {
  workspace: WorkspaceApiResponse;
  onWorkspaceUpdated: (workspace: WorkspaceApiResponse) => void;
}

/** Workspace identity: logo, name, and its (read-only) URL. */
export function WorkspaceGeneralPanel({
  workspace,
  onWorkspaceUpdated,
}: WorkspaceGeneralPanelProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(workspace.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoModalOpen, setLogoModalOpen] = useState(false);

  useEffect(() => {
    setName(workspace.name);
  }, [workspace.id, workspace.name]);

  const workspaceUrl = `${window.location.origin}/${workspace.slug}`;
  const logoUrl = getImageUrl(workspace.logo);

  const save = async () => {
    if (!name.trim()) return;
    setError(null);
    setSaving(true);
    try {
      onWorkspaceUpdated(await workspaceService.update(workspace.slug, { name: name.trim() }));
    } catch (e) {
      setError(
        apiErrorMessage(e, t('settings.workspace.updateError', 'Failed to update workspace')),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsPanel
      title={t('settings.workspace.generalTitle', 'General')}
      description={t(
        'settings.workspace.generalDescription',
        'Everyone in this workspace sees these details.',
      )}
    >
      <div className="flex items-center gap-4">
        <Avatar className="size-14 rounded-lg">
          {logoUrl && <AvatarImage src={logoUrl} alt="" />}
          <AvatarFallback className="rounded-lg text-lg">
            {workspace.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{name || workspace.name}</p>
          <p className="text-muted-foreground truncate text-sm">{workspaceUrl}</p>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => setLogoModalOpen(true)}
          >
            <PencilIcon />
            {t('settings.workspace.editLogo', 'Edit logo')}
          </Button>
        </div>
      </div>

      <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="workspace-name">{t('settings.workspace.name', 'Workspace name')}</Label>
          <Input id="workspace-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="workspace-url">{t('settings.workspace.url', 'Workspace URL')}</Label>
          <Input id="workspace-url" value={workspaceUrl} readOnly disabled />
        </div>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
      <div>
        <Button disabled={saving || !name.trim()} onClick={() => void save()}>
          {saving
            ? t('common.updating', 'Updating…')
            : t('settings.workspace.update', 'Update workspace')}
        </Button>
      </div>

      {/* The API has no workspace-delete endpoint yet, so the control states the
          route that does exist rather than offering an action that would fail. */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive text-base">
            {t('settings.workspace.delete.title', 'Delete this workspace')}
          </CardTitle>
          <CardDescription>
            {t(
              'settings.workspace.delete.description',
              'This action cannot be undone. All projects and data in this workspace will be permanently removed.',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="text-destructive" disabled>
            {t('settings.workspace.delete.button', 'Delete workspace')}
          </Button>
          <p className="text-muted-foreground mt-2 text-sm">
            {t(
              'settings.workspace.delete.instanceAdminOnly',
              'Workspaces are deleted by an instance administrator.',
            )}
          </p>
        </CardContent>
      </Card>

      <UploadImageModal
        open={logoModalOpen}
        onClose={() => setLogoModalOpen(false)}
        onSave={async (url) => {
          try {
            onWorkspaceUpdated(await workspaceService.update(workspace.slug, { logo: url }));
          } catch {
            /* The modal surfaces upload failures itself. */
          }
        }}
        title={t('settings.workspace.uploadLogo', 'Upload workspace logo')}
      />
    </SettingsPanel>
  );
}
