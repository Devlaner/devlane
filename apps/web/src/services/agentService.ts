import { apiClient } from '../api/client';
import type {
  AgentApiResponse,
  AgentIssueAssignmentApiResponse,
  AgentRunApiResponse,
  AgentUpsertRequest,
} from '../api/types';

const workspaceBase = (slug: string) => `/api/workspaces/${encodeURIComponent(slug)}/agents`;

const issueBase = (slug: string, projectId: string, issueId: string) =>
  `/api/workspaces/${encodeURIComponent(slug)}/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}`;

export const agentService = {
  async list(workspaceSlug: string, projectId?: string): Promise<AgentApiResponse[]> {
    const url = projectId
      ? `/api/workspaces/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/agents/`
      : `${workspaceBase(workspaceSlug)}/`;
    const { data } = await apiClient.get<AgentApiResponse[]>(url);
    return Array.isArray(data) ? data : [];
  },

  async create(workspaceSlug: string, payload: AgentUpsertRequest): Promise<AgentApiResponse> {
    const { data } = await apiClient.post<AgentApiResponse>(
      `${workspaceBase(workspaceSlug)}/`,
      payload,
    );
    return data;
  },

  async update(
    workspaceSlug: string,
    agentId: string,
    payload: Partial<AgentUpsertRequest>,
  ): Promise<AgentApiResponse> {
    const { data } = await apiClient.patch<AgentApiResponse>(
      `${workspaceBase(workspaceSlug)}/${encodeURIComponent(agentId)}/`,
      payload,
    );
    return data;
  },

  async delete(workspaceSlug: string, agentId: string): Promise<void> {
    await apiClient.delete(`${workspaceBase(workspaceSlug)}/${encodeURIComponent(agentId)}/`);
  },

  async listAssignments(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
  ): Promise<AgentIssueAssignmentApiResponse[]> {
    const { data } = await apiClient.get<AgentIssueAssignmentApiResponse[]>(
      `${issueBase(workspaceSlug, projectId, issueId)}/agent-assignments/`,
    );
    return Array.isArray(data) ? data : [];
  },

  async assign(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    agentId: string,
    reason: string,
  ): Promise<AgentIssueAssignmentApiResponse> {
    const { data } = await apiClient.post<AgentIssueAssignmentApiResponse>(
      `${issueBase(workspaceSlug, projectId, issueId)}/agent-assignments/`,
      { agent_id: agentId, reason },
    );
    return data;
  },

  async listRuns(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
  ): Promise<AgentRunApiResponse[]> {
    const { data } = await apiClient.get<AgentRunApiResponse[]>(
      `${issueBase(workspaceSlug, projectId, issueId)}/agent-runs/`,
    );
    return Array.isArray(data) ? data : [];
  },

  async run(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    agentId: string,
    prompt?: string,
  ): Promise<AgentRunApiResponse> {
    const { data } = await apiClient.post<AgentRunApiResponse>(
      `${issueBase(workspaceSlug, projectId, issueId)}/agent-runs/`,
      {
        agent_id: agentId,
        trigger: 'manual',
        input: prompt?.trim() ? { prompt: prompt.trim() } : {},
      },
    );
    return data;
  },
};
