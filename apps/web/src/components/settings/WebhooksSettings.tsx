import { useCallback, useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Card, CardContent, Button, Modal } from '../ui';
import { Badge } from '../ui/Badge';
import { IconPlus, IconTrash, IconRefresh } from './icons';
import { webhookService, type WebhookPayload } from '../../services/webhookService';
import { formatRelativeTime } from '../../lib/settingsHelpers';
import type { WebhookApiResponse, WebhookLogApiResponse } from '../../api/types';

interface WebhooksSettingsProps {
  workspaceSlug: string;
}

type EventKey = 'project' | 'issue' | 'module' | 'cycle' | 'issue_comment';

const EVENTS: { key: EventKey; label: string; hint: string }[] = [
  { key: 'issue', label: 'Issues', hint: 'Created, updated, or deleted issues' },
  { key: 'project', label: 'Projects', hint: 'Project lifecycle changes' },
  { key: 'module', label: 'Modules', hint: 'Module changes' },
  { key: 'cycle', label: 'Cycles', hint: 'Cycle changes' },
  { key: 'issue_comment', label: 'Issue comments', hint: 'New comments on issues' },
];

const emptyForm = (): Record<EventKey, boolean> & { url: string } => ({
  url: '',
  project: false,
  issue: true,
  module: false,
  cycle: false,
  issue_comment: false,
});

/**
 * Outbound workspace webhooks (issue #195). Admins register HTTPS endpoints that
 * receive signed POST payloads when subscribed events fire, toggle which events
 * each delivers, and inspect recent delivery attempts. The signing secret is
 * shown once at creation. Non-admins get a 403 from the API, surfaced here.
 */
export function WebhooksSettings({ workspaceSlug }: WebhooksSettingsProps) {
  const { t } = useTranslation();
  const relTime = (iso?: string) =>
    iso ? formatRelativeTime(iso) : t('common.unknown', 'Unknown');
  const [webhooks, setWebhooks] = useState<WebhookApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());

  const [logsFor, setLogsFor] = useState<WebhookApiResponse | null>(null);
  const [logs, setLogs] = useState<WebhookLogApiResponse[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setWebhooks(await webhookService.list(workspaceSlug));
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setWebhooks([]);
      setLoadError(
        status === 403
          ? t(
              'settings.webhooks.error.adminOnlyManage',
              'Only workspace admins can manage webhooks.',
            )
          : t('settings.webhooks.error.load', 'Could not load webhooks.'),
      );
    } finally {
      setLoading(false);
    }
  }, [workspaceSlug, t]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    webhookService
      .list(workspaceSlug)
      .then((res) => {
        if (!cancelled) setWebhooks(res);
      })
      .catch((err) => {
        if (cancelled) return;
        const status = (err as { response?: { status?: number } })?.response?.status;
        setWebhooks([]);
        setLoadError(
          status === 403
            ? t(
                'settings.webhooks.error.adminOnlyManage',
                'Only workspace admins can manage webhooks.',
              )
            : t('settings.webhooks.error.load', 'Could not load webhooks.'),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, t]);

  const openCreate = () => {
    setForm(emptyForm());
    setCreatedSecret(null);
    setCreateError(null);
    setCreateOpen(true);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setCreatedSecret(null);
    setCreateError(null);
  };

  const anyEventSelected = useMemo(() => EVENTS.some((e) => form[e.key]), [form]);

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const payload: WebhookPayload = {
        url: form.url.trim(),
        project: form.project,
        issue: form.issue,
        module: form.module,
        cycle: form.cycle,
        issue_comment: form.issue_comment,
      };
      const created = await webhookService.create(workspaceSlug, payload);
      setCreatedSecret(created.secret_key ?? null);
      await load();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setCreateError(
        status === 400
          ? t('settings.webhooks.error.invalidUrl', 'Enter a valid public http(s) URL.')
          : status === 403
            ? t(
                'settings.webhooks.error.adminOnlyCreate',
                'Only workspace admins can create webhooks.',
              )
            : t(
                'settings.webhooks.error.create',
                'Could not create the webhook. Please try again.',
              ),
      );
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (w: WebhookApiResponse) => {
    setBusyId(w.id);
    setRowError(null);
    try {
      const updated = await webhookService.update(workspaceSlug, w.id, {
        is_active: !w.is_active,
      });
      setWebhooks((prev) => prev.map((x) => (x.id === w.id ? updated : x)));
    } catch {
      setRowError(
        t('settings.webhooks.error.update', 'Could not update the webhook. Please try again.'),
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (w: WebhookApiResponse) => {
    setBusyId(w.id);
    setRowError(null);
    try {
      await webhookService.remove(workspaceSlug, w.id);
      setWebhooks((prev) => prev.filter((x) => x.id !== w.id));
    } catch {
      setRowError(
        t('settings.webhooks.error.delete', 'Could not delete the webhook. Please try again.'),
      );
    } finally {
      setBusyId(null);
    }
  };

  const openLogs = async (w: WebhookApiResponse) => {
    setLogsFor(w);
    setLogs([]);
    setLogsError(null);
    setLogsLoading(true);
    try {
      setLogs(await webhookService.logs(workspaceSlug, w.id));
    } catch {
      setLogsError(t('settings.webhooks.error.logs', 'Could not load delivery logs.'));
    } finally {
      setLogsLoading(false);
    }
  };

  const subscribedEvents = (w: WebhookApiResponse) =>
    EVENTS.filter((e) => w[e.key]).map((e) => t(`settings.webhooks.event.${e.key}.label`, e.label));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-(--txt-primary)">
            {t('settings.webhooks.title', 'Webhooks')}
          </h2>
          <p className="mt-0.5 text-sm text-(--txt-secondary)">
            <Trans
              i18nKey="settings.webhooks.description"
              defaults="Send signed HTTP POST payloads to your own endpoints when events happen in this workspace. Each request carries an <code>X-Devlane-Signature</code> HMAC-SHA256 header you can verify with the signing secret."
              components={{ code: <code className="text-xs" /> }}
            />
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <IconPlus />
          {t('settings.webhooks.add', 'Add webhook')}
        </Button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-(--txt-tertiary)">
          {t('settings.webhooks.loading', 'Loading webhooks…')}
        </div>
      ) : loadError ? (
        <Card variant="outlined">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-(--txt-tertiary)">{loadError}</p>
          </CardContent>
        </Card>
      ) : webhooks.length === 0 ? (
        <Card variant="outlined">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-(--txt-tertiary)">
              {t('settings.webhooks.empty', 'No webhooks yet.')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rowError && <p className="text-sm text-(--txt-danger-primary)">{rowError}</p>}
          {webhooks.map((w) => {
            const events = subscribedEvents(w);
            return (
              <div
                key={w.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-(--radius-md) border border-(--border-subtle) px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-(--txt-primary)">{w.url}</p>
                    <Badge variant={w.is_active ? 'success' : 'neutral'}>
                      {w.is_active
                        ? t('settings.webhooks.status.active', 'Active')
                        : t('settings.webhooks.status.paused', 'Paused')}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-(--txt-tertiary)">
                    {events.length
                      ? events.join(', ')
                      : t('settings.webhooks.noEvents', 'No events')}{' '}
                    · {t('common.created', 'Created')} {relTime(w.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busyId === w.id}
                    onClick={() => openLogs(w)}
                  >
                    {t('settings.webhooks.logs', 'Logs')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busyId === w.id}
                    onClick={() => toggleActive(w)}
                  >
                    {w.is_active
                      ? t('settings.webhooks.pause', 'Pause')
                      : t('settings.webhooks.resume', 'Resume')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-1.5 text-(--txt-danger-primary)"
                    disabled={busyId === w.id}
                    onClick={() => handleDelete(w)}
                  >
                    <IconTrash />
                    {t('common.delete', 'Delete')}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create webhook modal */}
      <Modal
        open={createOpen}
        onClose={closeCreate}
        title={
          createdSecret !== null
            ? t('settings.webhooks.createdTitle', 'Webhook created')
            : t('settings.webhooks.add', 'Add webhook')
        }
      >
        {createdSecret !== null ? (
          <div className="space-y-4">
            <p className="text-sm text-(--txt-secondary)">
              <Trans
                i18nKey="settings.webhooks.secretHint"
                defaults="Copy this signing secret now; it will not be shown again. Use it to verify the <code>X-Devlane-Signature</code> header on incoming requests."
                components={{ code: <code className="text-xs" /> }}
              />
            </p>
            <div className="rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-layer-2) px-3 py-2 font-mono text-sm text-(--txt-primary) break-all">
              {createdSecret || t('settings.webhooks.noSecret', '(no secret returned)')}
            </div>
            <div className="flex justify-end">
              <Button onClick={closeCreate}>{t('common.done', 'Done')}</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
                {t('settings.webhooks.endpointUrl', 'Endpoint URL')}
              </label>
              <input
                type="url"
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://example.com/webhooks/devlane"
                className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none focus:border-(--border-strong)"
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-(--txt-secondary)">
                {t('settings.webhooks.events', 'Events')}
              </p>
              <div className="space-y-2">
                {EVENTS.map((e) => (
                  <label key={e.key} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={form[e.key]}
                      onChange={(ev) => setForm((f) => ({ ...f, [e.key]: ev.target.checked }))}
                      className="mt-0.5"
                    />
                    <span className="text-sm text-(--txt-primary)">
                      {t(`settings.webhooks.event.${e.key}.label`, e.label)}
                      <span className="block text-xs text-(--txt-tertiary)">
                        {t(`settings.webhooks.event.${e.key}.hint`, e.hint)}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            {createError && <p className="text-sm text-(--txt-danger-primary)">{createError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={closeCreate}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                disabled={!form.url.trim() || !anyEventSelected || creating}
                onClick={handleCreate}
              >
                {creating
                  ? t('settings.webhooks.creating', 'Creating…')
                  : t('settings.webhooks.create', 'Create webhook')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delivery logs modal */}
      <Modal
        open={logsFor !== null}
        onClose={() => setLogsFor(null)}
        title={t('settings.webhooks.deliveryLogs', 'Delivery logs')}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-xs text-(--txt-tertiary)">{logsFor?.url}</p>
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5"
              disabled={logsLoading || !logsFor}
              onClick={() => logsFor && openLogs(logsFor)}
            >
              <IconRefresh />
              {t('common.refresh', 'Refresh')}
            </Button>
          </div>
          {logsLoading ? (
            <p className="py-8 text-center text-sm text-(--txt-tertiary)">
              {t('common.loading', 'Loading…')}
            </p>
          ) : logsError ? (
            <p className="py-8 text-center text-sm text-(--txt-danger-primary)">{logsError}</p>
          ) : logs.length === 0 ? (
            <p className="py-8 text-center text-sm text-(--txt-tertiary)">
              {t('settings.webhooks.noDeliveries', 'No deliveries yet.')}
            </p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {logs.map((l) => {
                const code = parseInt(l.response_status, 10);
                const ok = !Number.isNaN(code) && code >= 200 && code < 300;
                return (
                  <div
                    key={l.id}
                    className="rounded-(--radius-md) border border-(--border-subtle) px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-(--txt-primary)">
                        {l.event_type}
                      </span>
                      <Badge variant={ok ? 'success' : 'danger'}>
                        {l.response_status || t('settings.webhooks.noResponse', 'no response')}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-(--txt-tertiary)">
                      {relTime(l.created_at)}
                      {l.retry_count > 0
                        ? ` · ${t('settings.webhooks.retriesCount', '{{count}} retries', { count: l.retry_count })}`
                        : ''}
                    </p>
                    {l.response_body && (
                      <p className="mt-1 truncate font-mono text-xs text-(--txt-tertiary)">
                        {l.response_body}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
