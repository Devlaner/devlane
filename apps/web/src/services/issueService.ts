import { apiClient } from '../api/client';
import type {
  IssueActivityApiResponse,
  IssueApiResponse,
  IssueAttachmentApiResponse,
  IssueLinkApiResponse,
  IssueRelationApiResponse,
  IssueRelationType,
  IssueReactionApiResponse,
  CreateIssueRequest,
} from '../api/types';

export interface ListIssuesParams {
  limit?: number;
  offset?: number;
}

const base = (slug: string, pid: string, iid: string) =>
  `/api/workspaces/${encodeURIComponent(slug)}/projects/${encodeURIComponent(pid)}/issues/${encodeURIComponent(iid)}`;

const bulkBase = (slug: string, pid: string) =>
  `/api/workspaces/${encodeURIComponent(slug)}/projects/${encodeURIComponent(pid)}/issues-bulk`;

export const issueService = {
  async listWorkspaceDrafts(
    workspaceSlug: string,
    params?: ListIssuesParams,
  ): Promise<IssueApiResponse[]> {
    const searchParams = new URLSearchParams();
    if (params?.limit != null) searchParams.set('limit', String(params.limit));
    if (params?.offset != null) searchParams.set('offset', String(params.offset));
    const qs = searchParams.toString();
    const url = `/api/workspaces/${encodeURIComponent(workspaceSlug)}/draft-issues/${qs ? `?${qs}` : ''}`;
    const { data } = await apiClient.get<IssueApiResponse[]>(url);
    return data;
  },

  async listWorkspaceArchived(
    workspaceSlug: string,
    params?: ListIssuesParams,
  ): Promise<IssueApiResponse[]> {
    const searchParams = new URLSearchParams();
    if (params?.limit != null) searchParams.set('limit', String(params.limit));
    if (params?.offset != null) searchParams.set('offset', String(params.offset));
    const qs = searchParams.toString();
    const url = `/api/workspaces/${encodeURIComponent(workspaceSlug)}/archived-issues/${qs ? `?${qs}` : ''}`;
    const { data } = await apiClient.get<IssueApiResponse[]>(url);
    return Array.isArray(data) ? data : [];
  },

  async list(
    workspaceSlug: string,
    projectId: string,
    params?: ListIssuesParams,
  ): Promise<IssueApiResponse[]> {
    const searchParams = new URLSearchParams();
    if (params?.limit != null) searchParams.set('limit', String(params.limit));
    if (params?.offset != null) searchParams.set('offset', String(params.offset));
    const qs = searchParams.toString();
    const url = `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/issues/${qs ? `?${qs}` : ''}`;
    const { data } = await apiClient.get<IssueApiResponse[]>(url);
    return data;
  },

  async get(workspaceSlug: string, projectId: string, issueId: string): Promise<IssueApiResponse> {
    const { data } = await apiClient.get<IssueApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/`,
    );
    return data;
  },

  async create(
    workspaceSlug: string,
    projectId: string,
    payload: CreateIssueRequest,
  ): Promise<IssueApiResponse> {
    const { data } = await apiClient.post<IssueApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/issues/`,
      payload,
    );
    return data;
  },

  async update(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    payload: Partial<
      CreateIssueRequest & {
        state_id?: string | null;
        is_draft?: boolean;
        description_html?: string;
        type?: string;
        /** uuid to set, "" to clear, omit to leave unchanged */
        estimate_point_id?: string | null;
      }
    >,
  ): Promise<IssueApiResponse> {
    const { data } = await apiClient.patch<IssueApiResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/`,
      payload,
    );
    return data;
  },

  async delete(workspaceSlug: string, projectId: string, issueId: string): Promise<void> {
    await apiClient.delete(
      `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/`,
    );
  },

  async listActivities(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
  ): Promise<IssueActivityApiResponse[]> {
    const { data } = await apiClient.get<IssueActivityApiResponse[]>(
      `${base(workspaceSlug, projectId, issueId)}/activities/`,
    );
    return data;
  },

  async isSubscribed(workspaceSlug: string, projectId: string, issueId: string): Promise<boolean> {
    const { data } = await apiClient.get<{ subscribed: boolean }>(
      `${base(workspaceSlug, projectId, issueId)}/subscribe/`,
    );
    return data.subscribed;
  },

  async subscribe(workspaceSlug: string, projectId: string, issueId: string): Promise<void> {
    await apiClient.post(`${base(workspaceSlug, projectId, issueId)}/subscribe/`);
  },

  async unsubscribe(workspaceSlug: string, projectId: string, issueId: string): Promise<void> {
    await apiClient.delete(`${base(workspaceSlug, projectId, issueId)}/subscribe/`);
  },

  // ── Links ──────────────────────────────────────────────────────────────────

  async listLinks(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
  ): Promise<IssueLinkApiResponse[]> {
    const { data } = await apiClient.get<IssueLinkApiResponse[]>(
      `${base(workspaceSlug, projectId, issueId)}/issue-links/`,
    );
    return data ?? [];
  },

  async createLink(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    payload: { url: string; title?: string },
  ): Promise<IssueLinkApiResponse> {
    const { data } = await apiClient.post<IssueLinkApiResponse>(
      `${base(workspaceSlug, projectId, issueId)}/issue-links/`,
      payload,
    );
    return data;
  },

  async updateLink(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    linkId: string,
    payload: { url?: string; title?: string },
  ): Promise<IssueLinkApiResponse> {
    const { data } = await apiClient.patch<IssueLinkApiResponse>(
      `${base(workspaceSlug, projectId, issueId)}/issue-links/${encodeURIComponent(linkId)}/`,
      payload,
    );
    return data;
  },

  async deleteLink(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    linkId: string,
  ): Promise<void> {
    await apiClient.delete(
      `${base(workspaceSlug, projectId, issueId)}/issue-links/${encodeURIComponent(linkId)}/`,
    );
  },

  // ── Relations ──────────────────────────────────────────────────────────────

  async listRelations(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
  ): Promise<IssueRelationApiResponse> {
    const { data } = await apiClient.get<IssueRelationApiResponse>(
      `${base(workspaceSlug, projectId, issueId)}/issue-relation/`,
    );
    return data;
  },

  async addRelation(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    relationType: IssueRelationType,
    relatedIssueIds: string[],
  ): Promise<IssueApiResponse[]> {
    const { data } = await apiClient.post<IssueApiResponse[]>(
      `${base(workspaceSlug, projectId, issueId)}/issue-relation/`,
      { relation_type: relationType, issues: relatedIssueIds },
    );
    return data ?? [];
  },

  async removeRelation(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    relationType: IssueRelationType,
    relatedIssueId: string,
  ): Promise<void> {
    await apiClient.post(`${base(workspaceSlug, projectId, issueId)}/remove-relation/`, {
      relation_type: relationType,
      related_issue: relatedIssueId,
    });
  },

  // ── Attachments ────────────────────────────────────────────────────────────

  async listAttachments(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
  ): Promise<IssueAttachmentApiResponse[]> {
    const { data } = await apiClient.get<IssueAttachmentApiResponse[]>(
      `/api/assets/v2/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/attachments/`,
    );
    return data ?? [];
  },

  async initiateAttachmentUpload(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    file: { name: string; size: number; type: string },
  ): Promise<{
    asset_id: string;
    upload_data: { url: string; fields: Record<string, string> };
    attachment: IssueAttachmentApiResponse;
  }> {
    const { data } = await apiClient.post(
      `/api/assets/v2/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/attachments/`,
      { name: file.name, size: file.size, type: file.type },
    );
    return data;
  },

  async confirmAttachmentUpload(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    assetId: string,
  ): Promise<void> {
    await apiClient.patch(
      `/api/assets/v2/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/attachments/${encodeURIComponent(assetId)}/`,
    );
  },

  async deleteAttachment(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    assetId: string,
  ): Promise<void> {
    await apiClient.delete(
      `/api/assets/v2/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/attachments/${encodeURIComponent(assetId)}/`,
    );
  },

  async listReactions(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
  ): Promise<IssueReactionApiResponse[]> {
    const { data } = await apiClient.get<IssueReactionApiResponse[]>(
      `${base(workspaceSlug, projectId, issueId)}/reactions/`,
    );
    return data;
  },

  async addReaction(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    reaction: string,
  ): Promise<IssueReactionApiResponse> {
    const { data } = await apiClient.post<IssueReactionApiResponse>(
      `${base(workspaceSlug, projectId, issueId)}/reactions/`,
      { reaction },
    );
    return data;
  },

  async removeReaction(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    reaction: string,
  ): Promise<void> {
    await apiClient.delete(
      `${base(workspaceSlug, projectId, issueId)}/reactions/${encodeURIComponent(reaction)}/`,
    );
  },

  async archive(workspaceSlug: string, projectId: string, issueId: string): Promise<void> {
    await apiClient.post(`${base(workspaceSlug, projectId, issueId)}/archive/`);
  },

  async restore(workspaceSlug: string, projectId: string, issueId: string): Promise<void> {
    await apiClient.delete(`${base(workspaceSlug, projectId, issueId)}/archive/`);
  },

  async listArchived(
    workspaceSlug: string,
    projectId: string,
    params: ListIssuesParams = {},
  ): Promise<IssueApiResponse[]> {
    const search = new URLSearchParams();
    if (params.limit != null) search.set('limit', String(params.limit));
    if (params.offset != null) search.set('offset', String(params.offset));
    const qs = search.toString();
    const url = `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/archived-issues/${qs ? `?${qs}` : ''}`;
    const { data } = await apiClient.get<IssueApiResponse[]>(url);
    return data;
  },

  async bulkUpdate(
    workspaceSlug: string,
    projectId: string,
    issueIds: string[],
    fields: { priority?: string; state_id?: string },
  ): Promise<void> {
    await apiClient.post(`${bulkBase(workspaceSlug, projectId)}/update/`, {
      issue_ids: issueIds,
      ...fields,
    });
  },

  async bulkArchive(
    workspaceSlug: string,
    projectId: string,
    issueIds: string[],
    archived = true,
  ): Promise<void> {
    await apiClient.post(`${bulkBase(workspaceSlug, projectId)}/archive/`, {
      issue_ids: issueIds,
      archived,
    });
  },

  async bulkDelete(workspaceSlug: string, projectId: string, issueIds: string[]): Promise<void> {
    await apiClient.post(`${bulkBase(workspaceSlug, projectId)}/delete/`, { issue_ids: issueIds });
  },
};
