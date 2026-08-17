import { useTranslation } from 'react-i18next';
import { Progress } from '@/v2/components/ui/progress';
import { ScrollArea } from '@/v2/components/ui/scroll-area';
import { Separator } from '@/v2/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/v2/components/ui/sheet';
import { CycleBurndownChart } from '../../components/cycles/CycleBurndownChart';
import { formatDate } from '../lib/project';
import type { CycleProgressResponse } from '../../services/cycleService';
import type { CycleApiResponse } from '../../api/types';

/** The five state groups a cycle reports, in the order they progress. */
const STATE_KEYS = ['completed', 'started', 'unstarted', 'backlog', 'cancelled'] as const;

type StateKey = (typeof STATE_KEYS)[number];

const STATE_COLORS: Record<StateKey, string> = {
  completed: 'bg-emerald-500',
  started: 'bg-amber-500',
  unstarted: 'bg-muted-foreground/60',
  backlog: 'bg-muted-foreground/30',
  cancelled: 'bg-destructive',
};

interface CycleStatsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cycle: CycleApiResponse;
  progress: CycleProgressResponse | null;
}

/**
 * The cycle's numbers, as a right-hand drawer.
 *
 * They used to sit in two cards above the work item list, which pushed the list
 * — the page's actual subject — below the fold on a laptop. Progress is checked
 * occasionally and read at length when it is; the list is read every visit. So
 * the headline percentage stays on the page and the breakdown moves in here,
 * where the burndown gets a full column's height instead of half a card.
 */
export function CycleStatsSheet({ open, onOpenChange, cycle, progress }: CycleStatsSheetProps) {
  const { t } = useTranslation();

  const labels: Record<StateKey, string> = {
    completed: t('cycle.legendCompleted', 'Completed'),
    started: t('cycle.legendStarted', 'Started'),
    unstarted: t('cycle.legendUnstarted', 'Unstarted'),
    backlog: t('cycle.legendBacklog', 'Backlog'),
    cancelled: t('cycle.legendCancelled', 'Cancelled'),
  };

  const counts: Record<StateKey, number> = {
    completed: progress?.completed_issues ?? 0,
    started: progress?.started_issues ?? 0,
    unstarted: progress?.unstarted_issues ?? 0,
    backlog: progress?.backlog_issues ?? 0,
    cancelled: progress?.cancelled_issues ?? 0,
  };

  const total = progress?.total_issues ?? 0;
  const completionPct = total > 0 ? Math.round((counts.completed / total) * 100) : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t('cycle.statistics', 'Statistics')}</SheetTitle>
          <SheetDescription>
            {formatDate(cycle.start_date)} — {formatDate(cycle.end_date)}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-6 p-4">
            {progress ? (
              <>
                <section className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-sm font-medium">
                      {t('cycle.overallProgress', 'Overall Progress')}
                    </h3>
                    <span className="text-3xl font-semibold tabular-nums">{completionPct}%</span>
                  </div>
                  <Progress value={completionPct} className="h-2" />
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {t('cycle.completedOfTotal', '{{completed}} of {{total}} work items done', {
                      completed: counts.completed,
                      total,
                    })}
                  </p>
                </section>

                <Separator />

                <section className="space-y-3">
                  <h3 className="text-sm font-medium">{t('cycle.breakdown', 'Breakdown')}</h3>
                  {/* One bar rather than five numbers: the counts only mean
                      something as shares of the total. */}
                  {total > 0 && (
                    <div className="bg-muted flex h-2 overflow-hidden rounded-full">
                      {STATE_KEYS.filter((key) => counts[key] > 0).map((key) => (
                        <div
                          key={key}
                          className={STATE_COLORS[key]}
                          style={{ width: `${(counts[key] / total) * 100}%` }}
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                  )}
                  <ul className="space-y-1.5">
                    {STATE_KEYS.map((key) => (
                      <li key={key} className="flex items-center gap-2 text-sm">
                        <span
                          aria-hidden="true"
                          className={`size-2 shrink-0 rounded-full ${STATE_COLORS[key]}`}
                        />
                        <span className="text-muted-foreground min-w-0 flex-1 truncate">
                          {labels[key]}
                        </span>
                        <span className="tabular-nums">{counts[key]}</span>
                        <span className="text-muted-foreground w-10 text-right text-xs tabular-nums">
                          {total > 0 ? `${Math.round((counts[key] / total) * 100)}%` : '—'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>

                <Separator />

                <section className="space-y-3">
                  <h3 className="text-sm font-medium">{t('cycle.burndown', 'Burndown')}</h3>
                  <CycleBurndownChart
                    completionChart={progress.distribution?.completion_chart ?? {}}
                    total={progress.total_issues}
                    startDate={cycle.start_date}
                    endDate={cycle.end_date}
                  />
                </section>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                {t('cycle.statsUnavailable', 'Statistics are not available for this cycle.')}
              </p>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
