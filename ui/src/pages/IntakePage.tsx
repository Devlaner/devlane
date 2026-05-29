import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '../components/ui';
import { workspaceService } from '../services/workspaceService';
import { projectService } from '../services/projectService';
import { issueService } from '../services/issueService';
import type { IssueApiResponse, ProjectApiResponse, WorkspaceApiResponse } from '../api/types';
import type { Priority } from '../types';

const priorityVariant: Record<Priority, 'danger' | 'warning' | 'default' | 'neutral'> = {
  urgent: 'danger',
  high: 'danger',
  medium: 'warning',
  low: 'default',
  none: 'neutral',
};

export function IntakePage() {
  const { workspaceSlug, projectId } = useParams<{ workspaceSlug: string; projectId: string }>();
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [drafts, setDrafts] = useState<IssueApiResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceSlug || !projectId) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
    });
    Promise.all([
      workspaceService.getBySlug(workspaceSlug),
      projectService.get(workspaceSlug, projectId),
      issueService.list(workspaceSlug, projectId, { limit: 500 }),
    ])
      .then(([w, p, issues]) => {
        if (cancelled) return;
        setWorkspace(w ?? null);
        setProject(p ?? null);
        setDrafts((issues ?? []).filter((i) => i.is_draft));
      })
      .catch(() => {
        if (!cancelled) {
          setWorkspace(null);
          setProject(null);
          setDrafts([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId]);

  const accept = async (issue: IssueApiResponse) => {
    if (!workspaceSlug || !projectId) return;
    setAccepting(issue.id);
    setError(null);
    try {
      await issueService.update(workspaceSlug, projectId, issue.id, { is_draft: false });
      setDrafts((prev) => prev.filter((i) => i.id !== issue.id));
    } catch {
      setError('Failed to accept issue.');
    }
    setAccepting(null);
  };

  const discard = async (issue: IssueApiResponse) => {
    if (!workspaceSlug || !projectId) return;
    setDiscarding(issue.id);
    setError(null);
    try {
      await issueService.delete(workspaceSlug, projectId, issue.id);
      setDrafts((prev) => prev.filter((i) => i.id !== issue.id));
    } catch {
      setError('Failed to discard issue.');
    }
    setDiscarding(null);
  };

  if (loading) return <div className="p-6 text-sm text-(--txt-tertiary)">Loading intake…</div>;
  if (!workspace || !project)
    return <div className="p-6 text-sm text-(--txt-secondary)">Project not found.</div>;

  const baseUrl = `/${workspace.slug}/projects/${project.id}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-(--txt-primary)">Intake</h1>
          <p className="text-sm text-(--txt-tertiary)">
            Draft issues waiting for triage. Accept to make active, or discard to delete.
          </p>
        </div>
        <Link
          to={`${baseUrl}/issues`}
          className="rounded-(--radius-md) px-3 py-1.5 text-sm text-(--txt-secondary) hover:bg-(--bg-layer-1-hover)"
        >
          Active issues →
        </Link>
      </div>

      {error && (
        <p className="rounded-md bg-(--bg-danger-subtle) px-3 py-2 text-sm text-(--txt-danger-primary)">
          {error}
        </p>
      )}

      {drafts.length === 0 ? (
        <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-8 text-center text-sm text-(--txt-tertiary)">
          No draft issues. The intake queue is empty.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-(--border-subtle) bg-(--bg-surface-1)">
          <table className="w-full text-left text-sm">
            <thead className="bg-(--bg-layer-1)">
              <tr>
                <th className="px-4 py-2 font-medium text-(--txt-secondary)">Work item</th>
                <th className="px-4 py-2 font-medium text-(--txt-secondary)">Priority</th>
                <th className="px-4 py-2 font-medium text-(--txt-secondary)">Created</th>
                <th className="px-4 py-2 font-medium text-(--txt-secondary)">Actions</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((issue) => (
                <tr
                  key={issue.id}
                  className="border-t border-(--border-subtle) hover:bg-(--bg-layer-1)"
                >
                  <td className="px-4 py-2">
                    <Link
                      to={`${baseUrl}/issues/${issue.id}`}
                      className="font-medium text-(--txt-primary) hover:text-(--txt-accent-primary)"
                    >
                      {project.identifier ?? project.id.slice(0, 6)}-{issue.sequence_id}{' '}
                      {issue.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    {issue.priority ? (
                      <Badge variant={priorityVariant[(issue.priority as Priority) ?? 'none']}>
                        {issue.priority}
                      </Badge>
                    ) : (
                      <span className="text-xs text-(--txt-tertiary)">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-(--txt-tertiary)">
                    {new Date(issue.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={accepting === issue.id}
                        onClick={() => accept(issue)}
                        className="rounded-(--radius-md) bg-(--bg-success-subtle) px-2 py-1 text-xs font-medium text-(--txt-success-primary) hover:opacity-90 disabled:opacity-50"
                      >
                        {accepting === issue.id ? 'Accepting…' : 'Accept'}
                      </button>
                      <button
                        type="button"
                        disabled={discarding === issue.id}
                        onClick={() => discard(issue)}
                        className="rounded-(--radius-md) bg-(--bg-danger-subtle) px-2 py-1 text-xs font-medium text-(--txt-danger-primary) hover:opacity-90 disabled:opacity-50"
                      >
                        {discarding === issue.id ? 'Discarding…' : 'Discard'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
