import { apiClient } from '../api/client';
import type { CommentReactionApiResponse, IssueCommentApiResponse } from '../api/types';

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
    access: 'INTERNAL' | 'EXTERNAL' = 'INTERNAL',
  ): Promise<IssueCommentApiResponse> {
    const { data } = await apiClient.post<IssueCommentApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/comments/`,
      { comment, access },
    );
    return data;
  },

  async listReactions(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    commentId: string,
  ): Promise<CommentReactionApiResponse[]> {
    const { data } = await apiClient.get<CommentReactionApiResponse[]>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/comments/${encodeURIComponent(commentId)}/reactions/`,
    );
    return data;
  },

  async addReaction(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    commentId: string,
    reaction: string,
  ): Promise<CommentReactionApiResponse> {
    const { data } = await apiClient.post<CommentReactionApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/comments/${encodeURIComponent(commentId)}/reactions/`,
      { reaction },
    );
    return data;
  },

  async removeReaction(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    commentId: string,
    reaction: string,
  ): Promise<void> {
    await apiClient.delete(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/comments/${encodeURIComponent(commentId)}/reactions/${encodeURIComponent(reaction)}/`,
    );
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
