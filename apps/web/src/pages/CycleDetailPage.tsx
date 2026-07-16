import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CalendarDays, ChartGantt, Columns3, List, Table2 } from 'lucide-react';
import { Badge, Button, Modal } from '../components/ui';
import { CycleBurndownChart } from '../components/cycles/CycleBurndownChart';
import { workspaceService } from '../services/workspaceService';
import { projectService } from '../services/projectService';
import { cycleService, type CycleProgressResponse } from '../services/cycleService';
import { issueService } from '../services/issueService';
import { stateService } from '../services/stateService';
import { labelService } from '../services/labelService';
import { moduleService } from '../services/moduleService';
import { integrationService } from '../services/integrationService';
import { cycleMatchesPathSegment } from '../lib/cycle';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { IssueLayoutList } from '../components/work-item/layouts/IssueLayoutList';
import { IssueLayoutBoard } from '../components/work-item/layouts/IssueLayoutBoard';
import { IssueLayoutSpreadsheet } from '../components/work-item/layouts/IssueLayoutSpreadsheet';
import { IssueLayoutCalendar } from '../components/work-item/layouts/IssueLayoutCalendar';
import { IssueLayoutGantt } from '../components/work-item/layouts/IssueLayoutGantt';
import {
  parseIssueLayout,
  type IssueLayout,
} from '../components/work-item/layouts/IssueLayoutTypes';
import { buildGroupedIssues } from '../lib/issueListGroupAndSort';
import { cloneDefaultProjectIssuesDisplay } from '../lib/projectIssuesDisplay';
import type { SavedViewDisplayPropertyId } from '../lib/projectSavedViewDisplay';
import type {
  CycleApiResponse,
  GitHubIssueSummaryEntry,
  IssueApiResponse,
  LabelApiResponse,
  ModuleApiResponse,
  ProjectApiResponse,
  StateApiResponse,
  WorkspaceMemberApiResponse,
  WorkspaceApiResponse,
} from '../api/types';
import { parseISODateForDisplay } from '../lib/dateOnly';

function formatDate(iso: string | null | undefined): string {
  const d = parseISODateForDisplay(iso);
  if (!d) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-(--bg-layer-1)">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-8 text-right text-xs tabular-nums text-(--txt-tertiary)">{pct}%</span>
    </div>
  );
}

const LAYOUT_OPTIONS: {
  key: IssueLayout;
  label: string;
  Icon: ComponentType<{ className?: string }>;
}[] = [
  { key: 'list', label: 'List', Icon: List },
  { key: 'board', label: 'Board', Icon: Columns3 },
  { key: 'calendar', label: 'Calendar', Icon: CalendarDays },
  { key: 'spreadsheet', label: 'Spreadsheet', Icon: Table2 },
  { key: 'gantt', label: 'Timeline', Icon: ChartGantt },
];

function CycleLayoutSwitcher({
  layout,
  onChange,
}: {
  layout: IssueLayout;
  onChange: (layout: IssueLayout) => void;
}) {
  const { t } = useTranslation();
  const layoutLabels: Record<IssueLayout, string> = {
    list: t('cycle.layoutList', 'List'),
    board: t('cycle.layoutBoard', 'Board'),
    calendar: t('cycle.layoutCalendar', 'Calendar'),
    spreadsheet: t('cycle.layoutSpreadsheet', 'Spreadsheet'),
    gantt: t('cycle.layoutTimeline', 'Timeline'),
  };
  return (
    <div className="flex h-8 overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-layer-1) p-0.5">
      {LAYOUT_OPTIONS.map(({ key, Icon }) => {
        const active = layout === key;
        const label = layoutLabels[key];
        return (
          <button
            key={key}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            onClick={() => onChange(key)}
            className={
              active
                ? 'flex size-7 items-center justify-center rounded-md bg-(--bg-layer-2) text-(--txt-primary) shadow-sm'
                : 'flex size-7 items-center justify-center rounded-md text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2-hover) hover:text-(--txt-secondary)'
            }
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}

export function CycleDetailPage() {
  const { workspaceSlug, projectId, cycleId } = useParams<{
    workspaceSlug: string;
    projectId: string;
    cycleId: string;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(() => Boolean(workspaceSlug && projectId && cycleId));
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [cycle, setCycle] = useState<CycleApiResponse | null>(null);
  const [allCycles, setAllCycles] = useState<CycleApiResponse[]>([]);
  const [issues, setIssues] = useState<IssueApiResponse[]>([]);
  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [labels, setLabels] = useState<LabelApiResponse[]>([]);
  const [modules, setModules] = useState<ModuleApiResponse[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [prSummary, setPrSummary] = useState<Record<string, GitHubIssueSummaryEntry>>({});
  const [progress, setProgress] = useState<CycleProgressResponse | null>(null);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [transferTargetId, setTransferTargetId] = useState('');
  const [now] = useState(() => Date.now());

  useDocumentTitle(
    loading ? t('cycle.title', 'Cycle') : (cycle?.name ?? t('cycle.title', 'Cycle')),
  );

  useEffect(() => {
    if (!workspaceSlug || !projectId || !cycleId) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setProgress(null);
        setLoading(true);
      }
    });
    Promise.all([
      workspaceService.getBySlug(workspaceSlug),
      projectService.get(workspaceSlug, projectId),
      cycleService.list(workspaceSlug, projectId),
      issueService.listAll(workspaceSlug, projectId),
      stateService.list(workspaceSlug, projectId),
      labelService.list(workspaceSlug, projectId),
      moduleService.list(workspaceSlug, projectId),
      workspaceService.listMembers(workspaceSlug),
    ])
      .then(([w, p, cycles, allIssues, st, lab, mod, mem]) => {
        if (cancelled) return;
        setWorkspace(w ?? null);
        setProject(p ?? null);
        const found = (cycles ?? []).find((c) => cycleMatchesPathSegment(c, cycleId)) ?? null;
        setCycle(found);
        setAllCycles(cycles ?? []);
        setIssues(allIssues ?? []);
        setStates(st ?? []);
        setLabels(lab ?? []);
        setModules(mod ?? []);
        setMembers(mem ?? []);
        // Fetch progress separately so it doesn't block the main render.
        if (found && workspaceSlug && projectId) {
          cycleService
            .getProgress(workspaceSlug, projectId, found.id)
            .then((snap) => {
              if (!cancelled) setProgress(snap);
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        if (cancelled) return;
        setWorkspace(null);
        setProject(null);
        setCycle(null);
        setIssues([]);
        setStates([]);
        setLabels([]);
        setModules([]);
        setMembers([]);
        setPrSummary({});
        setProgress(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, cycleId]);

  const cycleIssues = useMemo(() => {
    if (!cycle) return [];
    return issues.filter((i) => i.cycle_ids?.includes(cycle.id));
  }, [issues, cycle]);

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
      queueMicrotask(() => {
        if (!cancelled) setPrSummary({});
      });
      return () => {
        cancelled = true;
      };
    }
    integrationService
      .githubIssueSummary(workspaceSlug, projectId, ids)
      .then((map) => {
        if (!cancelled) setPrSummary(map);
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn('Could not load GitHub PR summaries for cycle issues.', err);
          setPrSummary({});
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, cycleIssueIDsKey]);

  const cycleDisplay = useMemo(() => {
    const display = cloneDefaultProjectIssuesDisplay();
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

  // Other cycles this one's incomplete work can be transferred into on completion.
  const transferTargets = allCycles.filter((c) => c.id !== cycle?.id && c.status !== 'completed');

  const handleComplete = async () => {
    if (!workspaceSlug || !projectId || !cycle) return;
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
      // Some work items may have moved out; refresh the list and the snapshot.
      const [allIssues, snap] = await Promise.all([
        issueService.listAll(workspaceSlug, projectId),
        cycleService.getProgress(workspaceSlug, projectId, cycle.id),
      ]);
      setIssues(allIssues ?? []);
      setProgress(snap);
      setCompleteModalOpen(false);
      setTransferTargetId('');
    } catch {
      setCompleteError(t('cycle.completeError', 'Could not complete the cycle. Please try again.'));
    } finally {
      setCompleting(false);
    }
  };

  if (loading)
    return (
      <div className="p-6 text-sm text-(--txt-tertiary)">
        {t('cycle.loading', 'Loading cycle…')}
      </div>
    );
  if (!workspace || !project || !cycle)
    return (
      <div className="p-6 text-sm text-(--txt-secondary)">
        {t('cycle.notFound', 'Cycle not found.')}
      </div>
    );

  const projectBase = `/${workspace.slug}/projects/${project.id}`;
  const layout = parseIssueLayout(searchParams.get('layout'));
  const setLayout = (nextLayout: IssueLayout) => {
    const next = new URLSearchParams(searchParams);
    if (nextLayout === 'list') next.delete('layout');
    else next.set('layout', nextLayout);
    setSearchParams(next, { replace: true });
  };
  const total = progress?.total_issues ?? cycleIssues.length;
  const completed = progress?.completed_issues ?? 0;
  const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const hasCol = (id: SavedViewDisplayPropertyId) => cycleDisplay.displayProperties.has(id);
  const cycleName = (issue: IssueApiResponse) => {
    const id = issue.cycle_ids?.[0];
    return id === cycle.id ? cycle.name : '—';
  };
  const moduleName = (issue: IssueApiResponse) => {
    const id = issue.module_ids?.[0];
    return id ? (modules.find((m) => m.id === id)?.name ?? '—') : '—';
  };
  const layoutIssues = groupedIssues.isFlat
    ? (groupedIssues.groups.get(groupedIssues.order[0]) ?? [])
    : cycleIssues;
  const issueHref = (id: string) => `${projectBase}/issues/${id}`;
  const layoutProps = {
    workspaceSlug: workspace.slug,
    project,
    issues: layoutIssues,
    states,
    labels,
    members,
    prSummary,
    baseUrl: projectBase,
    issueHref,
    now,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Link
            to={`${projectBase}/cycles`}
            className="inline-flex items-center text-sm text-(--txt-secondary) hover:text-(--txt-primary)"
          >
            ← {t('cycle.backToCycles', 'Back to cycles')}
          </Link>
          <h1 className="text-xl font-semibold text-(--txt-primary)">{cycle.name}</h1>
          <p className="text-sm text-(--txt-secondary)">
            {formatDate(cycle.start_date)} — {formatDate(cycle.end_date)} ·{' '}
            {t('cycle.workItemsCount', '{{count}} work items', { count: total })}
          </p>
        </div>
        <div className="shrink-0">
          {cycle.status === 'completed' ? (
            <Badge variant="neutral">{t('cycle.completed', 'Completed')}</Badge>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setTransferTargetId('');
                setCompleteError(null);
                setCompleteModalOpen(true);
              }}
            >
              {t('cycle.completeCycle', 'Complete cycle')}
            </Button>
          )}
        </div>
      </div>

      <Modal
        open={completeModalOpen}
        onClose={() => !completing && setCompleteModalOpen(false)}
        title={t('cycle.completeCycle', 'Complete cycle')}
      >
        <div className="space-y-4">
          <p className="text-sm text-(--txt-secondary)">
            <Trans
              i18nKey="cycle.completeModalBody"
              defaults="Completing <b>{{name}}</b> records its progress. Optionally move any incomplete work items into another cycle."
              values={{ name: cycle.name }}
              components={{ b: <span className="font-medium text-(--txt-primary)" /> }}
            />
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
              {t('cycle.transferLabel', 'Transfer incomplete work items to')}
            </label>
            <select
              value={transferTargetId}
              onChange={(e) => setTransferTargetId(e.target.value)}
              className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
            >
              <option value="">
                {t('cycle.transferNone', 'Don’t transfer (leave them here)')}
              </option>
              {transferTargets.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {completeError && <p className="text-sm text-(--txt-danger-primary)">{completeError}</p>}
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setCompleteModalOpen(false)}
              disabled={completing}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleComplete} disabled={completing}>
              {completing
                ? t('cycle.completing', 'Completing…')
                : t('cycle.completeCycle', 'Complete cycle')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Progress stats ── */}
      {progress && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Overall completion */}
          <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-(--txt-secondary)">
                {t('cycle.overallProgress', 'Overall Progress')}
              </p>
              <span className="text-2xl font-bold text-(--txt-primary)">{completionPct}%</span>
            </div>
            <ProgressBar value={completed} max={total} color="var(--color-success-600, #16a34a)" />
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-(--txt-tertiary)">
              <span>
                {t('cycle.statCompleted', '✓ Completed: {{count}}', {
                  count: progress.completed_issues,
                })}
              </span>
              <span>
                {t('cycle.statStarted', '▷ Started: {{count}}', {
                  count: progress.started_issues,
                })}
              </span>
              <span>
                {t('cycle.statUnstarted', '○ Unstarted: {{count}}', {
                  count: progress.unstarted_issues,
                })}
              </span>
              <span>
                {t('cycle.statCancelled', '⊘ Cancelled: {{count}}', {
                  count: progress.cancelled_issues,
                })}
              </span>
              <span>
                {t('cycle.statBacklog', '◻ Backlog: {{count}}', {
                  count: progress.backlog_issues,
                })}
              </span>
            </div>
          </div>

          {/* Burndown chart */}
          <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-4">
            <p className="mb-2 text-xs font-medium text-(--txt-secondary)">
              {t('cycle.burndown', 'Burndown')}
            </p>
            <CycleBurndownChart
              completionChart={progress.distribution?.completion_chart ?? {}}
              total={progress.total_issues}
              startDate={cycle.start_date}
              endDate={cycle.end_date}
            />
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-(--border-subtle) bg-(--bg-surface-1)">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--border-subtle) px-4 py-3">
          <h2 className="text-base font-semibold text-(--txt-primary)">
            {t('cycle.workItems', 'Work items')} {cycleIssues.length}
          </h2>
          <CycleLayoutSwitcher layout={layout} onChange={setLayout} />
        </div>

        {cycleIssues.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-(--txt-tertiary)">
            {t('cycle.noWorkItems', 'No work items in this cycle.')}
          </div>
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
  );
}
