import { useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { GitPullRequest, GitMerge, X, Loader2, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, Button } from '../ui';
import { integrationService } from '../../services/integrationService';
import { getApiErrorMessage } from '../../api/client';
import type { GitHubIssueLinkResponse } from '../../api/types';

interface IssuePRSidebarProps {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
}

/**
 * Right-rail panel on the issue detail page listing every GitHub PR linked to
 * this issue. Auto-detected refs and manually-pasted URLs both land here.
 *
 * Features:
 *   - One row per PR with state-coloured icon, owner/repo#num link, title,
 *     author + relative time, ✕ to unlink.
 *   - Footer: collapsible "Link a pull request" form with a single URL input.
 *
 * On 404 from the project (no repo linked yet) we render a soft "Link a repo
 * first" message rather than the form.
 */
export function IssuePRSidebar({ workspaceSlug, projectId, issueId }: IssuePRSidebarProps) {
  const { t } = useTranslation();
  const [links, setLinks] = useState<GitHubIssueLinkResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    integrationService
      .githubListIssueLinks(workspaceSlug, projectId, issueId)
      .then((list) => {
        if (!cancelled) setLinks(list ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(getApiErrorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, issueId]);

  const handleAdd = async () => {
    const v = url.trim();
    if (!v) return;
    setAdding(true);
    setError('');
    try {
      const created = await integrationService.githubCreateIssueLink(
        workspaceSlug,
        projectId,
        issueId,
        v,
      );
      // De-dup by id — the upsert path may return an existing row.
      setLinks((prev) => [created, ...prev.filter((l) => l.id !== created.id)]);
      setUrl('');
      setShowForm(false);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setAdding(false);
    }
  };

  const handleUnlink = async (linkId: string) => {
    setError('');
    try {
      await integrationService.githubDeleteIssueLink(workspaceSlug, projectId, issueId, linkId);
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  };

  return (
    <Card>
      <CardHeader className="flex items-center justify-between text-sm font-medium text-(--txt-secondary)">
        <span>{t('workItem.pr.title', 'Linked pull requests')}</span>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
            aria-label={t('workItem.pr.linkPr', 'Link a pull request')}
            title={t('workItem.pr.linkPr', 'Link a pull request')}
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </CardHeader>
      <CardContent className="space-y-2 pt-3 text-sm">
        {error && (
          <div className="rounded-(--radius-md) border border-(--border-danger-subtle) bg-(--bg-danger-subtle) px-2 py-1 text-xs text-(--txt-danger-primary)">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-(--txt-tertiary)">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />{' '}
            {t('workItem.pr.loading', 'Loading PRs…')}
          </div>
        ) : links.length === 0 && !showForm ? (
          <p className="text-xs text-(--txt-tertiary)">
            <Trans
              i18nKey="workItem.pr.empty"
              defaults="No pull requests yet. They appear automatically when a PR references this issue (e.g.<0>Fixes DEV-42</0>), or you can paste a URL above."
              components={[<span className="ml-1 font-mono" />]}
            />
          </p>
        ) : (
          <ul className="space-y-1.5">
            {links.map((l) => (
              <PRRow key={l.id} link={l} onUnlink={() => void handleUnlink(l.id)} />
            ))}
          </ul>
        )}

        {showForm && (
          <div className="mt-2 space-y-1.5 border-t border-(--border-subtle) pt-3">
            <label className="block text-xs font-medium text-(--txt-secondary)">
              {t('workItem.pr.urlLabel', 'Pull request URL')}
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t(
                'workItem.pr.urlPlaceholder',
                'https://github.com/owner/repo/pull/123',
              )}
              className="block w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-2 py-1.5 text-xs text-(--txt-primary) focus:outline-none"
              disabled={adding}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleAdd();
                if (e.key === 'Escape') {
                  setShowForm(false);
                  setUrl('');
                }
              }}
              autoFocus
            />
            <div className="flex justify-end gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                disabled={adding}
                onClick={() => {
                  setShowForm(false);
                  setUrl('');
                  setError('');
                }}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button size="sm" disabled={adding || !url.trim()} onClick={() => void handleAdd()}>
                {adding ? t('workItem.pr.linking', 'Linking…') : t('workItem.pr.link', 'Link')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PRRow({ link, onUnlink }: { link: GitHubIssueLinkResponse; onUnlink: () => void }) {
  const { t } = useTranslation();
  const repoLabel = useMemo(() => {
    // issue_url is the canonical PR URL: https://github.com/{owner}/{repo}/pull/{n}
    try {
      const u = new URL(link.issue_url);
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 4) {
        return `${parts[0]}/${parts[1]}#${link.repo_issue_id}`;
      }
    } catch {
      /* ignore */
    }
    return `#${link.repo_issue_id}`;
  }, [link.issue_url, link.repo_issue_id]);

  const stateMeta = prStateMeta(link);
  const stateLabel =
    {
      Merged: t('workItem.pr.stateMerged', 'Merged'),
      Closed: t('workItem.pr.stateClosed', 'Closed'),
      Draft: t('workItem.pr.stateDraft', 'Draft'),
      Open: t('workItem.pr.stateOpen', 'Open'),
    }[stateMeta.label] ?? stateMeta.label;

  return (
    <li className="group flex items-start gap-2 rounded-(--radius-md) p-1 hover:bg-(--bg-layer-1-hover)">
      <span
        className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center"
        style={{ color: stateMeta.color }}
        title={stateLabel}
      >
        {stateMeta.icon}
      </span>
      <div className="min-w-0 flex-1">
        <a
          href={link.issue_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-xs"
        >
          <span className="font-medium text-(--txt-primary) hover:underline">{repoLabel}</span>
          {link.title ? (
            <span className="ml-1 text-(--txt-secondary)" title={link.title}>
              {link.title}
            </span>
          ) : null}
        </a>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-(--txt-tertiary)">
          <span>{stateLabel}</span>
          {link.author_login && <span>· @{link.author_login}</span>}
          {link.detection_source === 'manual' && <span>· {t('workItem.pr.manual', 'manual')}</span>}
        </div>
      </div>
      <button
        type="button"
        onClick={onUnlink}
        className="ml-1 mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100 hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
        aria-label={t('workItem.pr.unlink', 'Unlink')}
        title={t('workItem.pr.unlink', 'Unlink')}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

function prStateMeta(link: GitHubIssueLinkResponse): {
  color: string;
  label: string;
  icon: React.ReactNode;
} {
  if (link.state === 'merged') {
    return { color: '#8957e5', label: 'Merged', icon: <GitMerge className="h-4 w-4" /> };
  }
  if (link.state === 'closed') {
    return {
      color: '#cf222e',
      label: 'Closed',
      icon: <GitPullRequest className="h-4 w-4" strokeWidth={2.5} />,
    };
  }
  if (link.draft) {
    return { color: '#6e7781', label: 'Draft', icon: <GitPullRequest className="h-4 w-4" /> };
  }
  return { color: '#1a7f37', label: 'Open', icon: <GitPullRequest className="h-4 w-4" /> };
}
