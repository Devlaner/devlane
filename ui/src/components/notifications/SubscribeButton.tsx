import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { issueService } from '../../services/issueService';

interface Props {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
}

/**
 * Toggle that lets the user explicitly follow / unfollow an issue's activity
 * stream. Hidden details: assignees and commenters are auto-subscribed by the
 * server, so this control mostly matters for non-assignees who want to lurk.
 */
export function SubscribeButton({ workspaceSlug, projectId, issueId }: Props) {
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    issueService
      .isSubscribed(workspaceSlug, projectId, issueId)
      .then((s) => {
        if (!cancelled) setSubscribed(s);
      })
      .catch(() => {
        if (!cancelled) setSubscribed(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, issueId]);

  const onToggle = async () => {
    if (subscribed === null || busy) return;
    setBusy(true);
    try {
      if (subscribed) {
        await issueService.unsubscribe(workspaceSlug, projectId, issueId);
        setSubscribed(false);
      } else {
        await issueService.subscribe(workspaceSlug, projectId, issueId);
        setSubscribed(true);
      }
    } catch {
      // Surface as best-effort; UI doesn't need an error toast for this.
    } finally {
      setBusy(false);
    }
  };

  if (subscribed === null) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      className={`inline-flex w-full items-center justify-center gap-2 rounded border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 ${
        subscribed
          ? 'border-(--border-subtle) bg-(--bg-surface-1) text-(--txt-primary) hover:bg-(--bg-layer-1-hover)'
          : 'border-(--border-subtle) bg-(--bg-canvas) text-(--txt-secondary) hover:text-(--txt-primary)'
      }`}
    >
      {subscribed ? <Bell size={14} /> : <BellOff size={14} />}
      {subscribed ? 'Subscribed' : 'Subscribe'}
    </button>
  );
}
