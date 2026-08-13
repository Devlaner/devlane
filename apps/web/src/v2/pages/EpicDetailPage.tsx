import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ExternalLink, Plus, X } from 'lucide-react';
import { Badge } from '@/v2/components/ui/badge';
import { Button } from '@/v2/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/v2/components/ui/card';
import { Input } from '@/v2/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/v2/components/ui/popover';
import { Progress } from '@/v2/components/ui/progress';
import { Skeleton } from '@/v2/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/v2/components/ui/table';
import { useSetV2Header } from '../contexts/AppShellHeaderContext';
import {
  EMPTY_PROGRESS,
  PRIORITY_LABELS,
  completionPercent,
  formatDate,
  priorityVariant,
  stateDotStyle,
  workItemDisplayId,
  type Priority,
} from '../lib/project';
import { safeUrl } from '../../lib/sanitize';
import { epicService, type EpicProgress } from '../../services/epicService';
import { issueService } from '../../services/issueService';
import { projectService } from '../../services/projectService';
import { stateService } from '../../services/stateService';
import type {
  IssueApiResponse,
  IssueLinkApiResponse,
  ProjectApiResponse,
  StateApiResponse,
} from '../../api/types';

/**
 * The v2 view of a single epic, built from shadcn primitives. It renders at
 * the same URL as EpicDetailPage; the stored interface preference picks
 * between them.
 *
 * The shipped page opens with its own back-link and title block. Here the shell
 * header carries both — the breadcrumb already says which epic this is and
 * links back to the list — so the page starts at the progress bar, which is the
 * thing the reader came for.
 *
 * The "add work item" picker moves from an inline panel that pushes the table
 * down to a popover, so the table it is adding to stays in view while you pick.
 */
export function EpicDetailPage() {
  const { t } = useTranslation();
  const { workspaceSlug, projectId, epicId } = useParams<{
    workspaceSlug: string;
    projectId: string;
    epicId: string;
  }>();
  const navigate = useNavigate();

  const [epic, setEpic] = useState<IssueApiResponse | null>(null);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [issues, setIssues] = useState<IssueApiResponse[]>([]);
  const [allIssues, setAllIssues] = useState<IssueApiResponse[]>([]);
  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [links, setLinks] = useState<IssueLinkApiResponse[]>([]);
  const [progress, setProgress] = useState<Record<string, EpicProgress>>({});
  const [loading, setLoading] = useState(Boolean(workspaceSlug && projectId && epicId));
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');

  useEffect(() => {
    if (!workspaceSlug || !projectId || !epicId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the spinner belongs to this fetch
    setLoading(true);
    Promise.all([
      epicService.get(workspaceSlug, projectId, epicId),
      epicService.listIssues(workspaceSlug, projectId, epicId),
      /* The picker's candidate pool, the states and the links are all
         decoration: failing one leaves the epic itself readable. */
      issueService
        .list(workspaceSlug, projectId, { limit: 250 })
        .catch(() => [] as IssueApiResponse[]),
      stateService.list(workspaceSlug, projectId).catch(() => [] as StateApiResponse[]),
      epicService
        .listLinks(workspaceSlug, projectId, epicId)
        .catch(() => [] as IssueLinkApiResponse[]),
      epicService.listProgress(workspaceSlug, projectId).catch(() => ({})),
      projectService.get(workspaceSlug, projectId).catch(() => null),
    ])
      .then(([ep, epicIssues, all, stateList, linkList, prog, proj]) => {
        if (cancelled) return;
        setEpic(ep ?? null);
        setIssues(epicIssues ?? []);
        setAllIssues(all ?? []);
        setStates(stateList ?? []);
        setLinks(linkList ?? []);
        setProgress(prog ?? {});
        setProject(proj);
        setNotFound(!ep);
        setError(null);
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
  }, [workspaceSlug, projectId, epicId]);

  const stateById = useMemo(() => new Map(states.map((s) => [s.id, s])), [states]);

  const counts = epicId ? (progress[epicId] ?? EMPTY_PROGRESS) : EMPTY_PROGRESS;
  const percent = completionPercent(counts);

  const candidates = useMemo(() => {
    const inEpic = new Set(issues.map((i) => i.id));
    const needle = pickerQuery.trim().toLowerCase();
    return allIssues
      .filter(
        (issue) =>
          !issue.is_epic &&
          issue.id !== epicId &&
          !inEpic.has(issue.id) &&
          (needle === '' || issue.name.toLowerCase().includes(needle)),
      )
      .slice(0, 20);
  }, [allIssues, issues, epicId, pickerQuery]);

  const onConvertToWorkItem = useCallback(async () => {
    if (!workspaceSlug || !projectId || !epicId) return;
    if (!window.confirm(t('epic.convertConfirm', 'Convert this epic back to a work item?'))) return;
    try {
      await issueService.convert(workspaceSlug, projectId, epicId, false);
      navigate(`/${workspaceSlug}/projects/${projectId}/issues/${epicId}`);
    } catch {
      setError(t('epic.convertError', 'Failed to convert to work item.'));
    }
  }, [workspaceSlug, projectId, epicId, navigate, t]);

  const headerActions = useMemo(
    () => (
      <div className="ml-auto flex items-center gap-2 px-4">
        <Button size="sm" variant="outline" onClick={() => void onConvertToWorkItem()}>
          {t('epic.convertToWorkItem', 'Convert to work item')}
        </Button>
      </div>
    ),
    [onConvertToWorkItem, t],
  );

  const parent = useMemo(
    () => ({
      label: t('common.epics', 'Epics'),
      to: `/${workspaceSlug}/projects/${projectId}/epics`,
    }),
    [workspaceSlug, projectId, t],
  );

  useSetV2Header({
    parent,
    title: epic?.name ?? null,
    actions: epic ? headerActions : null,
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-xl" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-xl lg:col-span-2" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  if (notFound || !epic) {
    return <p className="text-muted-foreground text-sm">{t('epic.notFound', 'Epic not found.')}</p>;
  }

  const state = epic.state_id ? stateById.get(epic.state_id) : undefined;

  const removeIssue = async (issueId: string) => {
    if (!workspaceSlug || !projectId) return;
    try {
      await epicService.removeIssue(workspaceSlug, projectId, epic.id, issueId);
      setIssues((prev) => prev.filter((i) => i.id !== issueId));
    } catch {
      setError(t('epic.removeIssueError', 'Failed to remove issue from epic.'));
    }
  };

  const addIssue = async (issue: IssueApiResponse) => {
    if (!workspaceSlug || !projectId) return;
    try {
      await epicService.addIssue(workspaceSlug, projectId, epic.id, issue.id);
      setIssues((prev) => [...prev, issue]);
      setPickerOpen(false);
      setPickerQuery('');
    } catch {
      setError(t('epic.addIssueError', 'Failed to add issue.'));
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <span className="text-muted-foreground font-mono text-xs">
            {workItemDisplayId(epic, project ?? undefined)}
          </span>
          <span className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={stateDotStyle(state)}
            />
            {state?.name ?? t('common.noState', 'No state')}
          </span>
          <Badge variant={priorityVariant(epic.priority)}>
            {PRIORITY_LABELS[(epic.priority ?? 'none') as Priority] ?? epic.priority}
          </Badge>
          <span className="text-muted-foreground text-sm">
            {t('issues.targetDate', 'Due')} {formatDate(epic.target_date)}
          </span>
          <div className="flex min-w-48 flex-1 items-center gap-2">
            <Progress value={percent} className="h-2 flex-1" />
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {counts.completed}/{counts.total}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              {t('epic.workItemsCount', 'Work items ({{count}})', { count: issues.length })}
            </h2>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus />
                  {t('epic.addIssue', 'Add issue')}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-2">
                <Input
                  autoFocus
                  value={pickerQuery}
                  onChange={(event) => setPickerQuery(event.target.value)}
                  placeholder={t('epic.searchIssues', 'Search issues…')}
                />
                <div className="mt-2 max-h-64 overflow-auto">
                  {candidates.length === 0 ? (
                    <p className="text-muted-foreground px-2 py-3 text-xs">
                      {t('epic.noMatchingIssues', 'No matching issues.')}
                    </p>
                  ) : (
                    candidates.map((issue) => (
                      <button
                        key={issue.id}
                        type="button"
                        onClick={() => void addIssue(issue)}
                        className="hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors"
                      >
                        <span className="text-muted-foreground shrink-0 font-mono text-xs">
                          {workItemDisplayId(issue, project ?? undefined)}
                        </span>
                        <span className="truncate">{issue.name}</span>
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="overflow-auto rounded-xl border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-3">{t('epic.colWorkItem', 'Work item')}</TableHead>
                  <TableHead className="w-40 px-3">{t('views.state', 'State')}</TableHead>
                  <TableHead className="w-32 px-3">{t('views.priority', 'Priority')}</TableHead>
                  <TableHead className="w-12 px-3" aria-label={t('common.actions', 'Actions')} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4} className="text-muted-foreground h-32 text-center">
                      {t('epic.noWorkItems', 'No work items yet.')}
                    </TableCell>
                  </TableRow>
                ) : (
                  issues.map((issue) => {
                    const issueState = issue.state_id ? stateById.get(issue.state_id) : undefined;
                    return (
                      <TableRow key={issue.id} className="group">
                        <TableCell className="p-0">
                          <Link
                            to={`/${workspaceSlug}/projects/${projectId}/issues/${issue.id}`}
                            className="hover:bg-muted/50 flex h-12 items-center gap-2 px-3 transition-colors"
                          >
                            <span className="text-muted-foreground shrink-0 font-mono text-xs">
                              {workItemDisplayId(issue, project ?? undefined)}
                            </span>
                            <span className="truncate font-medium">{issue.name}</span>
                          </Link>
                        </TableCell>
                        <TableCell className="px-3">
                          <span className="flex items-center gap-2 text-sm">
                            <span
                              aria-hidden
                              className="size-2 shrink-0 rounded-full"
                              style={stateDotStyle(issueState)}
                            />
                            <span className="truncate">
                              {issueState?.name ?? t('common.noState', 'No state')}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell className="px-3">
                          <Badge variant={priorityVariant(issue.priority)}>
                            {PRIORITY_LABELS[(issue.priority ?? 'none') as Priority] ??
                              issue.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-3 text-right">
                          {/* Focusable throughout; the fade is visual only. */}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                            title={t('epic.removeFromEpic', 'Remove from epic')}
                            aria-label={t('epic.removeNamedFromEpic', 'Remove {{name}} from epic', {
                              name: issue.name,
                            })}
                            onClick={() => void removeIssue(issue.id)}
                          >
                            <X />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <Card className="h-fit">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">{t('epic.links', 'Links')}</CardTitle>
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              aria-label={t('common.add', 'Add')}
              onClick={() => {
                setLinkOpen((open) => !open);
                setLinkUrl('');
                setLinkTitle('');
              }}
            >
              <Plus />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {linkOpen && (
              <form
                className="space-y-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (!workspaceSlug || !projectId || !linkUrl.trim()) return;
                  try {
                    const created = await epicService.createLink(
                      workspaceSlug,
                      projectId,
                      epic.id,
                      {
                        url: linkUrl.trim(),
                        title: linkTitle.trim() || undefined,
                      },
                    );
                    setLinks((prev) => [...prev, created]);
                    setLinkOpen(false);
                  } catch {
                    setError(t('epic.addLinkError', 'Failed to add link.'));
                  }
                }}
              >
                <Input
                  type="url"
                  required
                  placeholder="https://…"
                  value={linkUrl}
                  onChange={(event) => setLinkUrl(event.target.value)}
                />
                <Input
                  placeholder={t('epic.linkTitlePlaceholder', 'Title (optional)')}
                  value={linkTitle}
                  onChange={(event) => setLinkTitle(event.target.value)}
                />
                <div className="flex gap-2">
                  <Button size="sm" type="submit">
                    {t('common.add', 'Add')}
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    variant="ghost"
                    onClick={() => setLinkOpen(false)}
                  >
                    {t('common.cancel', 'Cancel')}
                  </Button>
                </div>
              </form>
            )}

            {links.length === 0 && !linkOpen ? (
              <p className="text-muted-foreground text-xs">{t('epic.noLinks', 'No links yet.')}</p>
            ) : (
              links.map((link) => (
                <div key={link.id} className="group flex items-center gap-1">
                  <a
                    href={safeUrl(link.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-xs hover:underline"
                  >
                    <ExternalLink className="size-3 shrink-0" aria-hidden />
                    <span className="truncate">{link.title || link.url}</span>
                  </a>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label={t('common.remove', 'Remove')}
                    onClick={async () => {
                      if (!workspaceSlug || !projectId) return;
                      await epicService
                        .deleteLink(workspaceSlug, projectId, epic.id, link.id)
                        .catch(() => {});
                      setLinks((prev) => prev.filter((l) => l.id !== link.id));
                    }}
                  >
                    <X />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
