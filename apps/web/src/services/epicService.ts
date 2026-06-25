import { apiClient } from '../api/client';
import type { IssueApiResponse, IssueLinkApiResponse } from '../api/types';

const base = (slug: string, pid: string) =>
  `/api/workspaces/${encodeURIComponent(slug)}/projects/${encodeURIComponent(pid)}/epics`;

/** Child-issue counts for an epic, grouped by state group (plus a total). */
export interface EpicProgress {
  backlog: number;
  unstarted: number;
  started: number;
  completed: number;
  cancelled: number;
  total: number;
}

export const epicService = {
  async list(workspaceSlug: string, projectId: string): Promise<IssueApiResponse[]> {
    const { data } = await apiClient.get<IssueApiResponse[]>(`${base(workspaceSlug, projectId)}/`);
    return data ?? [];
  },

  /** Per-epic progress for the whole project, keyed by epic id. */
  async listProgress(
    workspaceSlug: string,
    projectId: string,
  ): Promise<Record<string, EpicProgress>> {
    const { data } = await apiClient.get<Record<string, EpicProgress>>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/epics-progress/`,
    );
    return data ?? {};
  },

  async get(workspaceSlug: string, projectId: string, epicId: string): Promise<IssueApiResponse> {
    const { data } = await apiClient.get<IssueApiResponse>(
      `${base(workspaceSlug, projectId)}/${encodeURIComponent(epicId)}/`,
    );
    return data;
  },

  async create(
    workspaceSlug: string,
    projectId: string,
    payload: { name: string; description?: string; priority?: string },
  ): Promise<IssueApiResponse> {
    const { data } = await apiClient.post<IssueApiResponse>(
      `${base(workspaceSlug, projectId)}/`,
      payload,
    );
    return data;
  },

  async update(
    workspaceSlug: string,
    projectId: string,
    epicId: string,
    payload: Partial<{ name: string; description: string; priority: string; state_id: string }>,
  ): Promise<IssueApiResponse> {
    const { data } = await apiClient.patch<IssueApiResponse>(
      `${base(workspaceSlug, projectId)}/${encodeURIComponent(epicId)}/`,
      payload,
    );
    return data;
  },

  async delete(workspaceSlug: string, projectId: string, epicId: string): Promise<void> {
    await apiClient.delete(`${base(workspaceSlug, projectId)}/${encodeURIComponent(epicId)}/`);
  },

  async listIssues(
    workspaceSlug: string,
    projectId: string,
    epicId: string,
  ): Promise<IssueApiResponse[]> {
    const { data } = await apiClient.get<IssueApiResponse[]>(
      `${base(workspaceSlug, projectId)}/${encodeURIComponent(epicId)}/issues/`,
    );
    return data ?? [];
  },

  async addIssue(
    workspaceSlug: string,
    projectId: string,
    epicId: string,
    issueId: string,
  ): Promise<void> {
    await apiClient.post(
      `${base(workspaceSlug, projectId)}/${encodeURIComponent(epicId)}/issues/`,
      { issue_id: issueId },
    );
  },

  async listLinks(
    workspaceSlug: string,
    projectId: string,
    epicId: string,
  ): Promise<IssueLinkApiResponse[]> {
    const { data } = await apiClient.get<IssueLinkApiResponse[]>(
      `${base(workspaceSlug, projectId)}/${encodeURIComponent(epicId)}/links/`,
    );
    return data ?? [];
  },

  async createLink(
    workspaceSlug: string,
    projectId: string,
    epicId: string,
    payload: { url: string; title?: string },
  ): Promise<IssueLinkApiResponse> {
    const { data } = await apiClient.post<IssueLinkApiResponse>(
      `${base(workspaceSlug, projectId)}/${encodeURIComponent(epicId)}/links/`,
      payload,
    );
    return data;
  },

  async deleteLink(
    workspaceSlug: string,
    projectId: string,
    epicId: string,
    linkId: string,
  ): Promise<void> {
    await apiClient.delete(
      `${base(workspaceSlug, projectId)}/${encodeURIComponent(epicId)}/links/${encodeURIComponent(linkId)}/`,
    );
  },
};
