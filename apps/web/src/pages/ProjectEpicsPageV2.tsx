import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/shadcn/ui/badge';
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
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { epicService, type EpicProgress } from '../services/epicService';
import { projectService } from '../services/projectService';
import { stateService } from '../services/stateService';
import {
  EMPTY_PROGRESS,
  PRIORITY_LABELS,
  completionPercent,
  formatDate,
  matchesQuery,
  priorityVariant,
  stateDotStyle,
  workItemDisplayId,
  type Priority,
} from '../lib/projectV2';
import type { IssueApiResponse, ProjectApiResponse, StateApiResponse } from '../api/types';

/**
 * Design preview of a project's epics, built from shadcn primitives. It stands
 * alongside EpicsPage rather than replacing it, so the two can be compared side
 * by side.
 *
 * An epic is a work item with children, so the useful column is progress: the
 * shipped page shows a count, this one shows the same numbers as a bar, which
 * is what the reader is actually comparing between rows.
 */
export function ProjectEpicsPageV2() {
  const { t } = useTranslation();
  const { workspaceSlug, projectId } = useParams<{ workspaceSlug: string; projectId: string }>();
  const [searchParams] = useSearchParams();
  useDocumentTitle(t('common.epics', 'Epics'));

  const [epics, setEpics] = useState<IssueApiResponse[]>([]);
  const [progress, setProgress] = useState<Record<string, EpicProgress>>({});
  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(workspaceSlug && projectId));
  const [error, setError] = useState<string | null>(null);

  const query = searchParams.get('q') ?? '';

  useEffect(() => {
    if (!workspaceSlug || !projectId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the spinner belongs to this fetch
    setLoading(true);
    Promise.all([
      epicService.list(workspaceSlug, projectId),
      /* Progress is decoration: a failure leaves the bars at zero rather than
         failing the page. */
      epicService.listProgress(workspaceSlug, projectId).catch(() => ({})),
      stateService.list(workspaceSlug, projectId).catch(() => [] as StateApiResponse[]),
      projectService.get(workspaceSlug, projectId).catch(() => null),
    ])
      .then(([list, prog, stateList, proj]) => {
        if (cancelled) return;
        setEpics(list ?? []);
        setProgress(prog ?? {});
        setStates(stateList ?? []);
        setProject(proj);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError(t('epics.loadError', 'Could not load epics.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, t]);

  const stateById = useMemo(() => new Map(states.map((s) => [s.id, s])), [states]);

  const visible = useMemo(
    () =>
      epics.filter((epic) =>
        matchesQuery(query, epic.name, workItemDisplayId(epic, project ?? undefined)),
      ),
    [epics, query, project],
  );

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
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
              <TableHead className="px-3">{t('common.epics', 'Epics')}</TableHead>
              <TableHead className="w-40 px-3">{t('views.state', 'State')}</TableHead>
              <TableHead className="w-32 px-3">{t('views.priority', 'Priority')}</TableHead>
              <TableHead className="w-56 px-3">{t('common.progress', 'Progress')}</TableHead>
              <TableHead className="w-36 px-3">{t('issues.targetDate', 'Due')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="text-muted-foreground h-32 text-center">
                  {epics.length === 0
                    ? t('epics.empty', 'No epics yet')
                    : t('epics.noMatches', 'No epics match the current search.')}
                </TableCell>
              </TableRow>
            ) : (
              visible.map((epic) => {
                const counts = progress[epic.id] ?? EMPTY_PROGRESS;
                const percent = completionPercent(counts);
                const state = epic.state_id ? stateById.get(epic.state_id) : undefined;
                return (
                  <TableRow key={epic.id}>
                    <TableCell className="p-0">
                      <Link
                        to={`/${workspaceSlug}/app-v2/projects/${projectId}/epics/${epic.id}`}
                        className="hover:bg-muted/50 flex h-14 items-center gap-2 px-3 transition-colors"
                      >
                        <span className="text-muted-foreground shrink-0 font-mono text-xs">
                          {workItemDisplayId(epic, project ?? undefined)}
                        </span>
                        <span className="truncate font-medium">{epic.name}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="px-3">
                      <span className="flex items-center gap-2 text-sm">
                        <span
                          aria-hidden
                          className="size-2 shrink-0 rounded-full"
                          style={stateDotStyle(state)}
                        />
                        <span className="truncate">
                          {state?.name ?? t('common.noState', 'No state')}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="px-3">
                      <Badge variant={priorityVariant(epic.priority)}>
                        {PRIORITY_LABELS[(epic.priority ?? 'none') as Priority] ?? epic.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-3">
                      <div className="flex items-center gap-2">
                        <Progress value={percent} className="h-2 w-28" />
                        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                          {counts.completed}/{counts.total}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground px-3 text-sm">
                      {formatDate(epic.target_date)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
