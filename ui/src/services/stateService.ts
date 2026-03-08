import { apiClient } from "../api/client";
import type { StateApiResponse } from "../api/types";

export const stateService = {
  async list(
    workspaceSlug: string,
    projectId: string,
  ): Promise<StateApiResponse[]> {
    const { data } = await apiClient.get<StateApiResponse[]>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/states/`,
    );
    return data;
  },

  async create(
    workspaceSlug: string,
    projectId: string,
    payload: { name: string; color?: string; group?: string },
  ): Promise<StateApiResponse> {
    const { data } = await apiClient.post<StateApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/states/`,
      payload,
    );
    return data;
  },

  async update(
    workspaceSlug: string,
    projectId: string,
    stateId: string,
    payload: { name?: string; color?: string },
  ): Promise<StateApiResponse> {
    const { data } = await apiClient.patch<StateApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/states/${encodeURIComponent(stateId)}/`,
      payload,
    );
    return data;
  },

  async delete(
    workspaceSlug: string,
    projectId: string,
    stateId: string,
  ): Promise<void> {
    await apiClient.delete(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/states/${encodeURIComponent(stateId)}/`,
    );
  },
};
