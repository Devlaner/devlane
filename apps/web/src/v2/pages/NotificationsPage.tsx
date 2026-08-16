import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Archive,
  ArchiveRestore,
  ArrowUpRight,
  CheckCheck,
  Inbox,
  Loader2,
  Mail,
  MailOpen,
  Search,
  SearchX,
} from 'lucide-react';
import { NotificationSnoozeMenu } from '@/v2/components/notification-snooze-menu';
import { Avatar, AvatarFallback } from '@/v2/components/ui/avatar';
import { Badge } from '@/v2/components/ui/badge';
import { Button } from '@/v2/components/ui/button';
import { Input } from '@/v2/components/ui/input';
import { Separator } from '@/v2/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/v2/components/ui/sheet';
import { Skeleton } from '@/v2/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/v2/components/ui/tabs';
import { NotificationContent } from '../../components/notifications/NotificationContent';
import { useSetV2Header } from '../contexts/AppShellHeaderContext';
import { formatTimeAgo } from '../lib/project';
import { notificationService } from '../../services/notificationService';
import { workspaceService } from '../../services/workspaceService';
import { usePersistedChoice } from '../hooks/usePersistedChoice';
import type { NotificationApiResponse, WorkspaceApiResponse } from '../../api/types';

type InboxTab = 'all' | 'unread' | 'mentions' | 'archived';

const TABS: { id: InboxTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'mentions', label: 'Mentions' },
  { id: 'archived', label: 'Archived' },
];

/* Which tab the inbox reopens on. "Archived" is deliberately absent: it is the
   one tab that hides everything arriving, so remembering it would present an
   empty inbox as if nothing had happened. */
const PERSISTED_INBOX_TABS = ['all', 'unread', 'mentions'] as const satisfies readonly InboxTab[];

function listOptions(tab: InboxTab) {
  return {
    unreadOnly: tab === 'unread',
    mentionsOnly: tab === 'mentions',
    archived: tab === 'archived' ? ('archived' as const) : ('inbox' as const),
  };
}

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
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

interface NotificationDetailProps {
  notification: NotificationApiResponse;
  pendingAction: string | null;
  actionError: string | null;
  onToggleRead: () => void | Promise<void>;
  onArchive: () => void | Promise<void>;
  onSnooze: (until: Date) => void | Promise<void>;
  onUnsnooze: () => void | Promise<void>;
  onOpenIssue: () => void;
}

function NotificationDetail({
  notification,
  pendingAction,
  actionError,
  onToggleRead,
  onArchive,
  onSnooze,
  onUnsnooze,
  onOpenIssue,
}: NotificationDetailProps) {
  const { t } = useTranslation();
  const { actor, ref, issueName } = rowLabels(
    notification,
    t('notifications.actorFallback', 'Someone'),
  );
  const isBusy = pendingAction !== null;
  const readBusy = pendingAction === `read:${notification.id}`;
  const archiveBusy =
    pendingAction === `archive:${notification.id}` ||
    pendingAction === `unarchive:${notification.id}`;
  const snoozeBusy =
    pendingAction === `snooze:${notification.id}` ||
    pendingAction === `unsnooze:${notification.id}`;
  const canOpenIssue = Boolean(notification.message?.issue?.id && notification.project_id);

  return (
    <article className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 space-y-4 p-4 pr-14 sm:p-6 sm:pr-16 lg:pr-6">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar className="size-10 shrink-0">
            <AvatarFallback>{initials(actor)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h2 className="text-base leading-6 font-semibold sm:text-lg">{notification.title}</h2>
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span>{actor}</span>
              <span aria-hidden>·</span>
              <span>{formatTimeAgo(notification.created_at)}</span>
              {ref !== '—' && (
                <Badge variant="outline" className="font-normal">
                  {ref}
                </Badge>
              )}
            </div>
            {issueName && <p className="text-muted-foreground mt-1 text-sm">{issueName}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-11 sm:h-8"
            disabled={isBusy}
            onClick={() => void onToggleRead()}
          >
            {readBusy ? (
              <Loader2 className="animate-spin" />
            ) : notification.read_at ? (
              <Mail />
            ) : (
              <MailOpen />
            )}
            {notification.read_at
              ? t('notifications.markUnread', 'Mark unread')
              : t('notifications.markRead', 'Mark read')}
          </Button>

          <NotificationSnoozeMenu
            snoozedUntil={notification.snoozed_till ?? null}
            busy={snoozeBusy}
            disabled={isBusy}
            onSnooze={onSnooze}
            onUnsnooze={onUnsnooze}
          />

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-11 sm:h-8"
            disabled={isBusy}
            onClick={() => void onArchive()}
          >
            {archiveBusy ? (
              <Loader2 className="animate-spin" />
            ) : notification.archived_at ? (
              <ArchiveRestore />
            ) : (
              <Archive />
            )}
            {notification.archived_at
              ? t('common.unarchive', 'Unarchive')
              : t('common.archive', 'Archive')}
          </Button>

          {canOpenIssue && (
            <Button
              type="button"
              size="sm"
              className="h-11 sm:ml-auto sm:h-8"
              disabled={isBusy}
              onClick={onOpenIssue}
            >
              {t('notifications.openIssue', 'Open issue')}
              <ArrowUpRight />
            </Button>
          )}
        </div>
      </header>

      <Separator />
      {actionError && (
        <div className="border-b px-4 py-3 text-sm text-destructive sm:px-6 lg:hidden" role="alert">
          {actionError}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-3xl">
          <NotificationContent notification={notification} />
        </div>
      </div>
    </article>
  );
}

function InboxLoadingState() {
  return (
    <div className="flex min-h-[calc(100svh-5rem)] flex-col gap-4 lg:h-[calc(100svh-5rem)]">
      <div className="flex items-center justify-between gap-4 px-1 py-1">
        <div className="space-y-2">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(20rem,26rem)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border lg:min-h-0">
          <div className="space-y-3 p-3 sm:p-4">
            <Skeleton className="h-11 w-full lg:h-9" />
            <Skeleton className="h-11 w-full lg:h-9" />
          </div>
          <Separator />
          <div className="space-y-2 p-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        </div>
        <div className="hidden min-h-0 flex-col overflow-hidden rounded-xl border lg:flex">
          <div className="flex h-full items-center justify-center p-8">
            <Skeleton className="h-24 w-64 max-w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Responsive notification inbox composed from the project's shadcn
 * primitives. Desktop uses a master-detail surface; tablet and mobile open the
 * selected notification in a Sheet so the list keeps a usable reading width.
 */
interface NotificationsInboxV2Props {
  workspaceSlug: string | undefined;
}

function NotificationsInboxV2({ workspaceSlug }: NotificationsInboxV2Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const inboxRootRef = useRef<HTMLElement>(null);
  const lastSelectionButtonRef = useRef<HTMLButtonElement | null>(null);

  const [inboxTab, setInboxTab] = usePersistedChoice<InboxTab>(
    workspaceSlug ? `devlane-v2-inbox-tab:${workspaceSlug}` : null,
    PERSISTED_INBOX_TABS,
    'all',
  );
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [notifications, setNotifications] = useState<NotificationApiResponse[]>([]);
  const [loading, setLoading] = useState(Boolean(workspaceSlug));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  /* IDs the user explicitly marked unread in this session; selecting one
     again must not immediately undo that choice. */
  const [explicitUnreadIds, setExplicitUnreadIds] = useState<Set<string>>(new Set());

  const inboxTitle = t('notifications.documentTitle', 'Inbox');
  useSetV2Header({ parent: null, title: inboxTitle, actions: null });

  useEffect(() => {
    if (!workspaceSlug) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([
      workspaceService.getBySlug(workspaceSlug),
      notificationService.list(workspaceSlug, listOptions(inboxTab)),
    ])
      .then(([nextWorkspace, list]) => {
        if (cancelled) return;
        const nextNotifications = list ?? [];
        setWorkspace(nextWorkspace ?? null);
        setNotifications(nextNotifications);
        setSelectedId((current) =>
          current && nextNotifications.some((notification) => notification.id === current)
            ? current
            : null,
        );
      })
      .catch(() => {
        if (cancelled) return;
        setNotifications([]);
        setLoadError(t('notifications.loadError', 'Could not load notifications.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, inboxTab, reloadKey, t]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const closeSheetOnDesktop = (event: MediaQueryListEvent) => {
      if (!event.matches) setMobileDetailOpen(false);
    };
    media.addEventListener('change', closeSheetOnDesktop);
    return () => media.removeEventListener('change', closeSheetOnDesktop);
  }, []);

  const selected = useMemo(
    () => (selectedId ? (notifications.find((n) => n.id === selectedId) ?? null) : null),
    [notifications, selectedId],
  );

  const visibleNotifications = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const fallbackActor = t('notifications.actorFallback', 'Someone');
    return notifications.filter((notification) => {
      if (inboxTab === 'unread' && notification.read_at) return false;
      if (!needle) return true;
      const { actor, ref, issueName } = rowLabels(notification, fallbackActor);
      return [
        notification.title,
        actor,
        ref,
        issueName,
        notification.entity_identifier,
        notification.entity_name,
      ].some((value) => value?.toLocaleLowerCase().includes(needle));
    });
  }, [notifications, query, inboxTab, t]);

  const performAction = useCallback(
    async (key: string, action: () => Promise<void>) => {
      setPendingAction(key);
      setActionError(null);
      try {
        await action();
      } catch {
        setActionError(
          t('notifications.actionError', "That action couldn't be completed. Please try again."),
        );
      } finally {
        setPendingAction(null);
      }
    },
    [t],
  );

  const removeFromList = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id));
    setExplicitUnreadIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const onArchiveRow = useCallback(
    (id: string) =>
      performAction(`archive:${id}`, async () => {
        if (!workspaceSlug) return;
        await notificationService.archive(workspaceSlug, id);
        if (inboxTab === 'archived') {
          setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, archived_at: new Date().toISOString() } : n)),
          );
          return;
        }
        removeFromList(id);
        setSelectedId((current) => (current === id ? null : current));
      }),
    [workspaceSlug, inboxTab, performAction, removeFromList],
  );

  const onUnarchiveRow = useCallback(
    (id: string) =>
      performAction(`unarchive:${id}`, async () => {
        if (!workspaceSlug) return;
        await notificationService.unarchive(workspaceSlug, id);
        if (inboxTab === 'archived') {
          removeFromList(id);
          setSelectedId((current) => (current === id ? null : current));
        } else {
          setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, archived_at: null } : n)),
          );
        }
      }),
    [workspaceSlug, inboxTab, performAction, removeFromList],
  );

  const onMarkAllRead = useCallback(
    () =>
      performAction('mark-all-read', async () => {
        if (!workspaceSlug) return;
        await notificationService.markAllRead(workspaceSlug);
        const refreshed = await notificationService.list(workspaceSlug, listOptions(inboxTab));
        setNotifications(refreshed ?? []);
        setExplicitUnreadIds(new Set());
        if (inboxTab === 'unread') {
          setSelectedId(null);
          setMobileDetailOpen(false);
        }
      }),
    [workspaceSlug, inboxTab, performAction],
  );

  const onToggleReadOnSelected = useCallback(() => {
    if (!selected) return Promise.resolve();
    return performAction(`read:${selected.id}`, async () => {
      if (!workspaceSlug) return;
      if (selected.read_at) {
        await notificationService.markUnread(workspaceSlug, selected.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === selected.id ? { ...n, read_at: null } : n)),
        );
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
    });
  }, [workspaceSlug, selected, performAction]);

  const onSnoozeSelected = useCallback(
    (until: Date) => {
      if (!selected) return Promise.resolve();
      return performAction(`snooze:${selected.id}`, async () => {
        if (!workspaceSlug) return;
        await notificationService.snooze(workspaceSlug, selected.id, until);
        if (inboxTab !== 'archived') {
          removeFromList(selected.id);
          setSelectedId((current) => (current === selected.id ? null : current));
          setMobileDetailOpen(false);
        } else {
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === selected.id ? { ...n, snoozed_till: until.toISOString() } : n,
            ),
          );
        }
      });
    },
    [workspaceSlug, selected, inboxTab, performAction, removeFromList],
  );

  const onUnsnoozeSelected = useCallback(() => {
    if (!selected) return Promise.resolve();
    return performAction(`unsnooze:${selected.id}`, async () => {
      if (!workspaceSlug) return;
      await notificationService.unsnooze(workspaceSlug, selected.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === selected.id ? { ...n, snoozed_till: null } : n)),
      );
    });
  }, [workspaceSlug, selected, performAction]);

  const onOpenIssue = useCallback(() => {
    const issueId = selected?.message?.issue?.id;
    const projectId = selected?.project_id;
    if (!workspaceSlug || !issueId || !projectId) return;
    navigate(`/${workspaceSlug}/projects/${projectId}/issues/${issueId}`);
  }, [workspaceSlug, selected, navigate]);

  const selectNotification = (
    notification: NotificationApiResponse,
    trigger: HTMLButtonElement,
  ) => {
    lastSelectionButtonRef.current = trigger;
    setSelectedId(notification.id);
    setActionError(null);
    if (window.matchMedia('(max-width: 1023px)').matches) setMobileDetailOpen(true);

    if (
      workspaceSlug &&
      inboxTab !== 'archived' &&
      !notification.read_at &&
      !explicitUnreadIds.has(notification.id)
    ) {
      void performAction(`read:${notification.id}`, async () => {
        await notificationService.markRead(workspaceSlug, notification.id);
        setNotifications((prev) =>
          prev.map((item) =>
            item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item,
          ),
        );
      });
    }
  };

  if (loading && !workspace) return <InboxLoadingState />;

  if (loadError && !workspace) {
    return (
      <div className="flex min-h-[calc(100svh-5rem)] items-center justify-center rounded-xl border p-6">
        <div className="max-w-sm text-center">
          <Inbox className="text-muted-foreground mx-auto size-8" aria-hidden />
          <h1 className="mt-4 text-lg font-semibold">{inboxTitle}</h1>
          <p className="text-muted-foreground mt-2 text-sm" role="alert">
            {loadError}
          </p>
          <Button className="mt-4" onClick={() => setReloadKey((value) => value + 1)}>
            {t('notifications.retry', 'Try again')}
          </Button>
        </div>
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
      : inboxTab === 'unread'
        ? t(
            'notifications.empty.unread',
            "You're all caught up. There are no unread notifications.",
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
    <section
      ref={inboxRootRef}
      aria-labelledby="inbox-heading"
      className="flex min-h-[calc(100svh-5rem)] flex-col gap-4 lg:h-[calc(100svh-5rem)] lg:overflow-hidden"
    >
      <header className="flex shrink-0 flex-col gap-4 px-1 py-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 id="inbox-heading" className="text-xl font-semibold tracking-tight">
            {inboxTitle}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t('notifications.subtitle', "Updates from work you're involved in, in one place.")}
          </p>
        </div>
        {inboxTab !== 'archived' && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-11 self-start sm:h-8 sm:self-auto"
            disabled={loading || Boolean(pendingAction)}
            onClick={() => void onMarkAllRead()}
          >
            {pendingAction === 'mark-all-read' ? (
              <Loader2 className="animate-spin" />
            ) : (
              <CheckCheck />
            )}
            {t('notifications.markAllRead', 'Mark all read')}
          </Button>
        )}
      </header>

      <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(20rem,26rem)_minmax(0,1fr)]">
        <div
          role="region"
          aria-label={t('notifications.listLabel', 'Notifications')}
          className="flex min-w-0 flex-col overflow-hidden rounded-xl border lg:min-h-0"
        >
          <div className="flex shrink-0 flex-col gap-3 p-3 sm:p-4">
            <Tabs
              value={inboxTab}
              onValueChange={(value) => {
                if (!TABS.some((tab) => tab.id === value)) return;
                setInboxTab(value as InboxTab);
                setSelectedId(null);
                setMobileDetailOpen(false);
                setActionError(null);
              }}
            >
              <TabsList className="h-11 w-full rounded-xl bg-muted lg:h-9">
                {TABS.map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="rounded-lg border-0 px-2 font-normal text-muted-foreground shadow-none data-[state=active]:bg-card data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:data-[state=active]:bg-card"
                    disabled={loading || Boolean(pendingAction)}
                  >
                    {t(`notifications.tab.${tab.id}`, tab.label)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="relative w-full">
              <label htmlFor="notification-search" className="sr-only">
                {t('common.search', 'Search')}
              </label>
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                aria-hidden
              />
              <Input
                id="notification-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('notifications.searchPlaceholder', 'Search notifications…')}
                className="h-11 pl-9 lg:h-9"
              />
            </div>
          </div>

          <Separator />

          {actionError && (
            <div className="border-b px-4 py-3 text-sm text-destructive" role="alert">
              {actionError}
            </div>
          )}

          <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {loading ? (
              <div className="space-y-2 p-3" aria-label={t('common.loading', 'Loading…')}>
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 w-full" />
                ))}
              </div>
            ) : loadError ? (
              <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
                <Inbox className="text-muted-foreground size-7" aria-hidden />
                <p className="text-muted-foreground mt-3 max-w-xs text-sm" role="alert">
                  {loadError}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4"
                  onClick={() => setReloadKey((value) => value + 1)}
                >
                  {t('notifications.retry', 'Try again')}
                </Button>
              </div>
            ) : visibleNotifications.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
                {query.trim() ? (
                  <SearchX className="text-muted-foreground size-7" aria-hidden />
                ) : (
                  <Inbox className="text-muted-foreground size-7" aria-hidden />
                )}
                <p className="text-muted-foreground mt-3 max-w-xs text-sm">
                  {query.trim()
                    ? t('notifications.noSearchResults', 'No notifications match your search.')
                    : emptyMessage}
                </p>
              </div>
            ) : (
              <ul
                className="space-y-1 p-1.5"
                aria-label={t('notifications.listLabel', 'Notifications')}
              >
                {visibleNotifications.map((notification) => {
                  const { actor, ref, issueName } = rowLabels(
                    notification,
                    t('notifications.actorFallback', 'Someone'),
                  );
                  const isSelected = selectedId === notification.id;
                  const isArchived = Boolean(notification.archived_at);
                  const isUnread = !notification.read_at && !isArchived;
                  const contextLabel =
                    [ref !== '—' ? ref : '', issueName].filter(Boolean).join(' · ') || actor;
                  const rowActionPending =
                    pendingAction === `archive:${notification.id}` ||
                    pendingAction === `unarchive:${notification.id}`;
                  const archiveLabel = isArchived
                    ? t('common.unarchive', 'Unarchive')
                    : t('common.archive', 'Archive');

                  return (
                    <li
                      key={notification.id}
                      className={`group relative rounded-lg transition-colors before:pointer-events-none ${
                        isSelected
                          ? 'bg-accent text-accent-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary'
                          : 'hover:bg-muted/60'
                      }`}
                    >
                      <div className="flex min-w-0 items-stretch">
                        <button
                          type="button"
                          data-notification-trigger
                          aria-current={isSelected ? 'true' : undefined}
                          disabled={Boolean(pendingAction)}
                          onClick={(event) => selectNotification(notification, event.currentTarget)}
                          className="focus-visible:ring-ring flex min-h-16 min-w-0 flex-1 items-start gap-2.5 py-2 pr-2 pl-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-60"
                        >
                          <Avatar aria-hidden className="mt-0.5 size-8 shrink-0">
                            <AvatarFallback className="text-xs">{initials(actor)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <div className="flex min-w-0 items-center gap-1.5">
                              {isUnread && (
                                <span
                                  aria-hidden
                                  className="bg-primary size-1.5 shrink-0 rounded-full"
                                />
                              )}
                              <p
                                className={`truncate text-sm leading-5 ${
                                  notification.read_at ? 'font-medium' : 'font-semibold'
                                }`}
                              >
                                {isUnread && (
                                  <span className="sr-only">{t('notifications.new', 'New')}: </span>
                                )}
                                {notification.title}
                              </p>
                            </div>
                            <div className="text-muted-foreground mt-0.5 flex min-w-0 items-center gap-2 text-xs leading-4">
                              <span className="truncate">{contextLabel}</span>
                              <time
                                dateTime={notification.created_at}
                                className="ml-auto shrink-0 tabular-nums"
                              >
                                {formatTimeAgo(notification.created_at)}
                              </time>
                            </div>
                          </div>
                        </button>

                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          disabled={Boolean(pendingAction)}
                          aria-label={`${archiveLabel}: ${notification.title}`}
                          aria-busy={rowActionPending || undefined}
                          title={archiveLabel}
                          onClick={() =>
                            void (isArchived
                              ? onUnarchiveRow(notification.id)
                              : onArchiveRow(notification.id))
                          }
                          className="text-muted-foreground hover:text-foreground my-auto mr-1.5 size-11 shrink-0 lg:size-9"
                        >
                          {rowActionPending ? (
                            <Loader2 className="animate-spin" />
                          ) : isArchived ? (
                            <ArchiveRestore />
                          ) : (
                            <Archive />
                          )}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div
          role="region"
          aria-label={
            selected
              ? selected.title
              : t('notifications.detailDescription', 'Notification details and actions.')
          }
          className="hidden min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border lg:flex"
        >
          {!selected ? (
            <div className="text-muted-foreground flex h-full min-h-80 flex-col items-center justify-center p-8 text-center">
              <MailOpen className="size-8" aria-hidden />
              <p className="mt-3 max-w-xs text-sm">
                {t('notifications.selectPrompt', 'Select a notification to see details.')}
              </p>
            </div>
          ) : (
            <NotificationDetail
              notification={selected}
              pendingAction={pendingAction}
              actionError={actionError}
              onToggleRead={onToggleReadOnSelected}
              onArchive={() =>
                selected.archived_at ? onUnarchiveRow(selected.id) : onArchiveRow(selected.id)
              }
              onSnooze={onSnoozeSelected}
              onUnsnooze={onUnsnoozeSelected}
              onOpenIssue={onOpenIssue}
            />
          )}
        </div>
      </div>

      <Sheet open={mobileDetailOpen && Boolean(selected)} onOpenChange={setMobileDetailOpen}>
        <SheetContent
          className="w-full gap-0 p-0 sm:max-w-2xl [&>button]:top-2 [&>button]:right-2 [&>button]:flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center"
          side="right"
          onCloseAutoFocus={(event) => {
            const previousTrigger = lastSelectionButtonRef.current;
            const fallback = inboxRootRef.current?.querySelector<HTMLButtonElement>(
              '[data-notification-trigger], #notification-search',
            );
            const focusTarget = previousTrigger?.isConnected ? previousTrigger : fallback;
            if (!focusTarget) return;
            event.preventDefault();
            requestAnimationFrame(() => focusTarget.focus());
          }}
        >
          {selected && (
            <>
              <SheetHeader className="sr-only">
                <SheetTitle>{selected.title}</SheetTitle>
                <SheetDescription>
                  {t('notifications.detailDescription', 'Notification details and actions.')}
                </SheetDescription>
              </SheetHeader>
              <NotificationDetail
                notification={selected}
                pendingAction={pendingAction}
                actionError={actionError}
                onToggleRead={onToggleReadOnSelected}
                onArchive={() =>
                  selected.archived_at ? onUnarchiveRow(selected.id) : onArchiveRow(selected.id)
                }
                onSnooze={onSnoozeSelected}
                onUnsnooze={onUnsnoozeSelected}
                onOpenIssue={onOpenIssue}
              />
            </>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}

/** Remount the inbox when its workspace changes so in-flight local state from
 * one workspace can never be applied to another workspace's notification id. */
export function NotificationsPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  return (
    <NotificationsInboxV2
      key={workspaceSlug ?? 'missing-workspace'}
      workspaceSlug={workspaceSlug}
    />
  );
}
