import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, BellOff } from 'lucide-react';
import { Button } from '@/v2/components/ui/button';
import { issueService } from '../../services/issueService';

interface WorkItemSubscribeButtonProps {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  className?: string;
}

/**
 * Subscription toggle for the v2 work item toolbar.
 *
 * The shipped `SubscribeButton` renders a full-width control painted with the
 * legacy `--txt-*` / `--bg-*` variables, which is right for the legacy sidebar
 * it sits in and wrong for a toolbar of shadcn buttons. This is the same three
 * calls behind a `Button`, so the toolbar keeps one control height and one
 * token set.
 */
export function WorkItemSubscribeButton({
  workspaceSlug,
  projectId,
  issueId,
  className,
}: WorkItemSubscribeButtonProps) {
  const { t } = useTranslation();
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    issueService
      .isSubscribed(workspaceSlug, projectId, issueId)
      .then((value) => {
        if (!cancelled) setSubscribed(value);
      })
      .catch(() => {
        if (!cancelled) setSubscribed(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, issueId]);

  if (subscribed === null) return null;

  const toggle = async () => {
    if (busy) return;
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
      /* Best effort, exactly as the shipped control treats it. */
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant={subscribed ? 'secondary' : 'outline'}
      className={className}
      disabled={busy}
      aria-pressed={subscribed}
      onClick={() => void toggle()}
    >
      {subscribed ? <Bell aria-hidden="true" /> : <BellOff aria-hidden="true" />}
      <span className="hidden sm:inline">
        {subscribed
          ? t('workItem.detail.subscribed', 'Subscribed')
          : t('workItem.detail.subscribe', 'Subscribe')}
      </span>
    </Button>
  );
}
