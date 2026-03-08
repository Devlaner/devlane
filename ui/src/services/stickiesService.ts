import { apiClient } from "../api/client";
import type { StickyApiResponse, CreateStickyRequest } from "../api/types";

/**
 * Stickies API (workspace-scoped).
 */
export const stickiesService = {
  async list(workspaceSlug: string): Promise<StickyApiResponse[]> {
    const { data } = await apiClient.get<StickyApiResponse[]>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/stickies/`,
    );
    return data;
  },

  async create(
    workspaceSlug: string,
    payload: CreateStickyRequest,
  ): Promise<StickyApiResponse> {
    const { data } = await apiClient.post<StickyApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/stickies/`,
      payload,
    );
    return data;
  },

  async update(
    workspaceSlug: string,
    id: string,
    payload: { name?: string; description?: string; color?: string },
  ): Promise<StickyApiResponse> {
    const { data } = await apiClient.patch<StickyApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/stickies/${encodeURIComponent(id)}/`,
      payload,
    );
    return data;
  },

  async delete(workspaceSlug: string, id: string): Promise<void> {
    await apiClient.delete(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/stickies/${encodeURIComponent(id)}/`,
    );
  },
};
