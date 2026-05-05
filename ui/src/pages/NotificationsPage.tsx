import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Archive, ArchiveRestore } from 'lucide-react';
import { Avatar, Button } from '../components/ui';
import { workspaceService } from '../services/workspaceService';
import { notificationService } from '../services/notificationService';
import { NotificationContent } from '../components/notifications/NotificationContent';
import { SnoozeMenu } from '../components/notifications/SnoozeMenu';
import type { WorkspaceApiResponse, NotificationApiResponse } from '../api/types';

type InboxTab = 'all' | 'mentions' | 'archived';

function formatTimeAgo(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 0) return `${day} day${day === 1 ? '' : 's'} ago`;
  if (hr > 0) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  if (min > 0) return `${min} minute${min === 1 ? '' : 's'} ago`;
  if (sec > 0) return `${sec} second${sec === 1 ? '' : 's'} ago`;
  return 'less than a minute ago';
}

function rowLabels(n: NotificationApiResponse) {
  // System / legacy rows may have an empty or partial message payload.
  const actor = n.message?.actor?.display_name ?? 'Someone';
  const issue = n.message?.issue;
  const ref =
    issue?.project_identifier && issue.sequence_id != null
      ? `${issue.project_identifier}-${issue.sequence_id}`
      : '—';
  const issueName = issue?.name ?? '';
  return { actor, ref, issueName };
}

const TABS: { id: InboxTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'mentions', label: 'Mentions' },
  { id: 'archived', label: 'Archived' },
];

export function NotificationsPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const navigate = useNavigate();
  const [inboxTab, setInboxTab] = useState<InboxTab>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [notifications, setNotifications] = useState<NotificationApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  // IDs the user explicitly marked unread in this session; the auto-mark-read
  // effect below skips them so the toggle actually sticks.
  const [explicitUnreadIds, setExplicitUnreadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!workspaceSlug) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset when slug absent
      setLoading(false);
      return;
    }
    let cancelled = false;
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
      })
      .catch(() => {
        if (!cancelled) {
          setWorkspace(null);
          setNotifications([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, inboxTab]);

  const selected = useMemo(
    () => (selectedId ? (notifications.find((n) => n.id === selectedId) ?? null) : null),
    [notifications, selectedId],
  );

  // Auto-mark-on-select. Skip when viewing the Archived tab — re-reading
  // archived rows should not flip them to read silently. Also skip rows the
  // user just explicitly marked unread; otherwise this effect re-fires and
  // immediately re-marks them as read.
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
        // Read state is best-effort; failure won't block the UI.
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, selected, inboxTab, explicitUnreadIds]);

  const removeFromList = (id: string) =>
    setNotifications((prev) => prev.filter((n) => n.id !== id));

  const onMarkAllRead = async () => {
    if (!workspaceSlug) return;
    await notificationService.markAllRead(workspaceSlug);
    const refreshed = await notificationService.list(workspaceSlug, {
      mentionsOnly: inboxTab === 'mentions',
      archived: inboxTab === 'archived' ? 'archived' : 'inbox',
    });
    setNotifications(refreshed ?? []);
  };

  const onToggleReadOnSelected = async () => {
    if (!workspaceSlug || !selected) return;
    if (selected.read_at) {
      await notificationService.markUnread(workspaceSlug, selected.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === selected.id ? { ...n, read_at: null } : n)),
      );
      // Remember the user wanted this unread; the auto-mark effect will skip it.
      setExplicitUnreadIds((prev) => {
        const next = new Set(prev);
        next.add(selected.id);
        return next;
      });
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
  };

  const onArchiveRow = async (id: string) => {
    if (!workspaceSlug) return;
    await notificationService.archive(workspaceSlug, id);
    if (inboxTab === 'archived') {
      // Already in archive view — keep it visible for the unarchive affordance.
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, archived_at: new Date().toISOString() } : n)),
      );
      return;
    }
    removeFromList(id);
    if (selectedId === id) setSelectedId(null);
  };

  const onUnarchiveRow = async (id: string) => {
    if (!workspaceSlug) return;
    await notificationService.unarchive(workspaceSlug, id);
    if (inboxTab === 'archived') {
      removeFromList(id);
      if (selectedId === id) setSelectedId(null);
    } else {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, archived_at: null } : n)));
    }
  };

  const onSnoozeSelected = async (until: Date) => {
    if (!workspaceSlug || !selected) return;
    await notificationService.snooze(workspaceSlug, selected.id, until);
    // Snoozed rows disappear from the inbox view; keep them in the Archived tab if visible.
    if (inboxTab !== 'archived') {
      removeFromList(selected.id);
      setSelectedId(null);
    } else {
      setNotifications((prev) =>
        prev.map((n) => (n.id === selected.id ? { ...n, snoozed_till: until.toISOString() } : n)),
      );
    }
  };

  const onUnsnoozeSelected = async () => {
    if (!workspaceSlug || !selected) return;
    await notificationService.unsnooze(workspaceSlug, selected.id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === selected.id ? { ...n, snoozed_till: null } : n)),
    );
  };

  const onOpenIssue = () => {
    if (!workspaceSlug || !selected?.message?.issue) return;
    const projectId = selected.project_id;
    const issueId = selected.message.issue.id;
    if (!projectId || !issueId) return;
    navigate(`/${workspaceSlug}/projects/${projectId}/issues/${issueId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-(--txt-tertiary)">
        Loading…
      </div>
    );
  }
  if (!workspace) {
    return <div className="p-4 text-(--txt-secondary)">Workspace not found.</div>;
  }

  const listWidth = 'min(420px, 35%)';

  const emptyMessage =
    inboxTab === 'mentions'
      ? 'No mentions yet. When someone @-mentions you in an issue or comment, it shows here.'
      : inboxTab === 'archived'
        ? 'No archived notifications. Archive a row from the inbox to declutter without losing it.'
        : 'Inbox zero. Notifications about issues you’re involved with will land here.';

  return (
    <div className="flex h-full min-h-0 w-full">
      <div
        className="flex shrink-0 flex-col border-r border-(--border-subtle) bg-(--bg-canvas)"
        style={{ width: listWidth }}
      >
        <div className="shrink-0 border-b border-(--border-subtle) px-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setInboxTab(t.id);
                    setSelectedId(null);
                  }}
                  className={`border-b-2 px-4 py-2.5 text-sm font-medium ${
                    inboxTab === t.id
                      ? 'border-(--brand-default) text-(--txt-primary)'
                      : 'border-transparent text-(--txt-secondary) hover:text-(--txt-primary)'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {inboxTab !== 'archived' ? (
              <Button size="sm" variant="secondary" onClick={onMarkAllRead}>
                Mark all read
              </Button>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-6 text-sm text-(--txt-tertiary)">{emptyMessage}</div>
          ) : (
            <ul className="divide-y divide-(--border-subtle)">
              {notifications.map((n) => {
                const { actor, ref, issueName } = rowLabels(n);
                const isSelected = selectedId === n.id;
                const isArchived = !!n.archived_at;
                return (
                  <li key={n.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => setSelectedId(n.id)}
                      className={`flex w-full gap-3 px-4 py-3 text-left transition-colors ${
                        isSelected ? 'bg-(--bg-layer-1)' : 'hover:bg-(--bg-layer-1-hover)'
                      }`}
                    >
                      <Avatar name={actor} size="md" className="shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-(--txt-primary)">{n.title}</p>
                        <p className="mt-0.5 truncate text-sm text-(--txt-secondary)">
                          {ref}
                          {issueName ? ` — ${issueName}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 text-right text-xs text-(--txt-tertiary)">
                        <span className="block">{formatTimeAgo(n.created_at)}</span>
                        {!n.read_at && !isArchived && (
                          <span className="mt-1 inline-block rounded bg-(--brand-200) px-2 py-0.5 text-[10px] font-medium text-(--brand-default)">
                            New
                          </span>
                        )}
                      </span>
                    </button>
                    <button
                      type="button"
                      title={isArchived ? 'Unarchive' : 'Archive'}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isArchived) {
                          void onUnarchiveRow(n.id);
                        } else {
                          void onArchiveRow(n.id);
                        }
                      }}
                      className="absolute top-2 right-2 hidden rounded p-1 text-(--txt-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary) group-hover:block"
                    >
                      {isArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1 bg-(--bg-canvas)">
        {!selected ? (
          <div className="flex h-full items-center justify-center p-8 text-sm text-(--txt-tertiary)">
            Select a notification to see details.
          </div>
        ) : (
          <div className="h-full overflow-y-auto px-(--padding-page) py-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-(--txt-primary)">
                  {selected.title}
                </h2>
                <p className="mt-1 text-sm text-(--txt-secondary)">
                  {formatTimeAgo(selected.created_at)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button size="sm" variant="secondary" onClick={onToggleReadOnSelected}>
                  {selected.read_at ? 'Mark unread' : 'Mark read'}
                </Button>
                <SnoozeMenu
                  snoozedUntil={selected.snoozed_till ?? null}
                  onSnooze={onSnoozeSelected}
                  onUnsnooze={onUnsnoozeSelected}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    selected.archived_at ? onUnarchiveRow(selected.id) : onArchiveRow(selected.id)
                  }
                >
                  {selected.archived_at ? 'Unarchive' : 'Archive'}
                </Button>
                {selected.message?.issue?.id && selected.project_id ? (
                  <Button size="sm" variant="primary" onClick={onOpenIssue}>
                    Open issue
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="mt-6">
              <NotificationContent notification={selected} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
