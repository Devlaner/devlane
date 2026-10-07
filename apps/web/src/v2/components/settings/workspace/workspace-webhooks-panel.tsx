import { useCallback, useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  CheckIcon,
  CopyIcon,
  PlusIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
  WebhookIcon,
} from 'lucide-react';
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
import { Alert, AlertDescription, AlertTitle } from '@/v2/components/ui/alert';
import { Badge } from '@/v2/components/ui/badge';
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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/v2/components/ui/empty';
import { Input } from '@/v2/components/ui/input';
import { Label } from '@/v2/components/ui/label';
import { ScrollArea } from '@/v2/components/ui/scroll-area';
import { Skeleton } from '@/v2/components/ui/skeleton';
import { SettingsPanel, apiErrorMessage } from '@/v2/components/settings/settings-panel';
import { formatRelativeTime } from '../../../../lib/settingsHelpers';
import { webhookService, type WebhookPayload } from '../../../../services/webhookService';
import type { WebhookApiResponse, WebhookLogApiResponse } from '../../../../api/types';

interface WorkspaceWebhooksPanelProps {
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
 * Outbound workspace webhooks. Admins register HTTPS endpoints that receive
 * signed POST payloads when subscribed events fire, toggle which events each
 * delivers, and inspect recent delivery attempts. The signing secret is shown
 * once at creation. Non-admins get a 403 from the API, surfaced here.
 */
export function WorkspaceWebhooksPanel({ workspaceSlug }: WorkspaceWebhooksPanelProps) {
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
  const [secretCopied, setSecretCopied] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const [pendingDelete, setPendingDelete] = useState<WebhookApiResponse | null>(null);

  const [logsFor, setLogsFor] = useState<WebhookApiResponse | null>(null);
  const [logs, setLogs] = useState<WebhookLogApiResponse[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);

  const readLoadError = useCallback(
    (error: unknown) =>
      (error as { response?: { status?: number } })?.response?.status === 403
        ? t('settings.webhooks.error.adminOnlyManage', 'Only workspace admins can manage webhooks.')
        : t('settings.webhooks.error.load', 'Could not load webhooks.'),
    [t],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setWebhooks(await webhookService.list(workspaceSlug));
    } catch (error) {
      setWebhooks([]);
      setLoadError(readLoadError(error));
    } finally {
      setLoading(false);
    }
  }, [workspaceSlug, readLoadError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const anyEventSelected = useMemo(() => EVENTS.some((e) => form[e.key]), [form]);

  const openCreate = () => {
    setForm(emptyForm());
    setCreatedSecret(null);
    setSecretCopied(false);
    setCreateError(null);
    setCreateOpen(true);
  };

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
      setCreatedSecret(created.secret_key ?? '');
      await refresh();
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      setCreateError(
        status === 400
          ? t('settings.webhooks.error.invalidUrl', 'Enter a valid public http(s) URL.')
          : status === 403
            ? t(
                'settings.webhooks.error.adminOnlyCreate',
                'Only workspace admins can create webhooks.',
              )
            : apiErrorMessage(
                error,
                t(
                  'settings.webhooks.error.create',
                  'Could not create the webhook. Please try again.',
                ),
              ),
      );
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (webhook: WebhookApiResponse) => {
    setBusyId(webhook.id);
    setRowError(null);
    try {
      const updated = await webhookService.update(workspaceSlug, webhook.id, {
        is_active: !webhook.is_active,
      });
      setWebhooks((prev) => prev.map((x) => (x.id === webhook.id ? updated : x)));
    } catch (error) {
      setRowError(
        apiErrorMessage(
          error,
          t('settings.webhooks.error.update', 'Could not update the webhook. Please try again.'),
        ),
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setBusyId(pendingDelete.id);
    setRowError(null);
    try {
      await webhookService.remove(workspaceSlug, pendingDelete.id);
      setWebhooks((prev) => prev.filter((x) => x.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch (error) {
      setRowError(
        apiErrorMessage(
          error,
          t('settings.webhooks.error.delete', 'Could not delete the webhook. Please try again.'),
        ),
      );
    } finally {
      setBusyId(null);
    }
  };

  const openLogs = async (webhook: WebhookApiResponse) => {
    setLogsFor(webhook);
    setLogs([]);
    setLogsError(null);
    setLogsLoading(true);
    try {
      setLogs(await webhookService.logs(workspaceSlug, webhook.id));
    } catch (error) {
      setLogsError(
        apiErrorMessage(error, t('settings.webhooks.error.logs', 'Could not load delivery logs.')),
      );
    } finally {
      setLogsLoading(false);
    }
  };

  const copySecret = async () => {
    if (!createdSecret) return;
    try {
      await navigator.clipboard.writeText(createdSecret);
      setSecretCopied(true);
    } catch {
      /* Clipboard access can be denied; the secret stays selectable on screen. */
    }
  };

  const subscribedEvents = (webhook: WebhookApiResponse) =>
    EVENTS.filter((e) => webhook[e.key]).map((e) =>
      t(`settings.webhooks.event.${e.key}.label`, e.label),
    );

  return (
    <SettingsPanel
      title={t('settings.webhooks.title', 'Webhooks')}
      description={
        <Trans
          i18nKey="settings.webhooks.description"
          defaults="Send signed HTTP POST payloads to your own endpoints when events happen in this workspace. Each request carries an <code>X-Devlane-Signature</code> HMAC-SHA256 header you can verify with the signing secret."
          components={{
            code: <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs" />,
          }}
        />
      }
      actions={
        <Button size="sm" onClick={openCreate}>
          <PlusIcon />
          {t('settings.webhooks.add', 'Add webhook')}
        </Button>
      }
    >
      {rowError && <p className="text-destructive text-sm">{rowError}</p>}

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : loadError ? (
        <Alert variant="destructive" className="border">
          <TriangleAlertIcon />
          <AlertTitle>{t('settings.webhooks.error.title', 'Webhooks unavailable')}</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : webhooks.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <WebhookIcon />
            </EmptyMedia>
            <EmptyTitle>{t('settings.webhooks.empty', 'No webhooks yet.')}</EmptyTitle>
            <EmptyDescription>
              {t(
                'settings.webhooks.emptyHint',
                'Add an endpoint to receive workspace events as they happen.',
              )}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {webhooks.map((webhook) => {
            const events = subscribedEvents(webhook);
            return (
              <div
                key={webhook.id}
                className="flex flex-wrap items-start justify-between gap-4 rounded-lg border px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="truncate font-mono text-sm font-medium">{webhook.url}</p>
                    <Badge variant={webhook.is_active ? 'default' : 'secondary'}>
                      {webhook.is_active
                        ? t('settings.webhooks.status.active', 'Active')
                        : t('settings.webhooks.status.paused', 'Paused')}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {events.length > 0 ? (
                      events.map((event) => (
                        <Badge key={event} variant="outline">
                          {event}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        {t('settings.webhooks.noEvents', 'No events')}
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-2 text-xs">
                    {t('common.created', 'Created')} {relTime(webhook.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId === webhook.id}
                    onClick={() => void openLogs(webhook)}
                  >
                    {t('settings.webhooks.logs', 'Logs')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId === webhook.id}
                    onClick={() => void toggleActive(webhook)}
                  >
                    {webhook.is_active
                      ? t('settings.webhooks.pause', 'Pause')
                      : t('settings.webhooks.resume', 'Resume')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={busyId === webhook.id}
                    onClick={() => setPendingDelete(webhook)}
                  >
                    {t('common.delete', 'Delete')}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create webhook */}
      <Dialog open={createOpen} onOpenChange={(open) => !creating && setCreateOpen(open)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {createdSecret !== null
                ? t('settings.webhooks.createdTitle', 'Webhook created')
                : t('settings.webhooks.add', 'Add webhook')}
            </DialogTitle>
            <DialogDescription>
              {createdSecret !== null ? (
                <Trans
                  i18nKey="settings.webhooks.secretHint"
                  defaults="Copy this signing secret now; it will not be shown again. Use it to verify the <code>X-Devlane-Signature</code> header on incoming requests."
                  components={{
                    code: <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs" />,
                  }}
                />
              ) : (
                t(
                  'settings.webhooks.createDescription',
                  'Point the webhook at a public http(s) endpoint and pick the events it should receive.',
                )
              )}
            </DialogDescription>
          </DialogHeader>

          {createdSecret !== null ? (
            <>
              <div className="bg-muted flex items-start gap-2 rounded-md border px-3 py-2">
                <code className="min-w-0 flex-1 font-mono text-sm break-all">
                  {createdSecret || t('settings.webhooks.noSecret', '(no secret returned)')}
                </code>
                {createdSecret && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    aria-label={t('common.copy', 'Copy')}
                    onClick={() => void copySecret()}
                  >
                    {secretCopied ? <CheckIcon /> : <CopyIcon />}
                  </Button>
                )}
              </div>
              <DialogFooter>
                <Button onClick={() => setCreateOpen(false)}>{t('common.done', 'Done')}</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <form
                id="create-webhook-v2-form"
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleCreate();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="webhook-url">
                    {t('settings.webhooks.endpointUrl', 'Endpoint URL')}
                  </Label>
                  <Input
                    id="webhook-url"
                    type="url"
                    value={form.url}
                    onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                    placeholder="https://example.com/webhooks/devlane"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('settings.webhooks.events', 'Events')}</Label>
                  <div className="flex flex-col gap-2">
                    {EVENTS.map((event) => (
                      <Label
                        key={event.key}
                        htmlFor={`webhook-event-${event.key}`}
                        className="flex items-start gap-3 rounded-lg border px-3 py-2.5 font-normal"
                      >
                        <Checkbox
                          id={`webhook-event-${event.key}`}
                          checked={form[event.key]}
                          onCheckedChange={(checked) =>
                            setForm((f) => ({ ...f, [event.key]: checked === true }))
                          }
                          className="mt-0.5"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">
                            {t(`settings.webhooks.event.${event.key}.label`, event.label)}
                          </span>
                          <span className="text-muted-foreground block text-xs">
                            {t(`settings.webhooks.event.${event.key}.hint`, event.hint)}
                          </span>
                        </span>
                      </Label>
                    ))}
                  </div>
                </div>
                {createError && <p className="text-destructive text-sm">{createError}</p>}
              </form>
              <DialogFooter>
                <Button variant="outline" disabled={creating} onClick={() => setCreateOpen(false)}>
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  type="submit"
                  form="create-webhook-v2-form"
                  disabled={!form.url.trim() || !anyEventSelected || creating}
                >
                  {creating
                    ? t('settings.webhooks.creating', 'Creating…')
                    : t('settings.webhooks.create', 'Create webhook')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delivery logs */}
      <Dialog open={logsFor !== null} onOpenChange={(open) => !open && setLogsFor(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('settings.webhooks.deliveryLogs', 'Delivery logs')}</DialogTitle>
            <DialogDescription className="truncate font-mono">{logsFor?.url}</DialogDescription>
          </DialogHeader>

          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={logsLoading || !logsFor}
              onClick={() => logsFor && void openLogs(logsFor)}
            >
              <RefreshCwIcon />
              {t('common.refresh', 'Refresh')}
            </Button>
          </div>

          {logsLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : logsError ? (
            <p className="text-destructive py-6 text-center text-sm">{logsError}</p>
          ) : logs.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {t('settings.webhooks.noDeliveries', 'No deliveries yet.')}
            </p>
          ) : (
            <ScrollArea className="max-h-80">
              <div className="flex flex-col gap-2 pr-3">
                {logs.map((log) => {
                  const code = parseInt(log.response_status, 10);
                  const ok = !Number.isNaN(code) && code >= 200 && code < 300;
                  return (
                    <div key={log.id} className="rounded-lg border px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{log.event_type}</span>
                        <Badge variant={ok ? 'default' : 'destructive'}>
                          {log.response_status || t('settings.webhooks.noResponse', 'no response')}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {relTime(log.created_at)}
                        {log.retry_count > 0
                          ? ` · ${t('settings.webhooks.retriesCount', '{{count}} retries', {
                              count: log.retry_count,
                            })}`
                          : ''}
                      </p>
                      {log.response_body && (
                        <p className="text-muted-foreground mt-1 truncate font-mono text-xs">
                          {log.response_body}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('settings.webhooks.deleteTitle', 'Delete this webhook?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'settings.webhooks.deleteDescription',
                'Deliveries to this endpoint stop immediately. This cannot be undone.',
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyId !== null}>
              {t('common.cancel', 'Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={busyId !== null}
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {t('common.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsPanel>
  );
}
