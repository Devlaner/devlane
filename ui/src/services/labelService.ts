import { apiClient } from '../api/client';
import type { LabelApiResponse } from '../api/types';

export const labelService = {
  async list(workspaceSlug: string, projectId: string): Promise<LabelApiResponse[]> {
    const { data } = await apiClient.get<LabelApiResponse[]>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/issue-labels/`
    );
    return data;
  },
};
