import { apiClient } from '../api/client';

export interface ExportHistoryItem {
  id: string;
  name?: string;
  type: string;
  provider: string;
  status: string;
  created_at: string;
}

export const exportService = {
  /**
   * Generate a server-side .xlsx of the given projects' issues and return it as
   * a Blob to download. The request is recorded in the workspace export history.
   */
  async createXlsx(workspaceSlug: string, projectIds: string[], name?: string): Promise<Blob> {
    const { data } = await apiClient.post<Blob>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/exports/`,
      { project_ids: projectIds, name },
      { responseType: 'blob' },
    );
    return data;
  },

  async listHistory(workspaceSlug: string): Promise<{ exports: ExportHistoryItem[] }> {
    const { data } = await apiClient.get<{ exports: ExportHistoryItem[] }>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/exports/`,
    );
    return data;
  },
};
