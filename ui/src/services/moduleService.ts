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

  async get(
    workspaceSlug: string,
    projectId: string,
    moduleId: string,
  ): Promise<ModuleApiResponse> {
    const { data } = await apiClient.get<ModuleApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/modules/${encodeURIComponent(moduleId)}/`,
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

  async update(
    workspaceSlug: string,
    projectId: string,
    moduleId: string,
    payload: Partial<CreateModulePayload>,
  ): Promise<ModuleApiResponse> {
    const { data } = await apiClient.patch<ModuleApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/modules/${encodeURIComponent(moduleId)}/`,
      payload,
    );
    return data;
  },

  async listIssueIds(
    workspaceSlug: string,
    projectId: string,
    moduleId: string,
  ): Promise<string[]> {
    const { data } = await apiClient.get<string[]>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/modules/${encodeURIComponent(moduleId)}/issues/`,
    );
    return Array.isArray(data) ? data : [];
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
