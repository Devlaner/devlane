import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Modal } from '../ui';
import { integrationService } from '../../services/integrationService';
import { getApiErrorMessage } from '../../api/client';
import type { ProjectApiResponse, SlackChannel, SlackChannelLinkResponse } from '../../api/types';

interface SlackChannelSettingsModalProps {
  open: boolean;
  onClose: () => void;
  workspaceSlug: string;
  project: ProjectApiResponse;
  initialLink: SlackChannelLinkResponse | null;
  onSaved: (next: SlackChannelLinkResponse | null) => void;
}

export function SlackChannelSettingsModal({
  open,
  onClose,
  workspaceSlug,
  project,
  initialLink,
  onSaved,
}: SlackChannelSettingsModalProps) {
  const { t } = useTranslation();

  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');

  // Events
  const [eventCreated, setEventCreated] = useState(true);
  const [eventStateChanged, setEventStateChanged] = useState(true);
  const [eventCommented, setEventCommented] = useState(true);

  useEffect(() => {
    if (!open) return;
    setError('');

    if (initialLink) {
      setEventCreated(initialLink.events?.created ?? true);
      setEventStateChanged(initialLink.events?.state_changed ?? true);
      setEventCommented(initialLink.events?.commented ?? true);
    } else {
      // Load channels to pick from
      setLoadingChannels(true);
      integrationService
        .slackListChannels(workspaceSlug)
        .then((list) => {
          setChannels(list ?? []);
          if (list && list.length > 0) {
            setSelectedChannelId(list[0].id);
          }
        })
        .catch((e) => setError(getApiErrorMessage(e)))
        .finally(() => setLoadingChannels(false));
    }
  }, [open, workspaceSlug, initialLink]);

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      if (initialLink) {
        // Update events
        const next = await integrationService.slackUpdateProjectChannel(workspaceSlug, project.id, {
          created: eventCreated,
          state_changed: eventStateChanged,
          commented: eventCommented,
        });
        onSaved(next);
      } else {
        // Link channel
        if (!selectedChannelId) {
          throw new Error(
            t('integrations.slack.selectChannelRequired', 'Please select a channel.'),
          );
        }
        const channelName = channels.find((c) => c.id === selectedChannelId)?.name;
        if (!channelName) {
          throw new Error(
            t('integrations.slack.selectChannelRequired', 'Please select a channel.'),
          );
        }
        const next = await integrationService.slackLinkProjectChannel(workspaceSlug, project.id, {
          channel_id: selectedChannelId,
          channel_name: channelName,
        });
        onSaved(next);
        const withEvents = await integrationService.slackUpdateProjectChannel(
          workspaceSlug,
          project.id,
          {
            created: eventCreated,
            state_changed: eventStateChanged,
            commented: eventCommented,
          },
        );
        onSaved(withEvents);
      }
      onClose();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm(t('integrations.slack.unlinkConfirm', 'Unlink Slack channel from this project?')))
      return;
    setError('');
    setSaving(true);
    try {
      await integrationService.slackUnlinkProjectChannel(workspaceSlug, project.id);
      onSaved(null);
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
      title={t('integrations.slack.modalTitle', 'Slack notifications for {{name}}', {
        name: project.name,
      })}
      footer={
        <div className="flex w-full items-center justify-between">
          <div>
            {initialLink && (
              <Button variant="danger" onClick={() => void handleUnlink()} disabled={saving}>
                {t('integrations.unlink', 'Unlink')}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={() => void handleSave()}
              disabled={saving || (!initialLink && !selectedChannelId)}
            >
              {saving
                ? t('common.saving', 'Saving…')
                : initialLink
                  ? t('common.save', 'Save')
                  : t('integrations.link', 'Link')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {error && (
          <div className="rounded-(--radius-md) border border-(--border-danger-subtle) bg-(--bg-danger-subtle) px-3 py-2 text-sm text-(--txt-danger-primary)">
            {error}
          </div>
        )}

        {!initialLink ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-(--txt-primary)">
              {t('integrations.slack.selectChannel', 'Select channel')}
            </label>
            {loadingChannels ? (
              <p className="text-sm text-(--txt-secondary)">{t('common.loading', 'Loading…')}</p>
            ) : channels.length > 0 ? (
              <select
                className="w-full rounded-(--radius-md) border border-(--border-primary) bg-(--bg-primary) px-3 py-2 text-sm text-(--txt-primary)"
                value={selectedChannelId}
                onChange={(e) => setSelectedChannelId(e.target.value)}
              >
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-(--txt-secondary)">
                {t(
                  'integrations.slack.noChannels',
                  'No public channels found. Ensure the bot is invited to your Slack workspace.',
                )}
              </p>
            )}
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-(--txt-primary)">
              {t('integrations.slack.linkedChannel', 'Linked Channel: #{{name}}', {
                name: initialLink.channel_name,
              })}
            </p>
          </div>
        )}

        {(initialLink || (!initialLink && channels.length > 0)) && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-(--txt-primary)">
              {t('integrations.slack.notifyOn', 'Notify channel when:')}
            </p>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={eventCreated}
                onChange={(e) => setEventCreated(e.target.checked)}
                className="rounded border-(--border-primary)"
              />
              <span className="text-sm text-(--txt-secondary)">
                {t('integrations.slack.eventCreated', 'New issues are created')}
              </span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={eventStateChanged}
                onChange={(e) => setEventStateChanged(e.target.checked)}
                className="rounded border-(--border-primary)"
              />
              <span className="text-sm text-(--txt-secondary)">
                {t(
                  'integrations.slack.eventState',
                  'Issue states change (e.g. In Progress → Done)',
                )}
              </span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={eventCommented}
                onChange={(e) => setEventCommented(e.target.checked)}
                className="rounded border-(--border-primary)"
              />
              <span className="text-sm text-(--txt-secondary)">
                {t('integrations.slack.eventCommented', 'New comments are added')}
              </span>
            </label>
          </div>
        )}
      </div>
    </Modal>
  );
}
