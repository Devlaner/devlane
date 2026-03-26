import { apiClient } from '../api/client';
import type { CreatePageRequest, PageApiResponse, UpdatePageRequest } from '../api/types';

export const pageService = {
  async list(workspaceSlug: string, projectId?: string | null): Promise<PageApiResponse[]> {
    const url = projectId
      ? `/api/workspaces/${encodeURIComponent(workspaceSlug)}/pages/?project_id=${encodeURIComponent(projectId)}`
      : `/api/workspaces/${encodeURIComponent(workspaceSlug)}/pages/`;
    const { data } = await apiClient.get<PageApiResponse[]>(url);
    return data;
  },

  async create(workspaceSlug: string, payload: CreatePageRequest): Promise<PageApiResponse> {
    const { data } = await apiClient.post<PageApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/pages/`,
      payload,
    );
    return data;
  },

  async get(workspaceSlug: string, pageId: string): Promise<PageApiResponse> {
    const { data } = await apiClient.get<PageApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/pages/${encodeURIComponent(pageId)}/`,
    );
    return data;
  },

  async update(
    workspaceSlug: string,
    pageId: string,
    payload: UpdatePageRequest,
  ): Promise<PageApiResponse> {
    const { data } = await apiClient.patch<PageApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/pages/${encodeURIComponent(pageId)}/`,
      payload,
    );
    return data;
  },

  async delete(workspaceSlug: string, pageId: string): Promise<void> {
    await apiClient.delete(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/pages/${encodeURIComponent(pageId)}/`,
    );
  },
};
