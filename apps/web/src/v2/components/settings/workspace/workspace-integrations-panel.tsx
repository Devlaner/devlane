import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle2Icon,
  ExternalLinkIcon,
  SearchIcon,
  Settings2Icon,
  TriangleAlertIcon,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/v2/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/v2/components/ui/alert';
import { Badge } from '@/v2/components/ui/badge';
import { Button } from '@/v2/components/ui/button';
import { Card, CardContent } from '@/v2/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/v2/components/ui/dialog';
import { Input } from '@/v2/components/ui/input';
import { ScrollArea } from '@/v2/components/ui/scroll-area';
import { Skeleton } from '@/v2/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/v2/components/ui/tooltip';
import { SettingsPanel } from '@/v2/components/settings/settings-panel';
import { RepoSyncDialog } from '@/v2/components/settings/workspace/repo-sync-dialog';
import { SlackChannelDialog } from '@/v2/components/settings/workspace/slack-channel-dialog';
import { getApiErrorMessage } from '../../../../api/client';
import { IconGitHub, IconSlack } from '../../../../components/icons/IntegrationIcons';
import { integrationService } from '../../../../services/integrationService';
import type {
  GitHubRepositoryApiResponse,
  GitHubRepositorySyncResponse,
  ProjectApiResponse,
  SlackChannelLinkResponse,
  WorkspaceIntegrationApiResponse,
} from '../../../../api/types';

interface WorkspaceIntegrationsPanelProps {
  workspaceSlug: string;
  projects: ProjectApiResponse[];
}

/** Provider card: identity, status, blurb, and the connect/disconnect action. */
function ProviderCard({
  icon,
  name,
  status,
  meta,
  description,
  features,
  action,
}: {
  icon: ReactNode;
  name: string;
  status: ReactNode;
  meta?: ReactNode;
  description: string;
  features?: string[];
  action: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="bg-muted text-foreground grid size-10 shrink-0 place-items-center rounded-md">
            {icon}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">{name}</h3>
              {status}
              {meta}
            </div>
            <p className="text-muted-foreground mt-1 text-sm">{description}</p>
            {features && features.length > 0 && (
              <ul className="text-muted-foreground mt-3 flex flex-col gap-1 text-sm">
                {features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <CheckCircle2Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="shrink-0">{action}</div>
      </CardContent>
    </Card>
  );
}

/** Section label above a group of provider cards or link rows. */
function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-muted-foreground px-1 text-xs font-medium tracking-wider uppercase">
      {children}
    </p>
  );
}

/**
 * Workspace settings → Integrations. GitHub and Slack each get a provider card
 * with a connect/disconnect action; once connected, a per-project list below it
 * links repositories or channels and opens their settings dialog.
 */
export function WorkspaceIntegrationsPanel({
  workspaceSlug,
  projects,
}: WorkspaceIntegrationsPanelProps) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [installed, setInstalled] = useState<WorkspaceIntegrationApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [disconnecting, setDisconnecting] = useState<'github' | 'slack' | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<'github' | 'slack' | null>(null);

  // Per-project links (projectId → response or null when unlinked).
  const [projectSyncs, setProjectSyncs] = useState<
    Record<string, GitHubRepositorySyncResponse | null>
  >({});
  const [slackLinks, setSlackLinks] = useState<Record<string, SlackChannelLinkResponse | null>>({});

  const [syncDialogProjectId, setSyncDialogProjectId] = useState<string | null>(null);
  const [slackDialogProjectId, setSlackDialogProjectId] = useState<string | null>(null);
  const [confirmUnlinkRepo, setConfirmUnlinkRepo] = useState<ProjectApiResponse | null>(null);
  const [confirmUnlinkChannel, setConfirmUnlinkChannel] = useState<ProjectApiResponse | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  // Repo picker state.
  const [linkDialogProjectId, setLinkDialogProjectId] = useState<string | null>(null);
  const [repos, setRepos] = useState<GitHubRepositoryApiResponse[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposPage, setReposPage] = useState(1);
  const [reposHasMore, setReposHasMore] = useState(false);
  const [repoQuery, setRepoQuery] = useState('');
  const [linking, setLinking] = useState(false);

  const github = useMemo(
    () => installed.find((wi) => wi.provider === 'github') ?? null,
    [installed],
  );
  const slack = useMemo(() => installed.find((wi) => wi.provider === 'slack') ?? null, [installed]);
  const isConnected = github !== null;
  const isSlackConnected = slack !== null;

  // Surface the OAuth callback outcome (?connected=… or ?error=…) once.
  useEffect(() => {
    const connected = searchParams.get('connected');
    const errParam = searchParams.get('error');
    const next = new URLSearchParams(searchParams);
    if (connected === 'github' || connected === 'slack') {
      setSuccess(
        connected === 'github'
          ? t('integrations.github.connected', 'GitHub connected.')
          : t('integrations.slack.connected', 'Slack connected.'),
      );
      next.delete('connected');
      setSearchParams(next, { replace: true });
    } else if (errParam) {
      setError(errParam);
      next.delete('error');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      if (!cancelled) setProjectSyncs(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, isConnected, projects]);

  useEffect(() => {
    if (!isSlackConnected || projects.length === 0) {
      setSlackLinks({});
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
      if (!cancelled) setSlackLinks(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, isSlackConnected, projects]);

  const handleDisconnect = async () => {
    const provider = confirmDisconnect;
    if (!provider) return;
    setDisconnecting(provider);
    setError('');
    try {
      await integrationService.uninstall(workspaceSlug, provider);
      setInstalled((prev) => prev.filter((i) => i.provider !== provider));
      if (provider === 'github') {
        setProjectSyncs({});
        setSuccess(t('integrations.github.disconnected', 'GitHub disconnected.'));
      } else {
        setSlackLinks({});
        setSuccess(t('integrations.slack.disconnected', 'Slack disconnected.'));
      }
      setConfirmDisconnect(null);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setDisconnecting(null);
    }
  };

  const openRepoPicker = async (projectId: string) => {
    setLinkDialogProjectId(projectId);
    setRepos([]);
    setRepoQuery('');
    setReposPage(1);
    setReposHasMore(false);
    setReposLoading(true);
    try {
      const res = await integrationService.githubListRepos(workspaceSlug, 1, 30);
      setRepos(res.repositories ?? []);
      setReposHasMore((res.repositories?.length ?? 0) >= 30);
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
    if (!linkDialogProjectId) return;
    setLinking(true);
    setError('');
    try {
      const res = await integrationService.githubLinkProjectRepo(
        workspaceSlug,
        linkDialogProjectId,
        {
          github_repository_id: repo.id,
          owner: repo.owner.login,
          name: repo.name,
          url: repo.html_url,
        },
      );
      setProjectSyncs((prev) => ({ ...prev, [linkDialogProjectId]: res }));
      setLinkDialogProjectId(null);
      setSuccess(t('integrations.github.linked', 'Linked {{name}}.', { name: repo.full_name }));
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkRepo = async () => {
    if (!confirmUnlinkRepo) return;
    setUnlinking(true);
    setError('');
    try {
      await integrationService.githubUnlinkProjectRepo(workspaceSlug, confirmUnlinkRepo.id);
      setProjectSyncs((prev) => ({ ...prev, [confirmUnlinkRepo.id]: null }));
      setConfirmUnlinkRepo(null);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setUnlinking(false);
    }
  };

  const handleUnlinkChannel = async () => {
    if (!confirmUnlinkChannel) return;
    setUnlinking(true);
    setError('');
    try {
      await integrationService.slackUnlinkProjectChannel(workspaceSlug, confirmUnlinkChannel.id);
      setSlackLinks((prev) => ({ ...prev, [confirmUnlinkChannel.id]: null }));
      setConfirmUnlinkChannel(null);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setUnlinking(false);
    }
  };

  const statusBadge = (connected: boolean) =>
    connected ? (
      <Badge variant="default">{t('integrations.status.connected', 'Connected')}</Badge>
    ) : (
      <Badge variant="secondary">{t('integrations.status.available', 'Available')}</Badge>
    );

  const filteredRepos = repos.filter((repo) =>
    repo.full_name.toLowerCase().includes(repoQuery.trim().toLowerCase()),
  );
  const syncDialogProject = projects.find((p) => p.id === syncDialogProjectId) ?? null;
  const slackDialogProject = projects.find((p) => p.id === slackDialogProjectId) ?? null;
  const linkDialogProject = projects.find((p) => p.id === linkDialogProjectId) ?? null;

  return (
    <SettingsPanel
      title={t('integrations.title', 'Integrations')}
      description={t(
        'integrations.description',
        'Connect Devlane with the tools your team already uses to keep work in sync.',
      )}
    >
      {error && (
        <Alert variant="destructive" className="border">
          <TriangleAlertIcon />
          <AlertTitle>{t('common.error', 'Something went wrong')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && !error && (
        <Alert className="border">
          <CheckCircle2Icon />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <GroupLabel>{t('integrations.sourceControl', 'Source control')}</GroupLabel>
            <ProviderCard
              icon={<IconGitHub />}
              name="GitHub"
              status={statusBadge(isConnected)}
              meta={
                <>
                  {github?.account_login && (
                    <span className="text-muted-foreground text-xs">@{github.account_login}</span>
                  )}
                  {github?.suspended_at && (
                    <Badge variant="destructive">
                      {t('integrations.status.suspended', 'Suspended')}
                    </Badge>
                  )}
                </>
              }
              description={t(
                'integrations.github.description',
                'Two-way sync between GitHub pull requests and Devlane issues. Reference issues from PRs and branches to keep status in lock-step, and see review state from the issue sidebar.',
              )}
              features={
                isConnected
                  ? undefined
                  : [
                      t(
                        'integrations.github.feature.autoLink',
                        'Auto-link PRs to issues using branch names and commit messages',
                      ),
                      t(
                        'integrations.github.feature.mirrorStatus',
                        'Mirror PR status (draft, open, merged, closed) onto issue activity',
                      ),
                      t(
                        'integrations.github.feature.moveIssues',
                        'Move issues across states based on PR events',
                      ),
                    ]
              }
              action={
                isConnected ? (
                  <Button variant="outline" onClick={() => setConfirmDisconnect('github')}>
                    {t('integrations.github.disconnect', 'Disconnect')}
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      // Top-level navigation — GitHub redirects back to this section.
                      window.location.href = integrationService.githubInstallUrl(workspaceSlug);
                    }}
                  >
                    {t('integrations.github.connect', 'Connect')}
                  </Button>
                )
              }
            />
          </div>

          {isConnected && projects.length > 0 && (
            <div className="flex flex-col gap-2">
              <GroupLabel>{t('integrations.linkedRepositories', 'Linked repositories')}</GroupLabel>
              <div className="divide-y rounded-lg border">
                {projects.map((project) => {
                  const repo = projectSyncs[project.id]?.repository ?? null;
                  return (
                    <div
                      key={project.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {project.name}
                          {project.identifier && (
                            <span className="text-muted-foreground ml-2 text-xs font-normal">
                              {project.identifier}
                            </span>
                          )}
                        </p>
                        {repo ? (
                          <a
                            href={repo.url || `https://github.com/${repo.owner}/${repo.name}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground mt-0.5 inline-flex items-center gap-1 text-xs hover:underline"
                          >
                            {repo.owner}/{repo.name}
                            <ExternalLinkIcon className="size-3" aria-hidden />
                          </a>
                        ) : (
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            {t('integrations.noRepoLinked', 'No repository linked.')}
                          </p>
                        )}
                      </div>
                      {repo ? (
                        <div className="flex shrink-0 items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={t(
                                  'integrations.configureSyncAria',
                                  'Configure GitHub sync for {{name}}',
                                  { name: project.name },
                                )}
                                onClick={() => setSyncDialogProjectId(project.id)}
                              >
                                <Settings2Icon />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {t('integrations.syncSettings', 'Sync settings')}
                            </TooltipContent>
                          </Tooltip>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirmUnlinkRepo(project)}
                          >
                            {t('integrations.unlink', 'Unlink')}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void openRepoPicker(project.id)}
                        >
                          {t('integrations.linkRepo', 'Link repo')}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <GroupLabel>{t('integrations.communications', 'Communications')}</GroupLabel>
            <ProviderCard
              icon={<IconSlack />}
              name={t('integrations.slack.name', 'Slack')}
              status={statusBadge(isSlackConnected)}
              meta={
                slack?.suspended_at ? (
                  <Badge variant="destructive">
                    {t('integrations.status.suspended', 'Suspended')}
                  </Badge>
                ) : null
              }
              description={t(
                'integrations.slack.description',
                'Push issue events directly to Slack channels. Get notified when issues are created, move across states, or receive comments.',
              )}
              features={
                isSlackConnected
                  ? undefined
                  : [
                      t(
                        'integrations.slack.feature.notify',
                        'Route notifications to project-specific channels',
                      ),
                      t(
                        'integrations.slack.feature.events',
                        'Customize which events trigger a message',
                      ),
                    ]
              }
              action={
                isSlackConnected ? (
                  <Button variant="outline" onClick={() => setConfirmDisconnect('slack')}>
                    {t('integrations.slack.disconnect', 'Disconnect')}
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      window.location.href = integrationService.slackInstallUrl(workspaceSlug);
                    }}
                  >
                    {t('integrations.slack.connect', 'Connect')}
                  </Button>
                )
              }
            />
          </div>

          {isSlackConnected && projects.length > 0 && (
            <div className="flex flex-col gap-2">
              <GroupLabel>{t('integrations.slack.linkedChannels', 'Linked channels')}</GroupLabel>
              <div className="divide-y rounded-lg border">
                {projects.map((project) => {
                  const link = slackLinks[project.id] ?? null;
                  return (
                    <div
                      key={project.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {project.name}
                          {project.identifier && (
                            <span className="text-muted-foreground ml-2 text-xs font-normal">
                              {project.identifier}
                            </span>
                          )}
                        </p>
                        <p className="text-muted-foreground mt-0.5 truncate text-xs">
                          {link
                            ? `#${link.channel_name}`
                            : t('integrations.slack.noChannelLinked', 'No channel linked.')}
                        </p>
                      </div>
                      {link ? (
                        <div className="flex shrink-0 items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={t(
                                  'integrations.slack.configureAria',
                                  'Configure Slack channel for {{name}}',
                                  { name: project.name },
                                )}
                                onClick={() => setSlackDialogProjectId(project.id)}
                              >
                                <Settings2Icon />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {t('integrations.settings', 'Settings')}
                            </TooltipContent>
                          </Tooltip>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirmUnlinkChannel(project)}
                          >
                            {t('integrations.unlink', 'Unlink')}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSlackDialogProjectId(project.id)}
                        >
                          {t('integrations.slack.linkChannel', 'Link channel')}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Repository picker */}
      <Dialog
        open={linkDialogProjectId !== null}
        onOpenChange={(open) => !linking && !open && setLinkDialogProjectId(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t('integrations.linkModalTitle', 'Link a GitHub repository to {{name}}', {
                name: linkDialogProject?.name ?? t('common.project', 'Project'),
              })}
            </DialogTitle>
            <DialogDescription>
              {t(
                'integrations.linkModalHint',
                'Pick a repository the GitHub App has access to. Pull requests targeting this project will be linked to its issues.',
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <SearchIcon
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              value={repoQuery}
              onChange={(e) => setRepoQuery(e.target.value)}
              placeholder={t('integrations.searchRepos', 'Search repositories')}
              className="pl-9"
            />
          </div>

          {reposLoading && repos.length === 0 ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : filteredRepos.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {repos.length === 0
                ? t(
                    'integrations.noReposAccessible',
                    'No repositories accessible to the installation. Add this app to a repo on GitHub first.',
                  )
                : t('integrations.noReposMatch', 'No repositories match your search.')}
            </p>
          ) : (
            <ScrollArea className="max-h-72 rounded-lg border">
              <div className="divide-y">
                {filteredRepos.map((repo) => (
                  <div
                    key={repo.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{repo.full_name}</p>
                      {repo.description && (
                        <p className="text-muted-foreground truncate text-xs">{repo.description}</p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={linking}
                      onClick={() => void handlePickRepo(repo)}
                    >
                      {t('integrations.link', 'Link')}
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          <DialogFooter className="sm:justify-between">
            {reposHasMore ? (
              <Button variant="ghost" disabled={reposLoading} onClick={() => void loadMoreRepos()}>
                {reposLoading
                  ? t('common.loading', 'Loading…')
                  : t('integrations.loadMore', 'Load more')}
              </Button>
            ) : (
              <span />
            )}
            <Button
              variant="outline"
              disabled={linking}
              onClick={() => setLinkDialogProjectId(null)}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {syncDialogProject && (
        <RepoSyncDialog
          open
          onOpenChange={(open) => !open && setSyncDialogProjectId(null)}
          workspaceSlug={workspaceSlug}
          project={syncDialogProject}
          initialSync={projectSyncs[syncDialogProject.id] ?? null}
          onSaved={(next) => setProjectSyncs((prev) => ({ ...prev, [syncDialogProject.id]: next }))}
        />
      )}

      {slackDialogProject && (
        <SlackChannelDialog
          open
          onOpenChange={(open) => !open && setSlackDialogProjectId(null)}
          workspaceSlug={workspaceSlug}
          project={slackDialogProject}
          initialLink={slackLinks[slackDialogProject.id] ?? null}
          onSaved={(next) => setSlackLinks((prev) => ({ ...prev, [slackDialogProject.id]: next }))}
        />
      )}

      <AlertDialog
        open={confirmDisconnect !== null}
        onOpenChange={(open) => !disconnecting && !open && setConfirmDisconnect(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDisconnect === 'slack'
                ? t('integrations.slack.disconnectTitle', 'Disconnect Slack?')
                : t('integrations.github.disconnectTitle', 'Disconnect GitHub?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDisconnect === 'slack'
                ? t(
                    'integrations.slack.disconnectConfirm',
                    'Disconnect Slack from this workspace? Project channels will be unlinked.',
                  )
                : t(
                    'integrations.github.disconnectConfirm',
                    'Disconnect GitHub from this workspace? Linked repos will be unlinked.',
                  )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnecting !== null}>
              {t('common.cancel', 'Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={disconnecting !== null}
              onClick={(e) => {
                e.preventDefault();
                void handleDisconnect();
              }}
            >
              {disconnecting
                ? t('integrations.disconnecting', 'Disconnecting…')
                : t('integrations.disconnect', 'Disconnect')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmUnlinkRepo !== null}
        onOpenChange={(open) => !unlinking && !open && setConfirmUnlinkRepo(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('integrations.github.unlinkTitle', 'Unlink this repository?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'integrations.github.unlinkConfirm',
                'Pull requests stop syncing with {{name}}. You can link it again at any time.',
                { name: confirmUnlinkRepo?.name ?? '' },
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unlinking}>
              {t('common.cancel', 'Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={unlinking}
              onClick={(e) => {
                e.preventDefault();
                void handleUnlinkRepo();
              }}
            >
              {t('integrations.unlink', 'Unlink')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmUnlinkChannel !== null}
        onOpenChange={(open) => !unlinking && !open && setConfirmUnlinkChannel(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('integrations.slack.unlinkTitle', 'Unlink this channel?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'integrations.slack.unlinkConfirm',
                'Devlane stops posting {{name}} updates to the channel.',
                { name: confirmUnlinkChannel?.name ?? '' },
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unlinking}>
              {t('common.cancel', 'Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={unlinking}
              onClick={(e) => {
                e.preventDefault();
                void handleUnlinkChannel();
              }}
            >
              {t('integrations.unlink', 'Unlink')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsPanel>
  );
}
