import { apiClient } from '../api/client';
import type { IntakeItemApiResponse } from '../api/types';

const base = (workspaceSlug: string, projectId: string) =>
  `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/intake-issues/`;

/** Project intake (triage inbox) lifecycle. */
export const intakeService = {
  /** List intake items, optionally filtered to one status. */
  async list(
    workspaceSlug: string,
    projectId: string,
    status?: 'pending' | 'snoozed' | 'accepted' | 'declined' | 'duplicate',
  ): Promise<IntakeItemApiResponse[]> {
    const { data } = await apiClient.get<IntakeItemApiResponse[]>(base(workspaceSlug, projectId), {
      params: status ? { status } : undefined,
    });
    return Array.isArray(data) ? data : [];
  },

  /** Count of items still awaiting triage (for the sidebar badge). */
  async pendingCount(workspaceSlug: string, projectId: string): Promise<number> {
    const { data } = await apiClient.get<{ pending: number }>(
      `${base(workspaceSlug, projectId)}count/`,
    );
    return data.pending ?? 0;
  },

  accept(workspaceSlug: string, projectId: string, itemId: string): Promise<void> {
    return this.transition(workspaceSlug, projectId, itemId, { action: 'accept' });
  },
  decline(workspaceSlug: string, projectId: string, itemId: string): Promise<void> {
    return this.transition(workspaceSlug, projectId, itemId, { action: 'decline' });
  },
  snooze(
    workspaceSlug: string,
    projectId: string,
    itemId: string,
    snoozedTill: string,
  ): Promise<void> {
    return this.transition(workspaceSlug, projectId, itemId, {
      action: 'snooze',
      snoozed_till: snoozedTill,
    });
  },
  markDuplicate(
    workspaceSlug: string,
    projectId: string,
    itemId: string,
    duplicateToId: string,
  ): Promise<void> {
    return this.transition(workspaceSlug, projectId, itemId, {
      action: 'duplicate',
      duplicate_to_id: duplicateToId,
    });
  },

  async transition(
    workspaceSlug: string,
    projectId: string,
    itemId: string,
    body: {
      action: 'accept' | 'decline' | 'snooze' | 'duplicate';
      snoozed_till?: string;
      duplicate_to_id?: string;
    },
  ): Promise<void> {
    await apiClient.patch(`${base(workspaceSlug, projectId)}${encodeURIComponent(itemId)}/`, body);
  },
};
