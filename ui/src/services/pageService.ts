import { apiClient } from '../api/client';
import type {
  CreatePageRequest,
  PageApiResponse,
  PageVersionApiResponse,
  UpdatePageContentRequest,
  UpdatePageRequest,
} from '../api/types';

export interface ListPagesOpts {
  projectId?: string | null;
  /** 'inbox' (default, hides archived) | 'archived' (only archived). */
  archived?: 'inbox' | 'archived';
  parentId?: string | null;
  search?: string;
  ownedByMe?: boolean;
  onlyRoots?: boolean;
}

const base = (slug: string) => `/api/workspaces/${encodeURIComponent(slug)}/pages`;

export const pageService = {
  async list(
    workspaceSlug: string,
    opts: ListPagesOpts | string | null = {},
  ): Promise<PageApiResponse[]> {
    // Backwards-compat: callers passing a project_id string still work.
    const o: ListPagesOpts =
      typeof opts === 'string' || opts == null ? { projectId: opts as string | null } : opts;
    const params = new URLSearchParams();
    if (o.projectId) params.set('project_id', o.projectId);
    if (o.archived === 'archived') params.set('archived', 'true');
    if (o.parentId) params.set('parent_id', o.parentId);
    if (o.onlyRoots) params.set('only_roots', 'true');
    if (o.search) params.set('search', o.search);
    if (o.ownedByMe) params.set('owned_by_me', 'true');
    const qs = params.toString() ? `?${params.toString()}` : '';
    const { data } = await apiClient.get<PageApiResponse[]>(`${base(workspaceSlug)}/${qs}`);
    return data;
  },

  async listChildren(workspaceSlug: string, pageId: string): Promise<PageApiResponse[]> {
    const { data } = await apiClient.get<PageApiResponse[]>(
      `${base(workspaceSlug)}/${encodeURIComponent(pageId)}/children/`,
    );
    return data;
  },

  async create(workspaceSlug: string, payload: CreatePageRequest): Promise<PageApiResponse> {
    const { data } = await apiClient.post<PageApiResponse>(`${base(workspaceSlug)}/`, payload);
    return data;
  },

  async get(workspaceSlug: string, pageId: string): Promise<PageApiResponse> {
    const { data } = await apiClient.get<PageApiResponse>(
      `${base(workspaceSlug)}/${encodeURIComponent(pageId)}/`,
    );
    return data;
  },

  async update(
    workspaceSlug: string,
    pageId: string,
    payload: UpdatePageRequest,
  ): Promise<PageApiResponse> {
    const { data } = await apiClient.patch<PageApiResponse>(
      `${base(workspaceSlug)}/${encodeURIComponent(pageId)}/`,
      payload,
    );
    return data;
  },

  /** PATCH .../content/ — autosave target. */
  async updateContent(
    workspaceSlug: string,
    pageId: string,
    html: string,
  ): Promise<PageApiResponse> {
    const payload: UpdatePageContentRequest = { description_html: html };
    const { data } = await apiClient.patch<PageApiResponse>(
      `${base(workspaceSlug)}/${encodeURIComponent(pageId)}/content/`,
      payload,
    );
    return data;
  },

  async delete(workspaceSlug: string, pageId: string): Promise<void> {
    await apiClient.delete(`${base(workspaceSlug)}/${encodeURIComponent(pageId)}/`);
  },

  async lock(workspaceSlug: string, pageId: string): Promise<void> {
    await apiClient.post(`${base(workspaceSlug)}/${encodeURIComponent(pageId)}/lock/`);
  },
  async unlock(workspaceSlug: string, pageId: string): Promise<void> {
    await apiClient.delete(`${base(workspaceSlug)}/${encodeURIComponent(pageId)}/lock/`);
  },

  async archive(workspaceSlug: string, pageId: string): Promise<void> {
    await apiClient.post(`${base(workspaceSlug)}/${encodeURIComponent(pageId)}/archive/`);
  },
  async unarchive(workspaceSlug: string, pageId: string): Promise<void> {
    await apiClient.delete(`${base(workspaceSlug)}/${encodeURIComponent(pageId)}/archive/`);
  },

  async duplicate(workspaceSlug: string, pageId: string): Promise<PageApiResponse> {
    const { data } = await apiClient.post<PageApiResponse>(
      `${base(workspaceSlug)}/${encodeURIComponent(pageId)}/duplicate/`,
    );
    return data;
  },

  async listVersions(workspaceSlug: string, pageId: string): Promise<PageVersionApiResponse[]> {
    const { data } = await apiClient.get<PageVersionApiResponse[]>(
      `${base(workspaceSlug)}/${encodeURIComponent(pageId)}/versions/`,
    );
    return data;
  },

  async getVersion(
    workspaceSlug: string,
    pageId: string,
    versionId: string,
  ): Promise<PageVersionApiResponse> {
    const { data } = await apiClient.get<PageVersionApiResponse>(
      `${base(workspaceSlug)}/${encodeURIComponent(pageId)}/versions/${encodeURIComponent(versionId)}/`,
    );
    return data;
  },

  async restoreVersion(
    workspaceSlug: string,
    pageId: string,
    versionId: string,
  ): Promise<PageApiResponse> {
    const { data } = await apiClient.post<PageApiResponse>(
      `${base(workspaceSlug)}/${encodeURIComponent(pageId)}/versions/${encodeURIComponent(versionId)}/restore/`,
    );
    return data;
  },

  async favorite(workspaceSlug: string, pageId: string): Promise<void> {
    await apiClient.post(`${base(workspaceSlug)}/${encodeURIComponent(pageId)}/favorite/`);
  },
  async unfavorite(workspaceSlug: string, pageId: string): Promise<void> {
    await apiClient.delete(`${base(workspaceSlug)}/${encodeURIComponent(pageId)}/favorite/`);
  },
  async listFavoriteIds(workspaceSlug: string): Promise<string[]> {
    const { data } = await apiClient.get<string[]>(`${base(workspaceSlug)}/favorites/`);
    return data;
  },
};
