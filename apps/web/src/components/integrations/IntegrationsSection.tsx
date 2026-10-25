import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Settings2 } from 'lucide-react';
import { Button, Card, CardContent, Badge, Modal } from '../ui';
import { integrationService } from '../../services/integrationService';
import { getApiErrorMessage } from '../../api/client';
import { RepoSyncSettingsModal } from './RepoSyncSettingsModal';
import { SlackChannelSettingsModal } from './SlackChannelSettingsModal';
import type {
  GitHubRepositoryApiResponse,
  GitHubRepositorySyncResponse,
  ProjectApiResponse,
  WorkspaceIntegrationApiResponse,
  SlackChannelLinkResponse,
} from '../../api/types';

import { IconGitHub, IconSlack } from '../icons/IntegrationIcons';

interface IntegrationsSectionProps {
  workspaceSlug: string;
  projects: ProjectApiResponse[];
}

/**
 * Workspace settings → Integrations.
 *
 * GitHub is the only provider for now. Layout:
 *   - Provider card with Connect / Manage button driven by installed status.
 *   - Once connected, an inline panel lists projects with their linked-repo status
 *     and lets the user link/unlink a repo via a modal.
 */
export function IntegrationsSection({ workspaceSlug, projects }: IntegrationsSectionProps) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [installed, setInstalled] = useState<WorkspaceIntegrationApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [disconnecting, setDisconnecting] = useState(false);

  // Per-project sync rows (projectId → response or null when unlinked).
  const [projectSyncs, setProjectSyncs] = useState<
    Record<string, GitHubRepositorySyncResponse | null>
  >({});

  // Slack project links
  const [slackProjectLinks, setSlackProjectLinks] = useState<
    Record<string, SlackChannelLinkResponse | null>
  >({});
  const [slackSettingsOpenForProjectId, setSlackSettingsOpenForProjectId] = useState<string | null>(
    null,
  );
  const [slackDisconnecting, setSlackDisconnecting] = useState(false);

  // Repo link modal state.
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkingProjectId, setLinkingProjectId] = useState<string | null>(null);

  // Sync-settings modal state.
  const [settingsOpenForProjectId, setSettingsOpenForProjectId] = useState<string | null>(null);
  const [repos, setRepos] = useState<GitHubRepositoryApiResponse[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposPage, setReposPage] = useState(1);
  const [reposHasMore, setReposHasMore] = useState(false);
  const [linking, setLinking] = useState(false);

  const github = useMemo(
    () => installed.find((wi) => wi.provider === 'github') ?? null,
    [installed],
  );
  const slack = useMemo(() => installed.find((wi) => wi.provider === 'slack') ?? null, [installed]);

  const isConnected = !!github;
  const isSlackConnected = !!slack;

  // Surface OAuth callback redirect outcome (?connected=github or ?error=...).
  useEffect(() => {
    const connected = searchParams.get('connected');
    const errParam = searchParams.get('error');
    if (connected === 'github') {
      setSuccess(t('integrations.github.connected', 'GitHub connected.'));
      const next = new URLSearchParams(searchParams);
      next.delete('connected');
      setSearchParams(next, { replace: true });
    } else if (connected === 'slack') {
      setSuccess(t('integrations.slack.connected', 'Slack connected.'));
      const next = new URLSearchParams(searchParams);
      next.delete('connected');
      setSearchParams(next, { replace: true });
    } else if (errParam) {
      setError(errParam);
      const next = new URLSearchParams(searchParams);
      next.delete('error');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch installed integrations.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    integrationService
      .listInstalled(workspaceSlug)
      .then((list) => {
        if (!cancelled) setInstalled(list ?? []);
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
  }, [workspaceSlug]);

  // When connected, hydrate per-project sync state.
  useEffect(() => {
    if (!isConnected || projects.length === 0) {
      setProjectSyncs({});
      return;
    }
    let cancelled = false;
    Promise.all(
      projects.map((p) =>
        integrationService
          .githubGetProjectSync(workspaceSlug, p.id)
          .then((r) => [p.id, r] as const)
          .catch(() => [p.id, null] as const),
      ),
    ).then((entries) => {
      if (cancelled) return;
      const next: Record<string, GitHubRepositorySyncResponse | null> = {};
      for (const [pid, r] of entries) next[pid] = r;
      setProjectSyncs(next);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, isConnected, projects]);

  // When connected, hydrate per-project slack links.
  useEffect(() => {
    if (!isSlackConnected || projects.length === 0) {
      setSlackProjectLinks({});
      return;
    }
    let cancelled = false;
    Promise.all(
      projects.map((p) =>
        integrationService
          .slackGetProjectChannel(workspaceSlug, p.id)
          .then((r) => [p.id, r] as const)
          .catch(() => [p.id, null] as const),
      ),
    ).then((entries) => {
      if (cancelled) return;
      const next: Record<string, SlackChannelLinkResponse | null> = {};
      for (const [pid, r] of entries) next[pid] = r;
      setSlackProjectLinks(next);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, isSlackConnected, projects]);

  const handleConnect = () => {
    // Top-level navigation — GitHub will redirect us back to /<slug>/settings?section=integrations.
    window.location.href = integrationService.githubInstallUrl(workspaceSlug);
  };

  const handleDisconnect = async () => {
    if (
      !confirm(
        t(
          'integrations.github.disconnectConfirm',
          'Disconnect GitHub from this workspace? Linked repos will be unlinked.',
        ),
      )
    )
      return;
    setDisconnecting(true);
    setError('');
    try {
      await integrationService.uninstall(workspaceSlug, 'github');
      setInstalled((prev) => prev.filter((i) => i.provider !== 'github'));
      setProjectSyncs({});
      setSuccess(t('integrations.github.disconnected', 'GitHub disconnected.'));
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSlackConnect = () => {
    window.location.href = integrationService.slackInstallUrl(workspaceSlug);
  };

  const handleSlackDisconnect = async () => {
    if (
      !confirm(
        t(
          'integrations.slack.disconnectConfirm',
          'Disconnect Slack from this workspace? Project channels will be unlinked.',
        ),
      )
    )
      return;
    setSlackDisconnecting(true);
    setError('');
    try {
      await integrationService.uninstall(workspaceSlug, 'slack');
      setInstalled((prev) => prev.filter((i) => i.provider !== 'slack'));
      setSlackProjectLinks({});
      setSuccess(t('integrations.slack.disconnected', 'Slack disconnected.'));
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSlackDisconnecting(false);
    }
  };

  const openLinkModal = async (projectId: string) => {
    setLinkingProjectId(projectId);
    setLinkModalOpen(true);
    setRepos([]);
    setReposPage(1);
    setReposHasMore(false);
    setReposLoading(true);
    try {
      const res = await integrationService.githubListRepos(workspaceSlug, 1, 30);
      setRepos(res.repositories ?? []);
      setReposHasMore((res.repositories?.length ?? 0) >= 30);
      setReposPage(1);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setReposLoading(false);
    }
  };

  const loadMoreRepos = async () => {
    if (reposLoading) return;
    setReposLoading(true);
    try {
      const next = reposPage + 1;
      const res = await integrationService.githubListRepos(workspaceSlug, next, 30);
      setRepos((prev) => [...prev, ...(res.repositories ?? [])]);
      setReposPage(next);
      setReposHasMore((res.repositories?.length ?? 0) >= 30);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setReposLoading(false);
    }
  };

  const handlePickRepo = async (repo: GitHubRepositoryApiResponse) => {
    if (!linkingProjectId) return;
    setLinking(true);
    setError('');
    try {
      const res = await integrationService.githubLinkProjectRepo(workspaceSlug, linkingProjectId, {
        github_repository_id: repo.id,
        owner: repo.owner.login,
        name: repo.name,
        url: repo.html_url,
      });
      setProjectSyncs((prev) => ({ ...prev, [linkingProjectId]: res }));
      setLinkModalOpen(false);
      setLinkingProjectId(null);
      setSuccess(t('integrations.github.linked', 'Linked {{name}}.', { name: repo.full_name }));
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async (projectId: string) => {
    if (
      !confirm(
        t('integrations.github.unlinkConfirm', 'Unlink GitHub repository from this project?'),
      )
    )
      return;
    setError('');
    try {
      await integrationService.githubUnlinkProjectRepo(workspaceSlug, projectId);
      setProjectSyncs((prev) => ({ ...prev, [projectId]: null }));
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-(--txt-primary)">
          {t('integrations.title', 'Integrations')}
        </h2>
        <p className="mt-1 text-sm text-(--txt-secondary)">
          {t(
            'integrations.description',
            'Connect Devlane with the tools your team already uses to keep work in sync.',
          )}
        </p>
      </div>

      {error && (
        <div className="rounded-(--radius-md) border border-(--border-danger-subtle) bg-(--bg-danger-subtle) px-3 py-2 text-sm text-(--txt-danger-primary)">
          {error}
        </div>
      )}
      {success && !error && (
        <div className="rounded-(--radius-md) border border-(--border-success-subtle) bg-(--bg-success-subtle) px-3 py-2 text-sm text-(--txt-success-primary)">
          {success}
        </div>
      )}

      <div>
        <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-(--txt-tertiary)">
          {t('integrations.sourceControl', 'Source control')}
        </p>
        <Card variant="outlined">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-(--radius-md) bg-(--bg-layer-1) text-(--txt-icon-secondary)">
                <IconGitHub />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-(--txt-primary)">GitHub</h3>
                  {isConnected ? (
                    <Badge variant="success">
                      {t('integrations.status.connected', 'Connected')}
                    </Badge>
                  ) : (
                    <Badge variant="neutral">
                      {t('integrations.status.available', 'Available')}
                    </Badge>
                  )}
                  {github?.account_login && (
                    <span className="text-xs text-(--txt-tertiary)">@{github.account_login}</span>
                  )}
                  {github?.suspended_at && (
                    <Badge variant="warning">
                      {t('integrations.status.suspended', 'Suspended')}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-(--txt-secondary)">
                  {t(
                    'integrations.github.description',
                    'Two-way sync between GitHub pull requests and Devlane issues. Reference issues from PRs and branches to keep status in lock-step, and see review state from the issue sidebar.',
                  )}
                </p>
                {!isConnected && (
                  <ul className="mt-3 space-y-1 text-sm text-(--txt-tertiary)">
                    <li>
                      •{' '}
                      {t(
                        'integrations.github.feature.autoLink',
                        'Auto-link PRs to issues using branch names and commit messages',
                      )}
                    </li>
                    <li>
                      •{' '}
                      {t(
                        'integrations.github.feature.mirrorStatus',
                        'Mirror PR status (draft, open, merged, closed) onto issue activity',
                      )}
                    </li>
                    <li>
                      •{' '}
                      {t(
                        'integrations.github.feature.moveIssues',
                        'Move issues across states based on PR events',
                      )}
                    </li>
                  </ul>
                )}
              </div>
            </div>
            <div className="shrink-0">
              {loading ? (
                <Button variant="secondary" disabled>
                  {t('common.loading', 'Loading…')}
                </Button>
              ) : isConnected ? (
                <Button variant="secondary" disabled={disconnecting} onClick={handleDisconnect}>
                  {disconnecting
                    ? t('integrations.github.disconnecting', 'Disconnecting…')
                    : t('integrations.github.disconnect', 'Disconnect')}
                </Button>
              ) : (
                <Button onClick={handleConnect}>
                  {t('integrations.github.connect', 'Connect')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {isConnected && projects.length > 0 && (
        <div>
          <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-(--txt-tertiary)">
            {t('integrations.linkedRepositories', 'Linked repositories')}
          </p>
          <Card variant="outlined">
            <CardContent className="p-0">
              <ul className="divide-y divide-(--border-subtle)">
                {projects.map((p) => {
                  const sync = projectSyncs[p.id];
                  const repo = sync?.repository ?? null;
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-(--txt-primary)">
                          {p.name}
                          {p.identifier ? (
                            <span className="ml-2 text-xs font-normal text-(--txt-tertiary)">
                              {p.identifier}
                            </span>
                          ) : null}
                        </p>
                        {repo ? (
                          <p className="truncate text-xs text-(--txt-secondary)">
                            <a
                              href={repo.url || `https://github.com/${repo.owner}/${repo.name}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline"
                            >
                              {repo.owner}/{repo.name}
                            </a>
                          </p>
                        ) : (
                          <p className="text-xs text-(--txt-tertiary)">
                            {t('integrations.noRepoLinked', 'No repository linked.')}
                          </p>
                        )}
                      </div>
                      {repo ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSettingsOpenForProjectId(p.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-(--radius-md) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
                            aria-label={t(
                              'integrations.configureSyncAria',
                              'Configure GitHub sync for {{name}}',
                              { name: p.name },
                            )}
                            title={t('integrations.syncSettings', 'Sync settings')}
                          >
                            <Settings2 className="h-4 w-4" />
                          </button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void handleUnlink(p.id)}
                          >
                            {t('integrations.unlink', 'Unlink')}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void openLinkModal(p.id)}
                        >
                          {t('integrations.linkRepo', 'Link repo')}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {/* --- Slack Section --- */}
      <div>
        <p className="mb-2 mt-8 px-1 text-xs font-medium uppercase tracking-wider text-(--txt-tertiary)">
          {t('integrations.communications', 'Communications')}
        </p>
        <Card variant="outlined">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-(--radius-md) bg-(--bg-layer-1) text-(--txt-icon-secondary)">
                <IconSlack />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-(--txt-primary)">
                    {t('integrations.slack.name', 'Slack')}
                  </h3>
                  {isSlackConnected ? (
                    <Badge variant="success">
                      {t('integrations.status.connected', 'Connected')}
                    </Badge>
                  ) : (
                    <Badge variant="neutral">
                      {t('integrations.status.available', 'Available')}
                    </Badge>
                  )}
                  {slack?.suspended_at && (
                    <Badge variant="warning">
                      {t('integrations.status.suspended', 'Suspended')}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-(--txt-secondary)">
                  {t(
                    'integrations.slack.description',
                    'Push issue events directly to Slack channels. Get notified when issues are created, move across states, or receive comments.',
                  )}
                </p>
                {!isSlackConnected && (
                  <ul className="mt-3 space-y-1 text-sm text-(--txt-tertiary)">
                    <li>
                      •{' '}
                      {t(
                        'integrations.slack.feature.notify',
                        'Route notifications to project-specific channels',
                      )}
                    </li>
                    <li>
                      •{' '}
                      {t(
                        'integrations.slack.feature.events',
                        'Customize which events trigger a message',
                      )}
                    </li>
                  </ul>
                )}
              </div>
            </div>
            <div className="shrink-0">
              {loading ? (
                <Button variant="secondary" disabled>
                  {t('common.loading', 'Loading…')}
                </Button>
              ) : isSlackConnected ? (
                <Button
                  variant="secondary"
                  disabled={slackDisconnecting}
                  onClick={() => void handleSlackDisconnect()}
                >
                  {slackDisconnecting
                    ? t('integrations.slack.disconnecting', 'Disconnecting…')
                    : t('integrations.slack.disconnect', 'Disconnect')}
                </Button>
              ) : (
                <Button onClick={() => void handleSlackConnect()}>
                  {t('integrations.slack.connect', 'Connect')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {isSlackConnected && projects.length > 0 && (
        <div>
          <p className="mb-2 mt-6 px-1 text-xs font-medium uppercase tracking-wider text-(--txt-tertiary)">
            {t('integrations.slack.linkedChannels', 'Linked channels')}
          </p>
          <Card variant="outlined">
            <CardContent className="p-0">
              <ul className="divide-y divide-(--border-subtle)">
                {projects.map((p) => {
                  const link = slackProjectLinks[p.id];
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-(--txt-primary)">
                          {p.name}
                          {p.identifier ? (
                            <span className="ml-2 text-xs font-normal text-(--txt-tertiary)">
                              {p.identifier}
                            </span>
                          ) : null}
                        </p>
                        {link ? (
                          <p className="truncate text-xs text-(--txt-secondary)">
                            #{link.channel_name}
                          </p>
                        ) : (
                          <p className="text-xs text-(--txt-tertiary)">
                            {t('integrations.slack.noChannelLinked', 'No channel linked.')}
                          </p>
                        )}
                      </div>
                      {link ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSlackSettingsOpenForProjectId(p.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-(--radius-md) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
                            aria-label={t(
                              'integrations.slack.configureAria',
                              'Configure Slack channel for {{name}}',
                              { name: p.name },
                            )}
                            title={t('integrations.settings', 'Settings')}
                          >
                            <Settings2 className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSlackSettingsOpenForProjectId(p.id)}
                        >
                          {t('integrations.slack.linkChannel', 'Link channel')}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {/* --- Modals --- */}
      <Modal
        open={linkModalOpen}
        onClose={() => {
          if (!linking) {
            setLinkModalOpen(false);
            setLinkingProjectId(null);
          }
        }}
        title={t('integrations.linkModalTitle', 'Link a GitHub repository to {{name}}', {
          name: linkingProjectId
            ? (projects.find((p) => p.id === linkingProjectId)?.name ??
              t('common.project', 'Project'))
            : t('common.project', 'Project'),
        })}
        footer={
          <Button
            variant="secondary"
            onClick={() => {
              if (!linking) {
                setLinkModalOpen(false);
                setLinkingProjectId(null);
              }
            }}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-(--txt-secondary)">
            {t(
              'integrations.linkModalHint',
              'Pick a repository the GitHub App has access to. Pull requests targeting this project will be linked to its issues.',
            )}
          </p>
          <div className="max-h-80 overflow-y-auto rounded-(--radius-md) border border-(--border-subtle)">
            {repos.length === 0 && !reposLoading ? (
              <p className="px-3 py-4 text-sm text-(--txt-tertiary)">
                {t(
                  'integrations.noReposAccessible',
                  'No repositories accessible to the installation. Add this app to a repo on GitHub first.',
                )}
              </p>
            ) : (
              <ul className="divide-y divide-(--border-subtle)">
                {repos.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-(--txt-primary)">
                        {r.full_name}
                      </p>
                      {r.description ? (
                        <p className="truncate text-xs text-(--txt-tertiary)">{r.description}</p>
                      ) : null}
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={linking}
                      onClick={() => void handlePickRepo(r)}
                    >
                      {t('integrations.link', 'Link')}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {reposHasMore && (
            <Button variant="ghost" onClick={() => void loadMoreRepos()} disabled={reposLoading}>
              {reposLoading
                ? t('common.loading', 'Loading…')
                : t('integrations.loadMore', 'Load more')}
            </Button>
          )}
        </div>
      </Modal>

      {settingsOpenForProjectId &&
        (() => {
          const proj = projects.find((p) => p.id === settingsOpenForProjectId);
          if (!proj) return null;
          return (
            <RepoSyncSettingsModal
              open
              onClose={() => setSettingsOpenForProjectId(null)}
              workspaceSlug={workspaceSlug}
              project={proj}
              initialSync={projectSyncs[proj.id] ?? null}
              onSaved={(next) => setProjectSyncs((prev) => ({ ...prev, [proj.id]: next }))}
            />
          );
        })()}

      {slackSettingsOpenForProjectId &&
        (() => {
          const proj = projects.find((p) => p.id === slackSettingsOpenForProjectId);
          if (!proj) return null;
          return (
            <SlackChannelSettingsModal
              open
              onClose={() => setSlackSettingsOpenForProjectId(null)}
              workspaceSlug={workspaceSlug}
              project={proj}
              initialLink={slackProjectLinks[proj.id] ?? null}
              onSaved={(next) => setSlackProjectLinks((prev) => ({ ...prev, [proj.id]: next }))}
            />
          );
        })()}
    </div>
  );
}
