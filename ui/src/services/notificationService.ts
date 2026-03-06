import { apiClient } from '../api/client';
import type { NotificationApiResponse } from '../api/types';

export const notificationService = {
  async list(workspaceSlug: string, unreadOnly = false): Promise<NotificationApiResponse[]> {
    const params = unreadOnly ? '?unread_only=true' : '';
    const { data } = await apiClient.get<NotificationApiResponse[]>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/notifications/${params}`
    );
    return data;
  },

  async markRead(workspaceSlug: string, notificationId: string): Promise<void> {
    await apiClient.post(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/notifications/${encodeURIComponent(notificationId)}/read/`
    );
  },

  async markAllRead(workspaceSlug: string): Promise<void> {
    await apiClient.post(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/notifications/mark-all-read/`
    );
  },
};
