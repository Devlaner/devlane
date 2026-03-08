import { apiClient } from "../api/client";
import type { LabelApiResponse } from "../api/types";

export const labelService = {
  async list(
    workspaceSlug: string,
    projectId: string,
  ): Promise<LabelApiResponse[]> {
    const { data } = await apiClient.get<LabelApiResponse[]>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/issue-labels/`,
    );
    return data;
  },

  async create(
    workspaceSlug: string,
    projectId: string,
    payload: { name: string; color?: string },
  ): Promise<LabelApiResponse> {
    const { data } = await apiClient.post<LabelApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/issue-labels/`,
      payload,
    );
    return data;
  },

  async update(
    workspaceSlug: string,
    projectId: string,
    labelId: string,
    payload: { name?: string; color?: string },
  ): Promise<LabelApiResponse> {
    const { data } = await apiClient.patch<LabelApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/issue-labels/${encodeURIComponent(labelId)}/`,
      payload,
    );
    return data;
  },

  async delete(
    workspaceSlug: string,
    projectId: string,
    labelId: string,
  ): Promise<void> {
    await apiClient.delete(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/issue-labels/${encodeURIComponent(labelId)}/`,
    );
  },
};
