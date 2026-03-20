import { apiClient } from '../api/client';
import type { PageApiResponse } from '../api/types';

export const pageService = {
  async list(workspaceSlug: string, projectId?: string | null): Promise<PageApiResponse[]> {
    const url = projectId
      ? `/api/workspaces/${encodeURIComponent(workspaceSlug)}/pages/?project_id=${encodeURIComponent(projectId)}`
      : `/api/workspaces/${encodeURIComponent(workspaceSlug)}/pages/`;
    const { data } = await apiClient.get<PageApiResponse[]>(url);
    return data;
  },
};
