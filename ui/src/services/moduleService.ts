import { apiClient } from "../api/client";
import type { ModuleApiResponse } from "../api/types";

export interface CreateModulePayload {
  name: string;
  description?: string;
  status?: string;
  start_date?: string | null;
  target_date?: string | null;
}

export const moduleService = {
  async list(
    workspaceSlug: string,
    projectId: string,
  ): Promise<ModuleApiResponse[]> {
    const { data } = await apiClient.get<ModuleApiResponse[]>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/modules/`,
    );
    return data;
  },

  async create(
    workspaceSlug: string,
    projectId: string,
    payload: CreateModulePayload,
  ): Promise<ModuleApiResponse> {
    const { data } = await apiClient.post<ModuleApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/modules/`,
      payload,
    );
    return data;
  },

  async addIssue(
    workspaceSlug: string,
    projectId: string,
    moduleId: string,
    issueId: string,
  ): Promise<void> {
    await apiClient.post(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/modules/${encodeURIComponent(moduleId)}/issues/`,
      { issue_id: issueId },
    );
  },

  async removeIssue(
    workspaceSlug: string,
    projectId: string,
    moduleId: string,
    issueId: string,
  ): Promise<void> {
    await apiClient.delete(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/modules/${encodeURIComponent(moduleId)}/issues/${encodeURIComponent(issueId)}/`,
    );
  },
};
