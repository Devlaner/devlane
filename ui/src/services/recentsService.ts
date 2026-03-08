import { apiClient } from "../api/client";
import type {
  RecentVisitApiResponse,
  RecordRecentVisitRequest,
} from "../api/types";

/**
 * Recent visits API (workspace-scoped). List returns items with display_title and display_identifier when available.
 */
export const recentsService = {
  async list(
    workspaceSlug: string,
    limit = 20,
  ): Promise<RecentVisitApiResponse[]> {
    const { data } = await apiClient.get<RecentVisitApiResponse[]>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/recent-visits/`,
      { params: { limit } },
    );
    return data;
  },

  async record(
    workspaceSlug: string,
    payload: RecordRecentVisitRequest,
  ): Promise<void> {
    await apiClient.post(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/recent-visits/`,
      payload,
    );
  },
};
