import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, Button } from '../components/ui';
import { CreateWorkItemModal } from '../components/CreateWorkItemModal';
import { workspaceService } from '../services/workspaceService';
import { projectService } from '../services/projectService';
import { issueService } from '../services/issueService';
import { cycleService } from '../services/cycleService';
import { moduleService } from '../services/moduleService';
import type { WorkspaceApiResponse, ProjectApiResponse, IssueApiResponse } from '../api/types';
import type { Priority } from '../types';

const PAGE_SIZE = 50;

const priorityVariant: Record<Priority, 'danger' | 'warning' | 'default' | 'neutral'> = {
  urgent: 'danger',
  high: 'danger',
  medium: 'warning',
  low: 'default',
  none: 'neutral',
};

const IconFolderPlus = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.25"
    className="text-(--txt-icon-tertiary)"
    aria-hidden
  >
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    <line x1="12" x2="12" y1="11" y2="17" />
    <line x1="9" x2="15" y1="14" y2="14" />
  </svg>
);

const IconFileDraft = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.25"
    className="text-(--txt-icon-tertiary)"
    aria-hidden
  >
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M8 13h8" />
    <path d="M8 17h6" />
  </svg>
);

export function DraftsPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [drafts, setDrafts] = useState<IssueApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const projectById = useMemo(() => {
    const m = new Map<string, ProjectApiResponse>();
    for (const p of projects) m.set(p.id, p);
    return m;
  }, [projects]);

  const loadDrafts = useCallback(
    async (reset: boolean) => {
      if (!workspaceSlug) return;
      const nextOffset = reset ? 0 : offset;
      if (reset) setListLoading(true);
      try {
        const batch = await issueService.listWorkspaceDrafts(workspaceSlug, {
          limit: PAGE_SIZE + 1,
          offset: nextOffset,
        });
        const more = batch.length > PAGE_SIZE;
        const slice = more ? batch.slice(0, PAGE_SIZE) : batch;
        setDrafts((prev) => (reset ? slice : [...prev, ...slice]));
        setHasMore(more);
        setOffset(nextOffset + slice.length);
      } catch {
        if (reset) setDrafts([]);
        setError('Could not load drafts.');
      } finally {
        if (reset) setListLoading(false);
      }
    },
    [workspaceSlug, offset],
  );

  useEffect(() => {
    if (!workspaceSlug) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      workspaceService.getBySlug(workspaceSlug),
      projectService.list(workspaceSlug),
    ])
      .then(([w, plist]) => {
        if (cancelled) return;
        setWorkspace(w ?? null);
        setProjects(plist ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setWorkspace(null);
          setProjects([]);
          setError('Could not load workspace.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  useEffect(() => {
    if (!workspaceSlug || !workspace) return;
    let cancelled = false;
    setOffset(0);
    setHasMore(false);
    setListLoading(true);
    issueService
      .listWorkspaceDrafts(workspaceSlug, { limit: PAGE_SIZE + 1, offset: 0 })
      .then((batch) => {
        if (cancelled) return;
        const more = batch.length > PAGE_SIZE;
        const slice = more ? batch.slice(0, PAGE_SIZE) : batch;
        setDrafts(slice);
        setHasMore(more);
        setOffset(slice.length);
      })
      .catch(() => {
        if (!cancelled) {
          setDrafts([]);
          setError('Could not load drafts.');
        }
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, workspace]);

  const handleCreateSave = async (data: {
    title: string;
    description?: string;
    projectId: string;
    stateId?: string;
    priority?: Priority;
    assigneeIds?: string[];
    labelIds?: string[];
    startDate?: string;
    dueDate?: string;
    cycleId?: string | null;
    moduleId?: string | null;
    parentId?: string | null;
    isDraft?: boolean;
  }) => {
    if (!workspaceSlug || !data.title.trim()) return;
    setCreateError(null);
    try {
      const created = await issueService.create(workspaceSlug, data.projectId, {
        name: data.title.trim(),
        description: data.description || undefined,
        state_id: data.stateId || undefined,
        priority: data.priority || undefined,
        assignee_ids: data.assigneeIds?.length ? data.assigneeIds : undefined,
        label_ids: data.labelIds?.length ? data.labelIds : undefined,
        start_date: data.startDate || undefined,
        target_date: data.dueDate || undefined,
        parent_id: data.parentId || undefined,
        is_draft: data.isDraft === true ? true : undefined,
      });
      if (created?.id) {
        if (data.cycleId) {
          await cycleService.addIssue(workspaceSlug, data.projectId, data.cycleId, created.id);
        }
        if (data.moduleId) {
          await moduleService.addIssue(workspaceSlug, data.projectId, data.moduleId, created.id);
        }
      }
      setCreateOpen(false);
      await loadDrafts(true);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create draft.');
    }
  };

  const handlePublish = async (issue: IssueApiResponse) => {
    if (!workspaceSlug) return;
    setRowBusy(issue.id);
    try {
      await issueService.update(workspaceSlug, issue.project_id, issue.id, { is_draft: false });
      setDrafts((prev) => prev.filter((i) => i.id !== issue.id));
    } catch {
      setError('Could not publish draft.');
    } finally {
      setRowBusy(null);
    }
  };

  const handleDelete = async (issue: IssueApiResponse) => {
    if (!workspaceSlug) return;
    if (!window.confirm(`Delete draft “${issue.name}”?`)) return;
    setRowBusy(issue.id);
    try {
      await issueService.delete(workspaceSlug, issue.project_id, issue.id);
      setDrafts((prev) => prev.filter((i) => i.id !== issue.id));
    } catch {
      setError('Could not delete draft.');
    } finally {
      setRowBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-(--txt-tertiary)">
        Loading…
      </div>
    );
  }

  if (!workspaceSlug || !workspace) {
    return <div className="text-sm text-(--txt-secondary)">Workspace not found.</div>;
  }

  const base = `/${workspace.slug}`;

  if (projects.length === 0) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center">
        <IconFolderPlus />
        <h1 className="mt-6 text-lg font-semibold text-(--txt-primary)">No projects yet</h1>
        <p className="mt-2 text-sm text-(--txt-secondary)">
          Create a project in this workspace before you can add draft work items.
        </p>
        <Link
          to={`${base}/projects`}
          className="mt-6 inline-flex h-9 items-center justify-center rounded-(--radius-md) bg-(--bg-accent-primary) px-4 text-sm font-medium text-(--txt-on-color) no-underline hover:bg-(--bg-accent-primary-hover)"
        >
          Create project
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <div className="border-b border-(--border-subtle) px-1 pb-4">
        <h1 className="text-xl font-semibold text-(--txt-primary)">Drafts</h1>
        <p className="mt-1 text-[13px] text-(--txt-secondary)">
          Draft work items stay out of the main backlog until you publish them. Open a row to edit
          details, or use Publish to move the item onto the project board.
        </p>
      </div>

      {error && (
        <p className="mt-4 text-sm text-(--txt-danger-primary)" role="alert">
          {error}
        </p>
      )}

      {listLoading && drafts.length === 0 ? (
        <div className="mt-8 flex justify-center text-sm text-(--txt-tertiary)">Loading drafts…</div>
      ) : drafts.length === 0 ? (
        <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center">
          <IconFileDraft />
          <h2 className="mt-6 text-lg font-semibold text-(--txt-primary)">No draft work items</h2>
          <p className="mt-2 text-sm text-(--txt-secondary)">
            Capture ideas as drafts and publish them into a project when you are ready.
          </p>
          <Button variant="primary" className="mt-6" type="button" onClick={() => setCreateOpen(true)}>
            Create draft work item
          </Button>
        </div>
      ) : (
        <div className="mt-2 rounded-md border border-(--border-subtle) bg-(--bg-surface-1)">
          <ul className="divide-y divide-(--border-subtle)">
            {drafts.map((issue) => {
              const proj = projectById.get(issue.project_id);
              const ident = proj?.identifier ?? '—';
              const seq = issue.sequence_id ?? '—';
              const busy = rowBusy === issue.id;
              const pri = (issue.priority ?? 'none') as Priority;
              return (
                <li key={issue.id}>
                  <div className="flex flex-col gap-2 py-3 pl-4 pr-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`${base}/projects/${issue.project_id}/issues/${issue.id}`}
                        className="group block no-underline"
                      >
                        <div className="flex flex-wrap items-center gap-2 text-[13px]">
                          <span className="font-mono text-(--txt-tertiary)">
                            {ident}-{seq}
                          </span>
                          <span className="truncate font-medium text-(--txt-primary) group-hover:text-(--brand-default)">
                            {issue.name}
                          </span>
                          {issue.priority && issue.priority !== 'none' ? (
                            <Badge variant={priorityVariant[pri] ?? 'neutral'} className="text-[11px]">
                              {issue.priority}
                            </Badge>
                          ) : null}
                        </div>
                      </Link>
                      {proj ? (
                        <p className="mt-0.5 truncate text-xs text-(--txt-tertiary)">{proj.name}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        disabled={busy}
                        onClick={() => void handlePublish(issue)}
                      >
                        Publish
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        disabled={busy}
                        onClick={() => void handleDelete(issue)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {hasMore ? (
            <div className="border-t border-(--border-subtle) p-3 text-center">
              <button
                type="button"
                className="text-[13px] font-medium text-(--brand-default) underline-offset-2 hover:underline"
                onClick={() => void loadDrafts(false)}
              >
                Load more
              </button>
            </div>
          ) : null}
        </div>
      )}

      <div className="mt-4">
        <Button variant="secondary" type="button" onClick={() => setCreateOpen(true)}>
          New draft
        </Button>
      </div>

      <CreateWorkItemModal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setCreateError(null);
        }}
        workspaceSlug={workspace.slug}
        projects={projects}
        defaultProjectId={projects[0]?.id}
        draftOnly
        createError={createError}
        onSave={handleCreateSave}
      />
    </div>
  );
}
