import { useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { Badge } from '@/v2/components/ui/badge';
import { Button } from '@/v2/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/v2/components/ui/dialog';
import { Label } from '@/v2/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/v2/components/ui/select';
import { Skeleton } from '@/v2/components/ui/skeleton';
import { CycleStatsSheet } from '@/v2/components/cycle-stats-sheet';
import { ProjectWorkItemsSection } from '@/v2/components/project-work-items-section';
import { parseIssueLayout } from '@/components/work-item/layouts/IssueLayoutTypes';
import { useSetV2Header } from '../contexts/AppShellHeaderContext';
import { useProjectIssuesController } from '../hooks/useProjectIssuesController';
import { useWorkItemLayoutPreference } from '../hooks/useListViewPreferences';
import { cycleMatchesPathSegment } from '../../lib/cycle';
import { formatDate } from '../lib/project';
import { cycleService, type CycleProgressResponse } from '../../services/cycleService';
import type { CycleApiResponse } from '../../api/types';

/**
 * The v2 view of a single cycle. It renders at the same URL as the shipped
 * CycleDetailPage; the stored interface preference picks between them.
 *
 * A cycle is the project's work item list narrowed to one cycle, so that is
 * literally what this page is: the same controller with the cycle set, and the
 * same ProjectWorkItemsSection the work items page renders — same toolbar,
 * grouping, inline editing, selection and bulk actions, and the same remembered
 * display settings. What the page adds is the cycle's own material: its dates,
 * the statistics drawer and completing the cycle.
 */
export function CycleDetailPage() {
  const { t } = useTranslation();
  const { workspaceSlug, projectId, cycleId } = useParams<{
    workspaceSlug: string;
    projectId: string;
    cycleId: string;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();
  /* Scoped to the project rather than the cycle: picking "board" is a habit
     about how someone works, not a statement about one cycle. */
  useWorkItemLayoutPreference('cycle-layout', workspaceSlug, projectId);

  const [cycle, setCycle] = useState<CycleApiResponse | null>(null);
  const [cyclesLoading, setCyclesLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [progress, setProgress] = useState<CycleProgressResponse | null>(null);

  const [completeOpen, setCompleteOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [transferTargetId, setTransferTargetId] = useState('');

  /* The route segment is a name slug, not an id — see lib/cycle.ts — so the
     cycle has to be resolved before the list can be scoped to it. */
  useEffect(() => {
    if (!workspaceSlug || !projectId || !cycleId) return;
    let cancelled = false;
    setCyclesLoading(true);
    cycleService
      .list(workspaceSlug, projectId)
      .then((list) => {
        if (cancelled) return;
        const found = (list ?? []).find((entry) => cycleMatchesPathSegment(entry, cycleId)) ?? null;
        setCycle(found);
        setNotFound(!found);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setCyclesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, cycleId]);

  /* Progress lands separately so the work item list isn't held back by it. */
  useEffect(() => {
    if (!workspaceSlug || !projectId || !cycle) return;
    let cancelled = false;
    cycleService
      .getProgress(workspaceSlug, projectId, cycle.id)
      .then((snapshot) => {
        if (!cancelled) setProgress(snapshot);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, cycle]);

  const controller = useProjectIssuesController(workspaceSlug, projectId, {
    cycleId: cycle?.id ?? null,
  });
  const { workspace, project, issues, filteredIssues, loading, cycles } = controller;

  const layout = parseIssueLayout(searchParams.get('layout'));
  const setLayout = (next: string) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'list') params.delete('layout');
    else params.set('layout', next);
    setSearchParams(params, { replace: true });
  };

  /* The drawer's open state is in the URL: "look at this cycle's burndown" is
     a link someone sends. */
  const statsOpen = searchParams.get('stats') === '1';
  const setStatsOpen = (open: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (open) next.set('stats', '1');
    else next.delete('stats');
    setSearchParams(next, { replace: true });
  };

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

  if (cyclesLoading || loading) {
    return (
      <div
        className="space-y-6 pb-8"
        aria-busy="true"
        aria-label={t('issues.loading', 'Loading work items')}
      >
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-16 w-full rounded-xl" />
        <div className="overflow-hidden rounded-xl border">
          <Skeleton className="h-10 w-full rounded-none" />
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={index} className="flex h-12 items-center gap-3 border-t px-4">
              <Skeleton className="size-4" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 max-w-80 flex-1" />
              <Skeleton className="hidden h-5 w-20 sm:block" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (notFound || !cycle || !workspace || !project) {
    return (
      <p className="text-muted-foreground text-sm">{t('cycle.notFound', 'Cycle not found.')}</p>
    );
  }

  const completionPct =
    progress && progress.total_issues > 0
      ? Math.round((progress.completed_issues / progress.total_issues) * 100)
      : 0;

  /* Other cycles this one's incomplete work can be moved into on completion. */
  const transferTargets = cycles.filter(
    (entry) => entry.id !== cycle.id && entry.status !== 'completed',
  );

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
      controller.refetchIssues();
      const snapshot = await cycleService.getProgress(workspaceSlug, projectId, cycle.id);
      setProgress(snapshot);
      setCompleteOpen(false);
      setTransferTargetId('');
    } catch {
      setCompleteError(t('cycle.completeError', 'Could not complete the cycle. Please try again.'));
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{cycle.name}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {formatDate(cycle.start_date)} — {formatDate(cycle.end_date)}
          </p>
        </div>
        <p className="text-muted-foreground text-sm tabular-nums" aria-live="polite">
          {t('issues.pageSummary', '{{visible}} of {{loaded}} on page {{page}}', {
            visible: filteredIssues.length,
            loaded: issues.length,
            page: 1,
          })}
        </p>
      </header>

      <ProjectWorkItemsSection
        workspaceSlug={workspaceSlug ?? ''}
        projectId={projectId ?? ''}
        workspace={workspace}
        project={project}
        controller={controller}
        layout={layout}
        onLayoutChange={setLayout}
        /* New work items created here belong to this cycle by default. */
        createInitialValues={{ projectId, cycleId: cycle.id }}
        toolbarExtras={
          <Button
            type="button"
            variant="outline"
            className="h-11 sm:h-9"
            onClick={() => setStatsOpen(true)}
          >
            <BarChart3 aria-hidden="true" />
            <span className="hidden lg:inline">{t('cycle.statistics', 'Statistics')}</span>
            {progress && <span className="tabular-nums">{completionPct}%</span>}
          </Button>
        }
        emptyTitle={t('cycle.noWorkItems', 'No work items in this cycle.')}
        emptyDescription={t(
          'cycle.emptyDescription',
          'Add work items to this cycle to plan and track the sprint.',
        )}
      />

      <CycleStatsSheet
        open={statsOpen}
        onOpenChange={setStatsOpen}
        cycle={cycle}
        progress={progress}
      />

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
