import { apiClient } from '../api/client';
import type { WebhookApiResponse, WebhookLogApiResponse } from '../api/types';

const base = (workspaceSlug: string) =>
  `/api/workspaces/${encodeURIComponent(workspaceSlug)}/webhooks/`;

export interface WebhookPayload {
  url?: string;
  is_active?: boolean;
  project?: boolean;
  issue?: boolean;
  module?: boolean;
  cycle?: boolean;
  issue_comment?: boolean;
}

/** Outbound workspace webhooks (admin only). */
export const webhookService = {
  async list(workspaceSlug: string): Promise<WebhookApiResponse[]> {
    const { data } = await apiClient.get<WebhookApiResponse[]>(base(workspaceSlug));
    return Array.isArray(data) ? data : [];
  },
  async create(workspaceSlug: string, payload: WebhookPayload): Promise<WebhookApiResponse> {
    const { data } = await apiClient.post<WebhookApiResponse>(base(workspaceSlug), payload);
    return data;
  },
  async update(
    workspaceSlug: string,
    webhookId: string,
    payload: WebhookPayload,
  ): Promise<WebhookApiResponse> {
    const { data } = await apiClient.patch<WebhookApiResponse>(
      `${base(workspaceSlug)}${encodeURIComponent(webhookId)}/`,
      payload,
    );
    return data;
  },
  async remove(workspaceSlug: string, webhookId: string): Promise<void> {
    await apiClient.delete(`${base(workspaceSlug)}${encodeURIComponent(webhookId)}/`);
  },
  async logs(workspaceSlug: string, webhookId: string): Promise<WebhookLogApiResponse[]> {
    const { data } = await apiClient.get<WebhookLogApiResponse[]>(
      `${base(workspaceSlug)}${encodeURIComponent(webhookId)}/logs/`,
    );
    return Array.isArray(data) ? data : [];
  },
};
