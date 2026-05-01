import { GitPullRequest, GitMerge } from 'lucide-react';
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
  if (!summary || summary.total === 0) return null;

  const { color, icon } = badgeStyle(summary.latest_state);
  const tooltip = buildTooltip(summary);

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

function buildTooltip(s: GitHubIssueSummaryEntry): string {
  const parts: string[] = [];
  parts.push(`${s.total} pull request${s.total === 1 ? '' : 's'}`);
  if (s.open) parts.push(`${s.open} open`);
  if (s.merged) parts.push(`${s.merged} merged`);
  if (s.closed) parts.push(`${s.closed} closed`);
  if (s.draft) parts.push(`${s.draft} draft`);
  return parts.join(' · ');
}
