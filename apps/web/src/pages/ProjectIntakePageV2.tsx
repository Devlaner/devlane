import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Check, Clock, X } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/shadcn/ui/tabs';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { intakeService } from '../services/intakeService';
import {
  PRIORITY_LABELS,
  formatDate,
  matchesQuery,
  priorityVariant,
  type Priority,
} from '../lib/projectV2';
import type { IntakeItemApiResponse } from '../api/types';

/** The statuses the triage inbox is browsed by, in the order they are worked. */
const TABS = ['pending', 'snoozed', 'accepted', 'declined'] as const;
type IntakeTab = (typeof TABS)[number];

const TAB_LABELS: Record<IntakeTab, string> = {
  pending: 'Pending',
  snoozed: 'Snoozed',
  accepted: 'Accepted',
  declined: 'Declined',
};

/** How long a snooze lasts, matching the shipped triage default. */
const SNOOZE_DAYS = 7;

/**
 * Design preview of a project's intake triage, built from shadcn primitives. It
 * stands alongside IntakePage rather than replacing it, so the two can be
 * compared side by side.
 *
 * Status is filtered server-side rather than in the browser: the item's
 * `status` field is a numeric code whose mapping is not exposed, while the list
 * endpoint takes the status by name. Each tab therefore fetches its own list,
 * and a triage action refetches the pair of tabs it moves an item between.
 */
export function ProjectIntakePageV2() {
  const { t } = useTranslation();
  const { workspaceSlug, projectId } = useParams<{ workspaceSlug: string; projectId: string }>();
  const [searchParams] = useSearchParams();
  useDocumentTitle(t('common.intake', 'Intake'));

  const [tab, setTab] = useState<IntakeTab>('pending');
  const [items, setItems] = useState<IntakeItemApiResponse[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const query = searchParams.get('q') ?? '';

  const load = useCallback(
    (status: IntakeTab) => {
      if (!workspaceSlug || !projectId) return;
      setLoading(true);
      Promise.all([
        intakeService.list(workspaceSlug, projectId, status),
        /* The pending badge stays accurate on every tab, so a triage action is
           visibly reflected even while reading the accepted list. */
        intakeService.pendingCount(workspaceSlug, projectId).catch(() => 0),
      ])
        .then(([list, count]) => {
          setItems(list ?? []);
          setPendingCount(count);
          setError(null);
        })
        .catch(() => setError(t('intake.loadError', 'Could not load intake items.')))
        .finally(() => setLoading(false));
    },
    [workspaceSlug, projectId, t],
  );

  useEffect(() => load(tab), [load, tab]);

  const visible = useMemo(
    () => items.filter((item) => matchesQuery(query, item.issue?.name, item.source_email)),
    [items, query],
  );

  /** Runs a triage action, then reloads the tab the item just left. */
  const triage = async (item: IntakeItemApiResponse, action: 'accept' | 'decline' | 'snooze') => {
    if (!workspaceSlug || !projectId || busyId) return;
    setBusyId(item.id);
    /* Removed up front: whichever tab is open, the item no longer belongs to
       it once the action succeeds. */
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    try {
      if (action === 'accept') await intakeService.accept(workspaceSlug, projectId, item.id);
      else if (action === 'decline') await intakeService.decline(workspaceSlug, projectId, item.id);
      else {
        const till = new Date(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000).toISOString();
        await intakeService.snooze(workspaceSlug, projectId, item.id, till);
      }
      const count = await intakeService.pendingCount(workspaceSlug, projectId).catch(() => null);
      if (count !== null) setPendingCount(count);
    } catch {
      setError(t('intake.actionError', 'Could not update that intake item.'));
      load(tab);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as IntakeTab)}
        className="flex min-h-0 flex-1 flex-col gap-3"
      >
        <TabsList>
          {TABS.map((name) => (
            <TabsTrigger key={name} value={name}>
              {t(`intake.${name}`, TAB_LABELS[name])}
              {name === 'pending' && pendingCount > 0 && (
                <Badge variant="secondary">{pendingCount}</Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={tab} className="min-h-0 flex-1 flex-col data-[state=active]:flex">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto rounded-xl border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-3">{t('intake.request', 'Request')}</TableHead>
                    <TableHead className="w-32 px-3">{t('views.priority', 'Priority')}</TableHead>
                    <TableHead className="w-40 px-3">{t('intake.source', 'Source')}</TableHead>
                    <TableHead className="w-36 px-3">{t('common.created', 'Created')}</TableHead>
                    {tab === 'pending' && (
                      <TableHead className="w-56 px-3 text-right">
                        <span className="sr-only">{t('common.actions', 'Actions')}</span>
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={tab === 'pending' ? 5 : 4}
                        className="text-muted-foreground h-32 text-center"
                      >
                        {items.length === 0
                          ? t('intake.empty', 'Nothing to triage')
                          : t('intake.noMatches', 'No intake items match the current search.')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    visible.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="p-0">
                          <Link
                            to={`/${workspaceSlug}/app-v2/projects/${projectId}/work-items/${item.issue_id}`}
                            className="hover:bg-muted/50 flex h-12 items-center gap-2 px-3 transition-colors"
                          >
                            <span className="truncate font-medium">
                              {item.issue?.name ?? t('intake.untitled', 'Untitled request')}
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell className="px-3">
                          <Badge variant={priorityVariant(item.issue?.priority)}>
                            {PRIORITY_LABELS[(item.issue?.priority ?? 'none') as Priority] ??
                              item.issue?.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground px-3 text-sm">
                          <span className="truncate">
                            {item.source_email || item.source || '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground px-3 text-sm">
                          {formatDate(item.created_at)}
                        </TableCell>
                        {tab === 'pending' && (
                          <TableCell className="px-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={busyId === item.id}
                                onClick={() => void triage(item, 'accept')}
                              >
                                <Check />
                                {t('intake.accept', 'Accept')}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={busyId === item.id}
                                onClick={() => void triage(item, 'snooze')}
                              >
                                <Clock />
                                {t('intake.snooze', 'Snooze')}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={busyId === item.id}
                                onClick={() => void triage(item, 'decline')}
                              >
                                <X />
                                {t('intake.decline', 'Decline')}
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
