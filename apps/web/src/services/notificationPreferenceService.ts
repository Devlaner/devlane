import { apiClient } from '../api/client';
import type { NotificationPreferencesResponse } from '../api/types';

/**
 * Workspace- and project-scoped notification preferences. Account-level
 * preferences live on {@link userService}. A GET returns the effective
 * preferences (project → workspace → account); a PUT writes an override at that
 * scope.
 */
export const notificationPreferenceService = {
  async getWorkspace(workspaceSlug: string): Promise<NotificationPreferencesResponse> {
    const { data } = await apiClient.get<NotificationPreferencesResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/notification-preferences/`,
    );
    return data;
  },

  async updateWorkspace(
    workspaceSlug: string,
    prefs: Partial<NotificationPreferencesResponse>,
  ): Promise<NotificationPreferencesResponse> {
    const { data } = await apiClient.put<NotificationPreferencesResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/notification-preferences/`,
      prefs,
    );
    return data;
  },

  async getProject(
    workspaceSlug: string,
    projectId: string,
  ): Promise<NotificationPreferencesResponse> {
    const { data } = await apiClient.get<NotificationPreferencesResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/notification-preferences/`,
    );
    return data;
  },

  async updateProject(
    workspaceSlug: string,
    projectId: string,
    prefs: Partial<NotificationPreferencesResponse>,
  ): Promise<NotificationPreferencesResponse> {
    const { data } = await apiClient.put<NotificationPreferencesResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/notification-preferences/`,
      prefs,
    );
    return data;
  },
};
