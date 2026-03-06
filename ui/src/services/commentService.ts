import { apiClient } from '../api/client';
import type { IssueCommentApiResponse } from '../api/types';

export const commentService = {
  async list(
    workspaceSlug: string,
    projectId: string,
    issueId: string
  ): Promise<IssueCommentApiResponse[]> {
    const { data } = await apiClient.get<IssueCommentApiResponse[]>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/comments/`
    );
    return data;
  },

  async create(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    comment: string
  ): Promise<IssueCommentApiResponse> {
    const { data } = await apiClient.post<IssueCommentApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/comments/`,
      { comment }
    );
    return data;
  },
};
