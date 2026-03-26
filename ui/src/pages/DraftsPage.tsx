import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Avatar } from '../components/ui';
import { CreateWorkItemModal } from '../components/CreateWorkItemModal';
import { workspaceService } from '../services/workspaceService';
import { projectService } from '../services/projectService';
import { issueService } from '../services/issueService';
import { cycleService } from '../services/cycleService';
import { moduleService } from '../services/moduleService';
import { stateService } from '../services/stateService';
import { labelService } from '../services/labelService';
import type {
  WorkspaceApiResponse,
  ProjectApiResponse,
  IssueApiResponse,
  StateApiResponse,
  LabelApiResponse,
  WorkspaceMemberApiResponse,
} from '../api/types';
import type { Priority } from '../types';
import type { StateGroup } from '../types/workspaceViewFilters';
import {
  PRIORITY_ICONS,
  PRIORITY_LABELS,
  STATE_GROUP_ICONS,
} from '../components/workspace-views/WorkspaceViewsFiltersData';
import { findWorkspaceMemberByUserId, getImageUrl } from '../lib/utils';

const PAGE_SIZE = 50;

const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low', 'none'];

function formatShortDate(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Plane-style key + sequence (e.g. LOGI1). Never use placeholder em-dashes for the key. */
function projectIssueKey(proj: ProjectApiResponse | undefined, issue: IssueApiResponse): string {
  const raw = proj?.identifier?.trim();
  if (raw && raw.length > 0) return raw.toUpperCase();
  const name = proj?.name?.trim() ?? '';
  const letters = name.replace(/[^a-zA-Z0-9]/g, '');
  if (letters.length >= 4) return letters.slice(0, 4).toUpperCase();
  if (letters.length > 0) return letters.toUpperCase().padEnd(4, 'X').slice(0, 4);
  const idPart = (issue.project_id || '').replace(/-/g, '');
  return (idPart.slice(0, 4) || 'ITEM').toUpperCase();
}

function draftDisplayId(proj: ProjectApiResponse | undefined, issue: IssueApiResponse): string {
  const key = projectIssueKey(proj, issue);
  const seq = issue.sequence_id;
  return seq != null ? `${key}${seq}` : key;
}

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

const IconCalendar = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const IconUser = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconTag = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
  </svg>
);

const IconEye = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconCircleSlash = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <circle cx="12" cy="12" r="10" />
    <path d="m4.9 4.9 14.2 14.2" />
  </svg>
);

const IconMoreVertical = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <circle cx="12" cy="5" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="12" cy="19" r="1.5" />
  </svg>
);

const IconLayoutGrid = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <rect width="7" height="7" x="3" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="14" rx="1" />
    <rect width="7" height="7" x="3" y="14" rx="1" />
  </svg>
);

function stateGroupIcon(group: string | undefined) {
  const g = (group ?? 'backlog').toLowerCase() as StateGroup;
  const icon = STATE_GROUP_ICONS[g];
  return icon ?? STATE_GROUP_ICONS.backlog;
}

export function DraftsPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [drafts, setDrafts] = useState<IssueApiResponse[]>([]);
  const [statesByProject, setStatesByProject] = useState<Map<string, StateApiResponse[]>>(new Map());
  const [labelsByProject, setLabelsByProject] = useState<Map<string, LabelApiResponse[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const projectById = useMemo(() => {
    const m = new Map<string, ProjectApiResponse>();
    for (const p of projects) m.set(p.id, p);
    return m;
  }, [projects]);

  const projectIdsKey = useMemo(
    () => [...new Set(drafts.map((d) => d.project_id))].sort().join(','),
    [drafts],
  );

  useEffect(() => {
    if (!workspaceSlug || !projectIdsKey) {
      setStatesByProject(new Map());
      setLabelsByProject(new Map());
      return;
    }
    const ids = projectIdsKey.split(',').filter(Boolean);
    let cancelled = false;
    Promise.all(
      ids.map(async (pid) => {
        const [states, labels] = await Promise.all([
          stateService.list(workspaceSlug, pid),
          labelService.list(workspaceSlug, pid),
        ]);
        return { pid, states, labels };
      }),
    )
      .then((rows) => {
        if (cancelled) return;
        const sm = new Map<string, StateApiResponse[]>();
        const lm = new Map<string, LabelApiResponse[]>();
        for (const { pid, states, labels } of rows) {
          sm.set(pid, states ?? []);
          lm.set(pid, labels ?? []);
        }
        setStatesByProject(sm);
        setLabelsByProject(lm);
      })
      .catch(() => {
        if (!cancelled) {
          setStatesByProject(new Map());
          setLabelsByProject(new Map());
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectIdsKey]);

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
      workspaceService.listMembers(workspaceSlug),
    ])
      .then(([w, plist, mems]) => {
        if (cancelled) return;
        setWorkspace(w ?? null);
        setProjects(plist ?? []);
        setMembers(mems ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setWorkspace(null);
          setProjects([]);
          setMembers([]);
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

  const getUser = (userId: string | null) => {
    if (!userId) return null;
    const m = findWorkspaceMemberByUserId(members, userId);
    const display = m?.member_display_name?.trim() ?? '';
    const emailUser = m?.member_email?.trim().split('@')[0]?.trim() ?? '';
    const name = display !== '' ? display : emailUser !== '' ? emailUser : userId.slice(0, 8);
    const raw = m?.member_avatar?.trim();
    const avatarUrl = raw ? raw : null;
    return { id: userId, name, avatarUrl };
  };

  const handlePatch = async (issue: IssueApiResponse, payload: Record<string, unknown>) => {
    if (!workspaceSlug) return;
    setRowBusy(issue.id);
    try {
      const updated = await issueService.update(workspaceSlug, issue.project_id, issue.id, payload);
      setDrafts((prev) => prev.map((i) => (i.id === issue.id ? { ...i, ...updated } : i)));
    } catch {
      setError('Could not update draft.');
    } finally {
      setRowBusy(null);
    }
  };

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
    setMenuOpenId(null);
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
    setMenuOpenId(null);
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
          className="mt-6 inline-flex h-9 items-center justify-center rounded-md bg-(--bg-accent-primary) px-4 text-sm font-medium text-(--txt-on-color) no-underline hover:bg-(--bg-accent-primary-hover)"
        >
          Create project
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-(--border-subtle) px-1 pb-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-(--txt-primary)">Drafts</h1>
          <p className="mt-1 max-w-2xl text-[13px] text-(--txt-secondary)">
            Draft work items stay out of the main backlog until you publish them. Use the row controls
            like on the project board, or open the work item to edit in full.
          </p>
        </div>
        <Button variant="primary" type="button" className="shrink-0" onClick={() => setCreateOpen(true)}>
          Draft a work item
        </Button>
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
            Draft a work item
          </Button>
        </div>
      ) : (
        <div className="mt-2 rounded-md border border-(--border-subtle) bg-(--bg-surface-1)">
          <ul className="divide-y divide-(--border-subtle)">
            {drafts.map((issue) => {
              const proj = projectById.get(issue.project_id);
              const displayId = draftDisplayId(proj, issue);
              const busy = rowBusy === issue.id;
              const pri = (issue.priority ?? 'none') as Priority;
              const states = statesByProject.get(issue.project_id) ?? [];
              const labels = labelsByProject.get(issue.project_id) ?? [];
              const currentState = states.find((s) => s.id === issue.state_id);
              const stateName = currentState?.name ?? 'Backlog';
              const primaryAssigneeId =
                issue.assignee_ids && issue.assignee_ids.length > 0 ? issue.assignee_ids[0] : null;
              const assignee = getUser(primaryAssigneeId);
              const labelNames = (issue.label_ids ?? [])
                .map((id) => labels.find((l) => l.id === id)?.name)
                .filter((n): n is string => Boolean(n));
              const startStr = formatShortDate(issue.start_date);
              const dueStr = formatShortDate(issue.target_date);
              const issueUrl = `${base}/projects/${issue.project_id}/issues/${issue.id}`;

              return (
                <li key={issue.id}>
                  <div className="flex min-h-11 flex-col gap-2 py-2.5 pl-4 pr-3 lg:flex-row lg:items-center lg:gap-3">
                    <Link
                      to={issueUrl}
                      className="group flex min-w-0 flex-1 items-center gap-2 truncate text-sm no-underline"
                    >
                      <span className="shrink-0 font-medium text-(--txt-accent-primary)">{displayId}</span>
                      <span className="truncate text-(--txt-primary) group-hover:text-(--brand-default)">
                        {issue.name}
                      </span>
                    </Link>

                    <div
                      className="flex shrink-0 flex-wrap items-center gap-1.5 text-(--txt-icon-tertiary)"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* State (Plane-style dashed control) */}
                      <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-dashed border-(--border-subtle) bg-(--bg-layer-2) px-2 py-1 text-[12px] text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)">
                        <span className="flex size-3.5 shrink-0 items-center justify-center text-(--txt-icon-tertiary) [&_svg]:size-3.5">
                          {stateGroupIcon(currentState?.group)}
                        </span>
                        <select
                          className="max-w-[7rem] cursor-pointer truncate border-0 bg-transparent p-0 text-[12px] font-medium text-(--txt-primary) focus:outline-none focus:ring-0"
                          value={issue.state_id ?? ''}
                          disabled={busy || states.length === 0}
                          aria-label="State"
                          onChange={(e) => {
                            const v = e.target.value;
                            void handlePatch(issue, { state_id: v || null });
                          }}
                        >
                          {states.length === 0 ? (
                            <option value="">{stateName}</option>
                          ) : (
                            [
                              <option key="__backlog" value="">
                                Backlog
                              </option>,
                              ...states.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              )),
                            ]
                          )}
                        </select>
                      </label>

                      <span
                        className="flex size-7 items-center justify-center rounded text-(--txt-icon-tertiary) opacity-40"
                        title="Blocked (coming soon)"
                      >
                        <IconCircleSlash />
                      </span>

                      <span
                        className="flex size-7 items-center justify-center"
                        title={labelNames.length ? labelNames.join(', ') : 'Labels'}
                      >
                        {labelNames.length > 0 ? (
                          <IconTag />
                        ) : (
                          <span className="opacity-40">
                            <IconTag />
                          </span>
                        )}
                      </span>

                      <label
                        className="flex h-7 cursor-pointer items-center gap-0.5 rounded border border-(--border-subtle) bg-(--bg-layer-2) px-1.5 text-[11px] text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
                        title={startStr ?? 'Start date'}
                      >
                        <IconCalendar />
                        <input
                          type="date"
                          className="w-[108px] cursor-pointer border-0 bg-transparent p-0 text-[11px] focus:outline-none"
                          value={issue.start_date?.slice(0, 10) ?? ''}
                          disabled={busy}
                          onChange={(e) => {
                            const v = e.target.value;
                            void handlePatch(issue, { start_date: v || null });
                          }}
                        />
                      </label>

                      <label
                        className="flex h-7 cursor-pointer items-center gap-0.5 rounded border border-(--border-subtle) bg-(--bg-layer-2) px-1.5 text-[11px] text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
                        title={dueStr ?? 'Due date'}
                      >
                        <IconCalendar />
                        <input
                          type="date"
                          className="w-[108px] cursor-pointer border-0 bg-transparent p-0 text-[11px] focus:outline-none"
                          value={issue.target_date?.slice(0, 10) ?? ''}
                          disabled={busy}
                          onChange={(e) => {
                            const v = e.target.value;
                            void handlePatch(issue, { target_date: v || null });
                          }}
                        />
                      </label>

                      <div className="flex items-center gap-1">
                        <span
                          className="flex size-7 shrink-0 items-center justify-center"
                          title={assignee?.name ?? 'Unassigned'}
                        >
                          {assignee ? (
                            <Avatar
                              name={assignee.name}
                              src={getImageUrl(assignee.avatarUrl) ?? undefined}
                              size="sm"
                              className="h-6 w-6 text-[10px]"
                            />
                          ) : (
                            <IconUser />
                          )}
                        </span>
                        <select
                          className="h-7 max-w-[7rem] cursor-pointer rounded border border-(--border-subtle) bg-(--bg-layer-2) pl-1 pr-5 text-[11px] text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
                          value={primaryAssigneeId ?? ''}
                          disabled={busy}
                          aria-label="Assignee"
                          onChange={(e) => {
                            const v = e.target.value;
                            void handlePatch(issue, { assignee_ids: v ? [v] : [] });
                          }}
                        >
                          <option value="">—</option>
                          {members.map((m) => {
                            const uid = m.member_id ?? m.id;
                            const nm =
                              m.member_display_name?.trim() ||
                              m.member_email?.split('@')[0] ||
                              uid.slice(0, 8);
                            return (
                              <option key={m.id} value={uid}>
                                {nm}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div
                        className="relative flex size-7 items-center justify-center"
                        title={PRIORITY_LABELS[pri]}
                      >
                        <select
                          className="absolute inset-0 z-10 cursor-pointer opacity-0"
                          value={pri}
                          disabled={busy}
                          aria-label="Priority"
                          onChange={(e) => {
                            void handlePatch(issue, { priority: e.target.value });
                          }}
                        >
                          {PRIORITIES.map((p) => (
                            <option key={p} value={p}>
                              {PRIORITY_LABELS[p]}
                            </option>
                          ))}
                        </select>
                        <span className="pointer-events-none flex size-7 items-center justify-center rounded border border-(--border-subtle) bg-(--bg-layer-2)">
                          {PRIORITY_ICONS[pri] ?? <IconLayoutGrid />}
                        </span>
                      </div>

                      <span className="flex size-7 items-center justify-center opacity-50" title="Estimate">
                        <IconLayoutGrid />
                      </span>

                      <span className="flex size-7 items-center justify-center" title="Visibility">
                        <IconEye />
                      </span>

                      <div className="relative">
                        <button
                          type="button"
                          className="flex size-7 items-center justify-center rounded hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
                          aria-expanded={menuOpenId === issue.id}
                          aria-label="More options"
                          disabled={busy}
                          onClick={() =>
                            setMenuOpenId((id) => (id === issue.id ? null : issue.id))
                          }
                        >
                          <IconMoreVertical />
                        </button>
                        {menuOpenId === issue.id ? (
                          <div
                            className="absolute right-0 z-20 mt-1 min-w-[9rem] rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)"
                            role="menu"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              className="block w-full px-3 py-2 text-left text-[13px] text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                              onClick={() => void handlePublish(issue)}
                            >
                              Publish
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="block w-full px-3 py-2 text-left text-[13px] text-(--txt-danger-primary) hover:bg-(--bg-layer-1-hover)"
                              onClick={() => void handleDelete(issue)}
                            >
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </div>
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
