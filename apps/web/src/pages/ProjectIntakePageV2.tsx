import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Check, CircleAlert, Clock, Inbox, RefreshCw, SearchX, X } from 'lucide-react';
import { ListPageSkeleton } from '@/components/shadcn/list-page-skeleton';
import { PageHeading } from '@/components/shadcn/page-heading';
import { ProjectListToolbar } from '@/components/shadcn/project-list-toolbar';
import { Badge } from '@/components/shadcn/ui/badge';
import { Button } from '@/components/shadcn/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/shadcn/ui/empty';
import { ScrollArea, ScrollBar } from '@/components/shadcn/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/shadcn/ui/toggle-group';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { intakeService } from '../services/intakeService';
import { projectService } from '../services/projectService';
import {
  PRIORITY_LABELS,
  formatDate,
  matchesQuery,
  priorityVariant,
  type Priority,
} from '../lib/projectV2';
import type { IntakeItemApiResponse, ProjectApiResponse } from '../api/types';

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
 * The page chrome — heading, body toolbar, table section, empty and error
 * states — is the one the workspace views page established, so every v2 list
 * reads the same way; the status tabs sit in the toolbar, as the scope control
 * does on the archives page.
 *
 * Status is filtered server-side rather than in the browser: the item's
 * `status` field is a numeric code whose mapping is not exposed, while the list
 * endpoint takes the status by name. Each tab therefore fetches its own list,
 * and a triage action refetches the pair of tabs it moves an item between.
 */
export function ProjectIntakePageV2() {
  const { t } = useTranslation();
  const { workspaceSlug, projectId } = useParams<{ workspaceSlug: string; projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  useDocumentTitle(t('common.intake', 'Intake'));

  const [items, setItems] = useState<IntakeItemApiResponse[]>([]);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  /* Only failed triage actions land here; a failed load takes over the whole
     page instead. */
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const query = searchParams.get('q') ?? '';
  /* URL-backed like the search, so a shared link lands on the same queue. */
  const rawTab = searchParams.get('status') ?? '';
  const tab: IntakeTab = (TABS as readonly string[]).includes(rawTab)
    ? (rawTab as IntakeTab)
    : 'pending';

  const load = useCallback(
    (status: IntakeTab) => {
      if (!workspaceSlug || !projectId) return;
      setLoading(true);
      setLoadError(false);
      Promise.all([
        intakeService.list(workspaceSlug, projectId, status),
        /* The pending badge stays accurate on every tab, so a triage action is
           visibly reflected even while reading the accepted list. */
        intakeService.pendingCount(workspaceSlug, projectId).catch(() => 0),
        projectService.get(workspaceSlug, projectId).catch(() => null),
      ])
        .then(([list, count, proj]) => {
          setItems(list ?? []);
          setPendingCount(count);
          setProject(proj);
        })
        .catch(() => setLoadError(true))
        .finally(() => setLoading(false));
    },
    [workspaceSlug, projectId],
  );

  useEffect(() => load(tab), [load, tab]);

  const visible = useMemo(
    () => items.filter((item) => matchesQuery(query, item.issue?.name, item.source_email)),
    [items, query],
  );

  const setTab = (next: string) => {
    if (!(TABS as readonly string[]).includes(next)) return;
    const params = new URLSearchParams(searchParams);
    if (next === 'pending') params.delete('status');
    else params.set('status', next);
    setSearchParams(params, { replace: true });
  };

  const clearSearch = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('q');
    setSearchParams(params, { replace: true });
  };

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
      setActionError(null);
    } catch {
      setActionError(t('intake.actionError', 'Could not update that intake item.'));
      load(tab);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <ListPageSkeleton label={t('intake.loading', 'Loading intake…')} rows={6} />;
  }

  if (loadError) {
    return (
      <Empty className="min-h-80 rounded-xl border border-dashed" role="alert">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
            <CircleAlert aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t('intake.loadErrorTitle', 'Intake could not be loaded')}</EmptyTitle>
          <EmptyDescription>
            {t(
              'intake.loadErrorDescription',
              'Check your connection and try again. Nothing in the queue has been changed.',
            )}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button type="button" variant="outline" onClick={() => load(tab)}>
            <RefreshCw aria-hidden="true" />
            {t('common.retry', 'Try again')}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const filtered = items.length > 0 && Boolean(query);
  const emptyState = (
    <Empty className="rounded-xl border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {filtered ? <SearchX aria-hidden="true" /> : <Inbox aria-hidden="true" />}
        </EmptyMedia>
        <EmptyTitle>
          {filtered
            ? t('intake.noMatchesTitle', 'No requests found')
            : t('intake.emptyTitle', 'Nothing to triage')}
        </EmptyTitle>
        <EmptyDescription>
          {filtered
            ? t('intake.noMatches', 'No intake items match the current search.')
            : t(
                'intake.emptyDescription',
                'Requests raised from outside the project land here to be accepted, snoozed or declined.',
              )}
        </EmptyDescription>
      </EmptyHeader>
      {filtered && (
        <EmptyContent>
          <Button type="button" variant="outline" onClick={clearSearch}>
            <SearchX aria-hidden="true" />
            {t('common.clearSearch', 'Clear search')}
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeading
        title={t('common.intake', 'Intake')}
        description={t('intake.pageDescription', 'Triage requests coming into {{project}}.', {
          project: project?.name ?? t('common.thisProject', 'this project'),
        })}
        summary={t('intake.summary', '{{pending}} pending · {{visible}} in this queue', {
          pending: pendingCount,
          visible: visible.length,
        })}
      />

      <ProjectListToolbar
        searchPlaceholder={t('intake.searchPlaceholder', 'Search requests')}
        regionLabel={t('intake.toolbar', 'Intake controls')}
        scopeControl={
          /* The segmented control the v2 projects and archives lists use for
             their scopes, so every scope switch reads the same. */
          <ToggleGroup
            type="single"
            value={tab}
            onValueChange={setTab}
            variant="default"
            size="sm"
            spacing={1}
            className="bg-muted/60 w-fit max-w-full shrink-0 touch-pan-x overflow-x-auto rounded-lg p-1 sm:p-0.5"
            aria-label={t('intake.scope', 'Triage status')}
          >
            {TABS.map((name) => (
              <ToggleGroupItem
                key={name}
                value={name}
                className="data-[state=on]:bg-background h-11 min-w-0 gap-1.5 px-3 data-[state=on]:shadow-xs sm:h-8 sm:px-2.5"
              >
                {t(`intake.${name}`, TAB_LABELS[name])}
                {name === 'pending' && pendingCount > 0 && (
                  <span className="text-muted-foreground min-w-3 text-center text-xs font-normal tabular-nums">
                    {pendingCount}
                  </span>
                )}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        }
      />

      {actionError && (
        <p className="text-destructive text-sm" role="alert">
          {actionError}
        </p>
      )}

      <div>
        {visible.length === 0 ? (
          emptyState
        ) : (
          <section
            className="rounded-xl border"
            aria-label={t('intake.tableLabel', 'Intake table')}
          >
            <ScrollArea className="w-full">
              <Table className="min-w-[52rem]">
                <TableCaption className="sr-only">
                  {t(
                    'intake.tableCaption',
                    'Incoming requests, with priority, source, creation date and triage actions.',
                  )}
                </TableCaption>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="min-w-72 px-3">
                      {t('intake.request', 'Request')}
                    </TableHead>
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
                  {visible.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="min-w-72 p-0">
                        <Link
                          to={`/${workspaceSlug}/app-v2/projects/${projectId}/work-items/${item.issue_id}`}
                          className="hover:bg-muted/50 focus-visible:ring-ring flex h-12 items-center gap-2 px-3 outline-none transition-colors focus-visible:ring-2"
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
                        <span className="truncate">{item.source_email || item.source || '—'}</span>
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
                              className="h-11 sm:h-8"
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
                              className="h-11 sm:h-8"
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
                              className="h-11 sm:h-8"
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
                  ))}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </section>
        )}
      </div>

      {query && (
        <p className="sr-only" aria-live="polite">
          {t('intake.visibleCount', '{{count}} requests visible', { count: visible.length })}
        </p>
      )}
    </div>
  );
}
