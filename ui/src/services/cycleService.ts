import { apiClient } from '../api/client';
import type { CycleApiResponse } from '../api/types';

export interface CreateCycleRequest {
  name: string;
  description?: string;
  start_date?: string;
  end_date?: string;
}

export interface UpdateCycleRequest {
  name?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
}

export const cycleService = {
  async list(workspaceSlug: string, projectId: string): Promise<CycleApiResponse[]> {
    const { data } = await apiClient.get<CycleApiResponse[]>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/cycles/`,
    );
    return data;
  },

  async create(
    workspaceSlug: string,
    projectId: string,
    payload: CreateCycleRequest,
  ): Promise<CycleApiResponse> {
    const { data } = await apiClient.post<CycleApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/cycles/`,
      payload,
    );
    return data;
  },

  async update(
    workspaceSlug: string,
    projectId: string,
    cycleId: string,
    payload: UpdateCycleRequest,
  ): Promise<CycleApiResponse> {
    const { data } = await apiClient.patch<CycleApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/cycles/${encodeURIComponent(cycleId)}/`,
      payload,
    );
    return data;
  },

  async delete(workspaceSlug: string, projectId: string, cycleId: string): Promise<void> {
    await apiClient.delete(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/cycles/${encodeURIComponent(cycleId)}/`,
    );
  },

  async addIssue(
    workspaceSlug: string,
    projectId: string,
    cycleId: string,
    issueId: string,
  ): Promise<void> {
    await apiClient.post(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/cycles/${encodeURIComponent(cycleId)}/issues/`,
      { issue_id: issueId },
    );
  },

  async removeIssue(
    workspaceSlug: string,
    projectId: string,
    cycleId: string,
    issueId: string,
  ): Promise<void> {
    await apiClient.delete(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/cycles/${encodeURIComponent(cycleId)}/issues/${encodeURIComponent(issueId)}/`,
    );
  },

  /** Returns issue IDs linked to the cycle. */
  async listIssueIds(workspaceSlug: string, projectId: string, cycleId: string): Promise<string[]> {
    const { data } = await apiClient.get<string[]>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/cycles/${encodeURIComponent(cycleId)}/issues/`,
    );
    return data ?? [];
  },
};
