import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Archive, ArchiveRestore, Inbox } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/shadcn/ui/avatar';
import { Badge } from '@/components/shadcn/ui/badge';
import { Button } from '@/components/shadcn/ui/button';
import { Skeleton } from '@/components/shadcn/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/shadcn/ui/tabs';
import { NotificationContent } from '../components/notifications/NotificationContent';
import { SnoozeMenu } from '../components/notifications/SnoozeMenu';
import { useSetV2Header } from '../contexts/AppShellV2HeaderContext';
import { formatTimeAgo } from '../lib/projectV2';
import { notificationService } from '../services/notificationService';
import { workspaceService } from '../services/workspaceService';
import type { NotificationApiResponse, WorkspaceApiResponse } from '../api/types';

type InboxTab = 'all' | 'mentions' | 'archived';

const TABS: { id: InboxTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'mentions', label: 'Mentions' },
  { id: 'archived', label: 'Archived' },
];

/** Actor, work item reference and name, tolerating partial system payloads. */
function rowLabels(n: NotificationApiResponse, fallbackActor: string) {
  const actor = n.message?.actor?.display_name ?? fallbackActor;
  const issue = n.message?.issue;
  const ref =
    issue?.project_identifier && issue.sequence_id != null
      ? `${issue.project_identifier}-${issue.sequence_id}`
      : '—';
  return { actor, ref, issueName: issue?.name ?? '' };
}

/** First letters of a display name, for the avatar fallback. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Design preview of the workspace inbox, built from shadcn primitives. It
 * stands alongside NotificationsPage rather than replacing it, so the two can
 * be compared side by side.
 *
 * The shipped page carries its tabs and its "mark all read" button inside the
 * list column. Here the tabs stay with the list they filter, but the actions
 * that apply to the selected row move into the shell's header — the v2 shell
 * has one header row for exactly this, and stacking a second one inside the
 * page is what the shipped layout ends up doing.
 */
export function NotificationsPageV2() {
  const { t } = useTranslation();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const navigate = useNavigate();

  const [inboxTab, setInboxTab] = useState<InboxTab>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [notifications, setNotifications] = useState<NotificationApiResponse[]>([]);
  const [loading, setLoading] = useState(Boolean(workspaceSlug));
  const [error, setError] = useState<string | null>(null);
  /* IDs the user explicitly marked unread in this session; the auto-mark-read
     effect below skips them so the toggle actually sticks. */
  const [explicitUnreadIds, setExplicitUnreadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!workspaceSlug) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the spinner belongs to this fetch
    setLoading(true);
    Promise.all([
      workspaceService.getBySlug(workspaceSlug),
      notificationService.list(workspaceSlug, {
        mentionsOnly: inboxTab === 'mentions',
        archived: inboxTab === 'archived' ? 'archived' : 'inbox',
      }),
    ])
      .then(([w, list]) => {
        if (cancelled) return;
        setWorkspace(w ?? null);
        setNotifications(list ?? []);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setNotifications([]);
        setError(t('notifications.loadError', 'Could not load notifications.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, inboxTab, t]);

  const selected = useMemo(
    () => (selectedId ? (notifications.find((n) => n.id === selectedId) ?? null) : null),
    [notifications, selectedId],
  );

  /* Auto-mark-on-select. Skipped on the Archived tab — re-reading archived rows
     should not flip them to read silently — and skipped for rows the user just
     marked unread, which would otherwise be re-marked read immediately. */
  useEffect(() => {
    if (!workspaceSlug || !selected || selected.read_at || inboxTab === 'archived') return;
    if (explicitUnreadIds.has(selected.id)) return;
    let cancelled = false;
    notificationService
      .markRead(workspaceSlug, selected.id)
      .then(() => {
        if (cancelled) return;
        setNotifications((prev) =>
          prev.map((n) => (n.id === selected.id ? { ...n, read_at: new Date().toISOString() } : n)),
        );
      })
      .catch(() => {
        /* Read state is best-effort; a failure won't block the UI. */
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, selected, inboxTab, explicitUnreadIds]);

  const removeFromList = (id: string) =>
    setNotifications((prev) => prev.filter((n) => n.id !== id));

  const onArchiveRow = useCallback(
    async (id: string) => {
      if (!workspaceSlug) return;
      await notificationService.archive(workspaceSlug, id);
      if (inboxTab === 'archived') {
        /* Already in the archive view — keep it visible for the unarchive affordance. */
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, archived_at: new Date().toISOString() } : n)),
        );
        return;
      }
      removeFromList(id);
      setSelectedId((prev) => (prev === id ? null : prev));
    },
    [workspaceSlug, inboxTab],
  );

  const onUnarchiveRow = useCallback(
    async (id: string) => {
      if (!workspaceSlug) return;
      await notificationService.unarchive(workspaceSlug, id);
      if (inboxTab === 'archived') {
        removeFromList(id);
        setSelectedId((prev) => (prev === id ? null : prev));
      } else {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, archived_at: null } : n)),
        );
      }
    },
    [workspaceSlug, inboxTab],
  );

  const onMarkAllRead = useCallback(async () => {
    if (!workspaceSlug) return;
    await notificationService.markAllRead(workspaceSlug);
    const refreshed = await notificationService.list(workspaceSlug, {
      mentionsOnly: inboxTab === 'mentions',
      archived: inboxTab === 'archived' ? 'archived' : 'inbox',
    });
    setNotifications(refreshed ?? []);
  }, [workspaceSlug, inboxTab]);

  const onToggleReadOnSelected = useCallback(async () => {
    if (!workspaceSlug || !selected) return;
    if (selected.read_at) {
      await notificationService.markUnread(workspaceSlug, selected.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === selected.id ? { ...n, read_at: null } : n)),
      );
      /* Remember the user wanted this unread; the auto-mark effect will skip it. */
      setExplicitUnreadIds((prev) => new Set(prev).add(selected.id));
    } else {
      await notificationService.markRead(workspaceSlug, selected.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === selected.id ? { ...n, read_at: new Date().toISOString() } : n)),
      );
      setExplicitUnreadIds((prev) => {
        if (!prev.has(selected.id)) return prev;
        const next = new Set(prev);
        next.delete(selected.id);
        return next;
      });
    }
  }, [workspaceSlug, selected]);

  const onSnoozeSelected = useCallback(
    async (until: Date) => {
      if (!workspaceSlug || !selected) return;
      await notificationService.snooze(workspaceSlug, selected.id, until);
      /* Snoozed rows leave the inbox view; they stay in the Archived tab. */
      if (inboxTab !== 'archived') {
        removeFromList(selected.id);
        setSelectedId(null);
      } else {
        setNotifications((prev) =>
          prev.map((n) => (n.id === selected.id ? { ...n, snoozed_till: until.toISOString() } : n)),
        );
      }
    },
    [workspaceSlug, selected, inboxTab],
  );

  const onUnsnoozeSelected = useCallback(async () => {
    if (!workspaceSlug || !selected) return;
    await notificationService.unsnooze(workspaceSlug, selected.id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === selected.id ? { ...n, snoozed_till: null } : n)),
    );
  }, [workspaceSlug, selected]);

  const onOpenIssue = useCallback(() => {
    const issueId = selected?.message?.issue?.id;
    const projectId = selected?.project_id;
    if (!workspaceSlug || !issueId || !projectId) return;
    navigate(`/${workspaceSlug}/app-v2/projects/${projectId}/work-items/${issueId}`);
  }, [workspaceSlug, selected, navigate]);

  /* The row actions act on the selection, so they belong in the header next to
     the breadcrumb rather than inside the detail pane. */
  const headerActions = useMemo(
    () => (
      <div className="ml-auto flex items-center gap-2 px-4">
        {inboxTab !== 'archived' && (
          <Button size="sm" variant="outline" onClick={() => void onMarkAllRead()}>
            {t('notifications.markAllRead', 'Mark all read')}
          </Button>
        )}
        {selected && (
          <>
            <Button size="sm" variant="outline" onClick={() => void onToggleReadOnSelected()}>
              {selected.read_at
                ? t('notifications.markUnread', 'Mark unread')
                : t('notifications.markRead', 'Mark read')}
            </Button>
            <SnoozeMenu
              snoozedUntil={selected.snoozed_till ?? null}
              onSnooze={onSnoozeSelected}
              onUnsnooze={onUnsnoozeSelected}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void (selected.archived_at
                  ? onUnarchiveRow(selected.id)
                  : onArchiveRow(selected.id))
              }
            >
              {selected.archived_at
                ? t('common.unarchive', 'Unarchive')
                : t('common.archive', 'Archive')}
            </Button>
            {selected.message?.issue?.id && selected.project_id && (
              <Button size="sm" onClick={onOpenIssue}>
                {t('notifications.openIssue', 'Open issue')}
              </Button>
            )}
          </>
        )}
      </div>
    ),
    [
      inboxTab,
      selected,
      t,
      onMarkAllRead,
      onToggleReadOnSelected,
      onSnoozeSelected,
      onUnsnoozeSelected,
      onArchiveRow,
      onUnarchiveRow,
      onOpenIssue,
    ],
  );

  useSetV2Header({ parent: null, title: null, actions: headerActions });

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 gap-4">
        <div className="w-[min(420px,35%)] space-y-2">
          <Skeleton className="h-9 w-64" />
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
        <Skeleton className="min-h-0 flex-1 rounded-xl" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <p className="text-muted-foreground text-sm">
        {t('common.workspaceNotFound', 'Workspace not found.')}
      </p>
    );
  }

  const emptyMessage =
    inboxTab === 'mentions'
      ? t(
          'notifications.empty.mentions',
          'No mentions yet. When someone @-mentions you in an issue or comment, it shows here.',
        )
      : inboxTab === 'archived'
        ? t(
            'notifications.empty.archived',
            'No archived notifications. Archive a row from the inbox to declutter without losing it.',
          )
        : t(
            'notifications.empty.all',
            'Inbox zero. Notifications about issues you’re involved with will land here.',
          );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      <div className="flex min-h-0 flex-1 gap-4">
        <div className="flex w-[min(420px,35%)] min-w-0 shrink-0 flex-col gap-3">
          <Tabs
            value={inboxTab}
            onValueChange={(value) => {
              setInboxTab(value as InboxTab);
              setSelectedId(null);
            }}
          >
            <TabsList>
              {TABS.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id}>
                  {t(`notifications.tab.${tab.id}`, tab.label)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="min-h-0 flex-1 overflow-auto rounded-xl border">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <Inbox className="text-muted-foreground size-6" aria-hidden />
                <p className="text-muted-foreground text-sm">{emptyMessage}</p>
              </div>
            ) : (
              <ul className="divide-y">
                {notifications.map((n) => {
                  const { actor, ref, issueName } = rowLabels(
                    n,
                    t('notifications.actorFallback', 'Someone'),
                  );
                  const isSelected = selectedId === n.id;
                  const isArchived = Boolean(n.archived_at);
                  return (
                    <li key={n.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => setSelectedId(n.id)}
                        className={`flex w-full gap-3 px-3 py-3 text-left transition-colors ${
                          isSelected ? 'bg-muted' : 'hover:bg-muted/50'
                        }`}
                      >
                        <Avatar className="size-8 shrink-0">
                          <AvatarFallback className="text-xs">{initials(actor)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{n.title}</p>
                          <p className="text-muted-foreground mt-0.5 truncate text-sm">
                            {ref}
                            {issueName ? ` — ${issueName}` : ''}
                          </p>
                        </div>
                        <span className="shrink-0 text-right">
                          <span className="text-muted-foreground block text-xs">
                            {formatTimeAgo(n.created_at)}
                          </span>
                          {!n.read_at && !isArchived && (
                            <Badge className="mt-1" variant="secondary">
                              {t('notifications.new', 'New')}
                            </Badge>
                          )}
                        </span>
                      </button>
                      {/* Kept focusable so keyboard users reach it; the fade is
                          visual only. */}
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={
                          isArchived
                            ? t('common.unarchive', 'Unarchive')
                            : t('common.archive', 'Archive')
                        }
                        title={
                          isArchived
                            ? t('common.unarchive', 'Unarchive')
                            : t('common.archive', 'Archive')
                        }
                        onClick={() =>
                          void (isArchived ? onUnarchiveRow(n.id) : onArchiveRow(n.id))
                        }
                        className="absolute top-2 right-2 size-7 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        {isArchived ? <ArchiveRestore /> : <Archive />}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="min-h-0 min-w-0 flex-1 overflow-auto rounded-xl border">
          {!selected ? (
            <div className="text-muted-foreground flex h-full items-center justify-center p-8 text-sm">
              {t('notifications.selectPrompt', 'Select a notification to see details.')}
            </div>
          ) : (
            <div className="p-6">
              <h2 className="truncate text-lg font-semibold">{selected.title}</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                {formatTimeAgo(selected.created_at)}
              </p>
              <div className="mt-6">
                <NotificationContent notification={selected} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
