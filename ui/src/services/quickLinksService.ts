import { apiClient } from "../api/client";
import type {
  QuickLinkApiResponse,
  CreateQuickLinkRequest,
} from "../api/types";

/**
 * Quick links API (workspace-scoped).
 */
export const quickLinksService = {
  async list(workspaceSlug: string): Promise<QuickLinkApiResponse[]> {
    const { data } = await apiClient.get<QuickLinkApiResponse[]>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/quick-links/`,
    );
    return data;
  },

  async create(
    workspaceSlug: string,
    payload: CreateQuickLinkRequest,
  ): Promise<QuickLinkApiResponse> {
    const { data } = await apiClient.post<QuickLinkApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/quick-links/`,
      payload,
    );
    return data;
  },

  async update(
    workspaceSlug: string,
    id: string,
    payload: { title?: string; url?: string },
  ): Promise<QuickLinkApiResponse> {
    const { data } = await apiClient.patch<QuickLinkApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/quick-links/${encodeURIComponent(id)}/`,
      payload,
    );
    return data;
  },

  async delete(workspaceSlug: string, id: string): Promise<void> {
    await apiClient.delete(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/quick-links/${encodeURIComponent(id)}/`,
    );
  },
};
