import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, CardContent } from '../components/ui';
import { workspaceService } from '../services/workspaceService';
import { projectService } from '../services/projectService';
import { epicService } from '../services/epicService';
import { stateService } from '../services/stateService';
import type {
  IssueApiResponse,
  ProjectApiResponse,
  StateApiResponse,
  WorkspaceApiResponse,
} from '../api/types';

export function EpicsPage() {
  const { workspaceSlug, projectId } = useParams<{ workspaceSlug: string; projectId: string }>();
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [epics, setEpics] = useState<IssueApiResponse[]>([]);
  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceSlug || !projectId) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
    });
    Promise.all([
      workspaceService.getBySlug(workspaceSlug),
      projectService.get(workspaceSlug, projectId),
      epicService.list(workspaceSlug, projectId),
      stateService.list(workspaceSlug, projectId),
    ])
      .then(([w, p, eps, st]) => {
        if (cancelled) return;
        setWorkspace(w ?? null);
        setProject(p ?? null);
        setEpics(eps ?? []);
        setStates(st ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setWorkspace(null);
          setProject(null);
          setEpics([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId]);

  const stateName = (stateId: string | null | undefined) =>
    stateId ? (states.find((s) => s.id === stateId)?.name ?? '—') : '—';

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim() || !workspaceSlug || !projectId) return;
    setCreating(true);
    setError(null);
    try {
      const created = await epicService.create(workspaceSlug, projectId, {
        name: createName.trim(),
      });
      setEpics((prev) => [...prev, created]);
      setCreateOpen(false);
      setCreateName('');
    } catch {
      setError('Failed to create epic.');
    }
    setCreating(false);
  };

  if (loading) return <div className="p-6 text-sm text-(--txt-tertiary)">Loading epics…</div>;
  if (!workspace || !project)
    return <div className="p-6 text-sm text-(--txt-secondary)">Project not found.</div>;

  const baseUrl = `/${workspace.slug}/projects/${project.id}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-(--txt-primary)">Epics</h1>
        <Button size="sm" onClick={() => setCreateOpen((v) => !v)}>
          + New epic
        </Button>
      </div>

      {createOpen && (
        <Card>
          <CardContent className="pt-4">
            <form onSubmit={handleCreate} className="space-y-2">
              <input
                autoFocus
                type="text"
                placeholder="Epic name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                required
                className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-canvas) px-3 py-1.5 text-sm text-(--txt-primary) focus:outline-none focus:ring-1 focus:ring-(--border-focus)"
              />
              {error && <p className="text-xs text-(--txt-danger-primary)">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={creating}>
                  {creating ? 'Creating…' : 'Create'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setCreateOpen(false);
                    setCreateName('');
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {epics.length === 0 ? (
        <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-8 text-center text-sm text-(--txt-tertiary)">
          No epics yet. Create one to group related work.
        </div>
      ) : (
        <div className="space-y-2">
          {epics.map((epic) => (
            <Card key={epic.id} className="hover:border-(--border-hover) transition-colors">
              <CardContent className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <Link
                    to={`${baseUrl}/epics/${epic.id}`}
                    className="block font-medium text-(--txt-primary) hover:text-(--txt-accent-primary)"
                  >
                    {epic.name}
                  </Link>
                  <p className="text-xs text-(--txt-tertiary)">
                    {project.identifier ?? project.id.slice(0, 6)}-{epic.sequence_id} ·{' '}
                    {stateName(epic.state_id)} · {epic.priority ?? 'no priority'}
                  </p>
                </div>
                <Link
                  to={`${baseUrl}/epics/${epic.id}`}
                  className="shrink-0 rounded-(--radius-md) px-2 py-1 text-xs text-(--txt-secondary) hover:bg-(--bg-layer-1-hover)"
                >
                  Open →
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
