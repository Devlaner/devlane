import { useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import { CalendarDays, ChartGantt, Columns3, List, Table2 } from 'lucide-react';
import { Badge } from '@/v2/components/ui/badge';
import { Button } from '@/v2/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/v2/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/v2/components/ui/dialog';
import { Label } from '@/v2/components/ui/label';
import { Progress } from '@/v2/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/v2/components/ui/select';
import { Skeleton } from '@/v2/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/v2/components/ui/toggle-group';
import { CycleBurndownChart } from '../../components/cycles/CycleBurndownChart';
import { IssueLayoutBoard } from '../../components/work-item/layouts/IssueLayoutBoard';
import { IssueLayoutCalendar } from '../../components/work-item/layouts/IssueLayoutCalendar';
import { IssueLayoutGantt } from '../../components/work-item/layouts/IssueLayoutGantt';
import { IssueLayoutList } from '../../components/work-item/layouts/IssueLayoutList';
import { IssueLayoutSpreadsheet } from '../../components/work-item/layouts/IssueLayoutSpreadsheet';
import {
  parseIssueLayout,
  type IssueLayout,
} from '../../components/work-item/layouts/IssueLayoutTypes';
import { useSetV2Header } from '../contexts/AppShellHeaderContext';
import { cycleMatchesPathSegment } from '../../lib/cycle';
import { buildGroupedIssues } from '../../lib/issueListGroupAndSort';
import { cloneDefaultProjectIssuesDisplay } from '../../lib/projectIssuesDisplay';
import { formatDate } from '../lib/project';
import type { SavedViewDisplayPropertyId } from '../../lib/projectSavedViewDisplay';
import { cycleService, type CycleProgressResponse } from '../../services/cycleService';
import { integrationService } from '../../services/integrationService';
import { issueService } from '../../services/issueService';
import { labelService } from '../../services/labelService';
import { moduleService } from '../../services/moduleService';
import { projectService } from '../../services/projectService';
import { stateService } from '../../services/stateService';
import { workspaceService } from '../../services/workspaceService';
import type {
  CycleApiResponse,
  GitHubIssueSummaryEntry,
  IssueApiResponse,
  LabelApiResponse,
  ModuleApiResponse,
  ProjectApiResponse,
  StateApiResponse,
  WorkspaceMemberApiResponse,
} from '../../api/types';

const LAYOUT_OPTIONS = [
  { key: 'list', label: 'List', Icon: List },
  { key: 'board', label: 'Board', Icon: Columns3 },
  { key: 'calendar', label: 'Calendar', Icon: CalendarDays },
  { key: 'spreadsheet', label: 'Spreadsheet', Icon: Table2 },
  { key: 'gantt', label: 'Timeline', Icon: ChartGantt },
] as const satisfies readonly {
  key: IssueLayout;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[];

/**
 * The v2 view of a single cycle, built from shadcn primitives. It renders at
 * the same URL as CycleDetailPage; the stored interface preference picks
 * between them.
 *
 * The work item layouts are the shipped renderers, imported whole. They carry
 * native drag handling and five distinct rendering strategies; rebuilding them
 * on shadcn primitives would be a rewrite of the list engine rather than a
 * design preview, and would regress the shipped pages that share them. What is
 * rewritten here is the chrome around them: the progress card, the burndown
 * frame, the layout switcher and the completion dialog.
 *
 * The shipped page shows five raw state counts as a glyph-prefixed grid. Those
 * numbers only mean something relative to the total, so they render as a
 * proportional bar with the counts alongside.
 */
export function CycleDetailPage() {
  const { t } = useTranslation();
  const { workspaceSlug, projectId, cycleId } = useParams<{
    workspaceSlug: string;
    projectId: string;
    cycleId: string;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [cycle, setCycle] = useState<CycleApiResponse | null>(null);
  const [allCycles, setAllCycles] = useState<CycleApiResponse[]>([]);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [issues, setIssues] = useState<IssueApiResponse[]>([]);
  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [labels, setLabels] = useState<LabelApiResponse[]>([]);
  const [modules, setModules] = useState<ModuleApiResponse[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [prSummary, setPrSummary] = useState<Record<string, GitHubIssueSummaryEntry>>({});
  const [progress, setProgress] = useState<CycleProgressResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(workspaceSlug && projectId && cycleId));
  const [notFound, setNotFound] = useState(false);

  const [completeOpen, setCompleteOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [transferTargetId, setTransferTargetId] = useState('');
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!workspaceSlug || !projectId || !cycleId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      cycleService.list(workspaceSlug, projectId),
      issueService.list(workspaceSlug, projectId, { limit: 1000 }),
      stateService.list(workspaceSlug, projectId).catch(() => [] as StateApiResponse[]),
      labelService.list(workspaceSlug, projectId).catch(() => [] as LabelApiResponse[]),
      moduleService.list(workspaceSlug, projectId).catch(() => [] as ModuleApiResponse[]),
      workspaceService.listMembers(workspaceSlug).catch(() => [] as WorkspaceMemberApiResponse[]),
      projectService.get(workspaceSlug, projectId).catch(() => null),
    ])
      .then(([cycles, allIssues, stateList, labelList, moduleList, memberList, proj]) => {
        if (cancelled) return;
        /* The route segment is a name slug, not an id — see lib/cycle.ts. */
        const found = (cycles ?? []).find((c) => cycleMatchesPathSegment(c, cycleId)) ?? null;
        setCycle(found);
        setAllCycles(cycles ?? []);
        setIssues(allIssues ?? []);
        setStates(stateList ?? []);
        setLabels(labelList ?? []);
        setModules(moduleList ?? []);
        setMembers(memberList ?? []);
        setProject(proj);
        setNotFound(!found);
        /* Progress lands separately so the work item list isn't held back by it. */
        if (found) {
          cycleService
            .getProgress(workspaceSlug, projectId, found.id)
            .then((snapshot) => {
              if (!cancelled) setProgress(snapshot);
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
  }, [workspaceSlug, projectId, cycleId]);

  const cycleIssues = useMemo(
    () => (cycle ? issues.filter((i) => i.cycle_ids?.includes(cycle.id)) : []),
    [issues, cycle],
  );

  const cycleIssueIDsKey = useMemo(
    () =>
      cycleIssues
        .map((i) => i.id)
        .sort()
        .join(','),
    [cycleIssues],
  );

  useEffect(() => {
    if (!workspaceSlug || !projectId) return;
    let cancelled = false;
    const ids = cycleIssueIDsKey ? cycleIssueIDsKey.split(',') : [];
    if (ids.length === 0) {
      /* Clears the previous cycle's summaries. */
      setPrSummary({});
      return () => {
        cancelled = true;
      };
    }
    integrationService
      .githubIssueSummary(workspaceSlug, projectId, ids)
      .then((map) => {
        if (!cancelled) setPrSummary(map);
      })
      .catch(() => {
        /* PR badges are decoration; the list renders without them. */
        if (!cancelled) setPrSummary({});
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, cycleIssueIDsKey]);

  const cycleDisplay = useMemo(() => {
    const display = cloneDefaultProjectIssuesDisplay();
    /* Every row belongs to this cycle, so the column would repeat one value. */
    display.displayProperties.delete('cycle');
    display.groupBy = 'none';
    display.orderBy = 'last_created';
    return display;
  }, []);

  const subWorkCountByParentId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const issue of issues) {
      const parentId = issue.parent_id?.trim();
      if (parentId) counts.set(parentId, (counts.get(parentId) ?? 0) + 1);
    }
    return counts;
  }, [issues]);

  const groupedIssues = useMemo(
    () =>
      buildGroupedIssues({
        baseForGrouping: cycleIssues,
        groupBy: cycleDisplay.groupBy,
        orderBy: cycleDisplay.orderBy,
        showEmptyGroups: cycleDisplay.showEmptyGroups,
        states,
        cycles: cycle ? [cycle] : [],
        modules,
        labels,
        members,
      }),
    [
      cycleIssues,
      cycleDisplay.groupBy,
      cycleDisplay.orderBy,
      cycleDisplay.showEmptyGroups,
      states,
      cycle,
      modules,
      labels,
      members,
    ],
  );

  const parent = useMemo(
    () => ({
      label: t('common.cycles', 'Cycles'),
      to: `/${workspaceSlug}/projects/${projectId}/cycles`,
    }),
    [workspaceSlug, projectId, t],
  );

  const headerActions = useMemo(() => {
    if (!cycle) return null;
    return (
      <div className="ml-auto flex items-center gap-2 px-4">
        {cycle.status === 'completed' ? (
          <Badge variant="secondary">{t('cycle.completed', 'Completed')}</Badge>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setTransferTargetId('');
              setCompleteError(null);
              setCompleteOpen(true);
            }}
          >
            {t('cycle.completeCycle', 'Complete cycle')}
          </Button>
        )}
      </div>
    );
  }, [cycle, t]);

  useSetV2Header({ parent, title: cycle?.name ?? null, actions: headerActions });

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (notFound || !cycle) {
    return (
      <p className="text-muted-foreground text-sm">{t('cycle.notFound', 'Cycle not found.')}</p>
    );
  }

  const layout = parseIssueLayout(searchParams.get('layout'));
  const setLayout = (next: IssueLayout) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'list') params.delete('layout');
    else params.set('layout', next);
    setSearchParams(params, { replace: true });
  };

  const total = progress?.total_issues ?? cycleIssues.length;
  const completed = progress?.completed_issues ?? 0;
  const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  /* Other cycles this one's incomplete work can be moved into on completion. */
  const transferTargets = allCycles.filter((c) => c.id !== cycle.id && c.status !== 'completed');

  const handleComplete = async () => {
    if (!workspaceSlug || !projectId) return;
    setCompleting(true);
    setCompleteError(null);
    try {
      const res = await cycleService.completeCycle(
        workspaceSlug,
        projectId,
        cycle.id,
        transferTargetId || undefined,
      );
      setCycle(res.cycle);
      /* Work items may have moved out; refresh the list and the snapshot. */
      const [refreshed, snapshot] = await Promise.all([
        issueService.list(workspaceSlug, projectId, { limit: 500 }),
        cycleService.getProgress(workspaceSlug, projectId, cycle.id),
      ]);
      setIssues(refreshed ?? []);
      setProgress(snapshot);
      setCompleteOpen(false);
      setTransferTargetId('');
    } catch {
      setCompleteError(t('cycle.completeError', 'Could not complete the cycle. Please try again.'));
    } finally {
      setCompleting(false);
    }
  };

  /* The shipped project base — the layout renderers build their own hrefs from
     it, and rewriting them to the v2 tree would mean forking the renderers. */
  const projectBase = `/${workspaceSlug}/projects/${projectId}`;
  const hasCol = (id: SavedViewDisplayPropertyId) => cycleDisplay.displayProperties.has(id);
  const cycleName = (issue: IssueApiResponse) =>
    issue.cycle_ids?.[0] === cycle.id ? cycle.name : '—';
  const moduleName = (issue: IssueApiResponse) => {
    const id = issue.module_ids?.[0];
    return id ? (modules.find((m) => m.id === id)?.name ?? '—') : '—';
  };
  const layoutIssues = groupedIssues.isFlat
    ? (groupedIssues.groups.get(groupedIssues.order[0]) ?? [])
    : cycleIssues;
  const layoutProps = {
    workspaceSlug: workspaceSlug ?? '',
    project: project as ProjectApiResponse,
    issues: layoutIssues,
    states,
    labels,
    members,
    prSummary,
    baseUrl: projectBase,
    issueHref: (id: string) => `${projectBase}/issues/${id}`,
    now,
  };

  const stats = progress
    ? [
        {
          key: 'completed',
          label: t('cycle.legendCompleted', 'Completed'),
          value: progress.completed_issues,
        },
        {
          key: 'started',
          label: t('cycle.legendStarted', 'Started'),
          value: progress.started_issues,
        },
        {
          key: 'unstarted',
          label: t('cycle.legendUnstarted', 'Unstarted'),
          value: progress.unstarted_issues,
        },
        {
          key: 'backlog',
          label: t('cycle.legendBacklog', 'Backlog'),
          value: progress.backlog_issues,
        },
        {
          key: 'cancelled',
          label: t('cycle.legendCancelled', 'Cancelled'),
          value: progress.cancelled_issues,
        },
      ]
    : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <Card>
        <CardContent className="text-muted-foreground flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span>
            {formatDate(cycle.start_date)} — {formatDate(cycle.end_date)}
          </span>
          <span>{t('cycle.workItemsCount', '{{count}} work items', { count: total })}</span>
        </CardContent>
      </Card>

      {progress && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm">
                {t('cycle.overallProgress', 'Overall Progress')}
              </CardTitle>
              <span className="text-2xl font-semibold tabular-nums">{completionPct}%</span>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={completionPct} className="h-2" />
              {/* Counts read against the total rather than in isolation. */}
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                {stats.map((stat) => (
                  <li
                    key={stat.key}
                    className="text-muted-foreground flex items-center justify-between text-xs"
                  >
                    <span>{stat.label}</span>
                    <span className="tabular-nums">{stat.value}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t('cycle.burndown', 'Burndown')}</CardTitle>
            </CardHeader>
            <CardContent>
              <CycleBurndownChart
                completionChart={progress.distribution?.completion_chart ?? {}}
                total={progress.total_issues}
                startDate={cycle.start_date}
                endDate={cycle.end_date}
              />
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border">
        <div className="bg-muted/50 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="text-sm font-semibold">
            {t('cycle.workItems', 'Work items')}{' '}
            <span className="text-muted-foreground tabular-nums">{cycleIssues.length}</span>
          </h2>
          <ToggleGroup
            type="single"
            value={layout}
            onValueChange={(value) => value && setLayout(value as IssueLayout)}
            variant="outline"
            size="sm"
          >
            {LAYOUT_OPTIONS.map(({ key, label, Icon }) => (
              <ToggleGroupItem key={key} value={key} aria-label={label} title={label}>
                <Icon className="size-4" />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {cycleIssues.length === 0 ? (
            <p className="text-muted-foreground px-4 py-12 text-center text-sm">
              {t('cycle.noWorkItems', 'No work items in this cycle.')}
            </p>
          ) : (
            <>
              {layout === 'list' && (
                <IssueLayoutList
                  {...layoutProps}
                  groupedIssues={groupedIssues}
                  hasCol={hasCol}
                  showEmptyGroups={cycleDisplay.showEmptyGroups}
                  subWorkCountByParentId={subWorkCountByParentId}
                  cycleName={cycleName}
                  moduleName={moduleName}
                />
              )}
              {layout === 'board' && <IssueLayoutBoard {...layoutProps} />}
              {layout === 'spreadsheet' && <IssueLayoutSpreadsheet {...layoutProps} />}
              {layout === 'calendar' && <IssueLayoutCalendar {...layoutProps} />}
              {layout === 'gantt' && <IssueLayoutGantt {...layoutProps} />}
            </>
          )}
        </div>
      </div>

      <Dialog open={completeOpen} onOpenChange={(open) => !completing && setCompleteOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('cycle.completeCycle', 'Complete cycle')}</DialogTitle>
            <DialogDescription>
              <Trans
                i18nKey="cycle.completeModalBody"
                defaults="Completing <b>{{name}}</b> records its progress. Optionally move any incomplete work items into another cycle."
                values={{ name: cycle.name }}
                components={{ b: <span className="text-foreground font-medium" /> }}
              />
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="cycle-transfer-target">
              {t('cycle.transferLabel', 'Transfer incomplete work items to')}
            </Label>
            <Select
              value={transferTargetId || 'none'}
              onValueChange={(value) => setTransferTargetId(value === 'none' ? '' : value)}
            >
              <SelectTrigger id="cycle-transfer-target" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  {t('cycle.transferNone', 'Don’t transfer (leave them here)')}
                </SelectItem>
                {transferTargets.map((target) => (
                  <SelectItem key={target.id} value={target.id}>
                    {target.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {completeError && (
            <p className="text-destructive text-sm" role="alert">
              {completeError}
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(false)} disabled={completing}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={() => void handleComplete()} disabled={completing}>
              {completing
                ? t('cycle.completing', 'Completing…')
                : t('cycle.completeCycle', 'Complete cycle')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
