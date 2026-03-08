import { apiClient } from "../api/client";
import type { IssueViewApiResponse } from "../api/types";

export const viewService = {
  async list(
    workspaceSlug: string,
    projectId?: string | null,
  ): Promise<IssueViewApiResponse[]> {
    const url = projectId
      ? `/api/workspaces/${encodeURIComponent(workspaceSlug)}/views/?project_id=${encodeURIComponent(projectId)}`
      : `/api/workspaces/${encodeURIComponent(workspaceSlug)}/views/`;
    const { data } = await apiClient.get<IssueViewApiResponse[]>(url);
    return data;
  },
};
