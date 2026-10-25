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
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/`,
    );
    return data;
  },

  /**
   * Get a project by ID within a workspace.
   */
  async get(workspaceSlug: string, projectId: string): Promise<ProjectApiResponse> {
    const { data } = await apiClient.get<ProjectApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/`,
    );
    return data;
  },

  /**
   * Create a project in a workspace.
   */
  async create(workspaceSlug: string, payload: CreateProjectRequest): Promise<ProjectApiResponse> {
    const { data } = await apiClient.post<ProjectApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/`,
      payload,
    );
    return data;
  },

  /**
   * Update project name or identifier.
   * PATCH /api/workspaces/:slug/projects/:projectId/
   */
  async update(
    workspaceSlug: string,
    projectId: string,
    payload: {
      name?: string;
      identifier?: string;
      description?: string;
      timezone?: string;
      cover_image?: string;
      emoji?: string;
      icon_prop?: { name?: string; color?: string } | null;
      /** When present, use empty string to clear; omit to leave unchanged. */
      project_lead_id?: string;
      /** When present, use empty string to clear; omit to leave unchanged. */
      default_assignee_id?: string;
      guest_view_all_features?: boolean;
      /** 2 = public (any workspace member), 0 = secret (members only). */
      network?: number;
      module_view?: boolean;
      cycle_view?: boolean;
      issue_views_view?: boolean;
      page_view?: boolean;
      intake_view?: boolean;
      is_time_tracking_enabled?: boolean;
      /** Auto-archive: months of inactivity after which settled items archive (0 = off). */
      archive_in?: number;
      /** Auto-close: months of inactivity after which active items are closed (0 = off). */
      close_in?: number;
    },
  ): Promise<ProjectApiResponse> {
    const { data } = await apiClient.patch<ProjectApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/`,
      payload,
    );
    return data;
  },

  /** List the workspace's archived projects. */
  async listArchived(workspaceSlug: string): Promise<ProjectApiResponse[]> {
    const { data } = await apiClient.get<ProjectApiResponse[]>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/archived-projects/`,
    );
    return Array.isArray(data) ? data : [];
  },

  /** Archive a project (hides it from active lists; not deleted). */
  async archive(workspaceSlug: string, projectId: string): Promise<void> {
    await apiClient.post(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/archive/`,
    );
  },

  /** Restore an archived project. */
  async restore(workspaceSlug: string, projectId: string): Promise<void> {
    await apiClient.delete(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/archive/`,
    );
  },

  async listMembers(workspaceSlug: string, projectId: string): Promise<ProjectMemberApiResponse[]> {
    const { data } = await apiClient.get<ProjectMemberApiResponse[]>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/members/`,
    );
    return data;
  },

  async listInvites(workspaceSlug: string, projectId: string): Promise<ProjectInviteApiResponse[]> {
    const { data } = await apiClient.get<ProjectInviteApiResponse[]>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/invitations/`,
    );
    return data;
  },

  async createInvite(
    workspaceSlug: string,
    projectId: string,
    payload: { email: string; role?: number },
  ): Promise<ProjectInviteApiResponse> {
    const { data } = await apiClient.post<ProjectInviteApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/invitations/`,
      payload,
    );
    return data;
  },

  /**
   * Update a project member's role. pk is the project_members row id.
   */
  async updateMember(
    workspaceSlug: string,
    projectId: string,
    memberPk: string,
    role: number,
  ): Promise<ProjectMemberApiResponse> {
    const { data } = await apiClient.patch<ProjectMemberApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(memberPk)}/`,
      { role },
    );
    return data;
  },

  /**
   * Remove a member from the project. pk is the project_members row id.
   */
  async deleteMember(workspaceSlug: string, projectId: string, memberPk: string): Promise<void> {
    await apiClient.delete(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(memberPk)}/`,
    );
  },

  /**
   * Delete a project invitation.
   */
  async deleteInvite(workspaceSlug: string, projectId: string, invitePk: string): Promise<void> {
    await apiClient.delete(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/invitations/${encodeURIComponent(invitePk)}/`,
    );
  },
};
