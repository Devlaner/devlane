import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Badge, Avatar, Button } from '../components/ui';
import { CreateWorkItemModal } from '../components/CreateWorkItemModal';
import { workspaceService } from '../services/workspaceService';
import { projectService } from '../services/projectService';
import { issueService } from '../services/issueService';
import { stateService } from '../services/stateService';
import { labelService } from '../services/labelService';
import { cycleService } from '../services/cycleService';
import { moduleService } from '../services/moduleService';
import type {
  WorkspaceApiResponse,
  ProjectApiResponse,
  IssueApiResponse,
  StateApiResponse,
  LabelApiResponse,
  WorkspaceMemberApiResponse,
} from '../api/types';
import type { Priority } from '../types';

const priorityVariant: Record<Priority, 'danger' | 'warning' | 'default' | 'neutral'> = {
  urgent: 'danger',
  high: 'danger',
  medium: 'warning',
  low: 'default',
  none: 'neutral',
};

const IconCalendar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const IconUser = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const IconTag = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
  </svg>
);
const IconEye = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconMoreVertical = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <circle cx="12" cy="5" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="12" cy="19" r="1.5" />
  </svg>
);
const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </svg>
);

export function IssueListPage() {
  const { workspaceSlug, projectId } = useParams<{ workspaceSlug: string; projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [issues, setIssues] = useState<IssueApiResponse[]>([]);
  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [labels, setLabels] = useState<LabelApiResponse[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [createError, setCreateError] = useState<string | null>(null);

  const refetchIssues = () => {
    if (!workspaceSlug || !projectId) return;
    issueService.list(workspaceSlug, projectId, { limit: 100 }).then(setIssues).catch(() => {});
  };

  useEffect(() => {
    if (!workspaceSlug || !projectId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      workspaceService.getBySlug(workspaceSlug),
      projectService.get(workspaceSlug, projectId),
      projectService.list(workspaceSlug),
      issueService.list(workspaceSlug, projectId, { limit: 100 }),
      stateService.list(workspaceSlug, projectId),
      labelService.list(workspaceSlug, projectId),
      workspaceService.listMembers(workspaceSlug),
    ])
      .then(([w, p, list, iss, st, lab, mem]) => {
        if (cancelled) return;
        setWorkspace(w);
        setProject(p);
        setProjects(list ?? []);
        setIssues(iss ?? []);
        setStates(st ?? []);
        setLabels(lab ?? []);
        setMembers(mem ?? []);
      })
      .catch(() => {
        if (!cancelled) setWorkspace(null); setProject(null); setProjects([]); setIssues([]); setStates([]); setLabels([]); setMembers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [workspaceSlug, projectId]);

  const getStateName = (stateId: string | null | undefined) => (stateId ? states.find((s) => s.id === stateId)?.name ?? stateId : '—');
  const getLabelNames = (labelIds: string[] = []) =>
    labelIds
      .map((id) => labels.find((l) => l.id === id)?.name)
      .filter((name): name is string => Boolean(name));
  const getUser = (userId: string | null) => {
    if (!userId) return null;
    const m = members.find((x) => x.member_id === userId);
    const display = m?.member_display_name?.trim();
    const emailUser = m?.member_email?.split('@')[0]?.trim();
    const name = display || emailUser || 'Member';
    return { id: userId, name, avatarUrl: null as string | null };
  };

  const createParam = searchParams.get('create') === '1';

  useEffect(() => {
    if (createParam && projectId) setCreateOpen(true);
  }, [createParam, projectId]);

  const handleCloseCreate = () => {
    setCreateOpen(false);
    setCreateError(null);
    searchParams.delete('create');
    setSearchParams(searchParams, { replace: true });
  };

  const handleCreateSave = async (data: {
    title: string;
    description?: string;
    projectId: string;
    stateId?: string;
    priority?: import('../types').Priority;
    assigneeIds?: string[];
    labelIds?: string[];
    startDate?: string;
    dueDate?: string;
    cycleId?: string | null;
    moduleId?: string | null;
    parentId?: string | null;
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
      });
      if (created?.id) {
        if (data.cycleId) {
          await cycleService.addIssue(workspaceSlug, data.projectId, data.cycleId, created.id);
        }
        if (data.moduleId) {
          await moduleService.addIssue(workspaceSlug, data.projectId, data.moduleId, created.id);
        }
      }
      refetchIssues();
      handleCloseCreate();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create work item');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8 text-sm text-[var(--txt-tertiary)]">Loading…</div>;
  }
  if (!workspace || !project) {
    return <div className="text-[var(--txt-secondary)]">Project not found.</div>;
  }

  const baseUrl = `/${workspace.slug}/projects/${project.id}`;

  return (
    <div className="space-y-4">
      {/* All work items N + plus */}
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--txt-primary)]">
          All work items {issues.length}
          <button
            type="button"
            className="flex size-7 items-center justify-center rounded-md text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-1-hover)] hover:text-[var(--txt-icon-secondary)]"
            aria-label="Add work item"
            onClick={() => setSearchParams({ create: '1' })}
          >
            <IconPlus />
          </button>
        </h2>
      </div>

      {/* List of work item rows */}
      <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)]">
        {issues.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 px-4 py-12">
            <p className="text-sm text-[var(--txt-tertiary)]">No work items yet.</p>
            <Button size="sm" className="gap-1.5" onClick={() => setSearchParams({ create: '1' })}>
              <IconPlus />
              New work item
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {issues.map((issue) => {
              const primaryAssigneeId = issue.assignee_ids && issue.assignee_ids.length > 0 ? issue.assignee_ids[0] : null;
              const assignee = getUser(primaryAssigneeId);
              const labelNames = getLabelNames(issue.label_ids ?? []);
              const displayId = `${project.identifier ?? project.id.slice(0, 8)}-${issue.sequence_id ?? issue.id.slice(-4)}`;
              return (
                <li key={issue.id}>
                  <Link
                    to={`${baseUrl}/issues/${issue.id}`}
                    className="flex min-h-12 items-center gap-3 px-4 py-2.5 no-underline transition-colors hover:bg-[var(--bg-layer-1-hover)]"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm">
                      <span className="font-medium text-[var(--txt-accent-primary)]">{displayId}</span>
                      <span className="ml-2 text-[var(--txt-primary)]">{issue.name}</span>
                    </span>
                    <div className="flex shrink-0 items-center gap-2 text-[var(--txt-icon-tertiary)]">
                      <span title={getStateName(issue.state_id ?? undefined)}>
                        <Badge variant="neutral" className="text-xs font-medium">
                          {getStateName(issue.state_id ?? undefined)}
                        </Badge>
                      </span>
                      <span title={issue.priority ?? ''} className="flex size-6 items-center justify-center">
                        <Badge variant={priorityVariant[(issue.priority as Priority) ?? 'none']} className="!px-1.5 !py-0 text-[10px]">
                          {issue.priority ?? '—'}
                        </Badge>
                      </span>
                      <span className="flex size-6 items-center justify-center" title="Due date">
                        <IconCalendar />
                      </span>
                      <span className="flex size-6 items-center justify-center" title={assignee?.name ?? 'Unassigned'}>
                        {assignee ? (
                          <Avatar name={assignee.name} src={assignee.avatarUrl} size="sm" className="h-6 w-6 text-[10px]" />
                        ) : (
                          <IconUser />
                        )}
                      </span>
                      <span className="flex size-6 items-center justify-center" title={labelNames.length ? labelNames.join(', ') : 'Labels'}>
                        {labelNames.length > 0 ? (
                          <IconTag />
                        ) : (
                          <span className="opacity-40"><IconTag /></span>
                        )}
                      </span>
                      <span className="flex size-6 items-center justify-center" title="Visibility">
                        <IconEye />
                      </span>
                      <button
                        type="button"
                        className="flex size-6 items-center justify-center rounded hover:bg-[var(--bg-layer-1-hover)] hover:text-[var(--txt-icon-secondary)]"
                        aria-label="More options"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
                        <IconMoreVertical />
                      </button>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {issues.length > 0 && (
          <div className="border-t border-[var(--border-subtle)] px-4 py-2.5">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-md border border-dashed border-[var(--border-subtle)] bg-transparent px-3 py-2 text-sm font-medium text-[var(--txt-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-layer-1-hover)] hover:text-[var(--txt-primary)]"
              onClick={() => setSearchParams({ create: '1' })}
            >
              <IconPlus />
              New work item
            </button>
          </div>
        )}
      </div>

      <CreateWorkItemModal
        open={createOpen}
        onClose={handleCloseCreate}
        workspaceSlug={workspace.slug}
        projects={projects}
        defaultProjectId={project.id}
        onSave={handleCreateSave}
        createError={createError}
      />
    </div>
  );
}
