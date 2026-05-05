import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { notificationService } from '../../services/notificationService';

interface Props {
  workspaceSlug: string;
}

const POLL_INTERVAL_MS = 60_000;

/**
 * Bell icon + unread badge for the workspace inbox.
 *
 * Polls the unread-count endpoint while the tab is visible. We skip work when
 * the document is hidden — there's no point repeatedly hitting the API for a
 * tab no one is looking at — and re-fetch immediately on tab refocus so a
 * returning user sees up-to-date counts.
 */
export function NotificationBell({ workspaceSlug }: Props) {
  const navigate = useNavigate();
  const [unread, setUnread] = useState<number>(0);

  useEffect(() => {
    if (!workspaceSlug) return;
    let cancelled = false;

    const refresh = () => {
      notificationService
        .unreadCount(workspaceSlug)
        .then((c) => {
          if (!cancelled) setUnread(c.total);
        })
        .catch(() => {
          // Bell is decorative — silently failing keeps the header clean.
        });
    };

    refresh();
    let timer: number | undefined;
    const startPolling = () => {
      stopPolling();
      timer = window.setInterval(refresh, POLL_INTERVAL_MS);
    };
    const stopPolling = () => {
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };

    if (!document.hidden) startPolling();

    const onVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        refresh();
        startPolling();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [workspaceSlug]);

  const badgeText = unread > 99 ? '99+' : String(unread);

  return (
    <button
      type="button"
      aria-label={unread > 0 ? `Notifications (${badgeText} unread)` : 'Notifications'}
      onClick={() => navigate(`/${workspaceSlug}/notifications`)}
      className="relative inline-flex h-8 w-8 items-center justify-center rounded text-(--txt-secondary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
    >
      <Bell size={18} />
      {unread > 0 ? (
        <span className="absolute -top-0.5 -right-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-(--brand-default) px-1 py-0 text-[10px] font-semibold leading-4 text-white">
          {badgeText}
        </span>
      ) : null}
    </button>
  );
}
