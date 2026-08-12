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
import { moduleService, type ModuleProgress } from '../services/moduleService';
import { MODULE_STATUSES } from '../lib/moduleStatuses';
import { EMPTY_PROGRESS, completionPercent, formatDate, matchesQuery } from '../lib/projectV2';
import type { ModuleApiResponse } from '../api/types';

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  MODULE_STATUSES.map((status) => [status.id, status.label]),
);

/**
 * Design preview of a project's modules, built from shadcn primitives. It
 * stands alongside ModulesPage rather than replacing it, so the two can be
 * compared side by side.
 *
 * A table rather than the cycles page's cards: modules have no date window to
 * anchor a card on, and the columns — status, progress, dates — are what one
 * module is compared against another by.
 */
export function ProjectModulesPageV2() {
  const { t } = useTranslation();
  const { workspaceSlug, projectId } = useParams<{ workspaceSlug: string; projectId: string }>();
  const [searchParams] = useSearchParams();
  useDocumentTitle(t('common.modules', 'Modules'));

  const [modules, setModules] = useState<ModuleApiResponse[]>([]);
  const [progress, setProgress] = useState<Record<string, ModuleProgress>>({});
  const [loading, setLoading] = useState(Boolean(workspaceSlug && projectId));
  const [error, setError] = useState<string | null>(null);

  const query = searchParams.get('q') ?? '';

  useEffect(() => {
    if (!workspaceSlug || !projectId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the spinner belongs to this fetch
    setLoading(true);
    Promise.all([
      moduleService.list(workspaceSlug, projectId),
      /* Progress is decoration: a failure leaves the bars at zero rather than
         failing the page. */
      moduleService.listProgress(workspaceSlug, projectId).catch(() => ({})),
    ])
      .then(([list, prog]) => {
        if (cancelled) return;
        setModules(list ?? []);
        setProgress(prog ?? {});
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError(t('modules.loadError', 'Could not load modules.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, t]);

  const visible = useMemo(
    () => modules.filter((module) => matchesQuery(query, module.name, module.description)),
    [modules, query],
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
              <TableHead className="px-3">{t('common.modules', 'Modules')}</TableHead>
              <TableHead className="w-36 px-3">{t('common.status', 'Status')}</TableHead>
              <TableHead className="w-56 px-3">{t('common.progress', 'Progress')}</TableHead>
              <TableHead className="w-36 px-3">{t('modules.startDate', 'Start')}</TableHead>
              <TableHead className="w-36 px-3">{t('modules.targetDate', 'Target')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="text-muted-foreground h-32 text-center">
                  {modules.length === 0
                    ? t('modules.empty', 'No modules yet')
                    : t('modules.noMatches', 'No modules match the current search.')}
                </TableCell>
              </TableRow>
            ) : (
              visible.map((module) => {
                const counts = progress[module.id] ?? EMPTY_PROGRESS;
                const percent = completionPercent(counts);
                return (
                  <TableRow key={module.id}>
                    <TableCell className="p-0">
                      <Link
                        to={`/${workspaceSlug}/app-v2/projects/${projectId}/modules/${module.id}`}
                        className="hover:bg-muted/50 flex h-14 flex-col justify-center gap-0.5 px-3 transition-colors"
                      >
                        <span className="truncate font-medium">{module.name}</span>
                        {module.description && (
                          <span className="text-muted-foreground truncate text-xs">
                            {module.description}
                          </span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="px-3">
                      <Badge variant="secondary">
                        {STATUS_LABELS[module.status] ?? module.status}
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
                      {formatDate(module.start_date)}
                    </TableCell>
                    <TableCell className="text-muted-foreground px-3 text-sm">
                      {formatDate(module.target_date)}
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
