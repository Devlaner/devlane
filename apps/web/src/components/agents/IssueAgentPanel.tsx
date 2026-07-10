import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, ChevronDown, Pencil, Play, Settings2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type {
  AgentApiResponse,
  AgentIssueAssignmentApiResponse,
  AgentRunApiResponse,
} from '../../api/types';
import { getApiErrorMessage } from '../../api/client';
import { agentService } from '../../services/agentService';
import { Button, Card, CardContent, CardHeader } from '../ui';
import { AgentMark, AgentRunStatusBadge } from './agentUi';
import { autonomyLabel } from './agentOptions';

interface IssueAgentPanelProps {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
}

function relativeTime(value: string): string {
  const timestamp = new Date(value).getTime();
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function IssueAgentPanel({ workspaceSlug, projectId, issueId }: IssueAgentPanelProps) {
  const [agents, setAgents] = useState<AgentApiResponse[]>([]);
  const [assignments, setAssignments] = useState<AgentIssueAssignmentApiResponse[]>([]);
  const [runs, setRuns] = useState<AgentRunApiResponse[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [reason, setReason] = useState('');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [running, setRunning] = useState(false);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [agentList, assignmentList, runList] = await Promise.all([
        agentService.list(workspaceSlug, projectId),
        agentService.listAssignments(workspaceSlug, projectId, issueId),
        agentService.listRuns(workspaceSlug, projectId, issueId),
      ]);
      setAgents(agentList);
      setAssignments(assignmentList);
      setRuns(runList);
      const latestActive = [...assignmentList]
        .reverse()
        .find((assignment) => assignment.status === 'active');
      const initialAgentId =
        latestActive?.agent_id ?? agentList.find((agent) => agent.enabled)?.id ?? '';
      setSelectedAgentId(initialAgentId);
      setReason(latestActive?.reason ?? '');
      setShowAssignmentForm(!latestActive);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [issueId, projectId, workspaceSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  const enabledAgents = useMemo(() => agents.filter((agent) => agent.enabled), [agents]);
  const latestActiveAssignment = useMemo(
    () => [...assignments].reverse().find((assignment) => assignment.status === 'active') ?? null,
    [assignments],
  );
  const assignedAgent = latestActiveAssignment
    ? (agents.find((agent) => agent.id === latestActiveAssignment.agent_id) ?? null)
    : null;
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? null;

  const assignAgent = async () => {
    if (!selectedAgentId) return;
    setAssigning(true);
    setError(null);
    try {
      const assignment = await agentService.assign(
        workspaceSlug,
        projectId,
        issueId,
        selectedAgentId,
        reason.trim(),
      );
      setAssignments((current) => {
        const exists = current.some((item) => item.id === assignment.id);
        return exists
          ? current.map((item) => (item.id === assignment.id ? assignment : item))
          : [...current, assignment];
      });
      setShowAssignmentForm(false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setAssigning(false);
    }
  };

  const runAgent = async () => {
    const agentId = assignedAgent?.id ?? selectedAgentId;
    if (!agentId) return;
    setRunning(true);
    setError(null);
    try {
      const run = await agentService.run(workspaceSlug, projectId, issueId, agentId, prompt);
      setRuns((current) => [run, ...current.filter((item) => item.id !== run.id)]);
      setPrompt('');
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-(--txt-secondary)">
          <Bot className="size-4 text-(--txt-icon-secondary)" aria-hidden />
          Agent
        </span>
        <Link
          to={`/${workspaceSlug}/settings?section=agents`}
          className="flex size-7 items-center justify-center rounded-md text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
          aria-label="Manage agents"
          title="Manage agents"
        >
          <Settings2 className="size-3.5" aria-hidden />
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="py-2 text-xs text-(--txt-tertiary)">Loading agents...</p>
        ) : enabledAgents.length === 0 ? (
          <div className="py-2 text-center">
            <p className="text-sm font-medium text-(--txt-primary)">No agents available</p>
            <Link
              to={`/${workspaceSlug}/settings?section=agents`}
              className="mt-1 inline-block text-xs font-medium text-(--txt-accent-primary) hover:underline"
            >
              Create an agent
            </Link>
          </div>
        ) : (
          <>
            {assignedAgent && !showAssignmentForm ? (
              <div className="flex items-start gap-2.5">
                <AgentMark name={assignedAgent.name} enabled={assignedAgent.enabled} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-(--txt-primary)">
                      {assignedAgent.name}
                    </p>
                    <span className="shrink-0 rounded bg-(--bg-accent-subtle) px-1.5 py-0.5 text-[10px] font-medium text-(--txt-accent-primary)">
                      Assigned
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-(--txt-tertiary)">
                    {autonomyLabel(assignedAgent.autonomy_level)}
                  </p>
                  {latestActiveAssignment?.reason && (
                    <p className="mt-1 line-clamp-2 text-xs text-(--txt-secondary)">
                      {latestActiveAssignment.reason}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAgentId(assignedAgent.id);
                    setReason(latestActiveAssignment?.reason ?? '');
                    setShowAssignmentForm(true);
                  }}
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-(--txt-icon-secondary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
                  aria-label="Change assigned agent"
                  title="Change assigned agent"
                >
                  <Pencil className="size-3.5" aria-hidden />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <select
                    value={selectedAgentId}
                    onChange={(event) => setSelectedAgentId(event.target.value)}
                    className="w-full appearance-none rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 pr-8 text-sm text-(--txt-primary) outline-none focus:border-(--border-strong)"
                    aria-label="Select agent"
                  >
                    {enabledAgents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name} - {autonomyLabel(agent.autonomy_level)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-(--txt-icon-tertiary)" />
                </div>
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="What should this agent own?"
                  className="w-full rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-xs text-(--txt-primary) outline-none placeholder:text-(--txt-placeholder) focus:border-(--border-strong)"
                />
                <div className="flex justify-end gap-2">
                  {assignedAgent && (
                    <Button variant="ghost" size="sm" onClick={() => setShowAssignmentForm(false)}>
                      Cancel
                    </Button>
                  )}
                  <Button
                    size="sm"
                    disabled={!selectedAgent || assigning}
                    onClick={() => void assignAgent()}
                  >
                    {assigning ? 'Assigning...' : assignedAgent ? 'Update' : 'Assign agent'}
                  </Button>
                </div>
              </div>
            )}

            {assignedAgent && !showAssignmentForm && (
              <div className="border-t border-(--border-subtle) pt-3">
                <label className="block text-xs font-medium text-(--txt-secondary)">
                  Task for this run
                  <textarea
                    rows={2}
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="Optional focus or constraints"
                    className="mt-1.5 w-full resize-none rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-xs font-normal text-(--txt-primary) outline-none placeholder:text-(--txt-placeholder) focus:border-(--border-strong)"
                  />
                </label>
                <Button
                  size="sm"
                  className="mt-2 w-full gap-1.5"
                  disabled={running}
                  onClick={() => void runAgent()}
                >
                  <Play className="size-3.5" fill="currentColor" aria-hidden />
                  {running ? 'Queueing...' : 'Run now'}
                </Button>
              </div>
            )}

            {runs.length > 0 && (
              <div className="border-t border-(--border-subtle) pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium text-(--txt-secondary)">Recent runs</p>
                  <span className="text-[11px] text-(--txt-tertiary)">{runs.length} total</span>
                </div>
                <div className="space-y-2">
                  {runs.slice(0, 4).map((run) => {
                    const agent = agents.find((item) => item.id === run.agent_id);
                    const runPrompt =
                      typeof run.input?.prompt === 'string' ? run.input.prompt : 'Manual run';
                    return (
                      <div key={run.id} className="flex items-start justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <p className="truncate text-(--txt-secondary)" title={runPrompt}>
                            {runPrompt}
                          </p>
                          <p className="mt-0.5 text-[11px] text-(--txt-tertiary)">
                            {agent?.name ?? 'Agent'} · {relativeTime(run.queued_at)}
                          </p>
                        </div>
                        <AgentRunStatusBadge status={run.status} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {error && (
          <p className="rounded-md bg-(--bg-danger-subtle) px-2.5 py-2 text-xs text-(--txt-danger-primary)">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
