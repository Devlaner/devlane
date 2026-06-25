import { apiClient } from '../api/client';
import type { EstimateApiResponse } from '../api/types';

export interface EstimatePointInput {
  key: number;
  value: string;
  description?: string;
}

export interface CreateEstimatePayload {
  name: string;
  description?: string;
  type?: string;
  last_used?: boolean;
  points: EstimatePointInput[];
}

export type UpdateEstimatePayload = Partial<CreateEstimatePayload>;

const projectBase = (workspaceSlug: string, projectId: string) =>
  `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/estimates/`;

export const estimateService = {
  async list(workspaceSlug: string, projectId: string): Promise<EstimateApiResponse[]> {
    const { data } = await apiClient.get<EstimateApiResponse[]>(
      projectBase(workspaceSlug, projectId),
    );
    return Array.isArray(data) ? data : [];
  },

  async create(
    workspaceSlug: string,
    projectId: string,
    payload: CreateEstimatePayload,
  ): Promise<EstimateApiResponse> {
    const { data } = await apiClient.post<EstimateApiResponse>(
      projectBase(workspaceSlug, projectId),
      payload,
    );
    return data;
  },

  async update(
    workspaceSlug: string,
    projectId: string,
    estimateId: string,
    payload: UpdateEstimatePayload,
  ): Promise<EstimateApiResponse> {
    const { data } = await apiClient.patch<EstimateApiResponse>(
      `${projectBase(workspaceSlug, projectId)}${encodeURIComponent(estimateId)}/`,
      payload,
    );
    return data;
  },

  async remove(workspaceSlug: string, projectId: string, estimateId: string): Promise<void> {
    await apiClient.delete(
      `${projectBase(workspaceSlug, projectId)}${encodeURIComponent(estimateId)}/`,
    );
  },
};
