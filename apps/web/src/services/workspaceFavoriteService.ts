import { apiClient } from '../api/client';
import type { FavoriteApiResponse } from '../api/types';

const base = (workspaceSlug: string) =>
  `/api/workspaces/${encodeURIComponent(workspaceSlug)}/favorites/`;

/**
 * Workspace favorites tree: favoriting cycles/modules, grouping them into
 * folders, and ordering. Project/view/page favorites keep their own endpoints.
 */
export const workspaceFavoriteService = {
  async list(workspaceSlug: string): Promise<FavoriteApiResponse[]> {
    const { data } = await apiClient.get<FavoriteApiResponse[]>(base(workspaceSlug));
    return Array.isArray(data) ? data : [];
  },

  async addEntity(
    workspaceSlug: string,
    payload: {
      entity_type: 'cycle' | 'module';
      entity_id: string;
      project_id: string;
      name: string;
    },
  ): Promise<FavoriteApiResponse> {
    const { data } = await apiClient.post<FavoriteApiResponse>(base(workspaceSlug), payload);
    return data;
  },

  async createFolder(workspaceSlug: string, name: string): Promise<FavoriteApiResponse> {
    const { data } = await apiClient.post<FavoriteApiResponse>(base(workspaceSlug), {
      is_folder: true,
      name,
    });
    return data;
  },

  async update(
    workspaceSlug: string,
    favoriteId: string,
    payload: { name?: string; parent_id?: string | null; sort_order?: number },
  ): Promise<FavoriteApiResponse> {
    const { data } = await apiClient.patch<FavoriteApiResponse>(
      `${base(workspaceSlug)}${encodeURIComponent(favoriteId)}/`,
      payload,
    );
    return data;
  },

  async remove(workspaceSlug: string, favoriteId: string): Promise<void> {
    await apiClient.delete(`${base(workspaceSlug)}${encodeURIComponent(favoriteId)}/`);
  },
};
