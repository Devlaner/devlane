import { apiClient } from '../api/client';
import type { NotificationApiResponse, UnreadCountResponse } from '../api/types';

export interface NotificationListOpts {
  unreadOnly?: boolean;
  mentionsOnly?: boolean;
  /** 'inbox' (default) hides archived; 'archived' shows only archived; 'all' includes both. */
  archived?: 'inbox' | 'archived' | 'all';
}

export const notificationService = {
  async list(
    workspaceSlug: string,
    opts: NotificationListOpts = {},
  ): Promise<NotificationApiResponse[]> {
    const params = new URLSearchParams();
    if (opts.unreadOnly) params.set('unread_only', 'true');
    if (opts.mentionsOnly) params.set('mentions', 'true');
    if (opts.archived === 'archived') params.set('archived', 'true');
    if (opts.archived === 'all') params.set('archived', 'all');
    const qs = params.toString() ? `?${params.toString()}` : '';
    const { data } = await apiClient.get<NotificationApiResponse[]>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/notifications/${qs}`,
    );
    return data;
  },

  async unreadCount(workspaceSlug: string): Promise<UnreadCountResponse> {
    const { data } = await apiClient.get<UnreadCountResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/notifications/unread-count/`,
    );
    return data;
  },

  async markRead(workspaceSlug: string, notificationId: string): Promise<void> {
    await apiClient.post(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/notifications/${encodeURIComponent(notificationId)}/read/`,
    );
  },

  async markUnread(workspaceSlug: string, notificationId: string): Promise<void> {
    await apiClient.delete(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/notifications/${encodeURIComponent(notificationId)}/read/`,
    );
  },

  async markAllRead(workspaceSlug: string): Promise<void> {
    await apiClient.post(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/notifications/mark-all-read/`,
    );
  },

  async archive(workspaceSlug: string, notificationId: string): Promise<void> {
    await apiClient.post(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/notifications/${encodeURIComponent(notificationId)}/archive/`,
    );
  },

  async unarchive(workspaceSlug: string, notificationId: string): Promise<void> {
    await apiClient.delete(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/notifications/${encodeURIComponent(notificationId)}/archive/`,
    );
  },

  async snooze(workspaceSlug: string, notificationId: string, until: Date): Promise<void> {
    await apiClient.post(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/notifications/${encodeURIComponent(notificationId)}/snooze/`,
      { until: until.toISOString() },
    );
  },

  async unsnooze(workspaceSlug: string, notificationId: string): Promise<void> {
    await apiClient.delete(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/notifications/${encodeURIComponent(notificationId)}/snooze/`,
    );
  },
};
