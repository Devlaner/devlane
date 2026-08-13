import { Fragment, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  CalendarDays,
  ChartGantt,
  CircleAlert,
  Columns3,
  ListTodo,
  Plus,
  RefreshCw,
  Rows3,
  Search,
  SearchX,
  Sheet,
  Upload,
  X,
} from 'lucide-react';
import { CreateWorkItemDialog } from '@/components/shadcn/create-work-item-dialog';
import { ImportCSVModal } from '@/components/work-item/ImportCSVModal';
import { IssuePRBadge } from '@/components/work-item/IssuePRBadge';
import {
  InlineAssigneeCell,
  InlineDateCell,
  InlineLabelsCell,
  InlinePriorityCell,
  InlineStateCell,
} from '@/components/shadcn/work-item-inline-cells';
import {
  WorkItemActionsMenu,
  WorkItemContextMenu,
} from '@/components/shadcn/work-item-row-actions';
import { WorkItemsBulkBar } from '@/components/shadcn/work-items-bulk-bar';
import { WorkItemsDisplayMenu } from '@/components/shadcn/work-items-display-menu';
import { WorkItemsFiltersMenu } from '@/components/shadcn/work-items-filters-menu';
import { WorkItemsBoardLayout } from '@/components/shadcn/work-item-layouts/work-items-board-layout';
import { WorkItemsCalendarLayout } from '@/components/shadcn/work-item-layouts/work-items-calendar-layout';
import { WorkItemsGanttLayout } from '@/components/shadcn/work-item-layouts/work-items-gantt-layout';
import { WorkItemsSpreadsheetLayout } from '@/components/shadcn/work-item-layouts/work-items-spreadsheet-layout';
import { parseIssueLayout } from '@/components/work-item/layouts/IssueLayoutTypes';
import { Badge } from '@/components/shadcn/ui/badge';
import { Button } from '@/components/shadcn/ui/button';
import { Checkbox } from '@/components/shadcn/ui/checkbox';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/shadcn/ui/empty';
import { Input } from '@/components/shadcn/ui/input';
import { ScrollArea, ScrollBar } from '@/components/shadcn/ui/scroll-area';
import { Skeleton } from '@/components/shadcn/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/shadcn/ui/toggle-group';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/ui/table';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useProjectIssuesController } from '../hooks/useProjectIssuesController';
import {
  formatDate,
  formatTimeAgo,
  stateDotStyle,
  workItemDisplayId,
  type Priority,
} from '../lib/projectV2';
import { cn } from '../lib/utils';
import { issueService } from '../services/issueService';
import type { IssueApiResponse } from '../api/types';

function validTimestamp(value: string | null | undefined): value is string {
  return Boolean(value && Number.isFinite(Date.parse(value)));
}

/**
 * The v2 design of a project's work item list. Loading, filtering, grouping,
 * ordering, selection and persistence all come from useProjectIssuesController —
 * the same controller the shipped list uses — so this page is a redesign of that
 * list rather than a second implementation of it.
 */
export function ProjectWorkItemsPageV2() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workspaceSlug, projectId } = useParams<{ workspaceSlug: string; projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  useDocumentTitle(t('views.workItems', 'Work items'));

  const {
    workspace,
    project,
    projects,
    issues,
    states,
    labels,
    cycles,
    members,
    prSummary,
    loading,
    listFilters,
    setListFilters,
    listDisplay,
    setListDisplay,
    searchQuery,
    setSearchQuery,
    filteredIssues,
    groupedIssues,
    subGroupedIssues,
    orderedVisibleIssues,
    subWorkCountByParentId,
    hasCol,
    cycleName,
    moduleName,
    selectedIds,
    visibleSelectedIds,
    toggleSelect,
    setSelection,
    clearSelection,
    runBulk,
    bulkError,
    refetchIssues,
    handleInlineUpdate,
    handleReorder,
    reorderEnabled,
    handleCardMove,
    now,
    createOpen,
    createError,
    openCreate,
    handleCloseCreate,
    handleCreateSave,
  } = useProjectIssuesController(workspaceSlug, projectId);

  const layout = parseIssueLayout(searchParams.get('layout'));
  const setLayout = (next: string) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'list') params.delete('layout');
    else params.set('layout', next);
    setSearchParams(params, { replace: true });
  };

  const [importOpen, setImportOpen] = useState(false);
  /* Manual reorder is only offered under "Order by: manual", the same rule the
     shipped list applies; the drop point follows the pointer's half of the row. */
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const stateById = new Map(states.map((state) => [state.id, state]));

  const issueUrl = (issueId: string) =>
    `/${workspaceSlug}/app-v2/projects/${projectId}/work-items/${issueId}`;

  const copyIssueLink = (issueId: string) => {
    const url = `${window.location.origin}${issueUrl(issueId)}`;
    void navigator.clipboard
      ?.writeText(url)
      .then(() => toast.success(t('common.linkCopied', 'Link copied')))
      .catch(() => toast.error(t('common.copyLinkError', 'Could not copy that link.')));
  };

  const archiveIds = async (ids: string[]) => {
    if (!workspaceSlug || !projectId || ids.length === 0) return;
    try {
      await issueService.bulkArchive(workspaceSlug, projectId, ids, true);
      refetchIssues();
      toast.success(
        t('issues.archiveSuccess', '{{count}} work items archived', { count: ids.length }),
        {
          action: {
            label: t('common.undo', 'Undo'),
            onClick: () => {
              void issueService
                .bulkArchive(workspaceSlug, projectId, ids, false)
                .then(refetchIssues)
                .catch(() => toast.error(t('issues.undoError', 'Could not undo that change.')));
            },
          },
        },
      );
    } catch {
      toast.error(t('issues.archiveError', 'Could not archive those work items.'));
    }
  };

  const deleteIds = async (ids: string[]) => {
    if (!workspaceSlug || !projectId || ids.length === 0) return;
    try {
      await issueService.bulkDelete(workspaceSlug, projectId, ids);
      refetchIssues();
      toast.success(
        t('issues.deleteSuccess', '{{count}} work items deleted', { count: ids.length }),
      );
    } catch {
      toast.error(t('issues.deleteError', 'Could not delete those work items.'));
    }
  };

  if (loading) {
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

  if (!workspace || !project) {
    return (
      <Empty className="min-h-80 rounded-xl border border-dashed" role="alert">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
            <CircleAlert aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t('issues.loadErrorTitle', 'Work items could not be loaded')}</EmptyTitle>
          <EmptyDescription>
            {t(
              'issues.loadErrorDescription',
              'Check your connection and try again. Your work item data has not been changed.',
            )}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button type="button" variant="outline" onClick={() => refetchIssues()}>
            <RefreshCw aria-hidden="true" />
            {t('common.retry', 'Try again')}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  /* Columns follow the shared display properties, so the two designs show the
     same data with the same toggles. */
  const columns: Array<{ id: string; label: string; className?: string }> = [
    { id: '__select__', label: '', className: 'w-10 px-3' },
    { id: '__title__', label: t('views.workItems', 'Work items'), className: 'min-w-72 px-3' },
  ];
  if (hasCol('state')) {
    columns.push({ id: 'state', label: t('views.state', 'State'), className: 'w-36 px-3' });
  }
  if (hasCol('priority')) {
    columns.push({
      id: 'priority',
      label: t('views.priority', 'Priority'),
      className: 'w-28 px-3',
    });
  }
  if (hasCol('assignee')) {
    columns.push({
      id: 'assignee',
      label: t('common.assignees', 'Assignees'),
      className: 'hidden w-36 px-3 md:table-cell',
    });
  }
  if (hasCol('labels')) {
    columns.push({
      id: 'labels',
      label: t('common.labels', 'Labels'),
      className: 'hidden w-44 px-3 xl:table-cell',
    });
  }
  if (hasCol('cycle')) {
    columns.push({
      id: 'cycle',
      label: t('display.groupCycle', 'Cycle'),
      className: 'hidden w-32 px-3 xl:table-cell',
    });
  }
  if (hasCol('module')) {
    columns.push({
      id: 'module',
      label: t('display.groupModule', 'Module'),
      className: 'hidden w-32 px-3 xl:table-cell',
    });
  }
  if (hasCol('sub_work_count')) {
    columns.push({
      id: 'sub_work_count',
      label: t('display.property.sub_work_count', 'Sub-work item count'),
      className: 'hidden w-24 px-3 xl:table-cell',
    });
  }
  if (hasCol('start_date')) {
    columns.push({
      id: 'start_date',
      label: t('filters.startDate', 'Start date'),
      className: 'hidden w-36 px-3 lg:table-cell',
    });
  }
  if (hasCol('due_date')) {
    columns.push({
      id: 'due_date',
      label: t('issues.targetDate', 'Due'),
      className: 'hidden w-36 px-3 md:table-cell',
    });
  }
  columns.push({
    id: '__updated__',
    label: t('common.updated', 'Updated'),
    className: 'hidden w-36 px-3 lg:table-cell',
  });
  columns.push({ id: '__actions__', label: '', className: 'w-12 px-3' });

  const columnCount = columns.length;

  const renderRow = (issue: IssueApiResponse) => {
    const actions = {
      issue,
      states,
      issueUrl: issueUrl(issue.id),
      onChangeState: (stateId: string) => handleInlineUpdate(issue.id, { state_id: stateId }),
      onChangePriority: (priority: string) =>
        handleInlineUpdate(issue.id, { priority: priority as Priority }),
      onCopyLink: () => copyIssueLink(issue.id),
      onArchive: () => void archiveIds([issue.id]),
      onDelete: () => void deleteIds([issue.id]),
    };

    return (
      <WorkItemContextMenu key={issue.id} {...actions}>
        <TableRow
          data-state={selectedIds.has(issue.id) ? 'selected' : undefined}
          className={cn('cursor-pointer', draggingId === issue.id && 'opacity-50')}
          draggable={reorderEnabled}
          onDragStart={(event) => {
            if (!reorderEnabled) return;
            setDraggingId(issue.id);
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', issue.id);
          }}
          onDragEnd={() => setDraggingId(null)}
          onDragOver={(event) => {
            if (reorderEnabled && draggingId && draggingId !== issue.id) event.preventDefault();
          }}
          onDrop={(event) => {
            if (!reorderEnabled) return;
            event.preventDefault();
            const activeId = event.dataTransfer.getData('text/plain') || draggingId;
            setDraggingId(null);
            if (!activeId || activeId === issue.id) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            handleReorder(activeId, issue.id, event.clientY > bounds.top + bounds.height / 2);
          }}
          onClick={(event) => {
            const target = event.target as HTMLElement;
            if (
              target.closest(
                'a, button, input, select, textarea, [role="menuitem"], [role="checkbox"]',
              )
            ) {
              return;
            }
            navigate(issueUrl(issue.id));
          }}
        >
          <TableCell className="px-3">
            <Checkbox
              checked={selectedIds.has(issue.id)}
              onCheckedChange={() => toggleSelect(issue.id)}
              aria-label={t('issues.selectItem', 'Select {{name}}', { name: issue.name })}
            />
          </TableCell>
          <TableCell className="min-w-72 px-3 py-2">
            <Link
              to={issueUrl(issue.id)}
              className="focus-visible:ring-ring flex min-w-0 items-center gap-2 rounded-sm outline-none focus-visible:ring-2"
            >
              {hasCol('id') && (
                <span className="text-muted-foreground shrink-0 font-mono text-xs">
                  {workItemDisplayId(issue, project)}
                </span>
              )}
              <span className="truncate font-medium">{issue.name}</span>
              <IssuePRBadge summary={prSummary[issue.id]} />
            </Link>
          </TableCell>
          {hasCol('state') && (
            <TableCell className="px-2">
              <InlineStateCell
                issue={issue}
                states={states}
                onUpdate={(patch) => handleInlineUpdate(issue.id, patch)}
              />
            </TableCell>
          )}
          {hasCol('priority') && (
            <TableCell className="px-2">
              <InlinePriorityCell
                issue={issue}
                onUpdate={(patch) => handleInlineUpdate(issue.id, patch)}
              />
            </TableCell>
          )}
          {hasCol('assignee') && (
            <TableCell className="hidden px-2 md:table-cell">
              <InlineAssigneeCell
                issue={issue}
                members={members}
                onUpdate={(patch) => handleInlineUpdate(issue.id, patch)}
              />
            </TableCell>
          )}
          {hasCol('labels') && (
            <TableCell className="hidden px-2 xl:table-cell">
              <InlineLabelsCell
                issue={issue}
                labels={labels}
                onUpdate={(patch) => handleInlineUpdate(issue.id, patch)}
              />
            </TableCell>
          )}
          {hasCol('cycle') && (
            <TableCell className="text-muted-foreground hidden truncate px-3 text-sm xl:table-cell">
              {cycleName(issue)}
            </TableCell>
          )}
          {hasCol('module') && (
            <TableCell className="text-muted-foreground hidden truncate px-3 text-sm xl:table-cell">
              {moduleName(issue)}
            </TableCell>
          )}
          {hasCol('sub_work_count') && (
            <TableCell className="text-muted-foreground hidden px-3 text-sm tabular-nums xl:table-cell">
              {subWorkCountByParentId.get(issue.id) ?? 0}
            </TableCell>
          )}
          {hasCol('start_date') && (
            <TableCell className="hidden px-2 lg:table-cell">
              <InlineDateCell
                issue={issue}
                field="start_date"
                onUpdate={(patch) => handleInlineUpdate(issue.id, patch)}
              />
            </TableCell>
          )}
          {hasCol('due_date') && (
            <TableCell className="hidden px-2 md:table-cell">
              <InlineDateCell
                issue={issue}
                field="target_date"
                onUpdate={(patch) => handleInlineUpdate(issue.id, patch)}
              />
            </TableCell>
          )}
          <TableCell className="text-muted-foreground hidden px-3 text-xs lg:table-cell">
            {validTimestamp(issue.updated_at) ? (
              <time dateTime={issue.updated_at} title={formatDate(issue.updated_at)}>
                {formatTimeAgo(issue.updated_at)}
              </time>
            ) : (
              '—'
            )}
          </TableCell>
          <TableCell className="px-3">
            <div className="flex justify-end">
              <WorkItemActionsMenu
                {...actions}
                menuLabel={t('issues.itemMenu', '{{name}} actions', { name: issue.name })}
              />
            </div>
          </TableCell>
        </TableRow>
      </WorkItemContextMenu>
    );
  };

  const groupHeaderRow = (key: string, title: string, items: IssueApiResponse[], depth = 0) => (
    <TableRow className="bg-muted/30 hover:bg-muted/30">
      <TableHead scope="rowgroup" colSpan={columnCount} className="h-9 px-3 py-2">
        <span
          className="flex items-center gap-2 text-xs font-medium"
          style={{ paddingLeft: depth * 16 }}
        >
          <Checkbox
            checked={items.length > 0 && items.every((issue) => selectedIds.has(issue.id))}
            onCheckedChange={(checked) => {
              const next = new Set(selectedIds);
              items.forEach((issue) =>
                checked === true ? next.add(issue.id) : next.delete(issue.id),
              );
              setSelection(next);
            }}
            aria-label={t('issues.selectGroup', 'Select all in {{group}}', { group: title })}
          />
          {key !== '__none__' && listDisplay.groupBy === 'states' && (
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full"
              style={stateDotStyle(stateById.get(key))}
            />
          )}
          <span className="truncate">{title}</span>
          <Badge variant="secondary" className="tabular-nums">
            {items.length}
          </Badge>
        </span>
      </TableHead>
    </TableRow>
  );

  const hasRows = filteredIssues.length > 0;

  return (
    <div className="space-y-6 pb-8">
      <CreateWorkItemDialog
        open={createOpen}
        onClose={handleCloseCreate}
        workspaceSlug={workspace.slug}
        projects={projects}
        defaultProjectId={project.id}
        onSave={handleCreateSave}
        createError={createError}
      />
      <ImportCSVModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        workspaceSlug={workspace.slug}
        projectId={project.id}
        onImported={refetchIssues}
      />

      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('views.workItems', 'Work items')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t('issues.pageDescription', 'Plan, prioritize, and track work for {{project}}.', {
              project: project.name,
            })}
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

      <div
        className="bg-card/50 flex flex-wrap items-center gap-2 rounded-xl border p-3 shadow-xs sm:p-4"
        role="region"
        aria-label={t('issues.toolbar', 'Work item controls')}
      >
        <div className="relative order-last w-full min-w-0 sm:order-none sm:w-64 sm:flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t('issues.searchPlaceholder', 'Search work items')}
            aria-label={t('issues.searchPlaceholder', 'Search work items')}
            className="h-11 pr-12 pl-10 sm:h-9"
          />
          {searchQuery && (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={() => {
                setSearchQuery('');
                requestAnimationFrame(() => searchInputRef.current?.focus());
              }}
              aria-label={t('common.clearSearch', 'Clear search')}
              className="absolute top-1/2 right-1 size-10 -translate-y-1/2 sm:size-8"
            >
              <X aria-hidden="true" />
            </Button>
          )}
        </div>

        <WorkItemsFiltersMenu
          filters={listFilters}
          onChange={setListFilters}
          labels={labels}
          cycles={cycles}
          members={members}
        />

        <div className="ml-auto flex items-center gap-2">
          <ToggleGroup
            type="single"
            value={layout}
            onValueChange={(value) => {
              if (value) setLayout(value);
            }}
            variant="outline"
            spacing={0}
            className="h-11 sm:h-9"
            aria-label={t('issues.layout', 'Layout')}
          >
            <ToggleGroupItem
              value="list"
              className="h-11 px-3 sm:h-9"
              aria-label={t('issues.layoutList', 'List')}
              title={t('issues.layoutList', 'List')}
            >
              <Rows3 aria-hidden="true" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="board"
              className="h-11 px-3 sm:h-9"
              aria-label={t('issues.layoutBoard', 'Board')}
              title={t('issues.layoutBoard', 'Board')}
            >
              <Columns3 aria-hidden="true" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="spreadsheet"
              className="h-11 px-3 sm:h-9"
              aria-label={t('issues.layoutSpreadsheet', 'Spreadsheet')}
              title={t('issues.layoutSpreadsheet', 'Spreadsheet')}
            >
              <Sheet aria-hidden="true" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="calendar"
              className="h-11 px-3 sm:h-9"
              aria-label={t('issues.layoutCalendar', 'Calendar')}
              title={t('issues.layoutCalendar', 'Calendar')}
            >
              <CalendarDays aria-hidden="true" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="gantt"
              className="h-11 px-3 sm:h-9"
              aria-label={t('issues.layoutGantt', 'Timeline')}
              title={t('issues.layoutGantt', 'Timeline')}
            >
              <ChartGantt aria-hidden="true" />
            </ToggleGroupItem>
          </ToggleGroup>
          <WorkItemsDisplayMenu display={listDisplay} onChange={setListDisplay} />
          <Button
            type="button"
            variant="outline"
            className="h-11 sm:h-9"
            onClick={() => setImportOpen(true)}
          >
            <Upload aria-hidden="true" />
            <span className="hidden lg:inline">{t('workItem.list.importCsv', 'Import CSV')}</span>
          </Button>
          <Button type="button" className="h-11 sm:h-9" onClick={openCreate}>
            <Plus aria-hidden="true" />
            <span className="hidden sm:inline">{t('issues.create', 'New work item')}</span>
            <span className="sm:hidden">{t('common.new', 'New')}</span>
          </Button>
        </div>
      </div>

      {bulkError && (
        <p className="text-destructive text-sm" role="alert">
          {bulkError}
        </p>
      )}

      {hasRows && layout === 'board' && (
        <WorkItemsBoardLayout
          groupedIssues={groupedIssues}
          subGroupedIssues={subGroupedIssues}
          showEmptyGroups={listDisplay.showEmptyGroups}
          groupBy={listDisplay.groupBy}
          states={states}
          labels={labels}
          members={members}
          prSummary={prSummary}
          hasCol={hasCol}
          issueUrl={issueUrl}
          onCardMove={handleCardMove}
        />
      )}

      {hasRows && layout === 'spreadsheet' && (
        <WorkItemsSpreadsheetLayout
          groupedIssues={groupedIssues}
          subGroupedIssues={subGroupedIssues}
          showEmptyGroups={listDisplay.showEmptyGroups}
          project={project}
          states={states}
          labels={labels}
          members={members}
          prSummary={prSummary}
          hasCol={hasCol}
          subWorkCountByParentId={subWorkCountByParentId}
          cycleName={cycleName}
          moduleName={moduleName}
          issueUrl={issueUrl}
          onUpdateIssue={handleInlineUpdate}
        />
      )}

      {hasRows && layout === 'calendar' && (
        <WorkItemsCalendarLayout
          issues={orderedVisibleIssues}
          states={states}
          issueUrl={issueUrl}
          onUpdateIssue={handleInlineUpdate}
          now={now}
        />
      )}

      {hasRows && layout === 'gantt' && (
        <WorkItemsGanttLayout
          issues={orderedVisibleIssues}
          states={states}
          issueUrl={issueUrl}
          onUpdateIssue={handleInlineUpdate}
          now={now}
        />
      )}

      {hasRows && layout === 'list' && (
        <section
          className="rounded-xl border"
          aria-label={t('issues.tableLabel', 'Work items table')}
        >
          <ScrollArea className="w-full">
            <Table>
              <TableCaption className="sr-only">
                {t(
                  'issues.tableCaption',
                  'Work items on this page, with state, priority, assignees, labels, due date, and last update.',
                )}
              </TableCaption>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  {columns.map((column) =>
                    column.id === '__select__' ? (
                      <TableHead key={column.id} className={column.className}>
                        <Checkbox
                          checked={
                            filteredIssues.length > 0 &&
                            filteredIssues.every((issue) => selectedIds.has(issue.id))
                              ? true
                              : visibleSelectedIds.size > 0
                                ? 'indeterminate'
                                : false
                          }
                          onCheckedChange={(checked) =>
                            checked === true
                              ? setSelection(filteredIssues.map((issue) => issue.id))
                              : clearSelection()
                          }
                          aria-label={t('issues.selectAll', 'Select all work items on this page')}
                        />
                      </TableHead>
                    ) : (
                      <TableHead key={column.id} className={column.className}>
                        {column.label || (
                          <span className="sr-only">{t('common.actions', 'Actions')}</span>
                        )}
                      </TableHead>
                    ),
                  )}
                </TableRow>
              </TableHeader>

              {subGroupedIssues
                ? subGroupedIssues.primaryOrder.map((primaryKey) => {
                    const cells = subGroupedIssues.cells.get(primaryKey);
                    const primaryItems = subGroupedIssues.subOrder.flatMap(
                      (subKey) => cells?.get(subKey) ?? [],
                    );
                    return (
                      <TableBody key={primaryKey}>
                        {groupHeaderRow(
                          primaryKey,
                          subGroupedIssues.primaryTitle(primaryKey),
                          primaryItems,
                        )}
                        {subGroupedIssues.subOrder.map((subKey) => {
                          const items = cells?.get(subKey) ?? [];
                          if (items.length === 0 && !listDisplay.showEmptyGroups) return null;
                          return (
                            <Fragment key={`${primaryKey}:${subKey}`}>
                              {groupHeaderRow(subKey, subGroupedIssues.subTitle(subKey), items, 1)}
                              {items.map(renderRow)}
                            </Fragment>
                          );
                        })}
                      </TableBody>
                    );
                  })
                : groupedIssues.order.map((groupKey) => {
                    const items = groupedIssues.groups.get(groupKey) ?? [];
                    return (
                      <TableBody key={groupKey}>
                        {!groupedIssues.isFlat &&
                          groupHeaderRow(groupKey, groupedIssues.title(groupKey), items)}
                        {items.map(renderRow)}
                      </TableBody>
                    );
                  })}
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          <div className="border-t p-2.5">
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground h-9 w-full justify-start border border-dashed"
              onClick={openCreate}
            >
              <Plus aria-hidden="true" />
              {t('issues.create', 'New work item')}
            </Button>
          </div>
        </section>
      )}

      {issues.length === 0 && (
        <Empty className="rounded-xl border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListTodo aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t('issues.emptyTitle', 'Create your first work item')}</EmptyTitle>
            <EmptyDescription>
              {t(
                'issues.emptyDescription',
                'Work items turn ideas into clear, prioritized steps your team can deliver.',
              )}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" onClick={openCreate}>
              <Plus aria-hidden="true" />
              {t('issues.create', 'New work item')}
            </Button>
          </EmptyContent>
        </Empty>
      )}

      {issues.length > 0 && !hasRows && (
        <Empty className="rounded-xl border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchX aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t('issues.noMatchesTitle', 'No work items found')}</EmptyTitle>
            <EmptyDescription>
              {t(
                'issues.noMatchesOnPage',
                'No work items on this page match the current search and filters.',
              )}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" variant="outline" onClick={() => setSearchQuery('')}>
              <SearchX aria-hidden="true" />
              {t('common.clearFilters', 'Clear filters')}
            </Button>
          </EmptyContent>
        </Empty>
      )}

      <WorkItemsBulkBar
        selectedCount={visibleSelectedIds.size}
        states={states}
        busy={false}
        onChangeState={(stateId) =>
          void runBulk((slug, pid, ids) =>
            issueService.bulkUpdate(slug, pid, ids, { state_id: stateId }),
          )
        }
        onChangePriority={(priority) =>
          void runBulk((slug, pid, ids) => issueService.bulkUpdate(slug, pid, ids, { priority }))
        }
        onArchive={() => void archiveIds([...visibleSelectedIds])}
        onDelete={() => void deleteIds([...visibleSelectedIds])}
        onClear={clearSelection}
      />

      <p className="sr-only" aria-live="polite">
        {t('issues.visibleCount', '{{count}} work items visible', { count: filteredIssues.length })}
      </p>
    </div>
  );
}
