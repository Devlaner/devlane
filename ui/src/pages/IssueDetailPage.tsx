import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, CardContent, CardHeader, Avatar } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { Dropdown, DatePickerTrigger, CommentEditor } from '../components/work-item';
import { DescriptionEditor } from '../components/work-item/DescriptionEditor';
import { IssueActivityFeed } from '../components/work-item/IssueActivityFeed';
import { CommentReactions } from '../components/work-item/CommentReactions';
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
import { IssuePRSidebar } from '../components/work-item/IssuePRSidebar';
import { SubscribeButton } from '../components/notifications/SubscribeButton';
import {
  PriorityIcon,
  StatePill,
  WorkItemAvatarGroup,
} from '../components/work-item/IssueRowCells';
import { membersFromAssigneeIds } from '../lib/issueRowHelpers';
import { getImageUrl } from '../lib/utils';
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
  IssueLinkApiResponse,
  IssueRelationApiResponse,
  IssueAttachmentApiResponse,
  IssueRelationType,
} from '../api/types';
import type { Priority } from '../types';

/**
 * Shared trigger style for the Properties sidebar dropdowns. Borderless +
 * background-on-hover so each row reads like a "value" rather than a button —
 * matches Plane's transparent-with-text variant. Content-width so the row's
 * `justify-end` can right-align it.
 */
const GHOST_TRIGGER =
  'inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-(--radius-md) px-2 py-1.5 text-xs text-(--txt-secondary) hover:bg-(--bg-layer-1-hover)';

/** One row in the Properties sidebar: fixed-width label on the left, value right-aligned. */
function PropertyRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <div className="flex w-32 shrink-0 items-center gap-1.5 text-xs text-(--txt-tertiary)">
        <span className="shrink-0 text-(--txt-icon-tertiary)">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="flex grow min-w-0 justify-end">{children}</div>
    </div>
  );
}

const IconPlus = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M5 12h14" />
    <path d="M12 5v14" />
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
const IconFlag = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M4 22V4" />
    <path d="M4 4h11l-1 5 1 5H4" />
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
const IconStack = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="m12 2 10 6-10 6L2 8l10-6Z" />
    <path d="m2 14 10 6 10-6" />
  </svg>
);
const IconCycle = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);
const IconLink = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);
const IconRelation = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="m6 17 5-5-5-5" />
    <path d="m13 17 5-5-5-5" />
  </svg>
);
const IconPaperclip = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);
const IconType = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <polyline points="4 7 4 4 20 4 20 7" />
    <line x1="9" y1="20" x2="15" y2="20" />
    <line x1="12" y1="4" x2="12" y2="20" />
  </svg>
);

const WORK_ITEM_TYPES = [
  { value: 'task', label: 'Task' },
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Feature' },
  { value: 'story', label: 'Story' },
  { value: 'chore', label: 'Chore' },
] as const;

const RELATION_TYPE_LABELS: Record<string, string> = {
  blocking: 'Blocking',
  blocked_by: 'Blocked by',
  duplicate: 'Duplicate',
  relates_to: 'Relates to',
};
/** Tiny lock icon used to mark internal comments. */
const CommentLockIcon = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    aria-hidden
  >
    <rect width="18" height="11" x="3" y="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
/** GitHub mark — used as the avatar for bot-posted comments. */
const BotGitHubIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

export function IssueDetailPage() {
  const { user: currentUser } = useAuth();
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
  const [addLinkOpen, setAddLinkOpen] = useState(false);
  const [addLinkUrl, setAddLinkUrl] = useState('');
  const [addLinkTitle, setAddLinkTitle] = useState('');
  const [addingLink, setAddingLink] = useState(false);
  // Relations
  const [relations, setRelations] = useState<IssueRelationApiResponse>({
    blocking: [],
    blocked_by: [],
    duplicate: [],
    relates_to: [],
  });
  const [addRelationOpen, setAddRelationOpen] = useState(false);
  const [addRelationType, setAddRelationType] = useState<IssueRelationType>('relates_to');
  const [addRelationSearch, setAddRelationSearch] = useState('');
  const [addingRelation, setAddingRelation] = useState(false);
  // Attachments
  const [attachments, setAttachments] = useState<IssueAttachmentApiResponse[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

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
    return 'Member';
  };
  const getMemberAvatar = (memberId: string | null | undefined): string | null => {
    if (!memberId) return null;
    const m = members.find((x) => x.member_id === memberId);
    const raw = m?.member_avatar?.trim();
    return raw ? raw : null;
  };
  const mentionMembers = members.map((m) => ({
    id: m.member_id,
    label: m.member_display_name?.trim() || m.member_email?.split('@')[0]?.trim() || 'Member',
  }));

  const assigneeIds = issue?.assignee_ids ?? [];
  const labelIds = issue?.label_ids ?? [];
  const cycleIds = issue?.cycle_ids ?? [];
  const moduleIds = issue?.module_ids ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-(--txt-tertiary)">
        Loading…
      </div>
    );
  }
  if (!workspace || !project || !issue) {
    return <div className="text-(--txt-secondary)">Issue not found.</div>;
  }

  const baseUrl = `/${workspace.slug}/projects/${project.id}`;
  const displayId = `${project.identifier ?? project.id.slice(0, 8)}-${issue.sequence_id ?? issue.id.slice(-4)}`;
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
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update work item.');
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
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update cycle.');
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
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update module.');
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
    if (days > 0) return `${days} day${days === 1 ? '' : 's'} ago`;
    if (hours > 0) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    if (minutes > 0) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    return 'just now';
  };

  const postComment = async (contentHtml: string, access: 'INTERNAL' | 'EXTERNAL' = 'INTERNAL') => {
    if (!workspaceSlug || !contentHtml.trim()) return;
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
        contentHtml.trim(),
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
        <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-xs text-(--txt-danger-primary)">
          {errorMessage}
        </div>
      )}
      <div className="flex items-center gap-2 text-sm text-(--txt-tertiary)">
        <Link to={baseUrl} className="text-(--txt-accent-primary) hover:underline">
          {project.name}
        </Link>
        <span>/</span>
        <Link to={`${baseUrl}/issues`} className="text-(--txt-accent-primary) hover:underline">
          Issues
        </Link>
        <span>/</span>
        <span className="text-(--txt-secondary)">{displayId}</span>
      </div>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-(--txt-primary)">{issue.name}</h1>
          <p className="mt-1 text-xs text-(--txt-tertiary)">
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
            <CardHeader className="text-sm font-medium text-(--txt-secondary)">
              Description
            </CardHeader>
            <CardContent>
              <DescriptionEditor
                initialHtml={descriptionHtml}
                onSave={(html) => updateIssue({ description: html, description_html: html })}
                placeholder="Add a description… (type / for commands)"
                mentionMembers={mentionMembers}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <span className="text-sm font-medium text-(--txt-secondary)">Activity</span>
              <span className="text-xs text-(--txt-tertiary)">Comments {comments.length}</span>
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
                  <p className="text-sm text-(--txt-tertiary)">No comments yet.</p>
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
                            title="Posted by the GitHub integration"
                            aria-label="GitHub bot"
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
                                  Bot
                                </span>
                              )}
                              {c.access === 'EXTERNAL' && (
                                <span
                                  className="inline-flex items-center gap-0.5 rounded bg-(--bg-accent-subtle) px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide text-(--txt-accent-primary)"
                                  title="External — visible to guests"
                                >
                                  External
                                </span>
                              )}
                              {c.access === 'INTERNAL' && (
                                <span
                                  className="inline-flex items-center gap-0.5 text-(--txt-icon-tertiary)"
                                  title="Internal — workspace members only"
                                >
                                  <CommentLockIcon />
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-(--txt-tertiary)">
                              <span title={new Date(c.created_at).toLocaleString()}>
                                {formatRelativeTime(c.created_at)}
                                {editedAt && ' (edited)'}
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
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="hover:text-(--txt-secondary)"
                                    onClick={() => void deleteComment(c.id)}
                                    disabled={
                                      deletingCommentId === c.id || updatingCommentId === c.id
                                    }
                                  >
                                    {deletingCommentId === c.id ? 'Deleting…' : 'Delete'}
                                  </button>
                                </>
                              )}
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
                                mentionMembers={mentionMembers}
                              />
                            </div>
                          ) : (
                            <>
                              <div
                                className="prose prose-sm mt-1 max-w-none text-(--txt-primary) [&_a]:text-(--txt-accent-primary) [&_a]:underline [&_code]:rounded [&_code]:bg-(--bg-layer-1) [&_code]:px-1 [&_code]:py-0.5"
                                dangerouslySetInnerHTML={{ __html: c.comment }}
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
              <CardHeader className="text-sm font-medium text-(--txt-secondary)">
                Sub-work items
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {children.map((ch) => (
                    <li key={ch.id}>
                      <Link
                        to={`${baseUrl}/issues/${ch.id}`}
                        className="text-sm text-(--txt-accent-primary) hover:underline"
                      >
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

          {/* ── Links ── */}
          <Card>
            <CardHeader className="flex items-center justify-between text-sm font-medium text-(--txt-secondary)">
              <span className="flex items-center gap-1.5">
                <IconLink />
                Links
              </span>
              <button
                type="button"
                onClick={() => {
                  setAddLinkOpen((v) => !v);
                  setAddLinkUrl('');
                  setAddLinkTitle('');
                }}
                className="rounded p-0.5 text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover)"
                title="Add link"
              >
                <IconPlus />
              </button>
            </CardHeader>
            <CardContent className="space-y-1 pt-2">
              {addLinkOpen && (
                <form
                  className="space-y-1.5 pb-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!addLinkUrl.trim() || !workspaceSlug) return;
                    setAddingLink(true);
                    try {
                      const created = await issueService.createLink(
                        workspaceSlug,
                        project.id,
                        issue.id,
                        { url: addLinkUrl.trim(), title: addLinkTitle.trim() || undefined },
                      );
                      setLinks((prev) => [...prev, created]);
                      setAddLinkOpen(false);
                    } catch {
                      /* ignore */
                    }
                    setAddingLink(false);
                  }}
                >
                  <input
                    type="url"
                    placeholder="https://..."
                    value={addLinkUrl}
                    onChange={(e) => setAddLinkUrl(e.target.value)}
                    required
                    className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-canvas) px-2 py-1 text-xs text-(--txt-primary) focus:outline-none focus:ring-1 focus:ring-(--border-focus)"
                  />
                  <input
                    type="text"
                    placeholder="Title (optional)"
                    value={addLinkTitle}
                    onChange={(e) => setAddLinkTitle(e.target.value)}
                    className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-canvas) px-2 py-1 text-xs text-(--txt-primary) focus:outline-none focus:ring-1 focus:ring-(--border-focus)"
                  />
                  <div className="flex gap-1">
                    <button
                      type="submit"
                      disabled={addingLink}
                      className="rounded-(--radius-md) bg-(--bg-accent-primary) px-2 py-1 text-xs text-white disabled:opacity-50"
                    >
                      {addingLink ? 'Adding…' : 'Add'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddLinkOpen(false)}
                      className="rounded-(--radius-md) px-2 py-1 text-xs text-(--txt-secondary) hover:bg-(--bg-layer-1-hover)"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
              {links.length === 0 && !addLinkOpen ? (
                <p className="text-xs text-(--txt-tertiary)">No links yet.</p>
              ) : (
                links.map((l) => (
                  <div key={l.id} className="flex items-center gap-1 group">
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 truncate text-xs text-(--txt-accent-primary) hover:underline"
                      title={l.url}
                    >
                      {l.title || l.url}
                    </a>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!workspaceSlug) return;
                        await issueService
                          .deleteLink(workspaceSlug, project.id, issue.id, l.id)
                          .catch(() => {});
                        setLinks((prev) => prev.filter((x) => x.id !== l.id));
                      }}
                      className="shrink-0 opacity-0 group-hover:opacity-100 rounded p-0.5 text-(--txt-tertiary) hover:text-(--txt-danger-primary)"
                      title="Remove link"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* ── Relations ── */}
          <Card>
            <CardHeader className="flex items-center justify-between text-sm font-medium text-(--txt-secondary)">
              <span className="flex items-center gap-1.5">
                <IconRelation />
                Relations
              </span>
              <button
                type="button"
                onClick={() => {
                  setAddRelationOpen((v) => !v);
                  setAddRelationSearch('');
                }}
                className="rounded p-0.5 text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover)"
                title="Add relation"
              >
                <IconPlus />
              </button>
            </CardHeader>
            <CardContent className="space-y-2 pt-2">
              {addRelationOpen && (
                <div className="space-y-1.5 pb-2">
                  <select
                    value={addRelationType}
                    onChange={(e) => setAddRelationType(e.target.value as IssueRelationType)}
                    className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-canvas) px-2 py-1 text-xs text-(--txt-primary) focus:outline-none"
                  >
                    {Object.entries(RELATION_TYPE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Search issues…"
                    value={addRelationSearch}
                    onChange={(e) => setAddRelationSearch(e.target.value)}
                    className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-canvas) px-2 py-1 text-xs text-(--txt-primary) focus:outline-none focus:ring-1 focus:ring-(--border-focus)"
                  />
                  <div className="max-h-40 overflow-y-auto space-y-0.5">
                    {allIssues
                      .filter(
                        (i) =>
                          i.id !== issue.id &&
                          (addRelationSearch === '' ||
                            i.name.toLowerCase().includes(addRelationSearch.toLowerCase())),
                      )
                      .slice(0, 20)
                      .map((candidate) => (
                        <button
                          key={candidate.id}
                          type="button"
                          disabled={addingRelation}
                          className="flex w-full items-center gap-2 rounded-(--radius-md) px-2 py-1 text-left text-xs hover:bg-(--bg-layer-1-hover) disabled:opacity-50"
                          onClick={async () => {
                            if (!workspaceSlug) return;
                            setAddingRelation(true);
                            try {
                              await issueService.addRelation(
                                workspaceSlug,
                                project.id,
                                issue.id,
                                addRelationType,
                                [candidate.id],
                              );
                              const updated = await issueService.listRelations(
                                workspaceSlug,
                                project.id,
                                issue.id,
                              );
                              setRelations(updated);
                              setAddRelationOpen(false);
                            } catch {
                              /* ignore */
                            }
                            setAddingRelation(false);
                          }}
                        >
                          <span className="shrink-0 text-[11px] font-medium text-(--txt-accent-primary)">
                            {project.identifier ?? project.id.slice(0, 6)}-{candidate.sequence_id}
                          </span>
                          <span className="truncate text-(--txt-primary)">{candidate.name}</span>
                        </button>
                      ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setAddRelationOpen(false)}
                    className="text-xs text-(--txt-tertiary) hover:text-(--txt-secondary)"
                  >
                    Cancel
                  </button>
                </div>
              )}
              {(['blocking', 'blocked_by', 'duplicate', 'relates_to'] as IssueRelationType[]).map(
                (rtype) => {
                  const group = relations[rtype];
                  if (!group?.length) return null;
                  return (
                    <div key={rtype}>
                      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-(--txt-tertiary)">
                        {RELATION_TYPE_LABELS[rtype]}
                      </p>
                      <div className="space-y-0.5">
                        {group.map((rel) => (
                          <div key={rel.id} className="flex items-center gap-1 group">
                            <Link
                              to={`${baseUrl}/issues/${rel.id}`}
                              className="min-w-0 flex-1 truncate text-xs text-(--txt-accent-primary) hover:underline"
                            >
                              {project.identifier ?? project.id.slice(0, 6)}-{rel.sequence_id}{' '}
                              {rel.name}
                            </Link>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!workspaceSlug) return;
                                await issueService
                                  .removeRelation(
                                    workspaceSlug,
                                    project.id,
                                    issue.id,
                                    rtype,
                                    rel.id,
                                  )
                                  .catch(() => {});
                                setRelations((prev) => ({
                                  ...prev,
                                  [rtype]: prev[rtype].filter((x) => x.id !== rel.id),
                                }));
                              }}
                              className="shrink-0 opacity-0 group-hover:opacity-100 rounded p-0.5 text-(--txt-tertiary) hover:text-(--txt-danger-primary)"
                              title="Remove"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                },
              )}
              {!addRelationOpen && Object.values(relations).every((g) => !g?.length) && (
                <p className="text-xs text-(--txt-tertiary)">No relations yet.</p>
              )}
            </CardContent>
          </Card>

          {/* ── Attachments ── */}
          <Card>
            <CardHeader className="flex items-center justify-between text-sm font-medium text-(--txt-secondary)">
              <span className="flex items-center gap-1.5">
                <IconPaperclip />
                Attachments
              </span>
              <label
                className="cursor-pointer rounded p-0.5 text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover)"
                title="Upload file"
              >
                <IconPlus />
                <input
                  type="file"
                  className="sr-only"
                  disabled={uploadingAttachment}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !workspaceSlug) return;
                    setUploadingAttachment(true);
                    try {
                      const resp = await issueService.initiateAttachmentUpload(
                        workspaceSlug,
                        project.id,
                        issue.id,
                        { name: file.name, size: file.size, type: file.type },
                      );
                      // Upload file to the presigned URL
                      const formData = new FormData();
                      Object.entries(resp.upload_data.fields ?? {}).forEach(([k, v]) =>
                        formData.append(k, v),
                      );
                      formData.append('file', file);
                      const uploadResp = await fetch(resp.upload_data.url, {
                        method: 'POST',
                        body: formData,
                        credentials: 'omit',
                      });
                      if (!uploadResp.ok) throw new Error(`Upload failed: ${uploadResp.status}`);
                      await issueService.confirmAttachmentUpload(
                        workspaceSlug,
                        project.id,
                        issue.id,
                        resp.asset_id,
                      );
                      const refreshed = await issueService.listAttachments(
                        workspaceSlug,
                        project.id,
                        issue.id,
                      );
                      setAttachments(refreshed);
                    } catch {
                      /* ignore — 503 if MinIO not configured */
                    }
                    setUploadingAttachment(false);
                    e.target.value = '';
                  }}
                />
              </label>
            </CardHeader>
            <CardContent className="space-y-1 pt-2">
              {uploadingAttachment && <p className="text-xs text-(--txt-tertiary)">Uploading…</p>}
              {attachments.length === 0 && !uploadingAttachment ? (
                <p className="text-xs text-(--txt-tertiary)">No attachments yet.</p>
              ) : (
                attachments.map((att) => (
                  <div key={att.id} className="flex items-center gap-1 group">
                    <a
                      href={att.asset_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 truncate text-xs text-(--txt-accent-primary) hover:underline"
                      title={att.attributes?.name}
                    >
                      {att.attributes?.name ?? 'Attachment'}
                    </a>
                    {att.attributes?.size != null && (
                      <span className="shrink-0 text-[10px] text-(--txt-tertiary)">
                        {(att.attributes.size / 1024).toFixed(0)}KB
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        if (!workspaceSlug) return;
                        try {
                          await issueService.deleteAttachment(
                            workspaceSlug,
                            project.id,
                            issue.id,
                            att.asset_id,
                          );
                          setAttachments((prev) => prev.filter((x) => x.id !== att.id));
                        } catch {
                          /* ignore */
                        }
                      }}
                      className="shrink-0 opacity-0 group-hover:opacity-100 rounded p-0.5 text-(--txt-tertiary) hover:text-(--txt-danger-primary)"
                      title="Delete"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-sm font-medium text-(--txt-secondary)">
              Properties
            </CardHeader>
            <CardContent className="space-y-1 pt-3 text-sm">
              {/* State */}
              <PropertyRow icon={<IconStack />} label="State">
                <Dropdown
                  id="state"
                  openId={openDropdown}
                  onOpen={setOpenDropdown}
                  label="State"
                  icon={<IconStack />}
                  displayValue=""
                  align="right"
                  triggerClassName={GHOST_TRIGGER}
                  triggerContent={
                    currentState ? (
                      <StatePill state={currentState} size="md" />
                    ) : (
                      <span className="text-(--txt-tertiary)">Select state</span>
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
                            ⚠ confirm
                          </span>
                        )}
                        {issue.state_id === s.id && !needsConfirm && (
                          <span className="ml-auto text-xs text-(--txt-tertiary)">Selected</span>
                        )}
                      </button>
                    );
                  })}
                </Dropdown>
              </PropertyRow>

              {/* Assignees */}
              <PropertyRow icon={<IconUser />} label="Assignees">
                <Dropdown
                  id="assignees"
                  openId={openDropdown}
                  onOpen={setOpenDropdown}
                  label="Assignees"
                  icon={<IconUser />}
                  displayValue=""
                  align="right"
                  triggerClassName={GHOST_TRIGGER}
                  panelClassName="max-h-72 min-w-[240px] overflow-auto rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)"
                  triggerContent={
                    issueAssignees.length === 0 ? (
                      <span className="text-(--txt-tertiary)">Add assignee</span>
                    ) : (
                      <div className="flex min-w-0 items-center gap-2">
                        <WorkItemAvatarGroup members={issueAssignees} max={3} />
                        <span className="truncate text-(--txt-secondary)">
                          {issueAssignees.length === 1
                            ? issueAssignees[0].name
                            : `${issueAssignees.length} assignees`}
                        </span>
                      </div>
                    )
                  }
                >
                  {members.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-(--txt-tertiary)">No members.</div>
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
              <PropertyRow icon={<IconFlag />} label="Priority">
                <Dropdown
                  id="priority"
                  openId={openDropdown}
                  onOpen={setOpenDropdown}
                  label="Priority"
                  icon={<IconFlag />}
                  displayValue=""
                  align="right"
                  triggerClassName={GHOST_TRIGGER}
                  triggerContent={
                    <div className="flex items-center gap-2">
                      <PriorityIcon priority={issue.priority as Priority | null | undefined} />
                      <span className="capitalize text-(--txt-secondary)">
                        {issue.priority ?? 'No priority'}
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
                        <span className="ml-auto text-xs text-(--txt-tertiary)">Selected</span>
                      )}
                    </button>
                  ))}
                </Dropdown>
              </PropertyRow>

              {/* Created by (read-only) */}
              <PropertyRow icon={<IconUser />} label="Created by">
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
              <PropertyRow icon={<IconCalendar />} label="Start date">
                <DatePickerTrigger
                  label="Start date"
                  icon={<IconCalendar />}
                  value={issue.start_date ?? ''}
                  placeholder="Add start date"
                  onChange={(v) => updateIssue({ start_date: v })}
                />
              </PropertyRow>

              {/* Due date */}
              <PropertyRow icon={<IconCalendar />} label="Due date">
                <DatePickerTrigger
                  label="Due date"
                  icon={<IconCalendar />}
                  value={issue.target_date ?? ''}
                  placeholder="Add due date"
                  onChange={(v) => updateIssue({ target_date: v })}
                />
              </PropertyRow>

              {/* Modules (multi) */}
              <PropertyRow icon={<IconStack />} label="Modules">
                <Dropdown
                  id="module"
                  openId={openDropdown}
                  onOpen={setOpenDropdown}
                  label="Modules"
                  icon={<IconStack />}
                  displayValue=""
                  align="right"
                  triggerClassName={GHOST_TRIGGER}
                  triggerContent={
                    selectedModules.length === 0 ? (
                      <span className="text-(--txt-tertiary)">No modules</span>
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
                    <span className="text-(--txt-tertiary)">No module</span>
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
                        <span className="text-xs text-(--txt-tertiary)">Selected</span>
                      )}
                    </button>
                  ))}
                </Dropdown>
              </PropertyRow>

              {/* Cycle */}
              <PropertyRow icon={<IconCycle />} label="Cycle">
                <Dropdown
                  id="cycle"
                  openId={openDropdown}
                  onOpen={setOpenDropdown}
                  label="Cycle"
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
                      <span className="text-(--txt-tertiary)">No cycle</span>
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
                    <span className="text-(--txt-tertiary)">No cycle</span>
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
                        <span className="text-xs text-(--txt-tertiary)">Selected</span>
                      )}
                    </button>
                  ))}
                </Dropdown>
              </PropertyRow>

              {/* Parent */}
              <PropertyRow icon={<IconStack />} label="Parent">
                <Dropdown
                  id="parent"
                  openId={openDropdown}
                  onOpen={setOpenDropdown}
                  label="Parent"
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
                      <span className="text-(--txt-tertiary)">Add parent work item</span>
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
                      <span className="text-(--txt-tertiary)">Remove parent</span>
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
              <PropertyRow icon={<IconTag />} label="Labels">
                <Dropdown
                  id="labels"
                  openId={openDropdown}
                  onOpen={setOpenDropdown}
                  label="Labels"
                  icon={<IconTag />}
                  displayValue=""
                  align="right"
                  triggerClassName={GHOST_TRIGGER}
                  panelClassName="max-h-72 min-w-[240px] overflow-auto rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)"
                  triggerContent={
                    selectedLabels.length === 0 ? (
                      <span className="text-(--txt-tertiary)">Select label</span>
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
                    <div className="px-3 py-2 text-sm text-(--txt-tertiary)">No labels.</div>
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
              <PropertyRow icon={<IconType />} label="Type">
                <Dropdown
                  id="type"
                  openId={openDropdown}
                  onOpen={setOpenDropdown}
                  label="Type"
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
                  {WORK_ITEM_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-(--bg-layer-1-hover)"
                      onClick={() => {
                        setOpenDropdown(null);
                        updateIssue({ type: t.value });
                      }}
                    >
                      <span className="capitalize text-(--txt-primary)">{t.label}</span>
                      {(issue.type ?? 'task') === t.value && (
                        <span className="ml-auto text-xs text-(--txt-tertiary)">Selected</span>
                      )}
                    </button>
                  ))}
                </Dropdown>
              </PropertyRow>
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
                  Confirm state change
                </h3>
                <p className="mb-4 text-sm text-(--txt-secondary)">
                  Move this issue to <strong>{targetState?.name}</strong>? This marks it as{' '}
                  {targetState?.group}.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingStateId(null)}
                    className="rounded-(--radius-md) px-3 py-1.5 text-sm text-(--txt-secondary) hover:bg-(--bg-layer-1-hover)"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      updateIssue({ state_id: pendingStateId });
                      setPendingStateId(null);
                    }}
                    className="rounded-(--radius-md) bg-(--bg-accent-primary) px-3 py-1.5 text-sm text-white hover:opacity-90"
                  >
                    Confirm
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
            setCreateError(err instanceof Error ? err.message : 'Failed to create sub-work item');
          }
        }}
      />
    </div>
  );
}
