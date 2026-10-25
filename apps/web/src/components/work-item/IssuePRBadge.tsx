import { GitPullRequest, GitMerge } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { GitHubIssueSummaryEntry } from '../../api/types';

interface IssuePRBadgeProps {
  summary?: GitHubIssueSummaryEntry;
}

/**
 * Compact icon shown next to an issue row when at least one PR is linked.
 * Color follows the latest PR's state (open=green / merged=purple / closed=red),
 * tooltip lists the breakdown.
 */
export function IssuePRBadge({ summary }: IssuePRBadgeProps) {
  const { t } = useTranslation();
  if (!summary || summary.total === 0) return null;

  const { color, icon } = badgeStyle(summary.latest_state);
  const tooltip = buildTooltip(summary, t);

  return (
    <span
      className="inline-flex h-4 w-4 items-center justify-center"
      style={{ color }}
      title={tooltip}
      aria-label={tooltip}
    >
      {icon}
    </span>
  );
}

function badgeStyle(latest: string): { color: string; icon: React.ReactNode } {
  if (latest === 'merged') {
    return { color: '#8957e5', icon: <GitMerge className="h-3.5 w-3.5" /> };
  }
  if (latest === 'closed') {
    return {
      color: '#cf222e',
      icon: <GitPullRequest className="h-3.5 w-3.5" strokeWidth={2.5} />,
    };
  }
  return { color: '#1a7f37', icon: <GitPullRequest className="h-3.5 w-3.5" /> };
}

function buildTooltip(s: GitHubIssueSummaryEntry, t: TFunction): string {
  const parts: string[] = [];
  parts.push(t('workItem.pr.prCount', '{{count}} pull requests', { count: s.total }));
  if (s.open) parts.push(t('workItem.pr.countOpen', '{{count}} open', { count: s.open }));
  if (s.merged) parts.push(t('workItem.pr.countMerged', '{{count}} merged', { count: s.merged }));
  if (s.closed) parts.push(t('workItem.pr.countClosed', '{{count}} closed', { count: s.closed }));
  if (s.draft) parts.push(t('workItem.pr.countDraft', '{{count}} draft', { count: s.draft }));
  return parts.join(' · ');
}
