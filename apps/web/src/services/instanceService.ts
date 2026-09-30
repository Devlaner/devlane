import { apiClient } from '../api';
import type {
  InstanceSetupStatusResponse,
  InstanceSetupRequest,
  UserApiResponse,
  InstanceSettingsResponse,
  InstanceSettingSectionValue,
  InstanceAdminApiResponse,
  InstanceEmailTestRequest,
} from '../api/types';

/**
 * Instance setup API (first-run flow). No auth required.
 */
export const instanceService = {
  async getSetupStatus(): Promise<InstanceSetupStatusResponse> {
    const { data } = await apiClient.get<InstanceSetupStatusResponse>(
      '/api/instance/setup-status/',
    );
    return data;
  },

  async completeSetup(payload: InstanceSetupRequest): Promise<UserApiResponse> {
    const { data } = await apiClient.post<UserApiResponse>('/api/instance/setup/', payload);
    return data;
  },
};

/** Unsplash search result item from proxy. */
export interface UnsplashSearchResult {
  id: string;
  url: string;
  thumb: string;
}

/** Instance admin settings (requires auth). */
export const instanceSettingsService = {
  async getSettings(): Promise<InstanceSettingsResponse> {
    const { data } = await apiClient.get<InstanceSettingsResponse>('/api/instance/settings/');
    return data;
  },

  async updateSection(
    key: string,
    value: InstanceSettingSectionValue,
  ): Promise<{ key: string; value: InstanceSettingSectionValue }> {
    const { data } = await apiClient.patch<{
      key: string;
      value: InstanceSettingSectionValue;
    }>(`/api/instance/settings/${encodeURIComponent(key)}`, { value });
    return data;
  },

  async sendTestEmail(payload: InstanceEmailTestRequest): Promise<{ message: string }> {
    const { data } = await apiClient.post<{ message: string }>(
      '/api/instance/settings/email/test',
      payload,
    );
    return data;
  },

  /** Search Unsplash (uses instance image API key). GET /api/instance/unsplash/search?q= */
  async unsplashSearch(q: string): Promise<{ results: UnsplashSearchResult[] }> {
    const { data } = await apiClient.get<{ results: UnsplashSearchResult[] }>(
      '/api/instance/unsplash/search',
      { params: { q: q.trim() } },
    );
    return data;
  },
};

/** Instance-admin management (requires instance-admin access). */
export const instanceAdminService = {
  /** GET /api/instance/admins/ */
  async listAdmins(): Promise<InstanceAdminApiResponse[]> {
    const { data } = await apiClient.get<InstanceAdminApiResponse[]>('/api/instance/admins/');
    return data;
  },

  /** POST /api/instance/admins/ — grants admin to an existing user by email. */
  async addAdmin(email: string): Promise<InstanceAdminApiResponse> {
    const { data } = await apiClient.post<InstanceAdminApiResponse>('/api/instance/admins/', {
      email: email.trim(),
    });
    return data;
  },

  /** DELETE /api/instance/admins/:id/ */
  async removeAdmin(id: string): Promise<void> {
    await apiClient.delete(`/api/instance/admins/${encodeURIComponent(id)}/`);
  },
};
