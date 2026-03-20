import { apiClient } from '../api/client';
import type { CycleApiResponse } from '../api/types';

export const cycleService = {
  async list(workspaceSlug: string, projectId: string): Promise<CycleApiResponse[]> {
    const { data } = await apiClient.get<CycleApiResponse[]>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/cycles/`,
    );
    return data;
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
};
