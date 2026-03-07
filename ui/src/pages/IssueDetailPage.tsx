import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, Button, Card, CardContent, CardHeader, Avatar } from '../components/ui';
import { Dropdown, DatePickerTrigger, CommentEditor } from '../components/work-item';
import { workspaceService } from '../services/workspaceService';
import { projectService } from '../services/projectService';
import { issueService } from '../services/issueService';
import { stateService } from '../services/stateService';
import { labelService } from '../services/labelService';
import { cycleService } from '../services/cycleService';
import { moduleService } from '../services/moduleService';
import { recentsService } from '../services/recentsService';
import { commentService } from '../services/commentService';
import { CreateWorkItemModal } from '../components/CreateWorkItemModal';
import type {
  WorkspaceApiResponse,
  ProjectApiResponse,
  IssueApiResponse,
  StateApiResponse,
  LabelApiResponse,
  WorkspaceMemberApiResponse,
  IssueCommentApiResponse,
  CycleApiResponse,
  ModuleApiResponse,
} from '../api/types';
import type { Priority } from '../types';

const priorityVariant: Record<Priority, 'danger' | 'warning' | 'default' | 'neutral'> = {
  urgent: 'danger',
  high: 'danger',
  medium: 'warning',
  low: 'default',
  none: 'neutral',
};

const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </svg>
);
const IconTag = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
  </svg>
);
const IconUser = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const IconFlag = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M4 22V4" />
    <path d="M4 4h11l-1 5 1 5H4" />
  </svg>
);
const IconCalendar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const IconStack = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="m12 2 10 6-10 6L2 8l10-6Z" />
    <path d="m2 14 10 6 10-6" />
  </svg>
);
const IconCycle = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);

export function IssueDetailPage() {
  const { workspaceSlug, projectId, issueId } = useParams<{
    workspaceSlug: string;
    projectId: string;
    issueId: string;
  }>();
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [issue, setIssue] = useState<IssueApiResponse | null>(null);
  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [labels, setLabels] = useState<LabelApiResponse[]>([]);
  const [cycles, setCycles] = useState<CycleApiResponse[]>([]);
  const [modules, setModules] = useState<ModuleApiResponse[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [allIssues, setAllIssues] = useState<IssueApiResponse[]>([]);
  const [comments, setComments] = useState<IssueCommentApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [subCreateOpen, setSubCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [postingComment, setPostingComment] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [updatingCommentId, setUpdatingCommentId] = useState<string | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceSlug || !projectId || !issueId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      workspaceService.getBySlug(workspaceSlug),
      projectService.get(workspaceSlug, projectId),
      issueService.get(workspaceSlug, projectId, issueId),
      stateService.list(workspaceSlug, projectId),
      labelService.list(workspaceSlug, projectId),
      cycleService.list(workspaceSlug, projectId),
      moduleService.list(workspaceSlug, projectId),
      workspaceService.listMembers(workspaceSlug),
      issueService.list(workspaceSlug, projectId, { limit: 250 }),
      commentService.list(workspaceSlug, projectId, issueId),
    ])
      .then(([w, p, i, st, lab, cy, mod, mem, all, com]) => {
        if (!cancelled) {
          setWorkspace(w ?? null);
          setProject(p ?? null);
          setIssue(i ?? null);
          setStates(st ?? []);
          setLabels(lab ?? []);
          setCycles(cy ?? []);
          setModules(mod ?? []);
          setMembers(mem ?? []);
          setAllIssues(all ?? []);
          setComments(com ?? []);
          if (workspaceSlug && i) {
            recentsService
              .record(workspaceSlug, {
                entity_name: 'issue',
                entity_identifier: issueId,
                project_id: projectId,
              })
              .catch(() => {});
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWorkspace(null);
          setProject(null);
          setIssue(null);
          setStates([]);
          setLabels([]);
          setCycles([]);
          setModules([]);
          setMembers([]);
          setAllIssues([]);
          setComments([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [workspaceSlug, projectId, issueId]);

  const getStateName = (stateId: string | null | undefined) =>
    stateId ? states.find((s) => s.id === stateId)?.name ?? stateId : '—';
  const getMemberLabel = (memberId: string | null | undefined) => {
    if (!memberId) return '—';
    const m = members.find((x) => x.member_id === memberId);
    const display = m?.member_display_name?.trim();
    if (display) return display;
    const emailUser = m?.member_email?.split('@')[0]?.trim();
    if (emailUser) return emailUser;
    return 'Member';
  };

  const assigneeIds = issue?.assignee_ids ?? [];
  const labelIds = issue?.label_ids ?? [];
  const cycleIds = issue?.cycle_ids ?? [];
  const moduleIds = issue?.module_ids ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-[var(--txt-tertiary)]">
        Loading…
      </div>
    );
  }
  if (!workspace || !project || !issue) {
    return (
      <div className="text-[var(--txt-secondary)]">
        Issue not found.
      </div>
    );
  }

  const baseUrl = `/${workspace.slug}/projects/${project.id}`;
  const displayId = `${project.identifier ?? project.id.slice(0, 8)}-${issue.sequence_id ?? issue.id.slice(-4)}`;
  const descriptionHtml = issue.description_html && typeof issue.description_html === 'string'
    ? issue.description_html
    : '';

  const updateIssue = async (patch: Record<string, unknown>) => {
    if (!workspaceSlug || !projectId || !issueId) return;
    setErrorMessage(null);
    try {
      const updated = await issueService.update(workspaceSlug, projectId, issueId, patch as never);
      setIssue(updated);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update work item.');
    }
  };

  const selectedCycle = cycleIds.length ? cycles.find((c) => c.id === cycleIds[0]) ?? null : null;
  const selectedModule = moduleIds.length ? modules.find((m) => m.id === moduleIds[0]) ?? null : null;

  const children = allIssues.filter((i) => i.parent_id === issue.id);

  const handleSetCycle = async (cycleIdToSet: string | null) => {
    if (!workspaceSlug) return;
    setErrorMessage(null);
    try {
      const removals = cycleIds.map((cid) =>
        cycleService.removeIssue(workspaceSlug, project.id, cid, issue.id).catch(() => {})
      );
      await Promise.all(removals);
      if (cycleIdToSet) {
        await cycleService.addIssue(workspaceSlug, project.id, cycleIdToSet, issue.id).catch(() => {});
      }
      const refreshed = await issueService.get(workspaceSlug, project.id, issue.id).catch(() => null);
      if (refreshed) setIssue(refreshed);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update cycle.');
    }
  };

  const handleSetModule = async (moduleIdToSet: string | null) => {
    if (!workspaceSlug) return;
    setErrorMessage(null);
    try {
      const removals = moduleIds.map((mid) =>
        moduleService.removeIssue(workspaceSlug, project.id, mid, issue.id).catch(() => {})
      );
      await Promise.all(removals);
      if (moduleIdToSet) {
        await moduleService.addIssue(workspaceSlug, project.id, moduleIdToSet, issue.id).catch(() => {});
      }
      const refreshed = await issueService.get(workspaceSlug, project.id, issue.id).catch(() => null);
      if (refreshed) setIssue(refreshed);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update module.');
    }
  };

  const filteredParentOptions = allIssues.filter((i) => i.id !== issue.id);

  const parentIssue = issue.parent_id ? allIssues.find((i) => i.id === issue.parent_id) ?? null : null;

  const formatRelativeTime = (iso: string) => {
    const date = new Date(iso);
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days} day${days === 1 ? '' : 's'} ago`;
    if (hours > 0) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    if (minutes > 0) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    return 'just now';
  };

  const postComment = async (contentHtml: string) => {
    if (!workspaceSlug || !contentHtml.trim()) return;
    setErrorMessage(null);
    setPostingComment(true);
    try {
      const created = await commentService.create(workspaceSlug, project.id, issue.id, contentHtml.trim());
      setComments((prev) => [...prev, created]);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to post comment.');
    } finally {
      setPostingComment(false);
    }
  };

  const updateComment = async (commentId: string, contentHtml: string) => {
    if (!workspaceSlug || !contentHtml.trim()) return;
    setErrorMessage(null);
    setUpdatingCommentId(commentId);
    try {
      const updated = await commentService.update(
        workspaceSlug,
        project.id,
        issue.id,
        commentId,
        contentHtml.trim()
      );
      setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
      setEditingCommentId(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update comment.');
    } finally {
      setUpdatingCommentId(null);
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!workspaceSlug) return;
    const confirmed = window.confirm('Delete this comment?');
    if (!confirmed) return;
    setErrorMessage(null);
    setDeletingCommentId(commentId);
    try {
      await commentService.delete(workspaceSlug, project.id, issue.id, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete comment.');
    } finally {
      setDeletingCommentId(null);
    }
  };

  return (
    <div className="space-y-6">
      {errorMessage && (
        <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] px-3 py-2 text-xs text-[var(--txt-danger-primary)]">
          {errorMessage}
        </div>
      )}
      <div className="flex items-center gap-2 text-sm text-[var(--txt-tertiary)]">
        <Link to={baseUrl} className="text-[var(--txt-accent-primary)] hover:underline">
          {project.name}
        </Link>
        <span>/</span>
        <Link to={`${baseUrl}/issues`} className="text-[var(--txt-accent-primary)] hover:underline">
          Issues
        </Link>
        <span>/</span>
        <span className="text-[var(--txt-secondary)]">{displayId}</span>
      </div>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-[var(--txt-primary)]">
            {issue.name}
          </h1>
          <p className="mt-1 text-xs text-[var(--txt-tertiary)]">
            Last edited {new Date(issue.updated_at).toLocaleDateString()}
          </p>
        </div>
        <div className="shrink-0">
          <Button size="sm" className="gap-1.5" onClick={() => setSubCreateOpen(true)}>
            <IconPlus />
            Add sub-work item
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="text-sm font-medium text-[var(--txt-secondary)]">
              Description
            </CardHeader>
            <CardContent>
              {descriptionHtml ? (
                <div
                  className="prose prose-sm max-w-none text-[var(--txt-primary)]"
                  dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                />
              ) : (
                <p className="text-sm text-[var(--txt-tertiary)]">
                  Click to add description.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <span className="text-sm font-medium text-[var(--txt-secondary)]">Activity</span>
              <span className="text-xs text-[var(--txt-tertiary)]">Comments {comments.length}</span>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-2 text-sm">
                  <Avatar name={getMemberLabel(issue.created_by_id)} src={null} size="sm" className="mt-0.5 h-7 w-7 text-[10px]" />
                  <div className="min-w-0">
                    <p className="text-[var(--txt-secondary)]">
                      <span className="font-medium text-[var(--txt-primary)]">{getMemberLabel(issue.created_by_id)}</span>{' '}
                      created this work item.
                      <span className="ml-2 text-xs text-[var(--txt-tertiary)]">{new Date(issue.created_at).toLocaleDateString()}</span>
                    </p>
                  </div>
                </div>

                {comments.length === 0 ? (
                  <p className="text-sm text-[var(--txt-tertiary)]">No comments yet.</p>
                ) : (
                  comments.map((c) => {
                    const isEditing = editingCommentId === c.id;
                    return (
                      <div key={c.id} className="flex flex-col gap-2 text-sm">
                        <div className="flex items-start gap-2">
                          <Avatar
                            name={getMemberLabel(c.created_by_id)}
                            src={null}
                            size="sm"
                            className="mt-0.5 h-7 w-7 text-[10px]"
                          />
                          <div className="min-w-0 flex-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-[var(--txt-secondary)]">
                                {getMemberLabel(c.created_by_id)}
                              </span>
                              <div className="flex items-center gap-2 text-[11px] text-[var(--txt-tertiary)]">
                                <span>{formatRelativeTime(c.created_at)}</span>
                                <button
                                  type="button"
                                  className="hover:text-[var(--txt-secondary)]"
                                  onClick={() => setEditingCommentId(c.id)}
                                  disabled={updatingCommentId === c.id || deletingCommentId === c.id}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="hover:text-[var(--txt-secondary)]"
                                  onClick={() => void deleteComment(c.id)}
                                  disabled={deletingCommentId === c.id || updatingCommentId === c.id}
                                >
                                  {deletingCommentId === c.id ? 'Deleting…' : 'Delete'}
                                </button>
                              </div>
                            </div>
                            {isEditing ? (
                              <div className="mt-2">
                                <CommentEditor
                                  initialHtml={c.comment}
                                  onSubmit={(html) => void updateComment(c.id, html)}
                                  isSubmitting={updatingCommentId === c.id}
                                  onCancel={() => setEditingCommentId(null)}
                                  showShortcutHint
                                  autoFocus
                                />
                              </div>
                            ) : (
                              <div
                                className="mt-1 prose prose-sm max-w-none text-[var(--txt-primary)]"
                                dangerouslySetInnerHTML={{ __html: c.comment }}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <CommentEditor onSubmit={postComment} isSubmitting={postingComment} showShortcutHint />
            </CardContent>
          </Card>

          {children.length > 0 && (
            <Card>
              <CardHeader className="text-sm font-medium text-[var(--txt-secondary)]">
                Sub-work items
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {children.map((ch) => (
                    <li key={ch.id}>
                      <Link to={`${baseUrl}/issues/${ch.id}`} className="text-sm text-[var(--txt-accent-primary)] hover:underline">
                        {ch.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="text-sm font-medium text-[var(--txt-secondary)]">
              Properties
            </CardHeader>
            <CardContent className="space-y-3 pt-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--txt-secondary)]">State</span>
                <Dropdown
                  id="state"
                  openId={openDropdown}
                  onOpen={setOpenDropdown}
                  label="State"
                  icon={<IconStack />}
                  displayValue={getStateName(issue.state_id ?? undefined)}
                  compact
                  align="right"
                >
                  {states.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--bg-layer-1-hover)]"
                      onClick={() => {
                        setOpenDropdown(null);
                        updateIssue({ state_id: s.id });
                      }}
                    >
                      <span className="truncate text-[var(--txt-primary)]">{s.name}</span>
                      {issue.state_id === s.id && <span className="text-xs text-[var(--txt-tertiary)]">Selected</span>}
                    </button>
                  ))}
                </Dropdown>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--txt-secondary)]">Assignees</span>
                <Dropdown
                  id="assignees"
                  openId={openDropdown}
                  onOpen={setOpenDropdown}
                  label="Assignees"
                  icon={<IconUser />}
                  displayValue={assigneeIds.length ? `${assigneeIds.length} selected` : 'Unassigned'}
                  compact
                  align="right"
                  panelClassName="max-h-72 min-w-[220px] overflow-auto rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] py-1 shadow-[var(--shadow-raised)]"
                >
                  {members.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-[var(--txt-tertiary)]">No members.</div>
                  ) : (
                    members.map((m) => {
                      const checked = assigneeIds.includes(m.member_id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--bg-layer-1-hover)]"
                          onClick={() => {
                            const next = checked
                              ? assigneeIds.filter((x) => x !== m.member_id)
                              : [...assigneeIds, m.member_id];
                            updateIssue({ assignee_ids: next });
                          }}
                        >
                          <span className="inline-flex size-4 items-center justify-center rounded border border-[var(--border-subtle)] text-[10px] text-[var(--txt-tertiary)]">
                            {checked ? '✓' : ''}
                          </span>
                      <span className="truncate text-[var(--txt-primary)]">{getMemberLabel(m.member_id)}</span>
                        </button>
                      );
                    })
                  )}
                </Dropdown>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--txt-secondary)]">Priority</span>
                <Dropdown
                  id="priority"
                  openId={openDropdown}
                  onOpen={setOpenDropdown}
                  label="Priority"
                  icon={<IconFlag />}
                  displayValue={issue.priority ?? 'none'}
                  compact
                  align="right"
                >
                  {(['urgent', 'high', 'medium', 'low', 'none'] as Priority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--bg-layer-1-hover)]"
                      onClick={() => {
                        setOpenDropdown(null);
                        updateIssue({ priority: p });
                      }}
                    >
                      <span className="truncate text-[var(--txt-primary)]">{p}</span>
                      <Badge variant={priorityVariant[p]} className="text-[10px]">
                        {p}
                      </Badge>
                    </button>
                  ))}
                </Dropdown>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--txt-secondary)]">Created by</span>
                <span className="text-[var(--txt-tertiary)]">{getMemberLabel(issue.created_by_id)}</span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--txt-secondary)]">Start date</span>
                <DatePickerTrigger
                  label="Start date"
                  icon={<IconCalendar />}
                  value={issue.start_date ?? ''}
                  placeholder="Add start date"
                  onChange={(v) => updateIssue({ start_date: v })}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--txt-secondary)]">Due date</span>
                <DatePickerTrigger
                  label="Due date"
                  icon={<IconCalendar />}
                  value={issue.target_date ?? ''}
                  placeholder="Add due date"
                  onChange={(v) => updateIssue({ target_date: v })}
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--txt-secondary)]">Modules</span>
                <Dropdown
                  id="module"
                  openId={openDropdown}
                  onOpen={setOpenDropdown}
                  label="Modules"
                  icon={<IconStack />}
                  displayValue={selectedModule?.name ?? 'No module'}
                  compact
                  align="right"
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--bg-layer-1-hover)]"
                    onClick={() => {
                      setOpenDropdown(null);
                      handleSetModule(null);
                    }}
                  >
                    No module
                  </button>
                  {modules.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--bg-layer-1-hover)]"
                      onClick={() => {
                        setOpenDropdown(null);
                        handleSetModule(m.id);
                      }}
                    >
                      <span className="truncate">{m.name}</span>
                      {moduleIds.includes(m.id) && <span className="text-xs text-[var(--txt-tertiary)]">Selected</span>}
                    </button>
                  ))}
                </Dropdown>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--txt-secondary)]">Cycle</span>
                <Dropdown
                  id="cycle"
                  openId={openDropdown}
                  onOpen={setOpenDropdown}
                  label="Cycle"
                  icon={<IconCycle />}
                  displayValue={selectedCycle?.name ?? 'No cycle'}
                  compact
                  align="right"
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--bg-layer-1-hover)]"
                    onClick={() => {
                      setOpenDropdown(null);
                      handleSetCycle(null);
                    }}
                  >
                    No cycle
                  </button>
                  {cycles.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--bg-layer-1-hover)]"
                      onClick={() => {
                        setOpenDropdown(null);
                        handleSetCycle(c.id);
                      }}
                    >
                      <span className="truncate">{c.name}</span>
                      {cycleIds.includes(c.id) && <span className="text-xs text-[var(--txt-tertiary)]">Selected</span>}
                    </button>
                  ))}
                </Dropdown>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--txt-secondary)]">Parent</span>
                <Dropdown
                  id="parent"
                  openId={openDropdown}
                  onOpen={setOpenDropdown}
                  label="Parent"
                  icon={<IconStack />}
                  displayValue={parentIssue ? parentIssue.name : 'Add parent work item'}
                  compact
                  align="right"
                  panelClassName="max-h-72 min-w-[260px] overflow-auto rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] py-1 shadow-[var(--shadow-raised)]"
                >
                  {filteredParentOptions.slice(0, 200).map((pi) => (
                    <button
                      key={pi.id}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--bg-layer-1-hover)]"
                      onClick={() => {
                        setOpenDropdown(null);
                        updateIssue({ parent_id: pi.id });
                      }}
                    >
                      <span className="truncate text-[var(--txt-primary)]">{pi.name}</span>
                    </button>
                  ))}
                </Dropdown>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--txt-secondary)]">Labels</span>
                <Dropdown
                  id="labels"
                  openId={openDropdown}
                  onOpen={setOpenDropdown}
                  label="Labels"
                  icon={<IconTag />}
                  displayValue={labelIds.length ? `${labelIds.length} selected` : 'Select label'}
                  compact
                  align="right"
                  panelClassName="max-h-72 min-w-[220px] overflow-auto rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] py-1 shadow-[var(--shadow-raised)]"
                >
                  {labels.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-[var(--txt-tertiary)]">No labels.</div>
                  ) : (
                    labels.map((l) => {
                      const checked = labelIds.includes(l.id);
                      return (
                        <button
                          key={l.id}
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--bg-layer-1-hover)]"
                          onClick={() => {
                            const next = checked ? labelIds.filter((x) => x !== l.id) : [...labelIds, l.id];
                            updateIssue({ label_ids: next });
                          }}
                        >
                          <span className="inline-flex size-4 items-center justify-center rounded border border-[var(--border-subtle)] text-[10px] text-[var(--txt-tertiary)]">
                            {checked ? '✓' : ''}
                          </span>
                          <span className="truncate text-[var(--txt-primary)]">{l.name}</span>
                        </button>
                      );
                    })
                  )}
                </Dropdown>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <CreateWorkItemModal
        open={subCreateOpen}
        onClose={() => { setSubCreateOpen(false); setCreateError(null); }}
        workspaceSlug={workspace.slug}
        projects={[{
          id: project.id,
          workspaceId: project.workspace_id,
          name: project.name,
          identifier: project.identifier ?? project.id.slice(0, 8),
          description: project.description ?? null,
        }]}
        defaultProjectId={project.id}
        createError={createError}
        onSave={async (data) => {
          if (!workspaceSlug) return;
          setCreateError(null);
          try {
            const created = await issueService.create(workspaceSlug, project.id, {
              name: data.title.trim(),
              description: data.description || undefined,
              state_id: data.stateId || undefined,
              priority: data.priority,
              assignee_ids: data.assigneeIds?.length ? data.assigneeIds : undefined,
              label_ids: data.labelIds?.length ? data.labelIds : undefined,
              start_date: data.startDate || undefined,
              target_date: data.dueDate || undefined,
              parent_id: issue.id,
            });
            if (data.cycleId) {
              await cycleService.addIssue(workspaceSlug, project.id, data.cycleId, created.id).catch(() => {});
            }
            if (data.moduleId) {
              await moduleService.addIssue(workspaceSlug, project.id, data.moduleId, created.id).catch(() => {});
            }
            const refreshedAll = await issueService.list(workspaceSlug, project.id, { limit: 250 }).catch(() => null);
            if (refreshedAll) setAllIssues(refreshedAll);
            setSubCreateOpen(false);
          } catch (err) {
            setCreateError(err instanceof Error ? err.message : 'Failed to create sub-work item');
          }
        }}
      />
    </div>
  );
}
