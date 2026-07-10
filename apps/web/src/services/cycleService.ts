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

/** Child-issue counts for a cycle, grouped by state group (plus a total). */
export interface CycleProgress {
  backlog: number;
  unstarted: number;
  started: number;
  completed: number;
  cancelled: number;
  total: number;
}

export const cycleService = {
  async list(workspaceSlug: string, projectId: string): Promise<CycleApiResponse[]> {
    const { data } = await apiClient.get<CycleApiResponse[]>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/cycles/`,
    );
    return data;
  },

  /** Per-cycle progress for the whole project, keyed by cycle id. */
  async listProgress(
    workspaceSlug: string,
    projectId: string,
  ): Promise<Record<string, CycleProgress>> {
    const { data } = await apiClient.get<Record<string, CycleProgress>>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/cycles-progress/`,
    );
    return data ?? {};
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

  async getProgress(
    workspaceSlug: string,
    projectId: string,
    cycleId: string,
  ): Promise<CycleProgressResponse> {
    const { data } = await apiClient.get<CycleProgressResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/cycles/${encodeURIComponent(cycleId)}/progress/`,
    );
    return data;
  },

  /**
   * Complete a cycle: snapshots its progress and marks it completed. When
   * targetCycleId is given, incomplete work items are moved into that cycle.
   */
  async completeCycle(
    workspaceSlug: string,
    projectId: string,
    cycleId: string,
    targetCycleId?: string | null,
  ): Promise<{ cycle: CycleApiResponse; transferred_count: number }> {
    const { data } = await apiClient.post<{ cycle: CycleApiResponse; transferred_count: number }>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/cycles/${encodeURIComponent(cycleId)}/transfer-issues/`,
      targetCycleId ? { target_cycle_id: targetCycleId } : {},
    );
    return data;
  },
};

export interface CycleProgressResponse {
  total_issues: number;
  completed_issues: number;
  backlog_issues: number;
  started_issues: number;
  unstarted_issues: number;
  cancelled_issues: number;
  distribution?: {
    completion_chart: Record<string, number | null>;
    assignees: unknown[];
    labels: unknown[];
  };
}
