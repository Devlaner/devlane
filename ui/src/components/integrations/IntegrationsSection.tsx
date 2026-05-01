import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Settings2 } from 'lucide-react';
import { Button, Card, CardContent, Badge, Modal } from '../ui';
import { integrationService } from '../../services/integrationService';
import { getApiErrorMessage } from '../../api/client';
import { RepoSyncSettingsModal } from './RepoSyncSettingsModal';
import type {
  GitHubRepositoryApiResponse,
  GitHubRepositorySyncResponse,
  ProjectApiResponse,
  WorkspaceIntegrationApiResponse,
} from '../../api/types';

const IconGitHub = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

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

  const isConnected = !!github;

  // Surface OAuth callback redirect outcome (?connected=github or ?error=...).
  useEffect(() => {
    const connected = searchParams.get('connected');
    const errParam = searchParams.get('error');
    if (connected === 'github') {
      setSuccess('GitHub connected.');
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

  const handleConnect = () => {
    // Top-level navigation — GitHub will redirect us back to /<slug>/settings?section=integrations.
    window.location.href = integrationService.githubInstallUrl(workspaceSlug);
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect GitHub from this workspace? Linked repos will be unlinked.')) return;
    setDisconnecting(true);
    setError('');
    try {
      await integrationService.uninstall(workspaceSlug, 'github');
      setInstalled([]);
      setProjectSyncs({});
      setSuccess('GitHub disconnected.');
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setDisconnecting(false);
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
      setSuccess(`Linked ${repo.full_name}.`);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async (projectId: string) => {
    if (!confirm('Unlink GitHub repository from this project?')) return;
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
        <h2 className="text-base font-semibold text-(--txt-primary)">Integrations</h2>
        <p className="mt-1 text-sm text-(--txt-secondary)">
          Connect Devlane with the tools your team already uses to keep work in sync.
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
          Source control
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
                    <Badge variant="success">Connected</Badge>
                  ) : (
                    <Badge variant="neutral">Available</Badge>
                  )}
                  {github?.account_login && (
                    <span className="text-xs text-(--txt-tertiary)">@{github.account_login}</span>
                  )}
                  {github?.suspended_at && <Badge variant="warning">Suspended</Badge>}
                </div>
                <p className="mt-1 text-sm text-(--txt-secondary)">
                  Two-way sync between GitHub pull requests and Devlane issues. Reference issues
                  from PRs and branches to keep status in lock-step, and see review state from the
                  issue sidebar.
                </p>
                {!isConnected && (
                  <ul className="mt-3 space-y-1 text-sm text-(--txt-tertiary)">
                    <li>• Auto-link PRs to issues using branch names and commit messages</li>
                    <li>• Mirror PR status (draft, open, merged, closed) onto issue activity</li>
                    <li>• Move issues across states based on PR events</li>
                  </ul>
                )}
              </div>
            </div>
            <div className="shrink-0">
              {loading ? (
                <Button variant="secondary" disabled>
                  Loading…
                </Button>
              ) : isConnected ? (
                <Button variant="secondary" disabled={disconnecting} onClick={handleDisconnect}>
                  {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                </Button>
              ) : (
                <Button onClick={handleConnect}>Connect</Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {isConnected && projects.length > 0 && (
        <div>
          <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-(--txt-tertiary)">
            Linked repositories
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
                          <p className="text-xs text-(--txt-tertiary)">No repository linked.</p>
                        )}
                      </div>
                      {repo ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSettingsOpenForProjectId(p.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-(--radius-md) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
                            aria-label={`Configure GitHub sync for ${p.name}`}
                            title="Sync settings"
                          >
                            <Settings2 className="h-4 w-4" />
                          </button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void handleUnlink(p.id)}
                          >
                            Unlink
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void openLinkModal(p.id)}
                        >
                          Link repo
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

      <Modal
        open={linkModalOpen}
        onClose={() => {
          if (!linking) {
            setLinkModalOpen(false);
            setLinkingProjectId(null);
          }
        }}
        title={`Link a GitHub repository to ${
          linkingProjectId
            ? (projects.find((p) => p.id === linkingProjectId)?.name ?? 'project')
            : 'project'
        }`}
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
            Cancel
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-(--txt-secondary)">
            Pick a repository the GitHub App has access to. Pull requests targeting this project
            will be linked to its issues.
          </p>
          <div className="max-h-80 overflow-y-auto rounded-(--radius-md) border border-(--border-subtle)">
            {repos.length === 0 && !reposLoading ? (
              <p className="px-3 py-4 text-sm text-(--txt-tertiary)">
                No repositories accessible to the installation. Add this app to a repo on GitHub
                first.
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
                      Link
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {reposHasMore && (
            <Button variant="ghost" onClick={() => void loadMoreRepos()} disabled={reposLoading}>
              {reposLoading ? 'Loading…' : 'Load more'}
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
    </div>
  );
}
