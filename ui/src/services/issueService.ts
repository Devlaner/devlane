import { apiClient } from '../api/client';
import type { IssueActivityApiResponse, IssueApiResponse, CreateIssueRequest } from '../api/types';

export interface ListIssuesParams {
  limit?: number;
  offset?: number;
}

export const issueService = {
  async listWorkspaceDrafts(
    workspaceSlug: string,
    params?: ListIssuesParams,
  ): Promise<IssueApiResponse[]> {
    const searchParams = new URLSearchParams();
    if (params?.limit != null) searchParams.set('limit', String(params.limit));
    if (params?.offset != null) searchParams.set('offset', String(params.offset));
    const qs = searchParams.toString();
    const url = `/api/workspaces/${encodeURIComponent(workspaceSlug)}/draft-issues/${qs ? `?${qs}` : ''}`;
    const { data } = await apiClient.get<IssueApiResponse[]>(url);
    return data;
  },

  async list(
    workspaceSlug: string,
    projectId: string,
    params?: ListIssuesParams,
  ): Promise<IssueApiResponse[]> {
    const searchParams = new URLSearchParams();
    if (params?.limit != null) searchParams.set('limit', String(params.limit));
    if (params?.offset != null) searchParams.set('offset', String(params.offset));
    const qs = searchParams.toString();
    const url = `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/issues/${qs ? `?${qs}` : ''}`;
    const { data } = await apiClient.get<IssueApiResponse[]>(url);
    return data;
  },

  async get(workspaceSlug: string, projectId: string, issueId: string): Promise<IssueApiResponse> {
    const { data } = await apiClient.get<IssueApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/`,
    );
    return data;
  },

  async create(
    workspaceSlug: string,
    projectId: string,
    payload: CreateIssueRequest,
  ): Promise<IssueApiResponse> {
    const { data } = await apiClient.post<IssueApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/issues/`,
      payload,
    );
    return data;
  },

  async update(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    payload: Partial<
      CreateIssueRequest & {
        state_id?: string | null;
        is_draft?: boolean;
        /** Alias accepted by the backend so callers can use either name. */
        description_html?: string;
      }
    >,
  ): Promise<IssueApiResponse> {
    const { data } = await apiClient.patch<IssueApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/`,
      payload,
    );
    return data;
  },

  async delete(workspaceSlug: string, projectId: string, issueId: string): Promise<void> {
    await apiClient.delete(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/`,
    );
  },

  /** GET .../issues/:pk/activities/ */
  async listActivities(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
  ): Promise<IssueActivityApiResponse[]> {
    const { data } = await apiClient.get<IssueActivityApiResponse[]>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/activities/`,
    );
    return data;
  },
};
