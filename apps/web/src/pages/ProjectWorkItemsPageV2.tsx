import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/shadcn/ui/badge';
import { Button } from '@/components/shadcn/ui/button';
import { Skeleton } from '@/components/shadcn/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/ui/table';
import {
  CreateWorkItemDialog,
  type CreateWorkItemDialogSubmit,
} from '@/components/shadcn/create-work-item-dialog';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { issueService } from '../services/issueService';
import { projectService } from '../services/projectService';
import { stateService } from '../services/stateService';
import {
  PRIORITY_LABELS,
  formatDate,
  matchesQuery,
  priorityVariant,
  stateDotStyle,
  workItemDisplayId,
  type Priority,
} from '../lib/projectV2';
import type { IssueApiResponse, ProjectApiResponse, StateApiResponse } from '../api/types';

const PAGE_SIZE = 100;

/**
 * Design preview of a project's work item list, built from shadcn primitives.
 * It stands alongside IssueListPage rather than replacing it, so the two can be
 * compared side by side.
 *
 * Work items are grouped by state, which is how the shipped list opens. Search,
 * the state filter and the priority filter live in the shell's header
 * (ProjectWorkItemsToolbar) and arrive here through the query string, so the
 * toolbar and this page do not need shared state.
 */
export function ProjectWorkItemsPageV2() {
  const { t } = useTranslation();
  const { workspaceSlug, projectId } = useParams<{ workspaceSlug: string; projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  useDocumentTitle(t('views.workItems', 'Work items'));

  const [issues, setIssues] = useState<IssueApiResponse[]>([]);
  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const query = searchParams.get('q') ?? '';
  const stateFilter = useMemo(
    () => (searchParams.get('state') ?? '').split(',').filter(Boolean),
    [searchParams],
  );
  const priorityFilter = useMemo(
    () => (searchParams.get('priority') ?? '').split(',').filter(Boolean),
    [searchParams],
  );

  useEffect(() => {
    if (!workspaceSlug || !projectId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      /* One extra row tells us whether another page exists. */
      issueService.list(workspaceSlug, projectId, { limit: PAGE_SIZE + 1 }),
      stateService.list(workspaceSlug, projectId).catch(() => [] as StateApiResponse[]),
      projectService.get(workspaceSlug, projectId).catch(() => null),
    ])
      .then(([list, stateList, proj]) => {
        if (cancelled) return;
        const page = list.slice(0, PAGE_SIZE);
        setHasMore(list.length > PAGE_SIZE);
        setIssues(page);
        setStates(stateList ?? []);
        setProject(proj);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError(t('issues.loadError', 'Could not load work items.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, t]);

  const loadMore = async () => {
    if (!workspaceSlug || !projectId || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await issueService.list(workspaceSlug, projectId, {
        limit: PAGE_SIZE + 1,
        offset: issues.length,
      });
      const page = next.slice(0, PAGE_SIZE);
      setHasMore(next.length > PAGE_SIZE);
      setIssues((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...page.filter((i) => !seen.has(i.id))];
      });
    } catch {
      setError(t('issues.loadMoreError', 'Could not load more work items.'));
    } finally {
      setLoadingMore(false);
    }
  };

  const stateById = useMemo(() => new Map(states.map((s) => [s.id, s])), [states]);

  /* The toolbar sits in the shell's header and cannot reach this state, so it
     opens the composer through the query string. */
  const createOpen = searchParams.get('create') === '1';
  const closeCreate = useCallback(() => {
    setCreateError(null);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('create');
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  const handleCreateSave = async (data: CreateWorkItemDialogSubmit) => {
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
      /* Prepended rather than refetched: the list is paged, and a refetch would
         drop every page the reader has already loaded. */
      if (created.project_id === projectId) setIssues((prev) => [created, ...prev]);
      closeCreate();
    } catch {
      setCreateError(t('issues.createError', 'Could not create that work item.'));
    }
  };

  /* Filtering happens here rather than in the request: the list endpoint takes
     only limit and offset. */
  const visible = useMemo(
    () =>
      issues.filter((issue) => {
        if (issue.is_draft) return false;
        if (stateFilter.length && !stateFilter.includes(issue.state_id ?? '')) return false;
        if (priorityFilter.length && !priorityFilter.includes(issue.priority ?? 'none'))
          return false;
        return matchesQuery(query, issue.name, workItemDisplayId(issue, project ?? undefined));
      }),
    [issues, stateFilter, priorityFilter, query, project],
  );

  /* Grouped by state in the states' own sequence, so the columns read
     backlog-to-done as the shipped board does. Items whose state is unknown
     (or missing) collect in a trailing group rather than disappearing. */
  const groups = useMemo(() => {
    const ordered = [...states].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
    const byState = new Map<string, IssueApiResponse[]>();
    const ungrouped: IssueApiResponse[] = [];
    for (const issue of visible) {
      const state = issue.state_id ? stateById.get(issue.state_id) : undefined;
      if (!state) {
        ungrouped.push(issue);
        continue;
      }
      const bucket = byState.get(state.id);
      if (bucket) bucket.push(issue);
      else byState.set(state.id, [issue]);
    }
    const result: {
      key: string;
      state: StateApiResponse | undefined;
      items: IssueApiResponse[];
    }[] = ordered
      .filter((state) => (byState.get(state.id)?.length ?? 0) > 0)
      .map((state) => ({ key: state.id, state, items: byState.get(state.id) ?? [] }));
    if (ungrouped.length) {
      result.push({ key: '__none__', state: undefined, items: ungrouped });
    }
    return result;
  }, [visible, states, stateById]);

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-9 w-56" />
        {Array.from({ length: 10 }).map((_, index) => (
          <Skeleton key={index} className="h-11 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-3">{t('views.workItems', 'Work items')}</TableHead>
              <TableHead className="w-32 px-3">{t('views.priority', 'Priority')}</TableHead>
              <TableHead className="w-36 px-3">{t('issues.targetDate', 'Due')}</TableHead>
              <TableHead className="w-36 px-3">{t('common.updated', 'Updated')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="text-muted-foreground h-32 text-center">
                  {issues.length === 0
                    ? t('issues.empty', 'No work items yet')
                    : t('issues.noMatches', 'No work items match the current search or filters.')}
                </TableCell>
              </TableRow>
            ) : (
              groups.map((group) => (
                <Fragment key={group.key}>
                  {/* A header row rather than a nested table, so the columns stay
                      aligned across every group. */}
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={4} className="px-3 py-2">
                      <span className="flex items-center gap-2 text-xs font-medium">
                        <span
                          aria-hidden
                          className="size-2 rounded-full"
                          style={stateDotStyle(group.state)}
                        />
                        {group.state?.name ?? t('common.noState', 'No state')}
                        <Badge variant="secondary">{group.items.length}</Badge>
                      </span>
                    </TableCell>
                  </TableRow>
                  {group.items.map((issue) => (
                    <TableRow key={issue.id}>
                      <TableCell className="p-0">
                        <Link
                          to={`/${workspaceSlug}/app-v2/projects/${projectId}/work-items/${issue.id}`}
                          className="hover:bg-muted/50 flex h-11 items-center gap-2 px-3 transition-colors"
                        >
                          <span className="text-muted-foreground shrink-0 font-mono text-xs">
                            {workItemDisplayId(issue, project ?? undefined)}
                          </span>
                          <span className="truncate font-medium">{issue.name}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="px-3">
                        <Badge variant={priorityVariant(issue.priority)}>
                          {PRIORITY_LABELS[(issue.priority ?? 'none') as Priority] ??
                            issue.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground px-3 text-sm">
                        {formatDate(issue.target_date)}
                      </TableCell>
                      <TableCell className="text-muted-foreground px-3 text-sm">
                        {formatDate(issue.updated_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadMore()}
            disabled={loadingMore}
          >
            {loadingMore ? t('common.loading', 'Loading…') : t('common.loadMore', 'Load more')}
          </Button>
        </div>
      )}

      {workspaceSlug && project && (
        <CreateWorkItemDialog
          open={createOpen}
          onClose={closeCreate}
          workspaceSlug={workspaceSlug}
          /* Scoped to this project: the composer is reached from inside it, so
             the project picker has exactly one option. */
          projects={[project]}
          defaultProjectId={project.id}
          createError={createError}
          onSave={handleCreateSave}
        />
      )}
    </div>
  );
}
