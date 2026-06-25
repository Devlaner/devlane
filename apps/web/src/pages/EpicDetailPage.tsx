import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, Card, CardContent, CardHeader } from '../components/ui';
import { workspaceService } from '../services/workspaceService';
import { projectService } from '../services/projectService';
import { epicService, type EpicProgress } from '../services/epicService';
import { EpicProgressBar } from '../components/work-item/EpicProgressBar';
import { issueService } from '../services/issueService';
import { stateService } from '../services/stateService';
import { safeUrl } from '../lib/sanitize';
import type {
  IssueLinkApiResponse,
  IssueApiResponse,
  ProjectApiResponse,
  StateApiResponse,
  WorkspaceApiResponse,
} from '../api/types';
import type { Priority } from '../types';

const priorityVariant: Record<Priority, 'danger' | 'warning' | 'default' | 'neutral'> = {
  urgent: 'danger',
  high: 'danger',
  medium: 'warning',
  low: 'default',
  none: 'neutral',
};

export function EpicDetailPage() {
  const { workspaceSlug, projectId, epicId } = useParams<{
    workspaceSlug: string;
    projectId: string;
    epicId: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [epic, setEpic] = useState<IssueApiResponse | null>(null);
  const [issues, setIssues] = useState<IssueApiResponse[]>([]);
  const [allIssues, setAllIssues] = useState<IssueApiResponse[]>([]);
  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [links, setLinks] = useState<IssueLinkApiResponse[]>([]);
  const [progress, setProgress] = useState<Record<string, EpicProgress>>({});
  const [addIssueSearch, setAddIssueSearch] = useState('');
  const [addIssueOpen, setAddIssueOpen] = useState(false);
  const [addLinkOpen, setAddLinkOpen] = useState(false);
  const [addLinkUrl, setAddLinkUrl] = useState('');
  const [addLinkTitle, setAddLinkTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceSlug || !projectId || !epicId) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
    });
    Promise.all([
      workspaceService.getBySlug(workspaceSlug),
      projectService.get(workspaceSlug, projectId),
      epicService.get(workspaceSlug, projectId, epicId),
      epicService.listIssues(workspaceSlug, projectId, epicId),
      issueService.list(workspaceSlug, projectId, { limit: 250 }),
      stateService.list(workspaceSlug, projectId),
      epicService.listLinks(workspaceSlug, projectId, epicId).catch(() => []),
      epicService.listProgress(workspaceSlug, projectId).catch(() => ({})),
    ])
      .then(([w, p, ep, eis, all, st, lnks, prog]) => {
        if (cancelled) return;
        setWorkspace(w ?? null);
        setProject(p ?? null);
        setEpic(ep ?? null);
        setIssues(eis ?? []);
        setAllIssues(all ?? []);
        setStates(st ?? []);
        setLinks((lnks as IssueLinkApiResponse[]) ?? []);
        setProgress((prog as Record<string, EpicProgress>) ?? {});
      })
      .catch(() => {
        if (!cancelled) {
          setWorkspace(null);
          setProject(null);
          setEpic(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, epicId]);

  const stateName = (stateId: string | null | undefined) =>
    stateId ? (states.find((s) => s.id === stateId)?.name ?? '—') : '—';

  if (loading) return <div className="p-6 text-sm text-(--txt-tertiary)">Loading epic…</div>;
  if (!workspace || !project || !epic)
    return <div className="p-6 text-sm text-(--txt-secondary)">Epic not found.</div>;

  const projectBase = `/${workspace.slug}/projects/${project.id}`;
  const candidateIssues = allIssues.filter(
    (i) =>
      !i.is_epic &&
      !issues.find((ei) => ei.id === i.id) &&
      i.id !== epic.id &&
      (addIssueSearch === '' || i.name.toLowerCase().includes(addIssueSearch.toLowerCase())),
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          to={`${projectBase}/epics`}
          className="inline-flex items-center text-sm text-(--txt-secondary) hover:text-(--txt-primary)"
        >
          ← Back to epics
        </Link>
        <h1 className="text-xl font-semibold text-(--txt-primary)">{epic.name}</h1>
        <p className="text-sm text-(--txt-secondary)">
          {project.identifier ?? project.id.slice(0, 6)}-{epic.sequence_id} ·{' '}
          {stateName(epic.state_id)} · {epic.priority ?? 'no priority'}
        </p>
        <div className="mt-2">
          <EpicProgressBar progress={epicId ? progress[epicId] : undefined} />
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-(--bg-danger-subtle) px-3 py-2 text-sm text-(--txt-danger-primary)">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Issues in this epic */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-(--txt-secondary)">
              Work items ({issues.length})
            </h2>
            <button
              type="button"
              onClick={() => setAddIssueOpen((v) => !v)}
              className="rounded-(--radius-md) px-2 py-1 text-xs text-(--txt-secondary) hover:bg-(--bg-layer-1-hover)"
            >
              + Add issue
            </button>
          </div>
          {addIssueOpen && (
            <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-3 space-y-2">
              <input
                autoFocus
                type="text"
                placeholder="Search issues…"
                value={addIssueSearch}
                onChange={(e) => setAddIssueSearch(e.target.value)}
                className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-canvas) px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-(--border-focus)"
              />
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {candidateIssues.slice(0, 20).map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-(--radius-md) px-2 py-1.5 text-left text-sm hover:bg-(--bg-layer-1-hover)"
                    onClick={async () => {
                      if (!workspaceSlug) return;
                      try {
                        await epicService.addIssue(workspaceSlug, project.id, epic.id, i.id);
                        setIssues((prev) => [...prev, i]);
                        setAddIssueOpen(false);
                      } catch {
                        setError('Failed to add issue.');
                      }
                    }}
                  >
                    <span className="shrink-0 text-[11px] font-medium text-(--txt-accent-primary)">
                      {project.identifier ?? project.id.slice(0, 6)}-{i.sequence_id}
                    </span>
                    <span className="truncate text-(--txt-primary)">{i.name}</span>
                  </button>
                ))}
                {candidateIssues.length === 0 && (
                  <p className="px-2 py-1 text-xs text-(--txt-tertiary)">No matching issues.</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setAddIssueOpen(false)}
                className="text-xs text-(--txt-tertiary) hover:text-(--txt-secondary)"
              >
                Cancel
              </button>
            </div>
          )}
          <div className="overflow-x-auto rounded-md border border-(--border-subtle) bg-(--bg-surface-1)">
            <table className="w-full text-left text-sm">
              <thead className="bg-(--bg-layer-1)">
                <tr>
                  <th className="px-4 py-2 font-medium text-(--txt-secondary)">Work item</th>
                  <th className="px-4 py-2 font-medium text-(--txt-secondary)">State</th>
                  <th className="px-4 py-2 font-medium text-(--txt-secondary)">Priority</th>
                </tr>
              </thead>
              <tbody>
                {issues.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-xs text-(--txt-tertiary)">
                      No work items yet.
                    </td>
                  </tr>
                ) : (
                  issues.map((i) => (
                    <tr key={i.id} className="border-t border-(--border-subtle)">
                      <td className="px-4 py-2">
                        <Link
                          to={`${projectBase}/issues/${i.id}`}
                          className="text-(--txt-primary) hover:text-(--txt-accent-primary)"
                        >
                          {i.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-(--txt-secondary)">{stateName(i.state_id)}</td>
                      <td className="px-4 py-2">
                        {i.priority && (
                          <Badge variant={priorityVariant[(i.priority as Priority) ?? 'none']}>
                            {i.priority}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Links sidebar */}
        <div>
          <Card>
            <CardHeader className="flex items-center justify-between text-sm font-medium text-(--txt-secondary)">
              <span>Links</span>
              <button
                type="button"
                onClick={() => {
                  setAddLinkOpen((v) => !v);
                  setAddLinkUrl('');
                  setAddLinkTitle('');
                }}
                className="rounded p-0.5 hover:bg-(--bg-layer-1-hover)"
              >
                +
              </button>
            </CardHeader>
            <CardContent className="space-y-1 pt-2">
              {addLinkOpen && (
                <form
                  className="space-y-1.5 pb-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!addLinkUrl.trim() || !workspaceSlug) return;
                    try {
                      const created = await epicService.createLink(
                        workspaceSlug,
                        project.id,
                        epic.id,
                        { url: addLinkUrl.trim(), title: addLinkTitle.trim() || undefined },
                      );
                      setLinks((prev) => [...prev, created]);
                      setAddLinkOpen(false);
                    } catch {
                      setError('Failed to add link.');
                    }
                  }}
                >
                  <input
                    type="url"
                    placeholder="https://…"
                    value={addLinkUrl}
                    onChange={(e) => setAddLinkUrl(e.target.value)}
                    required
                    className="w-full rounded border border-(--border-subtle) bg-(--bg-canvas) px-2 py-1 text-xs focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Title (optional)"
                    value={addLinkTitle}
                    onChange={(e) => setAddLinkTitle(e.target.value)}
                    className="w-full rounded border border-(--border-subtle) bg-(--bg-canvas) px-2 py-1 text-xs focus:outline-none"
                  />
                  <div className="flex gap-1">
                    <button
                      type="submit"
                      className="rounded bg-(--bg-accent-primary) px-2 py-1 text-xs text-white"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddLinkOpen(false)}
                      className="rounded px-2 py-1 text-xs text-(--txt-secondary) hover:bg-(--bg-layer-1-hover)"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
              {links.length === 0 && !addLinkOpen && (
                <p className="text-xs text-(--txt-tertiary)">No links yet.</p>
              )}
              {links.map((l) => (
                <div key={l.id} className="flex items-center gap-1 group">
                  <a
                    href={safeUrl(l.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 flex-1 truncate text-xs text-(--txt-accent-primary) hover:underline"
                  >
                    {l.title || l.url}
                  </a>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!workspaceSlug) return;
                      await epicService
                        .deleteLink(workspaceSlug, project.id, epic.id, l.id)
                        .catch(() => {});
                      setLinks((prev) => prev.filter((x) => x.id !== l.id));
                    }}
                    className="opacity-0 group-hover:opacity-100 text-xs text-(--txt-tertiary) hover:text-(--txt-danger-primary)"
                  >
                    ×
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
