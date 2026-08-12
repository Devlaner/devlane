import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Archive, ArchiveRestore, Layers } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/shadcn/ui/avatar';
import { Badge } from '@/components/shadcn/ui/badge';
import { Button } from '@/components/shadcn/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shadcn/ui/card';
import { Progress } from '@/components/shadcn/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/ui/select';
import { Separator } from '@/components/shadcn/ui/separator';
import { Skeleton } from '@/components/shadcn/ui/skeleton';
import { CommentEditor } from '../components/work-item';
import { DescriptionEditor } from '../components/work-item/DescriptionEditor';
import { DescriptionHistoryModal } from '../components/work-item/DescriptionHistoryModal';
import { IssueActivityFeed } from '../components/work-item/IssueActivityFeed';
import { IssueAttachmentsPanel } from '../components/work-item/IssueAttachmentsPanel';
import { IssueLinksPanel } from '../components/work-item/IssueLinksPanel';
import { IssuePRSidebar } from '../components/work-item/IssuePRSidebar';
import { IssueReactions } from '../components/work-item/IssueReactions';
import { IssueRelationsPanel } from '../components/work-item/IssueRelationsPanel';
import { SubscribeButton } from '../components/notifications/SubscribeButton';
import { useSetV2Header } from '../contexts/AppShellV2HeaderContext';
import { useAuth } from '../contexts/AuthContext';
import { membersFromAssigneeIds } from '../lib/issueRowHelpers';
import {
  PRIORITIES,
  PRIORITY_LABELS,
  formatDate,
  formatTimeAgo,
  priorityVariant,
  stateDotStyle,
  workItemDisplayId,
  type Priority,
} from '../lib/projectV2';
import { sanitizeHtml } from '../lib/sanitize';
import { getImageUrl } from '../lib/utils';
import { commentService } from '../services/commentService';
import { cycleService } from '../services/cycleService';
import { issueService } from '../services/issueService';
import { labelService } from '../services/labelService';
import { moduleService } from '../services/moduleService';
import { projectService } from '../services/projectService';
import { recentsService } from '../services/recentsService';
import { stateService } from '../services/stateService';
import { workspaceService } from '../services/workspaceService';
import type {
  CycleApiResponse,
  IssueActivityApiResponse,
  IssueApiResponse,
  IssueAttachmentApiResponse,
  IssueCommentApiResponse,
  IssueLinkApiResponse,
  IssueRelationApiResponse,
  LabelApiResponse,
  ModuleApiResponse,
  ProjectApiResponse,
  StateApiResponse,
  WorkspaceMemberApiResponse,
} from '../api/types';

const EMPTY_RELATIONS: IssueRelationApiResponse = {
  blocking: [],
  blocked_by: [],
  duplicate: [],
  relates_to: [],
};

/** Placeholder value for the "no selection" option in a Select. */
const NONE = '__none__';

/**
 * Design preview of a work item, built from shadcn primitives. It stands
 * alongside IssueDetailPage rather than replacing it, so the two can be
 * compared side by side.
 *
 * The editors and the sidebar panels are the shipped components, imported
 * whole: the TipTap description and comment editors, the activity feed, the PR
 * / links / relations / attachments panels and the subscribe button. They carry
 * their own state, their own requests and — in the editors' case — a
 * substantial extension stack. Rebuilding them would be a rewrite of the work
 * item editor rather than a design preview.
 *
 * What is rewritten is everything around them, and one thing is deliberately
 * different: the shipped page drives every property through a bespoke
 * `Dropdown` sharing a single `openDropdown` id across a dozen rows. Here each
 * property is a `Select`, so the properties panel is a form rather than a
 * cluster of custom popovers, and keyboard behaviour comes from the primitive.
 */
export function IssueDetailPageV2() {
  const { t } = useTranslation();
  const { workspaceSlug, projectId, issueId } = useParams<{
    workspaceSlug: string;
    projectId: string;
    issueId: string;
  }>();
  const { user: currentUser } = useAuth();

  const [issue, setIssue] = useState<IssueApiResponse | null>(null);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [labels, setLabels] = useState<LabelApiResponse[]>([]);
  const [cycles, setCycles] = useState<CycleApiResponse[]>([]);
  const [modules, setModules] = useState<ModuleApiResponse[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [allIssues, setAllIssues] = useState<IssueApiResponse[]>([]);
  const [comments, setComments] = useState<IssueCommentApiResponse[]>([]);
  const [activities, setActivities] = useState<IssueActivityApiResponse[]>([]);
  const [links, setLinks] = useState<IssueLinkApiResponse[]>([]);
  const [relations, setRelations] = useState<IssueRelationApiResponse>(EMPTY_RELATIONS);
  const [attachments, setAttachments] = useState<IssueAttachmentApiResponse[]>([]);
  const [loading, setLoading] = useState(Boolean(workspaceSlug && projectId && issueId));
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [postingComment, setPostingComment] = useState(false);

  useEffect(() => {
    if (!workspaceSlug || !projectId || !issueId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      issueService.get(workspaceSlug, projectId, issueId),
      projectService.get(workspaceSlug, projectId).catch(() => null),
      stateService.list(workspaceSlug, projectId).catch(() => [] as StateApiResponse[]),
      labelService.list(workspaceSlug, projectId).catch(() => [] as LabelApiResponse[]),
      cycleService.list(workspaceSlug, projectId).catch(() => [] as CycleApiResponse[]),
      moduleService.list(workspaceSlug, projectId).catch(() => [] as ModuleApiResponse[]),
      workspaceService.listMembers(workspaceSlug).catch(() => [] as WorkspaceMemberApiResponse[]),
      /* The sibling list backs the relations picker and the sub-item list. */
      issueService.list(workspaceSlug, projectId, { limit: 250 }).catch(() => []),
      commentService.list(workspaceSlug, projectId, issueId).catch(() => []),
      issueService.listActivities(workspaceSlug, projectId, issueId).catch(() => []),
      issueService.listLinks(workspaceSlug, projectId, issueId).catch(() => []),
      issueService.listRelations(workspaceSlug, projectId, issueId).catch(() => EMPTY_RELATIONS),
      issueService.listAttachments(workspaceSlug, projectId, issueId).catch(() => []),
    ])
      .then(([i, p, st, lab, cyc, mod, mem, all, com, acts, lnks, rels, atts]) => {
        if (cancelled) return;
        setIssue(i ?? null);
        setProject(p);
        setStates(st ?? []);
        setLabels(lab ?? []);
        setCycles(cyc ?? []);
        setModules(mod ?? []);
        setMembers(mem ?? []);
        setAllIssues(all ?? []);
        setComments(com ?? []);
        setActivities(acts ?? []);
        setLinks(lnks ?? []);
        setRelations(rels ?? EMPTY_RELATIONS);
        setAttachments(atts ?? []);
        setNotFound(!i);
        if (i) {
          recentsService
            .record(workspaceSlug, {
              entity_name: 'issue',
              entity_identifier: issueId,
              project_id: projectId,
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, issueId]);

  const stateById = useMemo(() => new Map(states.map((s) => [s.id, s])), [states]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.member_id, m])), [members]);

  const memberLabel = useCallback(
    (memberId: string | null | undefined) => {
      if (!memberId) return '—';
      const member = memberById.get(memberId);
      return (
        member?.member_display_name?.trim() ||
        member?.member_email?.split('@')[0]?.trim() ||
        t('common.member', 'Member')
      );
    },
    [memberById, t],
  );

  const mentionMembers = useMemo(
    () => members.map((m) => ({ id: m.member_id, label: memberLabel(m.member_id) })),
    [members, memberLabel],
  );

  const updateIssue = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!workspaceSlug || !projectId || !issueId) return;
      setError(null);
      try {
        const updated = await issueService.update(
          workspaceSlug,
          projectId,
          issueId,
          patch as never,
        );
        setIssue(updated);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t('workItem.detail.updateFailed', 'Failed to update work item.'),
        );
      }
    },
    [workspaceSlug, projectId, issueId, t],
  );

  const postComment = useCallback(
    async (contentHtml: string, access: 'INTERNAL' | 'EXTERNAL' = 'INTERNAL') => {
      if (!workspaceSlug || !projectId || !issueId || !contentHtml.trim()) return false;
      setError(null);
      setPostingComment(true);
      try {
        const created = await commentService.create(
          workspaceSlug,
          projectId,
          issueId,
          contentHtml,
          access,
        );
        setComments((prev) => [...prev, created]);
        /* A comment is an activity too, so the feed refreshes alongside it. */
        issueService
          .listActivities(workspaceSlug, projectId, issueId)
          .then(setActivities)
          .catch(() => {});
        return true;
      } catch {
        setError(t('workItem.detail.commentFailed', 'Failed to post comment.'));
        return false;
      } finally {
        setPostingComment(false);
      }
    },
    [workspaceSlug, projectId, issueId, t],
  );

  /* Cycle membership is an add/remove on the cycle, not a field on the work
     item, so the item is re-read afterwards rather than patched locally. */
  const setCycle = useCallback(
    async (nextCycleId: string | null) => {
      if (!workspaceSlug || !projectId || !issue) return;
      setError(null);
      try {
        await Promise.all(
          (issue.cycle_ids ?? []).map((id) =>
            cycleService.removeIssue(workspaceSlug, projectId, id, issue.id).catch(() => {}),
          ),
        );
        if (nextCycleId) {
          await cycleService
            .addIssue(workspaceSlug, projectId, nextCycleId, issue.id)
            .catch(() => {});
        }
        const refreshed = await issueService
          .get(workspaceSlug, projectId, issue.id)
          .catch(() => null);
        if (refreshed) setIssue(refreshed);
      } catch {
        setError(t('workItem.detail.updateFailed', 'Failed to update work item.'));
      }
    },
    [workspaceSlug, projectId, issue, t],
  );

  const setModule = useCallback(
    async (nextModuleId: string | null) => {
      if (!workspaceSlug || !projectId || !issue) return;
      setError(null);
      try {
        await Promise.all(
          (issue.module_ids ?? []).map((id) =>
            moduleService.removeIssue(workspaceSlug, projectId, id, issue.id).catch(() => {}),
          ),
        );
        if (nextModuleId) {
          await moduleService
            .addIssue(workspaceSlug, projectId, nextModuleId, issue.id)
            .catch(() => {});
        }
        const refreshed = await issueService
          .get(workspaceSlug, projectId, issue.id)
          .catch(() => null);
        if (refreshed) setIssue(refreshed);
      } catch {
        setError(t('workItem.detail.updateFailed', 'Failed to update work item.'));
      }
    },
    [workspaceSlug, projectId, issue, t],
  );

  const toggleArchive = useCallback(async () => {
    if (!workspaceSlug || !projectId || !issue) return;
    setError(null);
    try {
      const updated = issue.archived_at
        ? await issueService.restore(workspaceSlug, projectId, issue.id)
        : await issueService.archive(workspaceSlug, projectId, issue.id);
      setIssue(updated ?? issue);
    } catch {
      setError(t('workItem.detail.archiveFailed', 'Failed to archive work item.'));
    }
  }, [workspaceSlug, projectId, issue, t]);

  const parent = useMemo(
    () => ({
      label: t('views.workItems', 'Work items'),
      to: `/${workspaceSlug}/app-v2/projects/${projectId}/work-items`,
    }),
    [workspaceSlug, projectId, t],
  );

  const headerActions = useMemo(() => {
    if (!issue || !workspaceSlug || !projectId) return null;
    return (
      <div className="ml-auto flex items-center gap-2 px-4">
        <SubscribeButton workspaceSlug={workspaceSlug} projectId={projectId} issueId={issue.id} />
        <Button size="sm" variant="outline" onClick={() => void toggleArchive()}>
          {issue.archived_at ? <ArchiveRestore /> : <Archive />}
          {issue.archived_at ? t('common.restore', 'Restore') : t('common.archive', 'Archive')}
        </Button>
      </div>
    );
  }, [issue, workspaceSlug, projectId, toggleArchive, t]);

  useSetV2Header({
    parent,
    title: issue?.name ?? null,
    actions: issue ? headerActions : null,
  });

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (notFound || !issue || !workspaceSlug || !projectId) {
    return (
      <p className="text-muted-foreground text-sm">
        {t('workItem.detail.issueNotFound', 'Issue not found.')}
      </p>
    );
  }

  const state = issue.state_id ? stateById.get(issue.state_id) : undefined;
  const assignees = membersFromAssigneeIds(members, issue.assignee_ids ?? []);
  const issueLabels = (issue.label_ids ?? [])
    .map((id) => labels.find((l) => l.id === id))
    .filter((l): l is LabelApiResponse => Boolean(l));
  const selectedCycleId = issue.cycle_ids?.[0] ?? null;
  const selectedModuleId = issue.module_ids?.[0] ?? null;
  const children = allIssues.filter((i) => i.parent_id === issue.id);
  const completedChildren = children.filter(
    (child) => (child.state_id ? stateById.get(child.state_id)?.group : undefined) === 'completed',
  ).length;
  const descriptionHtml = typeof issue.description_html === 'string' ? issue.description_html : '';
  const baseUrl = `/${workspaceSlug}/projects/${projectId}`;

  return (
    <div className="space-y-4 pb-8">
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm">
                {t('workItem.detail.description', 'Description')}
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setHistoryOpen(true)}>
                {t('workItem.detail.history', 'History')}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <DescriptionEditor
                initialHtml={descriptionHtml}
                onSave={(html) => updateIssue({ description: html, description_html: html })}
                placeholder={t(
                  'workItem.detail.descriptionPlaceholder',
                  'Add a description… (type / for commands)',
                )}
                mentionMembers={mentionMembers}
              />
              <IssueReactions
                workspaceSlug={workspaceSlug}
                projectId={projectId}
                issueId={issue.id}
                currentUserId={currentUser?.id}
              />
            </CardContent>
          </Card>

          {children.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Layers className="size-4" aria-hidden />
                  {t('workItem.detail.subWorkItems', 'Sub-work items')}
                  <Badge variant="secondary">{children.length}</Badge>
                </CardTitle>
                <div className="flex w-40 items-center gap-2">
                  <Progress
                    value={Math.round((completedChildren / children.length) * 100)}
                    className="h-2 flex-1"
                  />
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {completedChildren}/{children.length}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {children.map((child) => {
                    const childState = child.state_id ? stateById.get(child.state_id) : undefined;
                    return (
                      <li key={child.id}>
                        <Link
                          to={`/${workspaceSlug}/app-v2/projects/${projectId}/work-items/${child.id}`}
                          className="hover:bg-muted/50 flex items-center gap-2 px-6 py-2.5 transition-colors"
                        >
                          <span
                            aria-hidden
                            className="size-2 shrink-0 rounded-full"
                            style={stateDotStyle(childState)}
                          />
                          <span className="text-muted-foreground shrink-0 font-mono text-xs">
                            {workItemDisplayId(child, project ?? undefined)}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm">{child.name}</span>
                          {child.priority && child.priority !== 'none' && (
                            <Badge variant={priorityVariant(child.priority)} className="shrink-0">
                              {PRIORITY_LABELS[child.priority as Priority] ?? child.priority}
                            </Badge>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm">{t('workItem.detail.activity', 'Activity')}</CardTitle>
              <span className="text-muted-foreground text-xs">
                {t('workItem.detail.commentsCount', 'Comments {{count}}', {
                  count: comments.length,
                })}
              </span>
            </CardHeader>
            <CardContent className="space-y-4">
              <IssueActivityFeed
                activities={activities}
                members={members}
                states={states}
                labels={labels}
              />

              <Separator />

              {comments.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {t('workItem.detail.noComments', 'No comments yet.')}
                </p>
              ) : (
                <ul className="space-y-4">
                  {comments.map((comment) => {
                    const isBot = !comment.created_by_id;
                    const authorName = isBot ? 'GitHub' : memberLabel(comment.created_by_id);
                    const avatar = comment.created_by_id
                      ? memberById.get(comment.created_by_id)?.member_avatar
                      : null;
                    return (
                      <li key={comment.id} className="flex items-start gap-3">
                        <Avatar className="mt-0.5 size-7 shrink-0">
                          {avatar && <AvatarImage src={getImageUrl(avatar) ?? undefined} alt="" />}
                          <AvatarFallback className="text-[10px]">
                            {authorName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="bg-muted/40 min-w-0 flex-1 rounded-lg border p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-medium">{authorName}</span>
                            {isBot && (
                              <Badge variant="secondary">{t('workItem.detail.bot', 'Bot')}</Badge>
                            )}
                            {comment.access === 'EXTERNAL' && (
                              <Badge variant="outline">
                                {t('workItem.detail.external', 'External')}
                              </Badge>
                            )}
                            <span className="text-muted-foreground text-xs">
                              {formatTimeAgo(comment.created_at)}
                            </span>
                          </div>
                          <div
                            className="prose prose-sm dark:prose-invert mt-2 max-w-none text-sm"
                            /* Server-authored HTML, sanitized before render — the
                               same treatment the shipped page gives it. */
                            dangerouslySetInnerHTML={{
                              __html: sanitizeHtml(comment.comment ?? ''),
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <CommentEditor
                onSubmit={postComment}
                isSubmitting={postingComment}
                showShortcutHint
                showAccessToggle
                mentionMembers={mentionMembers}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                {t('workItem.detail.properties', 'Properties')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <PropertyField label={t('workItem.detail.field.state', 'State')}>
                <Select
                  value={issue.state_id ?? NONE}
                  onValueChange={(value) =>
                    void updateIssue({ state_id: value === NONE ? null : value })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t('common.noState', 'No state')}</SelectItem>
                    {states.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className="size-2 shrink-0 rounded-full"
                            style={stateDotStyle(option)}
                          />
                          {option.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </PropertyField>

              <PropertyField label={t('workItem.detail.field.priority', 'Priority')}>
                <Select
                  value={issue.priority ?? 'none'}
                  onValueChange={(value) => void updateIssue({ priority: value })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {PRIORITY_LABELS[priority]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </PropertyField>

              <PropertyField label={t('workItem.detail.field.cycle', 'Cycle')}>
                <Select
                  value={selectedCycleId ?? NONE}
                  onValueChange={(value) => void setCycle(value === NONE ? null : value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t('common.none', 'None')}</SelectItem>
                    {cycles.map((cycle) => (
                      <SelectItem key={cycle.id} value={cycle.id}>
                        {cycle.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </PropertyField>

              <PropertyField label={t('workItem.detail.field.module', 'Module')}>
                <Select
                  value={selectedModuleId ?? NONE}
                  onValueChange={(value) => void setModule(value === NONE ? null : value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t('common.none', 'None')}</SelectItem>
                    {modules.map((module) => (
                      <SelectItem key={module.id} value={module.id}>
                        {module.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </PropertyField>

              <Separator />

              <PropertyField label={t('workItem.detail.field.assignees', 'Assignees')}>
                {assignees.length === 0 ? (
                  <span className="text-muted-foreground text-sm">
                    {t('common.unassigned', 'Unassigned')}
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {assignees.map((assignee) => (
                      <span key={assignee.id} className="flex items-center gap-1.5 text-sm">
                        <Avatar className="size-5">
                          {assignee.avatarUrl && (
                            <AvatarImage
                              src={getImageUrl(assignee.avatarUrl) ?? undefined}
                              alt=""
                            />
                          )}
                          <AvatarFallback className="text-[10px]">
                            {assignee.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{assignee.name}</span>
                      </span>
                    ))}
                  </div>
                )}
              </PropertyField>

              <PropertyField label={t('workItem.detail.field.labels', 'Labels')}>
                {issueLabels.length === 0 ? (
                  <span className="text-muted-foreground text-sm">{t('common.none', 'None')}</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {issueLabels.map((label) => (
                      <Badge key={label.id} variant="outline">
                        <span
                          aria-hidden
                          className="mr-1 size-2 rounded-full"
                          style={{ backgroundColor: label.color || 'var(--muted-foreground)' }}
                        />
                        {label.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </PropertyField>

              <PropertyField label={t('workItem.detail.field.startDate', 'Start date')}>
                <span className="text-sm">{formatDate(issue.start_date)}</span>
              </PropertyField>

              <PropertyField label={t('issues.targetDate', 'Due')}>
                <span className="text-sm">{formatDate(issue.target_date)}</span>
              </PropertyField>

              <PropertyField label={t('workItem.detail.field.state', 'State')}>
                <span className="flex items-center gap-2 text-sm">
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={stateDotStyle(state)}
                  />
                  {state?.name ?? t('common.noState', 'No state')}
                </span>
              </PropertyField>
            </CardContent>
          </Card>

          <IssuePRSidebar workspaceSlug={workspaceSlug} projectId={projectId} issueId={issue.id} />

          <IssueLinksPanel
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            issueId={issue.id}
            links={links}
            onLinksChange={setLinks}
          />

          <IssueRelationsPanel
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            projectIdentifier={project?.identifier ?? projectId.slice(0, 6)}
            issueId={issue.id}
            /* The panel builds its own hrefs from this; it belongs to the
               shipped tree, so it keeps the shipped base. */
            baseUrl={baseUrl}
            allIssues={allIssues}
            relations={relations}
            onRelationsChange={setRelations}
          />

          <IssueAttachmentsPanel
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            issueId={issue.id}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
          />
        </div>
      </div>

      <DescriptionHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        issueId={issue.id}
        authorLabel={memberLabel}
        onRestored={setIssue}
      />
    </div>
  );
}

/** One labelled row in the properties panel. */
function PropertyField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      <div>{children}</div>
    </div>
  );
}
