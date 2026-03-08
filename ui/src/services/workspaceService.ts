import { apiClient } from '../api/client';
import type {
  CreateWorkspaceRequest,
  WorkspaceApiResponse,
  WorkspaceInviteApiResponse,
  WorkspaceMemberApiResponse,
} from '../api/types';

/**
 * Workspace API service.
 * All workspace-related API calls go through here so pages stay free of fetch/axios.
 */
export const workspaceService = {
  /**
   * List workspaces for the current user.
   */
  async list(): Promise<WorkspaceApiResponse[]> {
    const { data } = await apiClient.get<WorkspaceApiResponse[]>('/api/users/me/workspaces/');
    return data;
  },

  /**
   * Get a workspace by slug (current user must be a member).
   */
  async getBySlug(slug: string): Promise<WorkspaceApiResponse> {
    const { data } = await apiClient.get<WorkspaceApiResponse>(`/api/workspaces/${encodeURIComponent(slug)}/`);
    return data;
  },

  /**
   * Create a new workspace.
   * @throws Error with user-facing message on failure
   */
  async create(payload: CreateWorkspaceRequest): Promise<WorkspaceApiResponse> {
    const { data } = await apiClient.post<WorkspaceApiResponse>('/api/workspaces/', payload);
    return data;
  },

  async listMembers(workspaceSlug: string): Promise<WorkspaceMemberApiResponse[]> {
    const { data } = await apiClient.get<WorkspaceMemberApiResponse[]>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/members/`
    );
    return data;
  },

  async listInvites(workspaceSlug: string): Promise<WorkspaceInviteApiResponse[]> {
    const { data } = await apiClient.get<WorkspaceInviteApiResponse[]>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/invitations/`
    );
    return data;
  },

  async createInvite(
    workspaceSlug: string,
    payload: { email: string; role?: number }
  ): Promise<WorkspaceInviteApiResponse> {
    const { data } = await apiClient.post<WorkspaceInviteApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/invitations/`,
      payload
    );
    return data;
  },

  /**
   * Update workspace name or slug.
   * PATCH /api/workspaces/:slug/
   */
  async update(
    slug: string,
    payload: { name?: string; slug?: string; logo?: string }
  ): Promise<WorkspaceApiResponse> {
    const { data } = await apiClient.patch<WorkspaceApiResponse>(
      `/api/workspaces/${encodeURIComponent(slug)}/`,
      payload
    );
    return data;
  },

  /**
   * Update a member's role. pk is the workspace member row id.
   * PATCH /api/workspaces/:slug/members/:pk/
   */
  async updateMember(
    workspaceSlug: string,
    memberPk: string,
    role: number
  ): Promise<WorkspaceMemberApiResponse> {
    const { data } = await apiClient.patch<WorkspaceMemberApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/members/${encodeURIComponent(memberPk)}/`,
      { role }
    );
    return data;
  },

  /**
   * Remove a member from the workspace. pk is the workspace member row id.
   * DELETE /api/workspaces/:slug/members/:pk/
   */
  async deleteMember(workspaceSlug: string, memberPk: string): Promise<void> {
    await apiClient.delete(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/members/${encodeURIComponent(memberPk)}/`
    );
  },

  /**
   * Delete a workspace invitation.
   * DELETE /api/workspaces/:slug/invitations/:pk/
   */
  async deleteInvite(workspaceSlug: string, invitePk: string): Promise<void> {
    await apiClient.delete(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/invitations/${encodeURIComponent(invitePk)}/`
    );
  },
};
