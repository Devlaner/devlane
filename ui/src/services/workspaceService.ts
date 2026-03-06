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
};
