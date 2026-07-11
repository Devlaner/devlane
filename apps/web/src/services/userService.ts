import { apiClient } from '../api/client';
import type {
  UserApiResponse,
  UpdateMeRequest,
  ChangePasswordRequest,
  NotificationPreferencesResponse,
  UserActivityItem,
  ApiTokenResponse,
  CreateTokenRequest,
} from '../api/types';

export const userService = {
  async updateMe(payload: UpdateMeRequest): Promise<UserApiResponse> {
    const { data } = await apiClient.patch<UserApiResponse>('/api/users/me/', payload);
    return data;
  },

  async changePassword(payload: ChangePasswordRequest): Promise<void> {
    await apiClient.post('/api/users/me/change-password/', payload);
  },

  async getNotificationPreferences(scope?: {
    workspace_id?: string;
    project_id?: string;
  }): Promise<NotificationPreferencesResponse> {
    const params = new URLSearchParams();
    if (scope?.workspace_id) params.set('workspace_id', scope.workspace_id);
    if (scope?.project_id) params.set('project_id', scope.project_id);
    const { data } = await apiClient.get<NotificationPreferencesResponse>(
      `/api/users/me/notification-preferences/${params.toString() ? `?${params.toString()}` : ''}`,
    );
    return data;
  },

  async updateNotificationPreferences(
    prefs: Partial<NotificationPreferencesResponse>,
  ): Promise<NotificationPreferencesResponse> {
    const { data } = await apiClient.put<NotificationPreferencesResponse>(
      '/api/users/me/notification-preferences/',
      prefs,
    );
    return data;
  },

  async getActivity(): Promise<{ activities: UserActivityItem[] }> {
    const { data } = await apiClient.get<{ activities: UserActivityItem[] }>(
      '/api/users/me/activity/',
    );
    return data;
  },

  async listTokens(): Promise<{ tokens: ApiTokenResponse[] }> {
    const { data } = await apiClient.get<{ tokens: ApiTokenResponse[] }>('/api/users/me/tokens/');
    return data;
  },

  async createToken(payload: CreateTokenRequest): Promise<{
    token: string;
    label: string;
    description: string;
    expired_at?: string | null;
    message: string;
  }> {
    const { data } = await apiClient.post<{
      token: string;
      label: string;
      description: string;
      expired_at?: string | null;
      message: string;
    }>('/api/users/me/tokens/', payload);
    return data;
  },

  async revokeToken(tokenId: string): Promise<void> {
    await apiClient.delete(`/api/users/me/tokens/${tokenId}/`);
  },
};
