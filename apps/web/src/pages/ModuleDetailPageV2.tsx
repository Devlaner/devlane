import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Boxes, Plus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/shadcn/ui/avatar';
import { Badge } from '@/components/shadcn/ui/badge';
import { Button } from '@/components/shadcn/ui/button';
import { Card, CardContent } from '@/components/shadcn/ui/card';
import { Progress } from '@/components/shadcn/ui/progress';
import { Skeleton } from '@/components/shadcn/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/ui/table';
import { AddExistingWorkItemModal } from '../components/AddExistingWorkItemModal';
import { CreateWorkItemModal } from '../components/CreateWorkItemModal';
import { ModuleLinksSection } from '../components/module-work-items/ModuleLinksSection';
import { useSetV2Header } from '../contexts/AppShellV2HeaderContext';
import { buildGroupedIssues } from '../lib/issueListGroupAndSort';
import { applyModuleSubWorkFilter, filterModuleIssues } from '../lib/moduleWorkItemsApply';
import {
  DEFAULT_MODULE_WORK_ITEMS_FILTERS,
  moduleWorkItemsPrefsKey,
  parseModuleWorkItemsPrefs,
} from '../lib/moduleWorkItemsPrefs';
import { cloneDefaultProjectIssuesDisplay } from '../lib/projectIssuesDisplay';
import {
  PRIORITY_LABELS,
  formatDate,
  matchesQuery,
  priorityVariant,
  stateDotStyle,
  workItemDisplayId,
  type Priority,
} from '../lib/projectV2';
import { slugify } from '../lib/slug';
import { getImageUrl } from '../lib/utils';
import { cycleService } from '../services/cycleService';
import { issueService } from '../services/issueService';
import { labelService } from '../services/labelService';
import { moduleService } from '../services/moduleService';
import { projectService } from '../services/projectService';
import { stateService } from '../services/stateService';
import { workspaceService } from '../services/workspaceService';
import type {
  CycleApiResponse,
  IssueApiResponse,
  LabelApiResponse,
  ModuleApiResponse,
  ProjectApiResponse,
  StateApiResponse,
  WorkspaceMemberApiResponse,
} from '../api/types';

/**
 * Design preview of a single module, built from shadcn primitives. It stands
 * alongside ModuleDetailPage rather than replacing it, so the two can be
 * compared side by side.
 *
 * Two deliberate departures from the shipped page:
 *
 * The shipped page renders its own work item rows by hand, one bespoke row
 * component with a dozen conditional columns. Here they are a `Table`, matching
 * how every other v2 list page presents the same records — the point of the
 * preview is that a work item looks the same wherever you meet it.
 *
 * The shipped page reads its filters from a toolbar in the app shell, over a
 * window event bus (`MODULE_WORK_ITEMS_FILTER_EVENT` and friends). The v2 shell
 * has no such toolbar, so the persisted preferences are read from
 * `moduleWorkItemsPrefs` for grouping and sub-work handling, and the search
 * term comes from `?q=` like every other v2 page. The event listeners are not
 * ported: nothing in this tree dispatches them.
 */
export function ModuleDetailPageV2() {
  const { t } = useTranslation();
  const { workspaceSlug, projectId, moduleId } = useParams<{
    workspaceSlug: string;
    projectId: string;
    moduleId: string;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [module, setModule] = useState<ModuleApiResponse | null>(null);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [projectModules, setProjectModules] = useState<ModuleApiResponse[]>([]);
  const [issues, setIssues] = useState<IssueApiResponse[]>([]);
  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [labels, setLabels] = useState<LabelApiResponse[]>([]);
  const [cycles, setCycles] = useState<CycleApiResponse[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [loading, setLoading] = useState(Boolean(workspaceSlug && projectId && moduleId));
  const [notFound, setNotFound] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [addExistingOpen, setAddExistingOpen] = useState(false);

  const query = searchParams.get('q') ?? '';
  const createOpen = searchParams.get('create') === '1';
  const resolvedModuleId = module?.id ?? null;

  useEffect(() => {
    if (!workspaceSlug || !projectId || !moduleId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the spinner belongs to this fetch
    setLoading(true);
    Promise.all([
      moduleService.list(workspaceSlug, projectId),
      issueService.list(workspaceSlug, projectId, { limit: 1000 }),
      stateService.list(workspaceSlug, projectId).catch(() => [] as StateApiResponse[]),
      labelService.list(workspaceSlug, projectId).catch(() => [] as LabelApiResponse[]),
      cycleService.list(workspaceSlug, projectId).catch(() => [] as CycleApiResponse[]),
      workspaceService.listMembers(workspaceSlug).catch(() => [] as WorkspaceMemberApiResponse[]),
      projectService.get(workspaceSlug, projectId).catch(() => null),
      projectService.list(workspaceSlug).catch(() => [] as ProjectApiResponse[]),
    ])
      .then(([mods, allIssues, stateList, labelList, cycleList, memberList, proj, projectList]) => {
        if (cancelled) return;
        /* The route segment is an id or a name slug, matching the shipped page. */
        const key = moduleId.trim().toLowerCase();
        const found =
          (mods ?? []).find((m) => m.id === moduleId) ??
          (mods ?? []).find((m) => slugify(m.name) === key) ??
          null;
        setModule(found);
        setProjectModules(mods ?? []);
        setIssues((allIssues ?? []).filter((i) => i.module_ids?.includes(found?.id ?? '')));
        setStates(stateList ?? []);
        setLabels(labelList ?? []);
        setCycles(cycleList ?? []);
        setMembers(memberList ?? []);
        setProject(proj);
        setProjects(projectList ?? []);
        setNotFound(!found);
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
  }, [workspaceSlug, projectId, moduleId]);

  /* Grouping and sub-work handling are a persisted, per-module preference. The
     v2 shell has no toolbar to change them, so they are read rather than held
     in state — honouring what the shipped toolbar last saved keeps the two
     views showing the same list. */
  const { listFilters, listDisplay } = useMemo(() => {
    const fallback = {
      listFilters: DEFAULT_MODULE_WORK_ITEMS_FILTERS,
      listDisplay: cloneDefaultProjectIssuesDisplay(),
    };
    if (!workspaceSlug || !projectId || !resolvedModuleId) return fallback;
    const parsed = parseModuleWorkItemsPrefs(
      localStorage.getItem(moduleWorkItemsPrefsKey(workspaceSlug, projectId, resolvedModuleId)),
    );
    if (!parsed) return fallback;
    return {
      listFilters: { ...DEFAULT_MODULE_WORK_ITEMS_FILTERS, ...parsed.filters },
      listDisplay: parsed.display,
    };
  }, [workspaceSlug, projectId, resolvedModuleId]);

  const stateById = useMemo(() => new Map(states.map((s) => [s.id, s])), [states]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.member_id, m])), [members]);

  const filteredIssues = useMemo(() => {
    let base = applyModuleSubWorkFilter(issues, listDisplay);
    base = filterModuleIssues(base, listFilters, states);
    return base.filter((issue) =>
      matchesQuery(query, issue.name, workItemDisplayId(issue, project ?? undefined)),
    );
  }, [issues, listDisplay, listFilters, states, query, project]);

  const groupedIssues = useMemo(
    () =>
      buildGroupedIssues({
        baseForGrouping: filteredIssues,
        groupBy: listDisplay.groupBy,
        orderBy: listDisplay.orderBy,
        showEmptyGroups: listDisplay.showEmptyGroups,
        states,
        cycles,
        modules: projectModules,
        labels,
        members,
      }),
    [
      filteredIssues,
      listDisplay.groupBy,
      listDisplay.orderBy,
      listDisplay.showEmptyGroups,
      states,
      cycles,
      projectModules,
      labels,
      members,
    ],
  );

  const closeCreate = useCallback(() => {
    setCreateError(null);
    const next = new URLSearchParams(searchParams);
    next.delete('create');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const openCreate = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.set('create', '1');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const refetchIssues = useCallback(() => {
    if (!workspaceSlug || !projectId || !resolvedModuleId) return;
    issueService
      .list(workspaceSlug, projectId, { limit: 1000 })
      .then((list) => {
        setIssues((list ?? []).filter((i) => i.module_ids?.includes(resolvedModuleId)));
      })
      .catch(() => {});
  }, [workspaceSlug, projectId, resolvedModuleId]);

  const parent = useMemo(
    () => ({
      label: t('common.modules', 'Modules'),
      to: `/${workspaceSlug}/app-v2/projects/${projectId}/modules`,
    }),
    [workspaceSlug, projectId, t],
  );

  const headerActions = useMemo(
    () => (
      <div className="ml-auto flex items-center gap-2 px-4">
        <Button size="sm" variant="outline" onClick={() => setAddExistingOpen(true)}>
          {t('module.addExistingWorkItem', 'Add an existing work item')}
        </Button>
        <Button size="sm" onClick={openCreate}>
          <Plus />
          {t('module.addWorkItem', 'Add work item')}
        </Button>
      </div>
    ),
    [openCreate, t],
  );

  useSetV2Header({
    parent,
    title: module?.name ?? null,
    actions: module ? headerActions : null,
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (notFound || !module) {
    return (
      <p className="text-muted-foreground text-sm">{t('module.notFound', 'Module not found.')}</p>
    );
  }

  const lead = module.lead_id ? memberById.get(module.lead_id) : undefined;
  const total = issues.length;
  const completedCount = issues.filter((issue) => {
    const group = issue.state_id ? stateById.get(issue.state_id)?.group : undefined;
    return group === 'completed';
  }).length;
  const percent = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  const rows = groupedIssues.isFlat
    ? [
        {
          key: null as string | null,
          issues: groupedIssues.groups.get(groupedIssues.order[0]) ?? [],
        },
      ]
    : groupedIssues.order.map((key) => ({ key, issues: groupedIssues.groups.get(key) ?? [] }));

  const renderRow = (issue: IssueApiResponse) => {
    const state = issue.state_id ? stateById.get(issue.state_id) : undefined;
    const assigneeId = issue.assignee_ids?.[0] ?? null;
    const assignee = assigneeId ? memberById.get(assigneeId) : undefined;
    const assigneeName =
      assignee?.member_display_name?.trim() ||
      assignee?.member_email?.split('@')[0] ||
      t('common.member', 'Member');
    return (
      <TableRow key={issue.id}>
        <TableCell className="p-0">
          <Link
            to={`/${workspaceSlug}/app-v2/projects/${projectId}/work-items/${issue.id}`}
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
              style={stateDotStyle(state)}
            />
            <span className="truncate">{state?.name ?? t('common.noState', 'No state')}</span>
          </span>
        </TableCell>
        <TableCell className="px-3">
          <Badge variant={priorityVariant(issue.priority)}>
            {PRIORITY_LABELS[(issue.priority ?? 'none') as Priority] ?? issue.priority}
          </Badge>
        </TableCell>
        <TableCell className="px-3">
          {assignee ? (
            <span className="flex items-center gap-2 text-sm">
              <Avatar className="size-5">
                {assignee.member_avatar && (
                  <AvatarImage src={getImageUrl(assignee.member_avatar) ?? undefined} alt="" />
                )}
                <AvatarFallback className="text-[10px]">
                  {assigneeName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{assigneeName}</span>
            </span>
          ) : (
            <span className="text-muted-foreground text-sm">
              {t('common.unassigned', 'Unassigned')}
            </span>
          )}
        </TableCell>
        <TableCell className="text-muted-foreground px-3 text-sm">
          {formatDate(issue.target_date)}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {module.status && <Badge variant="secondary">{module.status}</Badge>}
          <span className="text-muted-foreground text-sm">
            {formatDate(module.start_date)} — {formatDate(module.target_date)}
          </span>
          {lead && (
            <span className="flex items-center gap-2 text-sm">
              <Avatar className="size-5">
                {lead.member_avatar && (
                  <AvatarImage src={getImageUrl(lead.member_avatar) ?? undefined} alt="" />
                )}
                <AvatarFallback className="text-[10px]">
                  {(lead.member_display_name ?? '?').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {lead.member_display_name ?? t('common.member', 'Member')}
            </span>
          )}
          <div className="flex min-w-48 flex-1 items-center gap-2">
            <Progress value={percent} className="h-2 flex-1" />
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {completedCount}/{total}
            </span>
          </div>
        </CardContent>
      </Card>

      {workspaceSlug && projectId && resolvedModuleId && (
        <ModuleLinksSection
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          moduleId={resolvedModuleId}
        />
      )}

      {issues.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center">
          <Boxes className="text-muted-foreground size-6" aria-hidden />
          <div>
            <p className="font-medium">{t('module.emptyTitle', 'No work items in the module')}</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {t(
                'module.emptyDescription',
                'Create or add work items which you want to accomplish as part of this module',
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button size="sm" onClick={openCreate}>
              <Plus />
              {t('module.createNewWorkItems', 'Create new work items')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAddExistingOpen(true)}>
              {t('module.addExistingWorkItem', 'Add an existing work item')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-3">{t('views.workItems', 'Work items')}</TableHead>
                <TableHead className="w-40 px-3">{t('views.state', 'State')}</TableHead>
                <TableHead className="w-32 px-3">{t('views.priority', 'Priority')}</TableHead>
                <TableHead className="w-44 px-3">{t('views.assignee', 'Assignee')}</TableHead>
                <TableHead className="w-36 px-3">{t('issues.targetDate', 'Due')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredIssues.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="text-muted-foreground h-32 text-center">
                    {t('module.noWorkItemsMatchFilters', 'No work items match your filters.')}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((group) => (
                  <Fragment key={group.key ?? '__flat__'}>
                    {/* Group headers only appear when the saved preference asks
                        for grouping; a flat list renders straight rows. */}
                    {group.key !== null && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={5} className="px-3 py-2 text-xs font-medium">
                          {group.key}{' '}
                          <span className="text-muted-foreground tabular-nums">
                            {group.issues.length}
                          </span>
                        </TableCell>
                      </TableRow>
                    )}
                    {group.issues.map(renderRow)}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {workspaceSlug && (
        <CreateWorkItemModal
          open={createOpen}
          onClose={closeCreate}
          workspaceSlug={workspaceSlug}
          projects={projects}
          defaultProjectId={projectId}
          defaultModuleId={resolvedModuleId}
          createError={createError}
          onSave={async (data) => {
            if (!data.title.trim() || !resolvedModuleId) return;
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
                await moduleService.addIssue(
                  workspaceSlug,
                  data.projectId,
                  resolvedModuleId,
                  created.id,
                );
              }
              refetchIssues();
              closeCreate();
            } catch (err) {
              setCreateError(
                err instanceof Error
                  ? err.message
                  : t('module.createError', 'Failed to create work item'),
              );
            }
          }}
        />
      )}

      {/* projectIdentifier takes the same fallback workItemDisplayId uses, since
          the modal builds display ids from it and the prop is required. */}
      {workspaceSlug && projectId && resolvedModuleId && (
        <AddExistingWorkItemModal
          open={addExistingOpen}
          onClose={() => setAddExistingOpen(false)}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          moduleId={resolvedModuleId}
          projectIdentifier={project?.identifier ?? projectId.slice(0, 8)}
          onAdded={refetchIssues}
        />
      )}
    </div>
  );
}
