import { apiClient } from '../api/client';
import type { IssueViewApiResponse } from '../api/types';

export interface CreateViewRequest {
  name: string;
  description?: string;
  project_id?: string | null;
  query?: Record<string, unknown>;
  filters?: Record<string, unknown>;
  display_filters?: Record<string, unknown>;
  display_properties?: Record<string, unknown>;
}

export const viewService = {
  async list(workspaceSlug: string, projectId?: string | null): Promise<IssueViewApiResponse[]> {
    const url = projectId
      ? `/api/workspaces/${encodeURIComponent(workspaceSlug)}/views/?project_id=${encodeURIComponent(projectId)}`
      : `/api/workspaces/${encodeURIComponent(workspaceSlug)}/views/`;
    const { data } = await apiClient.get<IssueViewApiResponse[]>(url);
    return data;
  },

  /** Favorited saved views for the current user in this workspace (sidebar). */
  async listFavorites(workspaceSlug: string): Promise<IssueViewApiResponse[]> {
    const { data } = await apiClient.get<IssueViewApiResponse[]>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/views/favorites/`,
    );
    return data ?? [];
  },

  async get(workspaceSlug: string, viewId: string): Promise<IssueViewApiResponse> {
    const { data } = await apiClient.get<IssueViewApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/views/${encodeURIComponent(viewId)}/`,
    );
    return data;
  },

  async create(workspaceSlug: string, payload: CreateViewRequest): Promise<IssueViewApiResponse> {
    const { data } = await apiClient.post<IssueViewApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/views/`,
      payload,
    );
    return data;
  },

  async update(
    workspaceSlug: string,
    viewId: string,
    payload: Partial<CreateViewRequest>,
  ): Promise<IssueViewApiResponse> {
    const { data } = await apiClient.patch<IssueViewApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/views/${encodeURIComponent(viewId)}/`,
      payload,
    );
    return data;
  },

  async remove(workspaceSlug: string, viewId: string): Promise<void> {
    await apiClient.delete(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/views/${encodeURIComponent(viewId)}/`,
    );
  },

  async addFavorite(workspaceSlug: string, viewId: string): Promise<void> {
    await apiClient.post(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/views/${encodeURIComponent(viewId)}/favorite`,
    );
  },

  async removeFavorite(workspaceSlug: string, viewId: string): Promise<void> {
    await apiClient.delete(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/views/${encodeURIComponent(viewId)}/favorite`,
    );
  },

  async publish(workspaceSlug: string, viewId: string): Promise<IssueViewApiResponse> {
    try {
      const { data } = await apiClient.post<IssueViewApiResponse>(
        `/api/workspaces/${encodeURIComponent(workspaceSlug)}/views/${encodeURIComponent(viewId)}/publish/`,
      );
      return data;
    } catch {
      const { data } = await apiClient.post<IssueViewApiResponse>(
        `/api/workspaces/${encodeURIComponent(workspaceSlug)}/views/${encodeURIComponent(viewId)}/publish`,
      );
      return data;
    }
  },

  async unpublish(workspaceSlug: string, viewId: string): Promise<IssueViewApiResponse> {
    try {
      const { data } = await apiClient.post<IssueViewApiResponse>(
        `/api/workspaces/${encodeURIComponent(workspaceSlug)}/views/${encodeURIComponent(viewId)}/unpublish/`,
      );
      return data;
    } catch {
      const { data } = await apiClient.post<IssueViewApiResponse>(
        `/api/workspaces/${encodeURIComponent(workspaceSlug)}/views/${encodeURIComponent(viewId)}/unpublish`,
      );
      return data;
    }
  },
};
