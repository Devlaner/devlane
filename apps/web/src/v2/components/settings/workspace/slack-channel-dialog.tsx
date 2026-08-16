import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/v2/components/ui/button';
import { Checkbox } from '@/v2/components/ui/checkbox';
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
import { Skeleton } from '@/v2/components/ui/skeleton';
import { getApiErrorMessage } from '../../../../api/client';
import { integrationService } from '../../../../services/integrationService';
import type {
  ProjectApiResponse,
  SlackChannel,
  SlackChannelLinkResponse,
} from '../../../../api/types';

interface SlackChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceSlug: string;
  project: ProjectApiResponse;
  initialLink: SlackChannelLinkResponse | null;
  onSaved: (next: SlackChannelLinkResponse | null) => void;
}

type EventKey = 'created' | 'state_changed' | 'commented';

/** `i18nKey` reuses the shipped interface's wording so both stay translated. */
const EVENTS: { key: EventKey; i18nKey: string; label: string }[] = [
  { key: 'created', i18nKey: 'integrations.slack.eventCreated', label: 'New issues are created' },
  {
    key: 'state_changed',
    i18nKey: 'integrations.slack.eventState',
    label: 'Issue states change (e.g. In Progress → Done)',
  },
  {
    key: 'commented',
    i18nKey: 'integrations.slack.eventCommented',
    label: 'New comments are added',
  },
];

/** Links a project to a Slack channel and picks which events post to it. */
export function SlackChannelDialog({
  open,
  onOpenChange,
  workspaceSlug,
  project,
  initialLink,
  onSaved,
}: SlackChannelDialogProps) {
  const { t } = useTranslation();
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [events, setEvents] = useState<Record<EventKey, boolean>>({
    created: true,
    state_changed: true,
    commented: true,
  });

  useEffect(() => {
    if (!open) return;
    setError('');
    setEvents({
      created: initialLink?.events?.created ?? true,
      state_changed: initialLink?.events?.state_changed ?? true,
      commented: initialLink?.events?.commented ?? true,
    });
    if (initialLink) return;

    // Only an unlinked project needs the channel list to pick from.
    setSelectedChannelId('');
    setLoadingChannels(true);
    integrationService
      .slackListChannels(workspaceSlug)
      .then((list) => {
        setChannels(list ?? []);
        if (list && list.length > 0) setSelectedChannelId(list[0].id);
      })
      .catch((e) => setError(getApiErrorMessage(e)))
      .finally(() => setLoadingChannels(false));
  }, [open, workspaceSlug, initialLink]);

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      if (!initialLink) {
        const channelName = channels.find((c) => c.id === selectedChannelId)?.name;
        if (!channelName) {
          throw new Error(
            t('integrations.slack.selectChannelRequired', 'Please select a channel.'),
          );
        }
        onSaved(
          await integrationService.slackLinkProjectChannel(workspaceSlug, project.id, {
            channel_id: selectedChannelId,
            channel_name: channelName,
          }),
        );
      }
      onSaved(
        await integrationService.slackUpdateProjectChannel(workspaceSlug, project.id, events),
      );
      onOpenChange(false);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const canSave = initialLink !== null || selectedChannelId !== '';

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t('integrations.slack.modalTitle', 'Slack notifications for {{name}}', {
              name: project.name,
            })}
          </DialogTitle>
          <DialogDescription>
            {initialLink
              ? t('integrations.slack.linkedChannel', 'Linked channel: #{{name}}', {
                  name: initialLink.channel_name,
                })
              : t(
                  'integrations.slack.pickChannelHint',
                  'Pick a public channel the Devlane bot has joined.',
                )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {error && <p className="text-destructive text-sm">{error}</p>}

          {!initialLink && (
            <div className="space-y-2">
              <Label htmlFor="slack-channel">
                {t('integrations.slack.selectChannel', 'Select channel')}
              </Label>
              {loadingChannels ? (
                <Skeleton className="h-9 w-full" />
              ) : channels.length > 0 ? (
                <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
                  <SelectTrigger id="slack-channel" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {channels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        #{channel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {t(
                    'integrations.slack.noChannels',
                    'No public channels found. Ensure the bot is invited to your Slack workspace.',
                  )}
                </p>
              )}
            </div>
          )}

          {(initialLink || channels.length > 0) && (
            <div className="space-y-2">
              <Label>{t('integrations.slack.notifyOn', 'Notify the channel when')}</Label>
              <div className="flex flex-col gap-2">
                {EVENTS.map((event) => (
                  <Label
                    key={event.key}
                    htmlFor={`slack-event-${event.key}`}
                    className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-normal"
                  >
                    <Checkbox
                      id={`slack-event-${event.key}`}
                      checked={events[event.key]}
                      onCheckedChange={(checked) =>
                        setEvents((prev) => ({ ...prev, [event.key]: checked === true }))
                      }
                    />
                    {t(event.i18nKey, event.label)}
                  </Label>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button disabled={saving || !canSave} onClick={() => void handleSave()}>
            {saving
              ? t('common.saving', 'Saving…')
              : initialLink
                ? t('common.save', 'Save')
                : t('integrations.link', 'Link')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
