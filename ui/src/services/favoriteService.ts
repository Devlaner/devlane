import { apiClient } from '../api/client';

/**
 * Favorite projects API (current user).
 * - List favorited project IDs
 * - Add/remove favorite by workspace slug + project ID
 */
export const favoriteService = {
  /**
   * GET /api/users/me/favorite-projects/
   * Returns list of favorited project IDs for the current user.
   */
  async getFavoriteProjectIds(): Promise<string[]> {
    const { data } = await apiClient.get<{ project_ids: string[] }>(
      '/api/users/me/favorite-projects/'
    );
    return data.project_ids ?? [];
  },

  /**
   * POST /api/workspaces/:slug/projects/:projectId/favorite
   */
  async addFavorite(workspaceSlug: string, projectId: string): Promise<void> {
    await apiClient.post(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/favorite`
    );
  },

  /**
   * DELETE /api/workspaces/:slug/projects/:projectId/favorite
   */
  async removeFavorite(workspaceSlug: string, projectId: string): Promise<void> {
    await apiClient.delete(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/favorite`
    );
  },
};
