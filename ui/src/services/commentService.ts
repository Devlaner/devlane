import { apiClient } from "../api/client";
import type { IssueCommentApiResponse } from "../api/types";

export const commentService = {
  async list(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
  ): Promise<IssueCommentApiResponse[]> {
    const { data } = await apiClient.get<IssueCommentApiResponse[]>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/comments/`,
    );
    return data;
  },

  async create(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    comment: string,
  ): Promise<IssueCommentApiResponse> {
    const { data } = await apiClient.post<IssueCommentApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/comments/`,
      { comment },
    );
    return data;
  },

  async update(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    commentId: string,
    comment: string,
  ): Promise<IssueCommentApiResponse> {
    const { data } = await apiClient.patch<IssueCommentApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/comments/${encodeURIComponent(commentId)}/`,
      { comment },
    );
    return data;
  },

  async delete(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    commentId: string,
  ): Promise<void> {
    await apiClient.delete(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/comments/${encodeURIComponent(commentId)}/`,
    );
  },
};
