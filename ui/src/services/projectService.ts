import { apiClient } from '../api/client';
import type {
  CreateProjectRequest,
  ProjectApiResponse,
  ProjectInviteApiResponse,
  ProjectMemberApiResponse,
} from '../api/types';

/**
 * Project API service (scoped by workspace slug).
 */
export const projectService = {
  /**
   * List projects in a workspace.
   */
  async list(workspaceSlug: string): Promise<ProjectApiResponse[]> {
    const { data } = await apiClient.get<ProjectApiResponse[]>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/`
    );
    return data;
  },

  /**
   * Get a project by ID within a workspace.
   */
  async get(workspaceSlug: string, projectId: string): Promise<ProjectApiResponse> {
    const { data } = await apiClient.get<ProjectApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/`
    );
    return data;
  },

  /**
   * Create a project in a workspace.
   */
  async create(workspaceSlug: string, payload: CreateProjectRequest): Promise<ProjectApiResponse> {
    const { data } = await apiClient.post<ProjectApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/`,
      payload
    );
    return data;
  },

  async listMembers(workspaceSlug: string, projectId: string): Promise<ProjectMemberApiResponse[]> {
    const { data } = await apiClient.get<ProjectMemberApiResponse[]>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/members/`
    );
    return data;
  },

  async listInvites(workspaceSlug: string, projectId: string): Promise<ProjectInviteApiResponse[]> {
    const { data } = await apiClient.get<ProjectInviteApiResponse[]>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/invitations/`
    );
    return data;
  },

  async createInvite(
    workspaceSlug: string,
    projectId: string,
    payload: { email: string; role?: number }
  ): Promise<ProjectInviteApiResponse> {
    const { data } = await apiClient.post<ProjectInviteApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/invitations/`,
      payload
    );
    return data;
  },
};
