import { apiClient } from '../api/client';
import type { StateApiResponse } from '../api/types';

export const stateService = {
  async list(workspaceSlug: string, projectId: string): Promise<StateApiResponse[]> {
    const { data } = await apiClient.get<StateApiResponse[]>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/states/`
    );
    return data;
  },
};
