import { apiClient } from '../api/client';
import type {
  InstanceSetupStatusResponse,
  InstanceSetupRequest,
  UserApiResponse,
  InstanceSettingsResponse,
  InstanceSettingSectionValue,
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

  /** Search Unsplash (uses instance image API key). GET /api/instance/unsplash/search?q= */
  async unsplashSearch(q: string): Promise<{ results: UnsplashSearchResult[] }> {
    const { data } = await apiClient.get<{ results: UnsplashSearchResult[] }>(
      '/api/instance/unsplash/search',
      { params: { q: q.trim() } },
    );
    return data;
  },
};
