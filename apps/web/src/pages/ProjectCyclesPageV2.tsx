import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CalendarRange } from 'lucide-react';
import { Badge } from '@/components/shadcn/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/shadcn/ui/card';
import { Progress } from '@/components/shadcn/ui/progress';
import { Skeleton } from '@/components/shadcn/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/shadcn/ui/tabs';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { cycleService, type CycleProgress } from '../services/cycleService';
import { cyclePathSegment } from '../lib/cycle';
import { EMPTY_PROGRESS, completionPercent, formatDate, matchesQuery } from '../lib/projectV2';
import type { CycleApiResponse } from '../api/types';

/** Which tab a cycle belongs to, from its dates rather than its status field. */
type CycleBucket = 'active' | 'upcoming' | 'completed';

/**
 * Buckets a cycle by date. The API's `status` field is derived the same way
 * server-side, but it is not always present on freshly created cycles, so the
 * dates are the more reliable source here.
 */
function bucketOf(cycle: CycleApiResponse, now: number): CycleBucket {
  const start = cycle.start_date ? Date.parse(cycle.start_date) : NaN;
  const end = cycle.end_date ? Date.parse(cycle.end_date) : NaN;
  if (!Number.isNaN(end) && end < now) return 'completed';
  if (!Number.isNaN(start) && start > now) return 'upcoming';
  /* Undated cycles are drafts in practice; they sit with the upcoming ones
     rather than claiming to be running. */
  if (Number.isNaN(start) && Number.isNaN(end)) return 'upcoming';
  return 'active';
}

/**
 * Design preview of a project's cycles, built from shadcn primitives. It stands
 * alongside CyclesPage rather than replacing it, so the two can be compared
 * side by side.
 *
 * Cards rather than the shipped page's rows: a cycle is read as a unit — dates,
 * progress and counts together — and three tabs replace the shipped page's
 * stacked sections.
 */
export function ProjectCyclesPageV2() {
  const { t } = useTranslation();
  const { workspaceSlug, projectId } = useParams<{ workspaceSlug: string; projectId: string }>();
  const [searchParams] = useSearchParams();
  useDocumentTitle(t('common.cycles', 'Cycles'));

  const [cycles, setCycles] = useState<CycleApiResponse[]>([]);
  const [progress, setProgress] = useState<Record<string, CycleProgress>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = searchParams.get('q') ?? '';

  useEffect(() => {
    if (!workspaceSlug || !projectId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the spinner belongs to this fetch
    setLoading(true);
    Promise.all([
      cycleService.list(workspaceSlug, projectId),
      /* Progress is decoration: a failure leaves the bars at zero rather than
         failing the page. */
      cycleService.listProgress(workspaceSlug, projectId).catch(() => ({})),
    ])
      .then(([list, prog]) => {
        if (cancelled) return;
        setCycles(list ?? []);
        setProgress(prog ?? {});
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError(t('cycles.loadError', 'Could not load cycles.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, t]);

  /* Read once per mount rather than on every render: bucketing must not shift
     under the reader mid-session, and the clock is not a render input. */
  const [now] = useState(() => Date.now());

  const buckets = useMemo(() => {
    const result: Record<CycleBucket, CycleApiResponse[]> = {
      active: [],
      upcoming: [],
      completed: [],
    };
    for (const cycle of cycles) {
      if (!matchesQuery(query, cycle.name, cycle.description)) continue;
      result[bucketOf(cycle, now)].push(cycle);
    }
    /* Active and upcoming read soonest-first; completed reads most-recent-first,
       which is the order each is actually scanned in. */
    result.active.sort((a, b) => (a.end_date ?? '').localeCompare(b.end_date ?? ''));
    result.upcoming.sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''));
    result.completed.sort((a, b) => (b.end_date ?? '').localeCompare(a.end_date ?? ''));
    return result;
  }, [cycles, query, now]);

  if (loading) {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const renderBucket = (bucket: CycleBucket) => {
    const list = buckets[bucket];
    if (list.length === 0) {
      return (
        <p className="text-muted-foreground rounded-xl border border-dashed p-10 text-center text-sm">
          {cycles.length === 0
            ? t('cycles.empty', 'No cycles yet')
            : t('cycles.noMatches', 'No cycles match the current search.')}
        </p>
      );
    }
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map((cycle) => {
          const counts = progress[cycle.id] ?? EMPTY_PROGRESS;
          const percent = completionPercent(counts);
          return (
            <Card key={cycle.id} className="gap-3">
              <CardHeader>
                <CardTitle className="truncate">
                  {/* Keyed on the name slug, matching the shipped cycle route. */}
                  <Link
                    to={`/${workspaceSlug}/app-v2/projects/${projectId}/cycles/${cyclePathSegment(cycle)}`}
                    className="hover:underline"
                  >
                    {cycle.name}
                  </Link>
                </CardTitle>
                <CardDescription className="flex items-center gap-1.5">
                  <CalendarRange className="size-3.5 shrink-0" />
                  {formatDate(cycle.start_date)} — {formatDate(cycle.end_date)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Progress value={percent} className="h-2 flex-1" />
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {percent}%
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">
                    {t('common.total', 'Total')} {counts.total}
                  </Badge>
                  <Badge variant="secondary">
                    {t('states.started', 'In Progress')} {counts.started}
                  </Badge>
                  <Badge variant="secondary">
                    {t('states.completed', 'Done')} {counts.completed}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      {/* Active first: it is the tab a reader opening this page wants. */}
      <Tabs defaultValue="active" className="flex min-h-0 flex-1 flex-col gap-3">
        <TabsList>
          <TabsTrigger value="active">
            {t('cycles.active', 'Active')}
            <Badge variant="secondary">{buckets.active.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            {t('cycles.upcoming', 'Upcoming')}
            <Badge variant="secondary">{buckets.upcoming.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="completed">
            {t('cycles.completed', 'Completed')}
            <Badge variant="secondary">{buckets.completed.length}</Badge>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="min-h-0 flex-1 overflow-auto">
          {renderBucket('active')}
        </TabsContent>
        <TabsContent value="upcoming" className="min-h-0 flex-1 overflow-auto">
          {renderBucket('upcoming')}
        </TabsContent>
        <TabsContent value="completed" className="min-h-0 flex-1 overflow-auto">
          {renderBucket('completed')}
        </TabsContent>
      </Tabs>
    </div>
  );
}
