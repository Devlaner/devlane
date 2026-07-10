import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type {
  AgentApiResponse,
  AgentAutonomyLevel,
  AgentUpsertRequest,
  ProjectApiResponse,
} from '../../api/types';
import { getApiErrorMessage } from '../../api/client';
import { agentService } from '../../services/agentService';
import { Button, Modal, Tooltip } from '../ui';
import { AgentMark } from './agentUi';
import { AUTONOMY_OPTIONS, TOOL_OPTIONS, autonomyLabel, toolLabel } from './agentOptions';

interface AgentSettingsPanelProps {
  workspaceSlug: string;
  projects: ProjectApiResponse[];
}

interface AgentFormState {
  name: string;
  description: string;
  instructions: string;
  model: string;
  projectId: string;
  autonomyLevel: AgentAutonomyLevel;
  tools: string[];
  enabled: boolean;
}

const EMPTY_FORM: AgentFormState = {
  name: '',
  description: '',
  instructions: '',
  model: 'gpt-5',
  projectId: '',
  autonomyLevel: 'suggest',
  tools: ['issue.read'],
  enabled: true,
};

function formFromAgent(agent: AgentApiResponse): AgentFormState {
  return {
    name: agent.name,
    description: agent.description ?? '',
    instructions: agent.instructions ?? '',
    model: agent.model || 'gpt-5',
    projectId: agent.project_id ?? '',
    autonomyLevel: agent.autonomy_level,
    tools: agent.tool_permissions?.map((permission) => permission.tool) ?? [],
    enabled: agent.enabled,
  };
}

export function AgentSettingsPanel({ workspaceSlug, projects }: AgentSettingsPanelProps) {
  const [agents, setAgents] = useState<AgentApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingAgent, setEditingAgent] = useState<AgentApiResponse | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<AgentFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAgents(await agentService.list(workspaceSlug));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [workspaceSlug]);

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  const enabledCount = useMemo(() => agents.filter((agent) => agent.enabled).length, [agents]);
  const toolCount = useMemo(
    () => new Set(agents.flatMap((agent) => agent.tool_permissions?.map((p) => p.tool) ?? [])).size,
    [agents],
  );

  const openCreate = () => {
    setEditingAgent(null);
    setForm({ ...EMPTY_FORM, tools: [...EMPTY_FORM.tools] });
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (agent: AgentApiResponse) => {
    setEditingAgent(agent);
    setForm(formFromAgent(agent));
    setError(null);
    setModalOpen(true);
  };

  const saveAgent = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    const payload: AgentUpsertRequest = {
      name: form.name.trim(),
      description: form.description.trim(),
      instructions: form.instructions.trim(),
      model: form.model,
      enabled: form.enabled,
      autonomy_level: form.autonomyLevel,
      tool_permissions: form.tools.map((tool) => ({ tool, scope: 'workspace', config: {} })),
    };
    if (!editingAgent) payload.project_id = form.projectId || null;

    try {
      const saved = editingAgent
        ? await agentService.update(workspaceSlug, editingAgent.id, payload)
        : await agentService.create(workspaceSlug, payload);
      setAgents((current) => {
        const exists = current.some((agent) => agent.id === saved.id);
        return exists
          ? current.map((agent) => (agent.id === saved.id ? saved : agent))
          : [...current, saved].sort((a, b) => a.name.localeCompare(b.name));
      });
      setModalOpen(false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleAgent = async (agent: AgentApiResponse) => {
    setTogglingId(agent.id);
    setError(null);
    try {
      const updated = await agentService.update(workspaceSlug, agent.id, {
        name: agent.name,
        enabled: !agent.enabled,
      });
      setAgents((current) => current.map((item) => (item.id === agent.id ? updated : item)));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setTogglingId(null);
    }
  };

  const deleteAgent = async (agent: AgentApiResponse) => {
    if (!window.confirm(`Delete ${agent.name}? Existing run history will be retained.`)) return;
    setDeletingId(agent.id);
    setError(null);
    try {
      await agentService.delete(workspaceSlug, agent.id);
      setAgents((current) => current.filter((item) => item.id !== agent.id));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-(--txt-primary)">Agents</h2>
          <p className="mt-1 max-w-2xl text-sm text-(--txt-secondary)">
            Configure autonomous teammates, their boundaries, and the tools they can use.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="size-4" aria-hidden />
          New agent
        </Button>
      </div>

      <div className="grid grid-cols-3 border-y border-(--border-subtle) py-3">
        {[
          ['Total agents', agents.length],
          ['Enabled', enabledCount],
          ['Tools in use', toolCount],
        ].map(([label, value], index) => (
          <div
            key={label}
            className={`px-3 ${index > 0 ? 'border-l border-(--border-subtle)' : ''}`}
          >
            <p className="text-lg font-semibold text-(--txt-primary)">{value}</p>
            <p className="text-xs text-(--txt-tertiary)">{label}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-(--border-danger-subtle) bg-(--bg-danger-subtle) px-3 py-2 text-sm text-(--txt-danger-primary)">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-(--txt-tertiary)">Loading agents...</div>
      ) : agents.length === 0 ? (
        <div className="border-y border-(--border-subtle) py-12 text-center">
          <AgentMark name="New" />
          <p className="mt-3 text-sm font-medium text-(--txt-primary)">No agents yet</p>
          <p className="mt-1 text-sm text-(--txt-secondary)">
            Create one, give it a job, then assign it from any work item.
          </p>
          <Button size="sm" className="mt-4 gap-1.5" onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            Create agent
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {agents.map((agent) => {
            const project = projects.find((item) => item.id === agent.project_id);
            return (
              <div
                key={agent.id}
                className="rounded-md border border-(--border-subtle) bg-(--bg-layer-2) p-4"
              >
                <div className="flex items-start gap-3">
                  <AgentMark name={agent.name} enabled={agent.enabled} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-(--txt-primary)">{agent.name}</h3>
                      <span className="rounded bg-(--bg-accent-subtle) px-1.5 py-0.5 text-[11px] font-medium text-(--txt-accent-primary)">
                        {autonomyLabel(agent.autonomy_level)}
                      </span>
                      <span className="text-xs text-(--txt-tertiary)">
                        {project ? project.name : 'All projects'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-(--txt-secondary)">
                      {agent.description || 'No description provided.'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(agent.tool_permissions ?? []).length ? (
                        agent.tool_permissions.map((permission) => (
                          <span
                            key={permission.id || permission.tool}
                            className="rounded border border-(--border-subtle) bg-(--bg-surface-1) px-2 py-0.5 text-[11px] text-(--txt-secondary)"
                          >
                            {toolLabel(permission.tool)}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-(--txt-tertiary)">No tools granted</span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={agent.enabled}
                      aria-label={`${agent.enabled ? 'Disable' : 'Enable'} ${agent.name}`}
                      disabled={togglingId === agent.id}
                      onClick={() => void toggleAgent(agent)}
                      className={`relative mr-1 h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                        agent.enabled ? 'bg-(--brand-default)' : 'bg-(--neutral-400)'
                      }`}
                    >
                      <span
                        className={`absolute left-1 top-1 size-4 rounded-full bg-white shadow transition-transform ${
                          agent.enabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <Tooltip content="Edit agent">
                      <button
                        type="button"
                        onClick={() => openEdit(agent)}
                        className="flex size-8 items-center justify-center rounded-md text-(--txt-icon-secondary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
                        aria-label={`Edit ${agent.name}`}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </button>
                    </Tooltip>
                    <Tooltip content="Delete agent">
                      <button
                        type="button"
                        disabled={deletingId === agent.id}
                        onClick={() => void deleteAgent(agent)}
                        className="flex size-8 items-center justify-center rounded-md text-(--txt-icon-secondary) hover:bg-(--bg-danger-subtle) hover:text-(--txt-danger-primary) disabled:opacity-50"
                        aria-label={`Delete ${agent.name}`}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editingAgent ? 'Edit agent' : 'Create agent'}
        className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void saveAgent()} disabled={saving || !form.name.trim()}>
              {saving ? 'Saving...' : editingAgent ? 'Save changes' : 'Create agent'}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-(--txt-secondary)">
              Name
              <input
                autoFocus
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Bug triage agent"
                className="mt-1.5 w-full rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) outline-none placeholder:text-(--txt-placeholder) focus:border-(--border-strong)"
              />
            </label>
            <label className="block text-sm font-medium text-(--txt-secondary)">
              Scope
              <select
                value={form.projectId}
                disabled={Boolean(editingAgent)}
                onChange={(event) =>
                  setForm((current) => ({ ...current, projectId: event.target.value }))
                }
                className="mt-1.5 w-full rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) outline-none focus:border-(--border-strong) disabled:opacity-60"
              >
                <option value="">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm font-medium text-(--txt-secondary)">
            Description
            <input
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="What this agent is responsible for"
              className="mt-1.5 w-full rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) outline-none placeholder:text-(--txt-placeholder) focus:border-(--border-strong)"
            />
          </label>

          <label className="block text-sm font-medium text-(--txt-secondary)">
            Instructions
            <textarea
              rows={4}
              value={form.instructions}
              onChange={(event) =>
                setForm((current) => ({ ...current, instructions: event.target.value }))
              }
              placeholder="Describe how the agent should approach its work, what it should check, and when it should ask for review."
              className="mt-1.5 w-full resize-y rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) outline-none placeholder:text-(--txt-placeholder) focus:border-(--border-strong)"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-(--txt-secondary)">
              Model
              <select
                value={form.model}
                onChange={(event) =>
                  setForm((current) => ({ ...current, model: event.target.value }))
                }
                className="mt-1.5 w-full rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) outline-none focus:border-(--border-strong)"
              >
                <option value="gpt-5">GPT-5</option>
                <option value="gpt-5-mini">GPT-5 mini</option>
                <option value="claude-sonnet">Claude Sonnet</option>
                <option value="custom">Custom provider</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-(--txt-secondary)">
              Autonomy
              <select
                value={form.autonomyLevel}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    autonomyLevel: event.target.value as AgentAutonomyLevel,
                  }))
                }
                className="mt-1.5 w-full rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) outline-none focus:border-(--border-strong)"
              >
                {AUTONOMY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs font-normal text-(--txt-tertiary)">
                {
                  AUTONOMY_OPTIONS.find((option) => option.value === form.autonomyLevel)
                    ?.description
                }
              </span>
            </label>
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-(--txt-secondary)">Allowed tools</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {TOOL_OPTIONS.map((tool) => {
                const checked = form.tools.includes(tool.value);
                return (
                  <label
                    key={tool.value}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                      checked
                        ? 'border-(--border-accent-subtle) bg-(--bg-accent-subtle) text-(--txt-primary)'
                        : 'border-(--border-subtle) text-(--txt-secondary) hover:bg-(--bg-layer-1-hover)'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setForm((current) => ({
                          ...current,
                          tools: checked
                            ? current.tools.filter((value) => value !== tool.value)
                            : [...current.tools, tool.value],
                        }))
                      }
                      className="size-4 accent-(--brand-default)"
                    />
                    {tool.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>
      </Modal>
    </div>
  );
}
