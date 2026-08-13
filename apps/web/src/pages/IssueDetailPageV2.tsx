import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Archive,
  ArchiveRestore,
  CircleAlert,
  History,
  Layers,
  Link2,
  ListTree,
  MessageSquare,
  Activity as ActivityIcon,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/shadcn/ui/avatar';
import { Badge } from '@/components/shadcn/ui/badge';
import { Button } from '@/components/shadcn/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shadcn/ui/card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/shadcn/ui/empty';
import { Progress } from '@/components/shadcn/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/ui/select';
import { Separator } from '@/components/shadcn/ui/separator';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/shadcn/ui/toggle-group';
import { DetailPageSkeleton } from '@/components/shadcn/detail-page-skeleton';
import { PageHeading } from '@/components/shadcn/page-heading';
import { WorkItemSubscribeButton } from '@/components/shadcn/work-item-subscribe-button';
import {
  InlineAssigneeCell,
  InlineDateCell,
  InlineLabelsCell,
  InlinePriorityCell,
  InlineStateCell,
} from '@/components/shadcn/work-item-inline-cells';
import { CommentEditor } from '../components/work-item';
import { DescriptionEditor } from '../components/work-item/DescriptionEditor';
import { DescriptionHistoryModal } from '../components/work-item/DescriptionHistoryModal';
import { IssueActivityFeed } from '../components/work-item/IssueActivityFeed';
import { IssueAttachmentsPanel } from '../components/work-item/IssueAttachmentsPanel';
import { IssueLinksPanel } from '../components/work-item/IssueLinksPanel';
import { IssuePRSidebar } from '../components/work-item/IssuePRSidebar';
import { IssueReactions } from '../components/work-item/IssueReactions';
import { IssueRelationsPanel } from '../components/work-item/IssueRelationsPanel';
import type { IssueInlinePatch } from '../components/work-item/layouts/IssueLayoutTypes';
import { useSetV2Header } from '../contexts/AppShellV2HeaderContext';
import { useAuth } from '../contexts/AuthContext';
import {
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

const DETAIL_SECTIONS = ['comments', 'sub-items', 'activity'] as const;
type DetailSection = (typeof DETAIL_SECTIONS)[number];

function isDetailSection(value: string): value is DetailSection {
  return (DETAIL_SECTIONS as readonly string[]).includes(value);
}

/**
 * Design preview of a work item, built from shadcn primitives. It stands
 * alongside IssueDetailPage rather than replacing it, so the two can be
 * compared side by side.
 *
 * The frame is the one the v2 list pages use, so a work item reads as the same
 * kind of page as the list it came from: `PageHeading`, then a toolbar band
 * carrying the controls and the page's actions, then the body. `ListPageSkeleton`
 * has a detail-shaped sibling, `DetailPageSkeleton`, and the not-found case is
 * an `Empty` rather than a bare sentence — the states the list pages already
 * have, in the same shapes.
 *
 * Two structural changes follow from that frame:
 *   - The properties that get changed most (state, priority, assignees, due
 *     date) move out of the sidebar into the toolbar as the same inline cells
 *     the list rows use, so a row and its detail page are edited identically.
 *   - The main column no longer stacks description, sub-items and activity into
 *     one long scroll. Description stays pinned; sub-items, comments and
 *     activity become tabs, each labelled with its count.
 *
 * The editors and the sidebar panels are the shipped components, imported
 * whole: the TipTap description and comment editors, the activity feed, the PR
 * / links / relations / attachments panels. They carry their own state, their
 * own requests and — in the editors' case — a substantial extension stack.
 * Rebuilding them would be a rewrite of the work item editor rather than a
 * design preview.
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
  const [detailSection, setDetailSection] = useState<DetailSection>('comments');

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

  const copyLink = useCallback(() => {
    void navigator.clipboard
      ?.writeText(window.location.href)
      .then(() => toast.success(t('common.linkCopied', 'Link copied')))
      .catch(() => toast.error(t('common.copyLinkError', 'Could not copy that link.')));
  }, [t]);

  const listUrl = `/${workspaceSlug}/app-v2/projects/${projectId}/work-items`;

  const parent = useMemo(
    () => ({
      label: t('views.workItems', 'Work items'),
      to: `/${workspaceSlug}/app-v2/projects/${projectId}/work-items`,
    }),
    [workspaceSlug, projectId, t],
  );

  /* The actions live in the page's toolbar, next to the controls they act on,
     the way the v2 list pages place theirs — the 64px shell header keeps the
     breadcrumb alone. */
  useSetV2Header({ parent, title: issue?.name ?? null, actions: null });

  if (loading) {
    return <DetailPageSkeleton label={t('workItem.detail.loading', 'Loading work item')} />;
  }

  if (notFound || !issue || !workspaceSlug || !projectId) {
    return (
      <Empty className="min-h-80 rounded-xl border border-dashed" role="alert">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
            <CircleAlert aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t('workItem.detail.issueNotFound', 'Issue not found.')}</EmptyTitle>
          <EmptyDescription>
            {t(
              'workItem.detail.notFoundDescription',
              'This work item may have been deleted, or it belongs to a project you cannot open.',
            )}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild variant="outline">
            <Link to={listUrl}>{t('workItem.detail.backToList', 'Back to work items')}</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const state = issue.state_id ? stateById.get(issue.state_id) : undefined;
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
  const childUrl = (childId: string) =>
    `/${workspaceSlug}/app-v2/projects/${projectId}/work-items/${childId}`;
  const inlineUpdate = (patch: IssueInlinePatch) => void updateIssue({ ...patch });

  const tabCount = (value: number) => (
    <span className="text-muted-foreground min-w-3 text-center text-xs font-normal tabular-nums">
      {value}
    </span>
  );

  return (
    <div className="space-y-6 pb-8">
      <PageHeading
        title={
          <span className="flex flex-wrap items-baseline gap-2">
            <span className="text-muted-foreground font-mono text-base">
              {workItemDisplayId(issue, project ?? undefined)}
            </span>
            <span className="min-w-0">{issue.name}</span>
            {issue.archived_at && (
              <Badge variant="secondary">{t('common.archived', 'Archived')}</Badge>
            )}
          </span>
        }
        description={t(
          'workItem.detail.pageDescription',
          'Track the description, sub-work items, and discussion for this work item.',
        )}
        summary={t('workItem.detail.pageSummary', 'Updated {{updated}} · Created {{created}}', {
          updated: formatTimeAgo(issue.updated_at),
          created: formatDate(issue.created_at),
        })}
      />

      <div
        className="bg-card/50 flex flex-wrap items-center gap-2 rounded-xl border p-3 shadow-xs sm:p-4"
        role="region"
        aria-label={t('workItem.detail.toolbar', 'Work item controls')}
      >
        <InlineStateCell issue={issue} states={states} onUpdate={inlineUpdate} />
        <InlinePriorityCell issue={issue} onUpdate={inlineUpdate} />
        <InlineAssigneeCell issue={issue} members={members} onUpdate={inlineUpdate} />
        <InlineDateCell issue={issue} field="target_date" onUpdate={inlineUpdate} />

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <WorkItemSubscribeButton
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            issueId={issue.id}
            className="h-11 sm:h-9"
          />
          <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={copyLink}>
            <Link2 aria-hidden="true" />
            <span className="hidden sm:inline">{t('common.copyLink', 'Copy link')}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 sm:h-9"
            onClick={() => void toggleArchive()}
          >
            {issue.archived_at ? (
              <ArchiveRestore aria-hidden="true" />
            ) : (
              <Archive aria-hidden="true" />
            )}
            <span className="hidden sm:inline">
              {issue.archived_at ? t('common.restore', 'Restore') : t('common.archive', 'Archive')}
            </span>
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm">
                {t('workItem.detail.description', 'Description')}
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setHistoryOpen(true)}>
                <History aria-hidden="true" />
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

          {/* One long scroll of description → sub-items → activity → comments
              made the discussion the least reachable part of the page. The
              three become tabs, each carrying its own count, mirroring the
              scope tabs on the archive and cycle lists. */}
          <div className="flex flex-col gap-4">
            <ToggleGroup
              type="single"
              value={detailSection}
              onValueChange={(value) => {
                if (isDetailSection(value)) setDetailSection(value);
              }}
              variant="default"
              size="sm"
              spacing={1}
              className="bg-muted/60 w-fit max-w-full shrink-0 touch-pan-x overflow-x-auto rounded-lg p-1 sm:p-0.5"
              aria-label={t('workItem.detail.sections', 'Work item sections')}
            >
              <ToggleGroupItem
                value="comments"
                className="data-[state=on]:bg-background h-11 min-w-0 gap-1.5 px-3 data-[state=on]:shadow-xs sm:h-8 sm:px-2.5"
              >
                <MessageSquare aria-hidden="true" />
                {t('workItem.detail.comments', 'Comments')}
                {tabCount(comments.length)}
              </ToggleGroupItem>
              <ToggleGroupItem
                value="sub-items"
                className="data-[state=on]:bg-background h-11 min-w-0 gap-1.5 px-3 data-[state=on]:shadow-xs sm:h-8 sm:px-2.5"
              >
                <ListTree aria-hidden="true" />
                {t('workItem.detail.subWorkItems', 'Sub-work items')}
                {tabCount(children.length)}
              </ToggleGroupItem>
              <ToggleGroupItem
                value="activity"
                className="data-[state=on]:bg-background h-11 min-w-0 gap-1.5 px-3 data-[state=on]:shadow-xs sm:h-8 sm:px-2.5"
              >
                <ActivityIcon aria-hidden="true" />
                {t('workItem.detail.activity', 'Activity')}
                {tabCount(activities.length)}
              </ToggleGroupItem>
            </ToggleGroup>

            {detailSection === 'comments' && (
              <div className="space-y-4">
                {comments.length === 0 ? (
                  <Empty className="rounded-xl border border-dashed">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <MessageSquare aria-hidden="true" />
                      </EmptyMedia>
                      <EmptyTitle>{t('workItem.detail.noComments', 'No comments yet.')}</EmptyTitle>
                      <EmptyDescription>
                        {t(
                          'workItem.detail.noCommentsDescription',
                          'Start the discussion — comments are visible to everyone who can open this work item.',
                        )}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
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
                            {avatar && (
                              <AvatarImage src={getImageUrl(avatar) ?? undefined} alt="" />
                            )}
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
              </div>
            )}

            {detailSection === 'sub-items' && (
              <div className="space-y-4">
                {children.length === 0 ? (
                  <Empty className="rounded-xl border border-dashed">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Layers aria-hidden="true" />
                      </EmptyMedia>
                      <EmptyTitle>
                        {t('workItem.detail.noSubWorkItems', 'No sub-work items yet')}
                      </EmptyTitle>
                      <EmptyDescription>
                        {t(
                          'workItem.detail.noSubWorkItemsDescription',
                          'Break this work item down by setting it as the parent of another work item.',
                        )}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <Progress
                        value={Math.round((completedChildren / children.length) * 100)}
                        className="h-2 max-w-56 flex-1"
                        aria-label={t('workItem.detail.subWorkItemsProgress', 'Sub-work progress')}
                      />
                      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                        {completedChildren}/{children.length}
                      </span>
                    </div>

                    {/* Shaped like a row on the work item list, so a sub-item
                      reads the same here as it does there. */}
                    <section
                      className="overflow-hidden rounded-xl border"
                      aria-label={t('workItem.detail.subWorkItems', 'Sub-work items')}
                    >
                      <Table>
                        <TableCaption className="sr-only">
                          {t(
                            'workItem.detail.subItemsTableCaption',
                            'Sub-work items of this work item, with state, priority, and due date.',
                          )}
                        </TableCaption>
                        <TableHeader className="bg-muted/50">
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="min-w-56 px-3">
                              {t('views.workItems', 'Work items')}
                            </TableHead>
                            <TableHead className="w-36 px-3">{t('views.state', 'State')}</TableHead>
                            <TableHead className="hidden w-28 px-3 sm:table-cell">
                              {t('views.priority', 'Priority')}
                            </TableHead>
                            <TableHead className="hidden w-32 px-3 md:table-cell">
                              {t('issues.targetDate', 'Due')}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {children.map((child) => {
                            const childState = child.state_id
                              ? stateById.get(child.state_id)
                              : undefined;
                            const childPriority = (child.priority ?? 'none') as Priority;
                            return (
                              <TableRow key={child.id}>
                                <TableCell className="min-w-56 px-3 py-2">
                                  <Link
                                    to={childUrl(child.id)}
                                    className="focus-visible:ring-ring flex min-w-0 items-center gap-2 rounded-sm outline-none focus-visible:ring-2"
                                  >
                                    <span className="text-muted-foreground shrink-0 font-mono text-xs">
                                      {workItemDisplayId(child, project ?? undefined)}
                                    </span>
                                    <span className="truncate font-medium">{child.name}</span>
                                  </Link>
                                </TableCell>
                                <TableCell className="px-3">
                                  <span className="flex items-center gap-2 text-sm">
                                    <span
                                      aria-hidden="true"
                                      className="size-2 shrink-0 rounded-full"
                                      style={stateDotStyle(childState)}
                                    />
                                    <span className="truncate">
                                      {childState?.name ?? t('common.noState', 'No state')}
                                    </span>
                                  </span>
                                </TableCell>
                                <TableCell className="hidden px-3 sm:table-cell">
                                  {childPriority !== 'none' && (
                                    <Badge variant={priorityVariant(childPriority)}>
                                      {PRIORITY_LABELS[childPriority] ?? childPriority}
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-muted-foreground hidden px-3 text-sm md:table-cell">
                                  {child.target_date ? formatDate(child.target_date) : '—'}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </section>
                  </>
                )}
              </div>
            )}

            {detailSection === 'activity' && (
              <div>
                <Card>
                  <CardContent>
                    <IssueActivityFeed
                      activities={activities}
                      members={members}
                      states={states}
                      labels={labels}
                    />
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                {t('workItem.detail.properties', 'Properties')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* State and priority are edited from the toolbar, so the panel
                  carries the rest — and the fields that used to be read-only
                  here (assignees, labels, dates) now use the same inline cells
                  the list rows do. */}
              <PropertyField label={t('workItem.detail.field.assignees', 'Assignees')}>
                <InlineAssigneeCell
                  issue={issue}
                  members={members}
                  maxAvatars={5}
                  onUpdate={inlineUpdate}
                />
              </PropertyField>

              <PropertyField label={t('workItem.detail.field.labels', 'Labels')}>
                <InlineLabelsCell
                  issue={issue}
                  labels={labels}
                  maxChips={4}
                  onUpdate={inlineUpdate}
                />
              </PropertyField>

              <Separator />

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

              <PropertyField label={t('workItem.detail.field.startDate', 'Start date')}>
                <InlineDateCell issue={issue} field="start_date" onUpdate={inlineUpdate} />
              </PropertyField>

              <PropertyField label={t('issues.targetDate', 'Due')}>
                <InlineDateCell issue={issue} field="target_date" onUpdate={inlineUpdate} />
              </PropertyField>

              <Separator />

              <dl className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <dt className="text-muted-foreground text-xs font-medium">
                    {t('common.created', 'Created')}
                  </dt>
                  <dd className="text-sm">{formatDate(issue.created_at)}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-muted-foreground text-xs font-medium">
                    {t('common.updated', 'Updated')}
                  </dt>
                  <dd className="text-sm">
                    <time dateTime={issue.updated_at} title={formatDate(issue.updated_at)}>
                      {formatTimeAgo(issue.updated_at)}
                    </time>
                  </dd>
                </div>
              </dl>

              {/* The state also names the item's status at a glance, which the
                  toolbar's control shows but a printed or narrated page does
                  not, so it stays here as text. */}
              <p className="sr-only">
                {t('workItem.detail.field.state', 'State')}:{' '}
                {state?.name ?? t('common.noState', 'No state')}
                {issueLabels.length > 0 &&
                  ` · ${t('common.labels', 'Labels')}: ${issueLabels
                    .map((label) => label.name)
                    .join(', ')}`}
              </p>
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
