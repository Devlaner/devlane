import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/shadcn/ui/avatar';
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
import { ProjectSavedViewActiveFilters } from '../components/project-saved-view/ProjectSavedViewActiveFilters';
import { useSetV2Header } from '../contexts/AppShellV2HeaderContext';
import { useProjectSavedViewDisplay } from '../contexts/ProjectSavedViewDisplayContext';
import { useWorkspaceViewsState } from '../contexts/WorkspaceViewsStateContext';
import { buildGroupedIssues } from '../lib/issueListGroupAndSort';
import {
  parseSavedViewDisplayFromRecords,
  savedViewDisplayToRecords,
} from '../lib/projectSavedViewDisplay';
import {
  PRIORITY_LABELS,
  formatDate,
  priorityVariant,
  stateDotStyle,
  workItemDisplayId,
  type Priority,
} from '../lib/projectV2';
import { getImageUrl } from '../lib/utils';
import { applyWorkspaceViewFilters } from '../lib/workspaceViewFiltersApply';
import { cycleService } from '../services/cycleService';
import { issueService } from '../services/issueService';
import { labelService } from '../services/labelService';
import { moduleService } from '../services/moduleService';
import { projectService } from '../services/projectService';
import { stateService } from '../services/stateService';
import { viewService } from '../services/viewService';
import { workspaceService } from '../services/workspaceService';
import {
  parseWorkspaceViewFiltersFromSearchParams,
  workspaceViewFiltersToSearchParams,
} from '../types/workspaceViewFilters';
import type {
  CycleApiResponse,
  IssueApiResponse,
  IssueViewApiResponse,
  LabelApiResponse,
  ModuleApiResponse,
  ProjectApiResponse,
  StateApiResponse,
  WorkspaceMemberApiResponse,
} from '../api/types';

/**
 * Design preview of a project's saved view, built from shadcn primitives. It
 * stands alongside ViewDetailPage rather than replacing it, so the two can be
 * compared side by side.
 *
 * A saved view is a stored filter set plus stored display settings, so this
 * page is mostly plumbing between three contexts: `WorkspaceViewsStateContext`
 * holds the filters, `ProjectSavedViewDisplayContext` holds the grouping and
 * columns, and `AuthContext` sits under both. All three are mounted by
 * `AppShellV2Page`; the display provider recognises this tree's path as well as
 * the shipped one, so a view's settings follow the reader between them.
 *
 * The filter matching itself lives in `lib/workspaceViewFiltersApply`, shared
 * with WorkspaceViewsPageV2 — the two show the same records under the same
 * filter names, and would be impossible to compare if a filter behaved
 * differently in each.
 */
export function ViewDetailPageV2() {
  const { t } = useTranslation();
  const { workspaceSlug, projectId, viewId } = useParams<{
    workspaceSlug: string;
    projectId: string;
    viewId: string;
  }>();
  const { settings, setSettings } = useProjectSavedViewDisplay();
  const { filters, setFilters } = useWorkspaceViewsState();

  const [view, setView] = useState<IssueViewApiResponse | null>(null);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [issues, setIssues] = useState<IssueApiResponse[]>([]);
  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [labels, setLabels] = useState<LabelApiResponse[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [cycles, setCycles] = useState<CycleApiResponse[]>([]);
  const [modules, setModules] = useState<ModuleApiResponse[]>([]);
  const [loading, setLoading] = useState(Boolean(workspaceSlug && viewId));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>('idle');
  /* Seed the display context from the view record once per view id, so
     re-setting `view` after a save doesn't clobber the in-memory settings. */
  const seededViewId = useRef<string | null>(null);

  useEffect(() => {
    if (!workspaceSlug || !viewId) return;
    let cancelled = false;
    setLoading(true);
    viewService
      .get(workspaceSlug, viewId)
      .then((data) => {
        if (cancelled) return;
        setView(data ?? null);
        setError(data ? null : t('views.viewNotFound', 'View not found.'));
      })
      .catch(() => {
        if (cancelled) return;
        setView(null);
        setError(t('views.unableToLoadView', 'Unable to load this view.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, viewId, t]);

  useEffect(() => {
    if (!workspaceSlug || !projectId) return;
    let cancelled = false;
    Promise.all([
      issueService.list(workspaceSlug, projectId, { limit: 500 }),
      stateService.list(workspaceSlug, projectId).catch(() => [] as StateApiResponse[]),
      labelService.list(workspaceSlug, projectId).catch(() => [] as LabelApiResponse[]),
      workspaceService.listMembers(workspaceSlug).catch(() => [] as WorkspaceMemberApiResponse[]),
      cycleService.list(workspaceSlug, projectId).catch(() => [] as CycleApiResponse[]),
      moduleService.list(workspaceSlug, projectId).catch(() => [] as ModuleApiResponse[]),
      projectService.get(workspaceSlug, projectId).catch(() => null),
      projectService.list(workspaceSlug).catch(() => [] as ProjectApiResponse[]),
    ])
      .then(([iss, st, lab, mem, cyc, mod, proj, projectList]) => {
        if (cancelled) return;
        setIssues(iss ?? []);
        setStates(st ?? []);
        setLabels(lab ?? []);
        setMembers(mem ?? []);
        setCycles(cyc ?? []);
        setModules(mod ?? []);
        setProject(proj);
        setProjects(projectList ?? []);
      })
      .catch(() => {
        /* The view record still renders; the list below it stays empty. */
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId]);

  /* The saved view's `filters` JSON uses the same key/value shape that
     workspaceViewFiltersToSearchParams produces on the way into the API. */
  useEffect(() => {
    if (!view) return;
    const raw = view.filters;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (value == null) continue;
      const text = String(value).trim();
      if (text) params.set(key, text);
    }
    setFilters(parseWorkspaceViewFiltersFromSearchParams(params));
  }, [view, setFilters]);

  /* Display settings live on the view record so they are shared across users
     and devices. Seed once per view; a view without stored settings keeps
     whatever the display context already provides. */
  useEffect(() => {
    if (!view || seededViewId.current === view.id) return;
    seededViewId.current = view.id;
    const parsed = parseSavedViewDisplayFromRecords(view.display_filters, view.display_properties);
    if (parsed) setSettings(parsed);
  }, [view, setSettings]);

  /* Any edit means unsaved changes, so drop the "Saved" acknowledgement. */
  useEffect(() => {
    setSaveState('idle');
  }, [filters, settings]);

  const stateById = useMemo(() => new Map(states.map((s) => [s.id, s])), [states]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.member_id, m])), [members]);

  const filteredIssues = useMemo(
    () => (view ? applyWorkspaceViewFilters(issues, filters, stateById) : []),
    [view, issues, filters, stateById],
  );

  const visibleIssues = useMemo(
    () =>
      settings.showSubWorkItems
        ? filteredIssues
        : filteredIssues.filter((issue) => !issue.parent_id?.trim()),
    [filteredIssues, settings.showSubWorkItems],
  );

  const groupedIssues = useMemo(
    () =>
      buildGroupedIssues({
        baseForGrouping: visibleIssues,
        groupBy: settings.groupBy,
        orderBy: settings.orderBy,
        showEmptyGroups: false,
        states,
        cycles,
        modules,
        labels,
        members,
      }),
    [visibleIssues, settings.groupBy, settings.orderBy, states, cycles, modules, labels, members],
  );

  const handleSave = useCallback(async () => {
    if (!workspaceSlug || !viewId) return;
    setSaving(true);
    try {
      const { displayFilters, displayProperties } = savedViewDisplayToRecords(settings);
      await viewService.update(workspaceSlug, viewId, {
        filters: workspaceViewFiltersToSearchParams(filters),
        display_filters: displayFilters,
        display_properties: displayProperties,
      });
      /* Deliberately not re-setting `view`: the saved values already live in
         `filters` + `settings`, and replacing the record would re-run the sync
         effect above and clear this acknowledgement immediately. */
      setSaveState('saved');
    } catch {
      setSaveState('error');
    } finally {
      setSaving(false);
    }
  }, [workspaceSlug, viewId, settings, filters]);

  const parent = useMemo(
    () => ({
      label: t('common.views', 'Views'),
      to: `/${workspaceSlug}/app-v2/projects/${projectId}/views`,
    }),
    [workspaceSlug, projectId, t],
  );

  const headerActions = useMemo(
    () => (
      <div className="ml-auto flex items-center gap-2 px-4">
        {saveState === 'saved' && (
          <span className="text-muted-foreground text-xs">{t('views.saved', 'Saved')}</span>
        )}
        {saveState === 'error' && (
          <span className="text-destructive text-xs" role="alert">
            {t('views.saveError', 'Could not save.')}
          </span>
        )}
        <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
          {saving ? t('views.saving', 'Saving…') : t('views.saveView', 'Save view')}
        </Button>
      </div>
    ),
    [saveState, saving, handleSave, t],
  );

  useSetV2Header({
    parent,
    title: view?.name ?? null,
    actions: view ? headerActions : null,
  });

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-64" />
        {Array.from({ length: 10 }).map((_, index) => (
          <Skeleton key={index} className="h-11 w-full" />
        ))}
      </div>
    );
  }

  if (!view) {
    return (
      <p className="text-muted-foreground text-sm">
        {error ?? t('views.viewNotFound', 'View not found.')}
      </p>
    );
  }

  const showId = settings.displayProperties.has('id');
  const showState = settings.displayProperties.has('state');
  const showPriority = settings.displayProperties.has('priority');
  const showAssignee = settings.displayProperties.has('assignee');
  const showDueDate = settings.displayProperties.has('due_date');
  const columnCount =
    1 + [showState, showPriority, showAssignee, showDueDate].filter(Boolean).length;

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
    const assignee = issue.assignee_ids?.[0] ? memberById.get(issue.assignee_ids[0]) : undefined;
    const assigneeName =
      assignee?.member_display_name?.trim() ||
      assignee?.member_email?.split('@')[0] ||
      t('common.member', 'Member');
    return (
      <TableRow key={issue.id}>
        <TableCell className="p-0">
          <Link
            to={`/${workspaceSlug}/app-v2/projects/${issue.project_id}/work-items/${issue.id}`}
            className="hover:bg-muted/50 flex h-12 items-center gap-2 px-3 transition-colors"
          >
            {showId && (
              <span className="text-muted-foreground shrink-0 font-mono text-xs">
                {workItemDisplayId(issue, project ?? undefined)}
              </span>
            )}
            <span className="truncate font-medium">{issue.name}</span>
          </Link>
        </TableCell>
        {showState && (
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
        )}
        {showPriority && (
          <TableCell className="px-3">
            <Badge variant={priorityVariant(issue.priority)}>
              {PRIORITY_LABELS[(issue.priority ?? 'none') as Priority] ?? issue.priority}
            </Badge>
          </TableCell>
        )}
        {showAssignee && (
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
        )}
        {showDueDate && (
          <TableCell className="text-muted-foreground px-3 text-sm">
            {formatDate(issue.target_date)}
          </TableCell>
        )}
      </TableRow>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* The pills read and clear the same filter state this page filters on. */}
      <ProjectSavedViewActiveFilters
        members={members}
        labels={labels}
        projects={projects}
        scopeProjectId={projectId}
      />

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-3">{t('views.workItems', 'Work items')}</TableHead>
              {showState && (
                <TableHead className="w-40 px-3">{t('views.state', 'State')}</TableHead>
              )}
              {showPriority && (
                <TableHead className="w-32 px-3">{t('views.priority', 'Priority')}</TableHead>
              )}
              {showAssignee && (
                <TableHead className="w-44 px-3">{t('views.assignee', 'Assignee')}</TableHead>
              )}
              {showDueDate && (
                <TableHead className="w-36 px-3">{t('issues.targetDate', 'Due')}</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleIssues.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columnCount} className="text-muted-foreground h-32 text-center">
                  {issues.length === 0
                    ? t('views.noWorkItems', 'No work items yet')
                    : t('views.noMatches', 'No work items match this view’s filters.')}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((group) => (
                <Fragment key={group.key ?? '__flat__'}>
                  {group.key !== null && (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={columnCount} className="px-3 py-2 text-xs font-medium">
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
    </div>
  );
}
