import { apiClient, API_BASE } from '../api/client';
import type {
  GitHubIssueLinkResponse,
  GitHubIssueSummaryResponse,
  GitHubRepoListResponse,
  GitHubRepositorySyncResponse,
  IntegrationApiResponse,
  WorkspaceIntegrationApiResponse,
} from '../api/types';

/**
 * Integration API service.
 *
 * Workspace-level: list installed integrations, uninstall.
 * GitHub-level: list repos accessible to the installation, manage per-project
 * repo sync (link / get / update / unlink).
 *
 * The GitHub App install flow is a full-page redirect (not XHR) because GitHub
 * needs to host its install UI; see `githubInstallUrl()` for the URL builder.
 */
export const integrationService = {
  /** GET /api/integrations/ — list available providers. */
  async listAvailable(): Promise<IntegrationApiResponse[]> {
    const { data } = await apiClient.get<IntegrationApiResponse[]>('/api/integrations/');
    return data;
  },

  /** GET /api/workspaces/:slug/integrations/ — list installed in this workspace. */
  async listInstalled(workspaceSlug: string): Promise<WorkspaceIntegrationApiResponse[]> {
    const { data } = await apiClient.get<WorkspaceIntegrationApiResponse[]>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/integrations/`,
    );
    return data;
  },

  /** DELETE /api/workspaces/:slug/integrations/:provider/ */
  async uninstall(workspaceSlug: string, provider: string): Promise<void> {
    await apiClient.delete(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/integrations/${encodeURIComponent(provider)}/`,
    );
  },

  /**
   * Build the URL to start the GitHub App install flow. The browser must do a
   * top-level navigation (not XHR) because GitHub responds with a 302 to its
   * own install UI.
   */
  githubInstallUrl(workspaceSlug: string): string {
    const base = API_BASE || '';
    return `${base}/auth/github-app/install?workspace=${encodeURIComponent(workspaceSlug)}`;
  },

  /**
   * GET /api/workspaces/:slug/integrations/github/repositories/?page=&per_page=
   * Paginated list of repositories the installation has access to.
   */
  async githubListRepos(
    workspaceSlug: string,
    page = 1,
    perPage = 30,
  ): Promise<GitHubRepoListResponse> {
    const { data } = await apiClient.get<GitHubRepoListResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/integrations/github/repositories/`,
      { params: { page, per_page: perPage } },
    );
    return data;
  },

  /** GET /api/workspaces/:slug/projects/:projectId/integrations/github/sync/ */
  async githubGetProjectSync(
    workspaceSlug: string,
    projectId: string,
  ): Promise<GitHubRepositorySyncResponse | null> {
    try {
      const { data } = await apiClient.get<GitHubRepositorySyncResponse>(
        `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/integrations/github/sync/`,
      );
      return data;
    } catch (err) {
      // 404 means "not linked yet" — let the caller treat as null rather than throw.
      const e = err as { response?: { status?: number } };
      if (e?.response?.status === 404) return null;
      throw err;
    }
  },

  /** POST /api/workspaces/:slug/projects/:projectId/integrations/github/sync/ */
  async githubLinkProjectRepo(
    workspaceSlug: string,
    projectId: string,
    payload: {
      github_repository_id: number;
      owner: string;
      name: string;
      url?: string;
    },
  ): Promise<GitHubRepositorySyncResponse> {
    const { data } = await apiClient.post<GitHubRepositorySyncResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/integrations/github/sync/`,
      payload,
    );
    return data;
  },

  /** PATCH /api/workspaces/:slug/projects/:projectId/integrations/github/sync/ */
  async githubUpdateProjectSync(
    workspaceSlug: string,
    projectId: string,
    payload: {
      auto_link?: boolean;
      auto_close_on_merge?: boolean;
      in_progress_state_id?: string;
      done_state_id?: string;
    },
  ): Promise<unknown> {
    const { data } = await apiClient.patch(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/integrations/github/sync/`,
      payload,
    );
    return data;
  },

  /** DELETE /api/workspaces/:slug/projects/:projectId/integrations/github/sync/ */
  async githubUnlinkProjectRepo(workspaceSlug: string, projectId: string): Promise<void> {
    await apiClient.delete(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/integrations/github/sync/`,
    );
  },

  /** GET .../issues/:issueId/integrations/github/links/ */
  async githubListIssueLinks(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
  ): Promise<GitHubIssueLinkResponse[]> {
    const { data } = await apiClient.get<GitHubIssueLinkResponse[]>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/integrations/github/links/`,
    );
    return data;
  },

  /**
   * POST .../issues/:issueId/integrations/github/links/
   * Manually link a PR to an issue by pasting its GitHub URL.
   */
  async githubCreateIssueLink(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    url: string,
  ): Promise<GitHubIssueLinkResponse> {
    const { data } = await apiClient.post<GitHubIssueLinkResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/integrations/github/links/`,
      { url },
    );
    return data;
  },

  /** DELETE .../issues/:issueId/integrations/github/links/:linkId/ */
  async githubDeleteIssueLink(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    linkId: string,
  ): Promise<void> {
    await apiClient.delete(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/integrations/github/links/${encodeURIComponent(linkId)}/`,
    );
  },

  /**
   * GET .../integrations/github/issue-summary/?ids=a,b,c
   * Returns aggregated PR counts per issue ID for badges on the issues list page.
   * Pass an empty array to get an empty map (no request made).
   */
  async githubIssueSummary(
    workspaceSlug: string,
    projectId: string,
    issueIds: string[],
  ): Promise<GitHubIssueSummaryResponse['summary']> {
    if (issueIds.length === 0) return {};
    const { data } = await apiClient.get<GitHubIssueSummaryResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/integrations/github/issue-summary/`,
      { params: { ids: issueIds.join(',') } },
    );
    return data.summary ?? {};
  },
};
