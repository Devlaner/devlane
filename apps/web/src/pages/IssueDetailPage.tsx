import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { Archive, ArchiveRestore, Layers } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, Avatar } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { Dropdown, DatePickerTrigger, CommentEditor } from '../components/work-item';
import { sanitizeHtml } from '../lib/sanitize';
import { DescriptionEditor } from '../components/work-item/DescriptionEditor';
import { DescriptionHistoryModal } from '../components/work-item/DescriptionHistoryModal';
import { IssueReactions } from '../components/work-item/IssueReactions';
import { IssueActivityFeed } from '../components/work-item/IssueActivityFeed';
import { CommentReactions } from '../components/work-item/CommentReactions';
import { workspaceService } from '../services/workspaceService';
import { projectService } from '../services/projectService';
import { issueService } from '../services/issueService';
import { stateService } from '../services/stateService';
import { labelService } from '../services/labelService';
import { cycleService } from '../services/cycleService';
import { moduleService } from '../services/moduleService';
import { estimateService } from '../services/estimateService';
import { recentsService } from '../services/recentsService';
import { commentService } from '../services/commentService';
import { CreateWorkItemModal } from '../components/CreateWorkItemModal';
import { IssuePRSidebar } from '../components/work-item/IssuePRSidebar';
import { IssueLinksPanel } from '../components/work-item/IssueLinksPanel';
import { IssueRelationsPanel } from '../components/work-item/IssueRelationsPanel';
import { IssueAttachmentsPanel } from '../components/work-item/IssueAttachmentsPanel';
import { MoveWorkItemModal } from '../components/work-item/MoveWorkItemModal';
import { SubscribeButton } from '../components/notifications/SubscribeButton';
import {
  PriorityIcon,
  StatePill,
  WorkItemAvatarGroup,
} from '../components/work-item/IssueRowCells';
import {
  PropertyRow,
  IconPlus,
  IconTag,
  IconUser,
  IconFlag,
  IconCalendar,
  IconStack,
  IconCycle,
  IconType,
  IconEstimate,
  CommentLockIcon,
  BotGitHubIcon,
  WORK_ITEM_TYPES,
} from '../components/work-item/issue-detail-icons';
import { membersFromAssigneeIds } from '../lib/issueRowHelpers';
import { getImageUrl } from '../lib/utils';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import type {
  WorkspaceApiResponse,
  ProjectApiResponse,
  IssueApiResponse,
  StateApiResponse,
  LabelApiResponse,
  WorkspaceMemberApiResponse,
  IssueCommentApiResponse,
  IssueActivityApiResponse,
  CycleApiResponse,
  ModuleApiResponse,
  EstimateApiResponse,
  IssueLinkApiResponse,
  IssueRelationApiResponse,
  IssueAttachmentApiResponse,
} from '../api/types';
import type { Priority } from '../types';

/**
 * Shared trigger style for the Properties sidebar dropdowns. Borderless +
 * background-on-hover so each row reads like a "value" rather than a button —
 * the transparent-with-text variant. Content-width so the row's `justify-end`
 * can right-align it.
 */
const GHOST_TRIGGER =
  'inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-(--radius-md) px-2 py-1.5 text-xs text-(--txt-secondary) hover:bg-(--bg-layer-1-hover)';

export function IssueDetailPage() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const { workspaceSlug, projectId, issueId } = useParams<{
    workspaceSlug: string;
    projectId: string;
    issueId: string;
  }>();
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [issue, setIssue] = useState<IssueApiResponse | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [labels, setLabels] = useState<LabelApiResponse[]>([]);
  const [cycles, setCycles] = useState<CycleApiResponse[]>([]);
  const [modules, setModules] = useState<ModuleApiResponse[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [estimates, setEstimates] = useState<EstimateApiResponse[]>([]);
  const [allIssues, setAllIssues] = useState<IssueApiResponse[]>([]);
  const [comments, setComments] = useState<IssueCommentApiResponse[]>([]);
  const [activities, setActivities] = useState<IssueActivityApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [subCreateOpen, setSubCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [postingComment, setPostingComment] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [updatingCommentId, setUpdatingCommentId] = useState<string | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  // Workflow confirmation
  const [pendingStateId, setPendingStateId] = useState<string | null>(null);
  // Links
  const [links, setLinks] = useState<IssueLinkApiResponse[]>([]);
  // Relations
  const [relations, setRelations] = useState<IssueRelationApiResponse>({
    blocking: [],
    blocked_by: [],
    duplicate: [],
    relates_to: [],
  });
  // Attachments
  const [attachments, setAttachments] = useState<IssueAttachmentApiResponse[]>([]);

  const workItemTitle = t('workItem.detail.documentTitle', 'Work item');
  useDocumentTitle(loading ? workItemTitle : (issue?.name ?? workItemTitle));

  useEffect(() => {
    if (!workspaceSlug || !projectId) return;
    let cancelled = false;
    estimateService
      .list(workspaceSlug, projectId)
      .then((list) => {
        if (!cancelled) setEstimates(list);
      })
      .catch(() => {
        if (!cancelled) setEstimates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId]);

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
      issueService
        .listActivities(workspaceSlug, projectId, issueId)
        .catch(() => [] as IssueActivityApiResponse[]),
      issueService.listLinks(workspaceSlug, projectId, issueId).catch(() => []),
      issueService
        .listRelations(workspaceSlug, projectId, issueId)
        .catch(() => ({ blocking: [], blocked_by: [], duplicate: [], relates_to: [] })),
      issueService.listAttachments(workspaceSlug, projectId, issueId).catch(() => []),
    ])
      .then(([w, p, i, st, lab, cy, mod, mem, all, com, acts, lnks, rels, atts]) => {
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
          setActivities(acts ?? []);
          setLinks((lnks as IssueLinkApiResponse[]) ?? []);
          setRelations(
            (rels as IssueRelationApiResponse) ?? {
              blocking: [],
              blocked_by: [],
              duplicate: [],
              relates_to: [],
            },
          );
          setAttachments((atts as IssueAttachmentApiResponse[]) ?? []);
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
          setActivities([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, issueId]);

  const getMemberLabel = (memberId: string | null | undefined) => {
    if (!memberId) return '—';
    const m = members.find((x) => x.member_id === memberId);
    const display = m?.member_display_name?.trim();
    if (display) return display;
    const emailUser = m?.member_email?.split('@')[0]?.trim();
    if (emailUser) return emailUser;
    return t('common.member', 'Member');
  };
  const getMemberAvatar = (memberId: string | null | undefined): string | null => {
    if (!memberId) return null;
    const m = members.find((x) => x.member_id === memberId);
    const raw = m?.member_avatar?.trim();
    return raw ? raw : null;
  };
  const mentionMembers = members.map((m) => ({
    id: m.member_id,
    label:
      m.member_display_name?.trim() ||
      m.member_email?.split('@')[0]?.trim() ||
      t('common.member', 'Member'),
  }));

  const assigneeIds = issue?.assignee_ids ?? [];
  const labelIds = issue?.label_ids ?? [];
  const cycleIds = issue?.cycle_ids ?? [];
  const moduleIds = issue?.module_ids ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-(--txt-tertiary)">
        {t('common.loading', 'Loading…')}
      </div>
    );
  }
  if (!workspace || !project || !issue) {
    return (
      <div className="text-(--txt-secondary)">
        {t('workItem.detail.issueNotFound', 'Issue not found.')}
      </div>
    );
  }

  const baseUrl = `/${workspace.slug}/projects/${project.id}`;
  const displayId = `${project.identifier ?? project.id.slice(0, 8)}-${issue.sequence_id ?? issue.id.slice(-4)}`;

  const handleArchive = async () => {
    if (!workspaceSlug || !projectId || !issueId) return;
    if (
      !window.confirm(
        t(
          'workItem.detail.archiveConfirm',
          'Archive this work item? It will be hidden from active lists.',
        ),
      )
    )
      return;
    try {
      await issueService.archive(workspaceSlug, projectId, issueId);
      navigate(`${baseUrl}/issues`);
    } catch {
      setErrorMessage(t('workItem.detail.archiveFailed', 'Failed to archive work item.'));
    }
  };

  const handleRestore = async () => {
    if (!workspaceSlug || !projectId || !issueId) return;
    try {
      await issueService.restore(workspaceSlug, projectId, issueId);
      setIssue((prev) => (prev ? { ...prev, archived_at: null } : prev));
    } catch {
      setErrorMessage(t('workItem.detail.restoreFailed', 'Failed to restore work item.'));
    }
  };

  const handleConvertToEpic = async () => {
    if (!workspaceSlug || !projectId || !issueId) return;
    if (
      !window.confirm(
        t(
          'workItem.detail.convertEpicConfirm',
          'Convert this work item to an epic? It will be detached from its parent, if any.',
        ),
      )
    )
      return;
    try {
      await issueService.convert(workspaceSlug, projectId, issueId, true);
      navigate(`${baseUrl}/epics/${issueId}`);
    } catch {
      setErrorMessage(t('workItem.detail.convertEpicFailed', 'Failed to convert to epic.'));
    }
  };

  const descriptionHtml =
    issue.description_html && typeof issue.description_html === 'string'
      ? issue.description_html
      : '';

  const updateIssue = async (patch: Record<string, unknown>) => {
    if (!workspaceSlug || !projectId || !issueId) return;
    setErrorMessage(null);
    try {
      const updated = await issueService.update(workspaceSlug, projectId, issueId, patch as never);
      setIssue(updated);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : t('workItem.detail.updateFailed', 'Failed to update work item.'),
      );
    }
  };

  const selectedCycle = cycleIds.length ? (cycles.find((c) => c.id === cycleIds[0]) ?? null) : null;
  const selectedModules = moduleIds
    .map((id) => modules.find((m) => m.id === id))
    .filter((m): m is ModuleApiResponse => Boolean(m));
  const currentState = issue.state_id
    ? (states.find((s) => s.id === issue.state_id) ?? null)
    : null;
  const issueAssignees = membersFromAssigneeIds(members, assigneeIds);
  const selectedLabels = labelIds
    .map((id) => labels.find((l) => l.id === id))
    .filter((l): l is LabelApiResponse => Boolean(l));
  const createdByMember = issue.created_by_id
    ? members.find((m) => m.member_id === issue.created_by_id)
    : null;

  const children = allIssues.filter((i) => i.parent_id === issue.id);

  const handleSetCycle = async (cycleIdToSet: string | null) => {
    if (!workspaceSlug) return;
    setErrorMessage(null);
    try {
      const removals = cycleIds.map((cid) =>
        cycleService.removeIssue(workspaceSlug, project.id, cid, issue.id).catch(() => {}),
      );
      await Promise.all(removals);
      if (cycleIdToSet) {
        await cycleService
          .addIssue(workspaceSlug, project.id, cycleIdToSet, issue.id)
          .catch(() => {});
      }
      const refreshed = await issueService
        .get(workspaceSlug, project.id, issue.id)
        .catch(() => null);
      if (refreshed) setIssue(refreshed);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : t('workItem.detail.updateCycleFailed', 'Failed to update cycle.'),
      );
    }
  };

  const handleSetModule = async (moduleIdToSet: string | null) => {
    if (!workspaceSlug) return;
    setErrorMessage(null);
    try {
      const removals = moduleIds.map((mid) =>
        moduleService.removeIssue(workspaceSlug, project.id, mid, issue.id).catch(() => {}),
      );
      await Promise.all(removals);
      if (moduleIdToSet) {
        await moduleService
          .addIssue(workspaceSlug, project.id, moduleIdToSet, issue.id)
          .catch(() => {});
      }
      const refreshed = await issueService
        .get(workspaceSlug, project.id, issue.id)
        .catch(() => null);
      if (refreshed) setIssue(refreshed);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : t('workItem.detail.updateModuleFailed', 'Failed to update module.'),
      );
    }
  };

  const filteredParentOptions = allIssues.filter((i) => i.id !== issue.id);

  const parentIssue = issue.parent_id
    ? (allIssues.find((i) => i.id === issue.parent_id) ?? null)
    : null;

  const formatRelativeTime = (iso: string) => {
    const date = new Date(iso);
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return t('common.time.daysAgo', '{{count}} day ago', { count: days });
    if (hours > 0) return t('common.time.hoursAgo', '{{count}} hour ago', { count: hours });
    if (minutes > 0) return t('common.time.minutesAgo', '{{count}} minute ago', { count: minutes });
    return t('common.time.justNow', 'just now');
  };

  const postComment = async (
    contentHtml: string,
    access: 'INTERNAL' | 'EXTERNAL' = 'INTERNAL',
  ): Promise<boolean> => {
    if (!workspaceSlug || !contentHtml.trim()) return false;
    setErrorMessage(null);
    setPostingComment(true);
    try {
      const created = await commentService.create(
        workspaceSlug,
        project.id,
        issue.id,
        contentHtml.trim(),
        access,
      );
      setComments((prev) => [...prev, created]);
      return true;
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : t('workItem.detail.postCommentFailed', 'Failed to post comment.'),
      );
      return false;
    } finally {
      setPostingComment(false);
    }
  };

  const updateComment = async (commentId: string, contentHtml: string): Promise<boolean> => {
    if (!workspaceSlug || !contentHtml.trim()) return false;
    setErrorMessage(null);
    setUpdatingCommentId(commentId);
    try {
      const updated = await commentService.update(
        workspaceSlug,
        project.id,
        issue.id,
        commentId,
        contentHtml.trim(),
      );
      setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
      setEditingCommentId(null);
      return true;
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : t('workItem.detail.updateCommentFailed', 'Failed to update comment.'),
      );
      return false;
    } finally {
      setUpdatingCommentId(null);
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!workspaceSlug) return;
    const confirmed = window.confirm(
      t('workItem.detail.deleteCommentConfirm', 'Delete this comment?'),
    );
    if (!confirmed) return;
    setErrorMessage(null);
    setDeletingCommentId(commentId);
    try {
      await commentService.delete(workspaceSlug, project.id, issue.id, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : t('workItem.detail.deleteCommentFailed', 'Failed to delete comment.'),
      );
    } finally {
      setDeletingCommentId(null);
    }
  };

  // Estimate picker: offer the project's active estimate's points; resolve the
  // currently-selected point across all estimates so it renders even if it
  // belongs to a since-deactivated system.
  const activeEstimate = estimates.find((e) => e.last_used) ?? estimates[0] ?? null;
  const estimatePoints = activeEstimate?.points ?? [];
  const currentEstimatePoint =
    estimates.flatMap((e) => e.points).find((p) => p.id === issue.estimate_point_id) ?? null;

  return (
    <div className="space-y-6">
      {errorMessage && (
        <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-xs text-(--txt-danger-primary)">
          {errorMessage}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 text-sm text-(--txt-tertiary)">
        <div className="flex min-w-0 items-center gap-2">
          <Link to={baseUrl} className="text-(--txt-accent-primary) hover:underline">
            {project.name}
          </Link>
          <span>/</span>
          <Link to={`${baseUrl}/issues`} className="text-(--txt-accent-primary) hover:underline">
            {t('workItem.detail.issuesBreadcrumb', 'Issues')}
          </Link>
          <span>/</span>
          <span className="text-(--txt-secondary)">{displayId}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!issue.is_epic && !issue.archived_at ? (
            <button
              type="button"
              onClick={() => void handleConvertToEpic()}
              className="inline-flex shrink-0 items-center gap-1 rounded-(--radius-md) border border-(--border-subtle) px-2 py-1 text-xs text-(--txt-secondary) transition-colors hover:bg-(--bg-layer-1-hover)"
            >
              <Layers className="h-3.5 w-3.5" />
              {t('workItem.detail.convertToEpic', 'Convert to epic')}
            </button>
          ) : null}
          {!issue.is_epic && !issue.archived_at && workspaceSlug ? (
            <MoveWorkItemModal
              workspaceSlug={workspaceSlug}
              currentProjectId={project.id}
              issueId={issue.id}
              onMoved={(targetProjectId) =>
                navigate(`/${workspace.slug}/projects/${targetProjectId}/issues/${issue.id}`)
              }
            />
          ) : null}
          {issue.archived_at ? (
            <button
              type="button"
              onClick={() => void handleRestore()}
              className="inline-flex shrink-0 items-center gap-1 rounded-(--radius-md) border border-(--border-subtle) px-2 py-1 text-xs text-(--txt-secondary) transition-colors hover:bg-(--bg-layer-1-hover)"
            >
              <ArchiveRestore className="h-3.5 w-3.5" />
              {t('common.restore', 'Restore')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleArchive()}
              className="inline-flex shrink-0 items-center gap-1 rounded-(--radius-md) border border-(--border-subtle) px-2 py-1 text-xs text-(--txt-secondary) transition-colors hover:bg-(--bg-layer-1-hover)"
            >
              <Archive className="h-3.5 w-3.5" />
              {t('common.archive', 'Archive')}
            </button>
          )}
        </div>
      </div>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-(--txt-primary)">{issue.name}</h1>
          <p className="mt-1 text-xs text-(--txt-tertiary)">
            {t('workItem.detail.lastEdited', 'Last edited {{date}}', {
              date: new Date(issue.updated_at).toLocaleDateString(),
            })}
          </p>
        </div>
        <div className="shrink-0">
          <Button size="sm" className="gap-1.5" onClick={() => setSubCreateOpen(true)}>
            <IconPlus />
            {t('workItem.detail.addSubWorkItem', 'Add sub-work item')}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex items-center justify-between text-sm font-medium text-(--txt-secondary)">
              <span>{t('workItem.detail.description', 'Description')}</span>
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                className="rounded-(--radius-md) px-2 py-1 text-xs font-normal text-(--txt-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-secondary)"
              >
                {t('workItem.detail.history', 'History')}
              </button>
            </CardHeader>
            <CardContent>
              <DescriptionEditor
                initialHtml={descriptionHtml}
                onSave={(html) => updateIssue({ description: html, description_html: html })}
                placeholder={t(
                  'workItem.detail.descriptionPlaceholder',
                  'Add a description… (type / for commands)',
                )}
                mentionMembers={mentionMembers}
              />
              {workspaceSlug && projectId && issueId && (
                <div className="mt-3">
                  <IssueReactions
                    workspaceSlug={workspaceSlug}
                    projectId={projectId}
                    issueId={issueId}
                    currentUserId={currentUser?.id}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <span className="text-sm font-medium text-(--txt-secondary)">
                {t('workItem.detail.activity', 'Activity')}
              </span>
              <span className="text-xs text-(--txt-tertiary)">
                {t('workItem.detail.commentsCount', 'Comments {{count}}', {
                  count: comments.length,
                })}
              </span>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                {/* Real activity feed driven by IssueActivity rows. */}
                <IssueActivityFeed
                  activities={activities}
                  members={members}
                  states={states}
                  labels={labels}
                />

                {comments.length === 0 ? (
                  <p className="text-sm text-(--txt-tertiary)">
                    {t('workItem.detail.noComments', 'No comments yet.')}
                  </p>
                ) : (
                  comments.map((c) => {
                    const isEditing = editingCommentId === c.id;
                    const isBot = !c.created_by_id;
                    const isOwn =
                      !!c.created_by_id && !!currentUser?.id && c.created_by_id === currentUser.id;
                    const authorName = isBot ? 'GitHub' : getMemberLabel(c.created_by_id);
                    const editedAt = c.updated_at && c.updated_at !== c.created_at;
                    return (
                      <div key={c.id} className="group/comment flex items-start gap-2 text-sm">
                        {isBot ? (
                          <span
                            className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-(--border-subtle) bg-(--bg-layer-2) text-(--txt-icon-secondary)"
                            title={t(
                              'workItem.detail.botTitle',
                              'Posted by the GitHub integration',
                            )}
                            aria-label={t('workItem.detail.botAriaLabel', 'GitHub bot')}
                          >
                            <BotGitHubIcon />
                          </span>
                        ) : (
                          <Avatar
                            name={authorName}
                            src={getImageUrl(getMemberAvatar(c.created_by_id)) ?? undefined}
                            size="sm"
                            className="mt-0.5 h-7 w-7 text-[10px]"
                          />
                        )}
                        <div className="min-w-0 flex-1 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium text-(--txt-primary)">
                                {authorName}
                              </span>
                              {isBot && (
                                <span className="rounded bg-(--bg-layer-1) px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide text-(--txt-tertiary)">
                                  {t('workItem.detail.bot', 'Bot')}
                                </span>
                              )}
                              {c.access === 'EXTERNAL' && (
                                <span
                                  className="inline-flex items-center gap-0.5 rounded bg-(--bg-accent-subtle) px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide text-(--txt-accent-primary)"
                                  title={t(
                                    'workItem.detail.externalTitle',
                                    'External — visible to guests',
                                  )}
                                >
                                  {t('workItem.detail.external', 'External')}
                                </span>
                              )}
                              {c.access === 'INTERNAL' && (
                                <span
                                  className="inline-flex items-center gap-0.5 text-(--txt-icon-tertiary)"
                                  title={t(
                                    'workItem.detail.internalTitle',
                                    'Internal — workspace members only',
                                  )}
                                >
                                  <CommentLockIcon />
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-(--txt-tertiary)">
                              <span title={new Date(c.created_at).toLocaleString()}>
                                {formatRelativeTime(c.created_at)}
                                {editedAt && ` ${t('workItem.detail.edited', '(edited)')}`}
                              </span>
                              {isOwn && !isEditing && (
                                <>
                                  <button
                                    type="button"
                                    className="hover:text-(--txt-secondary)"
                                    onClick={() => setEditingCommentId(c.id)}
                                    disabled={
                                      updatingCommentId === c.id || deletingCommentId === c.id
                                    }
                                  >
                                    {t('common.edit', 'Edit')}
                                  </button>
                                  <button
                                    type="button"
                                    className="hover:text-(--txt-secondary)"
                                    onClick={() => void deleteComment(c.id)}
                                    disabled={
                                      deletingCommentId === c.id || updatingCommentId === c.id
                                    }
                                  >
                                    {deletingCommentId === c.id
                                      ? t('common.deleting', 'Deleting…')
                                      : t('common.delete', 'Delete')}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          {isEditing ? (
                            <div className="mt-2">
                              <CommentEditor
                                initialHtml={c.comment}
                                onSubmit={(html) => updateComment(c.id, html)}
                                isSubmitting={updatingCommentId === c.id}
                                onCancel={() => setEditingCommentId(null)}
                                showShortcutHint
                                autoFocus
                                mentionMembers={mentionMembers}
                              />
                            </div>
                          ) : (
                            <>
                              <div
                                className="prose prose-sm mt-1 max-w-none text-(--txt-primary) [&_a]:text-(--txt-accent-primary) [&_a]:underline [&_code]:rounded [&_code]:bg-(--bg-layer-1) [&_code]:px-1 [&_code]:py-0.5"
                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(c.comment) }}
                              />
                              {workspaceSlug && (
                                <CommentReactions
                                  workspaceSlug={workspaceSlug}
                                  projectId={project.id}
                                  issueId={issue.id}
                                  commentId={c.id}
                                  currentUserId={currentUser?.id}
                                />
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <CommentEditor
                onSubmit={postComment}
                isSubmitting={postingComment}
                showShortcutHint
                showAccessToggle
                mentionMembers={mentionMembers}
              />
            </CardContent>
          </Card>

          {children.length > 0 && (
            <Card>
              <CardHeader className="flex items-center gap-2 text-sm font-medium text-(--txt-secondary)">
                <span>{t('workItem.detail.subWorkItems', 'Sub-work items')}</span>
                <span className="rounded-full bg-(--bg-layer-2) px-1.5 text-xs text-(--txt-tertiary)">
                  {children.length}
                </span>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-(--border-subtle)">
                  {children.map((ch) => {
                    const childState = ch.state_id
                      ? (states.find((s) => s.id === ch.state_id) ?? null)
                      : null;
                    return (
                      <li key={ch.id}>
                        <Link
                          to={`${baseUrl}/issues/${ch.id}`}
                          className="flex items-center gap-2 rounded-(--radius-sm) py-2 hover:bg-(--bg-layer-1-hover) focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--brand-default)"
                        >
                          <span
                            className="size-2.5 shrink-0 rounded-full border border-(--border-subtle)"
                            style={{ backgroundColor: childState?.color ?? 'transparent' }}
                            title={childState?.name ?? t('workItem.detail.noState', 'No state')}
                          />
                          <span className="shrink-0 text-[11px] font-medium text-(--txt-tertiary)">
                            {project.identifier ?? project.id.slice(0, 8)}-
                            {ch.sequence_id ?? ch.id.slice(-4)}
                          </span>
                          <span className="truncate text-sm text-(--txt-primary)">{ch.name}</span>
                          {ch.priority && ch.priority !== 'none' && (
                            <span className="ml-auto shrink-0">
                              <PriorityIcon priority={ch.priority as Priority} />
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {workspaceSlug && (
            <SubscribeButton
              workspaceSlug={workspaceSlug}
              projectId={project.id}
              issueId={issue.id}
            />
          )}
          {workspaceSlug && (
            <IssuePRSidebar
              workspaceSlug={workspaceSlug}
              projectId={project.id}
              issueId={issue.id}
            />
          )}

          {workspaceSlug && (
            <IssueLinksPanel
              workspaceSlug={workspaceSlug}
              projectId={project.id}
              issueId={issue.id}
              links={links}
              onLinksChange={setLinks}
            />
          )}

          {workspaceSlug && (
            <IssueRelationsPanel
              workspaceSlug={workspaceSlug}
              projectId={project.id}
              projectIdentifier={project.identifier ?? project.id.slice(0, 6)}
              issueId={issue.id}
              baseUrl={baseUrl}
              allIssues={allIssues}
              relations={relations}
              onRelationsChange={setRelations}
            />
          )}

          {workspaceSlug && (
            <IssueAttachmentsPanel
              workspaceSlug={workspaceSlug}
              projectId={project.id}
              issueId={issue.id}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
            />
          )}

          <Card>
            <CardHeader className="text-sm font-medium text-(--txt-secondary)">
              {t('workItem.detail.properties', 'Properties')}
            </CardHeader>
            <CardContent className="space-y-1 pt-3 text-sm">
              {/* State */}
              <PropertyRow icon={<IconStack />} label={t('workItem.detail.field.state', 'State')}>
                <Dropdown
                  id="state"
                  openId={openDropdown}
                  onOpen={setOpenDropdown}
                  label={t('workItem.detail.field.state', 'State')}
                  icon={<IconStack />}
                  displayValue=""
                  align="right"
                  triggerClassName={GHOST_TRIGGER}
                  triggerContent={
                    currentState ? (
                      <StatePill state={currentState} size="md" />
                    ) : (
                      <span className="text-(--txt-tertiary)">
                        {t('workItem.detail.selectState', 'Select state')}
                      </span>
                    )
                  }
                >
                  {states.map((s) => {
                    const isTerminal = s.group === 'completed' || s.group === 'cancelled';
                    const currentGroup = currentState?.group ?? 'backlog';
                    const isCurrentTerminal =
                      currentGroup === 'completed' || currentGroup === 'cancelled';
                    const needsConfirm =
                      isTerminal && !isCurrentTerminal && s.id !== issue.state_id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-(--bg-layer-1-hover)"
                        onClick={() => {
                          setOpenDropdown(null);
                          if (needsConfirm) {
                            setPendingStateId(s.id);
                          } else {
                            updateIssue({ state_id: s.id });
                          }
                        }}
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: s.color || 'var(--neutral-500)' }}
                          aria-hidden
                        />
                        <span className="truncate text-(--txt-primary)">{s.name}</span>
                        {needsConfirm && (
                          <span className="ml-auto text-[10px] text-(--txt-warning-primary)">
                            {}
                            <span aria-hidden>⚠</span>{' '}
                            {t('workItem.detail.confirmChange', 'confirm')}
                          </span>
                        )}
                        {issue.state_id === s.id && !needsConfirm && (
                          <span className="ml-auto text-xs text-(--txt-tertiary)">
                            {t('common.selected', 'Selected')}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </Dropdown>
              </PropertyRow>

              {/* Assignees */}
              <PropertyRow
                icon={<IconUser />}
                label={t('workItem.detail.field.assignees', 'Assignees')}
              >
                <Dropdown
                  id="assignees"
                  openId={openDropdown}
                  onOpen={setOpenDropdown}
                  label={t('workItem.detail.field.assignees', 'Assignees')}
                  icon={<IconUser />}
                  displayValue=""
                  align="right"
                  triggerClassName={GHOST_TRIGGER}
                  panelClassName="max-h-72 min-w-[240px] overflow-auto rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)"
                  triggerContent={
                    issueAssignees.length === 0 ? (
                      <span className="text-(--txt-tertiary)">
                        {t('workItem.detail.addAssignee', 'Add assignee')}
                      </span>
                    ) : (
                      <div className="flex min-w-0 items-center gap-2">
                        <WorkItemAvatarGroup members={issueAssignees} max={3} />
                        <span className="truncate text-(--txt-secondary)">
                          {issueAssignees.length === 1
                            ? issueAssignees[0].name
                            : t('workItem.detail.assigneesCount', '{{count}} assignees', {
                                count: issueAssignees.length,
                              })}
                        </span>
                      </div>
                    )
                  }
                >
                  {members.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-(--txt-tertiary)">
                      {t('workItem.detail.noMembers', 'No members.')}
                    </div>
                  ) : (
                    members.map((m) => {
                      const checked = assigneeIds.includes(m.member_id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-(--bg-layer-1-hover)"
                          onClick={() => {
                            const next = checked
                              ? assigneeIds.filter((x) => x !== m.member_id)
                              : [...assigneeIds, m.member_id];
                            updateIssue({ assignee_ids: next });
                          }}
                        >
                          <span className="inline-flex size-4 items-center justify-center rounded border border-(--border-subtle) text-[10px] text-(--txt-tertiary)">
                            {checked ? '✓' : ''}
                          </span>
                          <Avatar
                            name={getMemberLabel(m.member_id)}
                            src={getImageUrl(m.member_avatar) ?? undefined}
                            size="sm"
                            className="h-5 w-5 text-[9px]"
                          />
                          <span className="truncate text-(--txt-primary)">
                            {getMemberLabel(m.member_id)}
                          </span>
                        </button>
                      );
                    })
                  )}
                </Dropdown>
              </PropertyRow>

              {/* Priority */}
              <PropertyRow
                icon={<IconFlag />}
                label={t('workItem.detail.field.priority', 'Priority')}
              >
                <Dropdown
                  id="priority"
                  openId={openDropdown}
                  onOpen={setOpenDropdown}
                  label={t('workItem.detail.field.priority', 'Priority')}
                  icon={<IconFlag />}
                  displayValue=""
                  align="right"
                  triggerClassName={GHOST_TRIGGER}
                  triggerContent={
                    <div className="flex items-center gap-2">
                      <PriorityIcon priority={issue.priority as Priority | null | undefined} />
                      <span className="capitalize text-(--txt-secondary)">
                        {issue.priority ?? t('workItem.detail.noPriority', 'No priority')}
                      </span>
                    </div>
                  }
                >
                  {(['urgent', 'high', 'medium', 'low', 'none'] as Priority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-(--bg-layer-1-hover)"
                      onClick={() => {
                        setOpenDropdown(null);
                        updateIssue({ priority: p });
                      }}
                    >
                      <PriorityIcon priority={p} />
                      <span className="capitalize text-(--txt-primary)">{p}</span>
                      {issue.priority === p && (
                        <span className="ml-auto text-xs text-(--txt-tertiary)">
                          {t('common.selected', 'Selected')}
                        </span>
                      )}
                    </button>
                  ))}
                </Dropdown>
              </PropertyRow>

              {/* Created by (read-only) */}
              <PropertyRow
                icon={<IconUser />}
                label={t('workItem.detail.field.createdBy', 'Created by')}
              >
                <div className="flex min-w-0 items-center gap-2 px-2 py-1.5">
                  <Avatar
                    name={getMemberLabel(issue.created_by_id)}
                    src={getImageUrl(createdByMember?.member_avatar) ?? undefined}
                    size="sm"
                    className="h-5 w-5 text-[9px]"
                  />
                  <span className="truncate text-(--txt-secondary)">
                    {getMemberLabel(issue.created_by_id)}
                  </span>
                </div>
              </PropertyRow>

              {/* Start date */}
              <PropertyRow
                icon={<IconCalendar />}
                label={t('workItem.detail.field.startDate', 'Start date')}
              >
                <DatePickerTrigger
                  label={t('workItem.detail.field.startDate', 'Start date')}
                  icon={<IconCalendar />}
                  value={issue.start_date ?? ''}
                  placeholder={t('workItem.detail.addStartDate', 'Add start date')}
                  onChange={(v) => updateIssue({ start_date: v })}
                />
              </PropertyRow>

              {/* Due date */}
              <PropertyRow
                icon={<IconCalendar />}
                label={t('workItem.detail.field.dueDate', 'Due date')}
              >
                <DatePickerTrigger
                  label={t('workItem.detail.field.dueDate', 'Due date')}
                  icon={<IconCalendar />}
                  value={issue.target_date ?? ''}
                  placeholder={t('workItem.detail.addDueDate', 'Add due date')}
                  onChange={(v) => updateIssue({ target_date: v })}
                />
              </PropertyRow>

              {/* Modules (multi) */}
              <PropertyRow
                icon={<IconStack />}
                label={t('workItem.detail.field.modules', 'Modules')}
              >
                <Dropdown
                  id="module"
                  openId={openDropdown}
                  onOpen={setOpenDropdown}
                  label={t('workItem.detail.field.modules', 'Modules')}
                  icon={<IconStack />}
                  displayValue=""
                  align="right"
                  triggerClassName={GHOST_TRIGGER}
                  triggerContent={
                    selectedModules.length === 0 ? (
                      <span className="text-(--txt-tertiary)">
                        {t('workItem.detail.noModules', 'No modules')}
                      </span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1">
                        {selectedModules.slice(0, 2).map((m) => (
                          <span
                            key={m.id}
                            className="inline-flex h-5 max-w-[10rem] items-center gap-1 truncate rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-1.5 text-[11px] text-(--txt-secondary)"
                          >
                            <span className="truncate">{m.name}</span>
                          </span>
                        ))}
                        {selectedModules.length > 2 && (
                          <span className="inline-flex h-5 items-center rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-layer-1) px-1.5 text-[11px] text-(--txt-tertiary)">
                            +{selectedModules.length - 2}
                          </span>
                        )}
                      </div>
                    )
                  }
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-(--bg-layer-1-hover)"
                    onClick={() => {
                      setOpenDropdown(null);
                      handleSetModule(null);
                    }}
                  >
                    <span className="text-(--txt-tertiary)">
                      {t('workItem.detail.noModule', 'No module')}
                    </span>
                  </button>
                  {modules.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-(--bg-layer-1-hover)"
                      onClick={() => {
                        setOpenDropdown(null);
                        handleSetModule(m.id);
                      }}
                    >
                      <span className="truncate text-(--txt-primary)">{m.name}</span>
                      {moduleIds.includes(m.id) && (
                        <span className="text-xs text-(--txt-tertiary)">
                          {t('common.selected', 'Selected')}
                        </span>
                      )}
                    </button>
                  ))}
                </Dropdown>
              </PropertyRow>

              {/* Cycle */}
              <PropertyRow icon={<IconCycle />} label={t('workItem.detail.field.cycle', 'Cycle')}>
                <Dropdown
                  id="cycle"
                  openId={openDropdown}
                  onOpen={setOpenDropdown}
                  label={t('workItem.detail.field.cycle', 'Cycle')}
                  icon={<IconCycle />}
                  displayValue=""
                  align="right"
                  triggerClassName={GHOST_TRIGGER}
                  triggerContent={
                    selectedCycle ? (
                      <span className="inline-flex h-5 max-w-full items-center gap-1.5 truncate rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-1.5 text-[11px] text-(--txt-secondary)">
                        <span className="truncate">{selectedCycle.name}</span>
                      </span>
                    ) : (
                      <span className="text-(--txt-tertiary)">
                        {t('workItem.detail.noCycle', 'No cycle')}
                      </span>
                    )
                  }
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-(--bg-layer-1-hover)"
                    onClick={() => {
                      setOpenDropdown(null);
                      handleSetCycle(null);
                    }}
                  >
                    <span className="text-(--txt-tertiary)">
                      {t('workItem.detail.noCycle', 'No cycle')}
                    </span>
                  </button>
                  {cycles.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-(--bg-layer-1-hover)"
                      onClick={() => {
                        setOpenDropdown(null);
                        handleSetCycle(c.id);
                      }}
                    >
                      <span className="truncate text-(--txt-primary)">{c.name}</span>
                      {cycleIds.includes(c.id) && (
                        <span className="text-xs text-(--txt-tertiary)">
                          {t('common.selected', 'Selected')}
                        </span>
                      )}
                    </button>
                  ))}
                </Dropdown>
              </PropertyRow>

              {/* Parent */}
              <PropertyRow icon={<IconStack />} label={t('workItem.detail.field.parent', 'Parent')}>
                <Dropdown
                  id="parent"
                  openId={openDropdown}
                  onOpen={setOpenDropdown}
                  label={t('workItem.detail.field.parent', 'Parent')}
                  icon={<IconStack />}
                  displayValue=""
                  align="right"
                  triggerClassName={GHOST_TRIGGER}
                  panelClassName="max-h-72 min-w-[280px] overflow-auto rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)"
                  triggerContent={
                    parentIssue ? (
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="shrink-0 text-[11px] font-medium text-(--txt-accent-primary)">
                          {project.identifier ?? project.id.slice(0, 8)}-
                          {parentIssue.sequence_id ?? parentIssue.id.slice(-4)}
                        </span>
                        <span className="truncate text-(--txt-secondary)">{parentIssue.name}</span>
                      </div>
                    ) : (
                      <span className="text-(--txt-tertiary)">
                        {t('workItem.detail.addParent', 'Add parent work item')}
                      </span>
                    )
                  }
                >
                  {parentIssue && (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-(--bg-layer-1-hover)"
                      onClick={() => {
                        setOpenDropdown(null);
                        updateIssue({ parent_id: null });
                      }}
                    >
                      <span className="text-(--txt-tertiary)">
                        {t('workItem.detail.removeParent', 'Remove parent')}
                      </span>
                    </button>
                  )}
                  {filteredParentOptions.slice(0, 200).map((pi) => (
                    <button
                      key={pi.id}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-(--bg-layer-1-hover)"
                      onClick={() => {
                        setOpenDropdown(null);
                        updateIssue({ parent_id: pi.id });
                      }}
                    >
                      <span className="shrink-0 text-[11px] font-medium text-(--txt-accent-primary)">
                        {project.identifier ?? project.id.slice(0, 8)}-
                        {pi.sequence_id ?? pi.id.slice(-4)}
                      </span>
                      <span className="truncate text-(--txt-primary)">{pi.name}</span>
                    </button>
                  ))}
                </Dropdown>
              </PropertyRow>

              {/* Labels (multi-chip) */}
              <PropertyRow icon={<IconTag />} label={t('workItem.detail.field.labels', 'Labels')}>
                <Dropdown
                  id="labels"
                  openId={openDropdown}
                  onOpen={setOpenDropdown}
                  label={t('workItem.detail.field.labels', 'Labels')}
                  icon={<IconTag />}
                  displayValue=""
                  align="right"
                  triggerClassName={GHOST_TRIGGER}
                  panelClassName="max-h-72 min-w-[240px] overflow-auto rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)"
                  triggerContent={
                    selectedLabels.length === 0 ? (
                      <span className="text-(--txt-tertiary)">
                        {t('workItem.detail.selectLabel', 'Select label')}
                      </span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1">
                        {selectedLabels.slice(0, 3).map((l) => (
                          <span
                            key={l.id}
                            className="inline-flex h-5 max-w-[7rem] items-center gap-1 truncate rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-1.5 text-[11px] text-(--txt-secondary)"
                            title={l.name}
                          >
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: l.color || 'var(--neutral-500)' }}
                              aria-hidden
                            />
                            <span className="truncate">{l.name}</span>
                          </span>
                        ))}
                        {selectedLabels.length > 3 && (
                          <span className="inline-flex h-5 items-center rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-layer-1) px-1.5 text-[11px] text-(--txt-tertiary)">
                            +{selectedLabels.length - 3}
                          </span>
                        )}
                      </div>
                    )
                  }
                >
                  {labels.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-(--txt-tertiary)">
                      {t('workItem.detail.noLabels', 'No labels.')}
                    </div>
                  ) : (
                    labels.map((l) => {
                      const checked = labelIds.includes(l.id);
                      return (
                        <button
                          key={l.id}
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-(--bg-layer-1-hover)"
                          onClick={() => {
                            const next = checked
                              ? labelIds.filter((x) => x !== l.id)
                              : [...labelIds, l.id];
                            updateIssue({ label_ids: next });
                          }}
                        >
                          <span className="inline-flex size-4 items-center justify-center rounded border border-(--border-subtle) text-[10px] text-(--txt-tertiary)">
                            {checked ? '✓' : ''}
                          </span>
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: l.color || 'var(--neutral-500)' }}
                            aria-hidden
                          />
                          <span className="truncate text-(--txt-primary)">{l.name}</span>
                        </button>
                      );
                    })
                  )}
                </Dropdown>
              </PropertyRow>

              {/* Type */}
              <PropertyRow icon={<IconType />} label={t('workItem.detail.field.type', 'Type')}>
                <Dropdown
                  id="type"
                  openId={openDropdown}
                  onOpen={setOpenDropdown}
                  label={t('workItem.detail.field.type', 'Type')}
                  icon={<IconType />}
                  displayValue=""
                  align="right"
                  triggerClassName={GHOST_TRIGGER}
                  triggerContent={
                    <span className="capitalize text-(--txt-secondary)">
                      {issue.type ?? 'task'}
                    </span>
                  }
                >
                  {WORK_ITEM_TYPES.map((wt) => (
                    <button
                      key={wt.value}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-(--bg-layer-1-hover)"
                      onClick={() => {
                        setOpenDropdown(null);
                        updateIssue({ type: wt.value });
                      }}
                    >
                      <span className="capitalize text-(--txt-primary)">{wt.label}</span>
                      {(issue.type ?? 'task') === wt.value && (
                        <span className="ml-auto text-xs text-(--txt-tertiary)">
                          {t('common.selected', 'Selected')}
                        </span>
                      )}
                    </button>
                  ))}
                  {!issue.is_epic && (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 border-t border-(--border-subtle) px-3 py-2 text-left text-sm hover:bg-(--bg-layer-1-hover)"
                      onClick={() => {
                        setOpenDropdown(null);
                        void handleConvertToEpic();
                      }}
                    >
                      <Layers className="size-3.5 text-(--txt-icon-tertiary)" />
                      <span className="text-(--txt-primary)">
                        {t('workItem.detail.epic', 'Epic')}
                      </span>
                      <span className="ml-auto text-xs text-(--txt-tertiary)">
                        {t('workItem.detail.convert', 'Convert')}
                      </span>
                    </button>
                  )}
                </Dropdown>
              </PropertyRow>

              {/* Estimate */}
              {estimatePoints.length > 0 && (
                <PropertyRow
                  icon={<IconEstimate />}
                  label={t('workItem.detail.field.estimate', 'Estimate')}
                >
                  <Dropdown
                    id="estimate"
                    openId={openDropdown}
                    onOpen={setOpenDropdown}
                    label={t('workItem.detail.field.estimate', 'Estimate')}
                    icon={<IconEstimate />}
                    displayValue=""
                    align="right"
                    triggerClassName={GHOST_TRIGGER}
                    triggerContent={
                      <span className="text-(--txt-secondary)">
                        {currentEstimatePoint?.value ??
                          t('workItem.detail.noEstimate', 'No estimate')}
                      </span>
                    }
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-(--bg-layer-1-hover)"
                      onClick={() => {
                        setOpenDropdown(null);
                        updateIssue({ estimate_point_id: '' });
                      }}
                    >
                      <span className="text-(--txt-primary)">
                        {t('workItem.detail.noEstimate', 'No estimate')}
                      </span>
                      {!issue.estimate_point_id && (
                        <span className="ml-auto text-xs text-(--txt-tertiary)">
                          {t('common.selected', 'Selected')}
                        </span>
                      )}
                    </button>
                    {estimatePoints.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-(--bg-layer-1-hover)"
                        onClick={() => {
                          setOpenDropdown(null);
                          updateIssue({ estimate_point_id: p.id });
                        }}
                      >
                        <span className="text-(--txt-primary)">{p.value}</span>
                        {issue.estimate_point_id === p.id && (
                          <span className="ml-auto text-xs text-(--txt-tertiary)">
                            {t('common.selected', 'Selected')}
                          </span>
                        )}
                      </button>
                    ))}
                  </Dropdown>
                </PropertyRow>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Workflow confirmation dialog */}
      {pendingStateId &&
        (() => {
          const targetState = states.find((s) => s.id === pendingStateId);
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
              onClick={() => setPendingStateId(null)}
            >
              <div
                className="w-full max-w-sm rounded-lg border border-(--border-subtle) bg-(--bg-surface-1) p-6 shadow-(--shadow-overlay)"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="mb-2 text-base font-semibold text-(--txt-primary)">
                  {t('workItem.detail.confirmStateChange', 'Confirm state change')}
                </h3>
                <p className="mb-4 text-sm text-(--txt-secondary)">
                  <Trans
                    i18nKey="workItem.detail.confirmStateBody"
                    defaults="Move this issue to <b>{{name}}</b>? This marks it as {{group}}."
                    values={{ name: targetState?.name, group: targetState?.group }}
                    components={{ b: <strong /> }}
                  />
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingStateId(null)}
                    className="rounded-(--radius-md) px-3 py-1.5 text-sm text-(--txt-secondary) hover:bg-(--bg-layer-1-hover)"
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      updateIssue({ state_id: pendingStateId });
                      setPendingStateId(null);
                    }}
                    className="rounded-(--radius-md) bg-(--bg-accent-primary) px-3 py-1.5 text-sm text-white hover:opacity-90"
                  >
                    {t('common.confirm', 'Confirm')}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      <CreateWorkItemModal
        open={subCreateOpen}
        onClose={() => {
          setSubCreateOpen(false);
          setCreateError(null);
        }}
        workspaceSlug={workspace.slug}
        projects={[
          {
            id: project.id,
            workspace_id: project.workspace_id,
            name: project.name,
            identifier: project.identifier ?? project.id.slice(0, 8),
            description: project.description ?? undefined,
          },
        ]}
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
              is_draft: data.isDraft === true ? true : undefined,
            });
            if (data.cycleId) {
              await cycleService
                .addIssue(workspaceSlug, project.id, data.cycleId, created.id)
                .catch(() => {});
            }
            if (data.moduleId) {
              await moduleService
                .addIssue(workspaceSlug, project.id, data.moduleId, created.id)
                .catch(() => {});
            }
            const refreshedAll = await issueService
              .list(workspaceSlug, project.id, { limit: 250 })
              .catch(() => null);
            if (refreshedAll) setAllIssues(refreshedAll);
            setSubCreateOpen(false);
          } catch (err) {
            setCreateError(
              err instanceof Error
                ? err.message
                : t('workItem.detail.createSubItemFailed', 'Failed to create sub-work item'),
            );
          }
        }}
      />
      {workspaceSlug && projectId && issueId && (
        <DescriptionHistoryModal
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          issueId={issueId}
          authorLabel={getMemberLabel}
          onRestored={(updated) => setIssue(updated)}
        />
      )}
    </div>
  );
}
