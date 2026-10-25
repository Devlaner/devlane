import { apiClient } from '../api/client';
import type { ImporterApiResponse } from '../api/types';

const base = (workspaceSlug: string, projectId: string) =>
  `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/importers/`;

/** Bulk import (CSV) jobs for a project. */
export const importerService = {
  /** Upload a CSV file to start an import. */
  async createCSV(
    workspaceSlug: string,
    projectId: string,
    file: File,
  ): Promise<ImporterApiResponse> {
    const form = new FormData();
    form.append('file', file);
    // apiClient strips Content-Type for FormData so the browser sets the boundary.
    const { data } = await apiClient.post<ImporterApiResponse>(
      base(workspaceSlug, projectId),
      form,
    );
    return data;
  },

  async list(workspaceSlug: string, projectId: string): Promise<ImporterApiResponse[]> {
    const { data } = await apiClient.get<ImporterApiResponse[]>(base(workspaceSlug, projectId));
    return Array.isArray(data) ? data : [];
  },

  async get(
    workspaceSlug: string,
    projectId: string,
    importerId: string,
  ): Promise<ImporterApiResponse> {
    const { data } = await apiClient.get<ImporterApiResponse>(
      `${base(workspaceSlug, projectId)}${encodeURIComponent(importerId)}/`,
    );
    return data;
  },
};
