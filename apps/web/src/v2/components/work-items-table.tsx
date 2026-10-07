import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, CalendarDays, ChevronsUpDown, Signal, Tag, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/v2/components/ui/avatar';
import { Badge } from '@/v2/components/ui/badge';
import { Button } from '@/v2/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/v2/components/ui/dropdown-menu';
import { Input } from '@/v2/components/ui/input';
import { ScrollArea, ScrollBar } from '@/v2/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/v2/components/ui/table';
import { formatTimeAgo } from '../lib/project';
import { getImageUrl } from '../../lib/utils';
import {
  DISPLAY_PROPERTY_LABELS,
  SPREADSHEET_COLUMN_ORDER,
  type DisplayPropertyKey,
  type SortableColumn,
  type SortOrder,
} from '../../types/workspaceViewDisplay';
import type {
  CycleApiResponse,
  IssueApiResponse,
  LabelApiResponse,
  ModuleApiResponse,
  ProjectApiResponse,
  StateApiResponse,
  WorkspaceMemberApiResponse,
} from '../../api/types';
import type { Priority } from '../../types';

/** Anything the table can show as a column. */
export type WorkItemsTableColumn = DisplayPropertyKey | 'created_at' | 'updated_at';

/** The patch shape the inline editors produce. */
export interface WorkItemsTablePatch {
  state_id?: string | null;
  priority?: Priority;
  assignee_ids?: string[];
  label_ids?: string[];
  start_date?: string | null;
  target_date?: string | null;
}

/** Compact list columns mirror the project work-items table's information order. */
const LIST_COLUMN_ORDER: WorkItemsTableColumn[] = [
  'state',
  'priority',
  'assignee',
  'labels',
  'cycle',
  'module',
  'start_date',
  'due_date',
  'updated_at',
];

/** Columns the header can sort by; the rest are display-only. */
const SORTABLE_BY_COLUMN: Partial<Record<WorkItemsTableColumn, SortableColumn>> = {
  priority: 'priority',
  state: 'state',
  assignee: 'assignee',
  start_date: 'start_date',
  due_date: 'due_date',
  created_at: 'created_at',
  updated_at: 'updated_at',
};

const COLUMN_ICONS: Partial<Record<WorkItemsTableColumn, typeof User>> = {
  priority: Signal,
  assignee: User,
  labels: Tag,
  start_date: CalendarDays,
  due_date: CalendarDays,
};

/** Cells that open an editor rather than just rendering a value. */
const EDITABLE_COLUMNS: WorkItemsTableColumn[] = [
  'state',
  'priority',
  'assignee',
  'labels',
  'start_date',
  'due_date',
];

const cellTriggerClass =
  'hover:bg-muted/50 flex h-11 w-full items-center gap-2 rounded-none px-3 text-left text-sm font-normal';

export interface WorkItemsTableProps {
  /** Rows, already filtered and sorted by the caller. */
  issues: IssueApiResponse[];
  /** `list` is the compact table; `spreadsheet` pins the name and scrolls. */
  variant: 'list' | 'spreadsheet';
  /** Which optional columns to show, in the caller's display state. */
  properties: DisplayPropertyKey[];
  projects: ProjectApiResponse[];
  states: StateApiResponse[];
  labels: LabelApiResponse[];
  members: WorkspaceMemberApiResponse[];
  modules: ModuleApiResponse[];
  cycles: CycleApiResponse[];
  sortBy: SortableColumn;
  sortOrder: SortOrder;
  onSort: (column: SortableColumn) => void;
  issueHref: (issue: IssueApiResponse) => string;
  /** Applies an inline edit; the caller owns the request and its rollback. */
  onPatch: (issue: IssueApiResponse, patch: WorkItemsTablePatch) => void;
  /** Renders the current user's own name as "You", as the shipped table does. */
  currentUserId?: string;
}

/**
 * The v2 work-item table: one row per work item, sortable headers, and cells
 * that edit in place.
 *
 * Every v2 list that shows work items as rows renders this — the workspace
 * views page and the cycle page today. They show the same records with the same
 * columns, and a cycle whose rows looked or behaved differently from the same
 * rows on the views page would read as a different product, so the table lives
 * here rather than in either page.
 *
 * Sorting and filtering stay with the caller: what a page shows is the page's
 * business, and only the header's own clicks come back out through `onSort`.
 */
export function WorkItemsTable({
  issues,
  variant,
  properties,
  projects,
  states,
  labels,
  members,
  modules,
  cycles,
  sortBy,
  sortOrder,
  onSort,
  issueHref,
  onPatch,
  currentUserId,
}: WorkItemsTableProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const projectMap = new Map(projects.map((project) => [project.id, project]));
  const stateMap = new Map(states.map((state) => [state.id, state]));
  const labelMap = new Map(labels.map((label) => [label.id, label]));
  const memberMap = new Map(members.map((member) => [member.member_id, member]));
  const moduleMap = new Map(modules.map((module) => [module.id, module]));
  const cycleMap = new Map(cycles.map((cycle) => [cycle.id, cycle]));

  const formatDate = (value: string | undefined | null) =>
    value
      ? new Date(value).toLocaleDateString('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric',
        })
      : '—';

  const memberLabel = (memberId: string): string => {
    if (currentUserId && memberId === currentUserId) return t('common.you', 'You');
    const member = memberMap.get(memberId);
    return (
      member?.member_display_name ??
      member?.member_email?.split('@')[0] ??
      t('common.member', 'Member')
    );
  };

  const memberInitial = (member: WorkspaceMemberApiResponse) =>
    (member.member_display_name ?? member.member_email ?? '?').charAt(0).toUpperCase();

  const workItemId = (issue: IssueApiResponse) => {
    const project = projectMap.get(issue.project_id);
    return project
      ? `${project.identifier ?? project.id.slice(0, 8)}-${issue.sequence_id ?? issue.id.slice(-4)}`
      : issue.id.slice(-4);
  };

  /* Created and updated are always present in the spreadsheet, and updated in
     the list, matching the shipped tables. */
  const columns: WorkItemsTableColumn[] =
    variant === 'spreadsheet'
      ? SPREADSHEET_COLUMN_ORDER.filter(
          (key) =>
            key === 'created_at' ||
            key === 'updated_at' ||
            properties.includes(key as DisplayPropertyKey),
        )
      : LIST_COLUMN_ORDER.filter(
          (key) => key === 'updated_at' || properties.includes(key as DisplayPropertyKey),
        );

  const headerLabel = (key: WorkItemsTableColumn) => {
    if (key === 'created_at') return t('views.createdOn', 'Created on');
    if (key === 'updated_at') return t('views.updatedOn', 'Updated on');
    return DISPLAY_PROPERTY_LABELS[key as DisplayPropertyKey];
  };

  const sortIndicator = (column: SortableColumn) => {
    if (sortBy !== column) return <ChevronsUpDown className="size-3.5 opacity-40" />;
    return sortOrder === 'asc' ? (
      <ArrowUp className="size-3.5" />
    ) : (
      <ArrowDown className="size-3.5" />
    );
  };

  const sortAriaValue = (column: SortableColumn): 'none' | 'ascending' | 'descending' => {
    if (sortBy !== column) return 'none';
    return sortOrder === 'asc' ? 'ascending' : 'descending';
  };

  /** Widths and the breakpoint each column survives down to, list variant only. */
  const listColumnClass = (key: WorkItemsTableColumn, cell = false) => {
    const padding = cell ? 'p-0' : 'px-0';
    switch (key) {
      case 'state':
        return `w-36 ${padding}`;
      case 'priority':
        return `w-28 ${padding}`;
      case 'assignee':
        return `hidden w-36 ${padding} md:table-cell`;
      case 'labels':
        return `hidden w-44 ${padding} xl:table-cell`;
      case 'cycle':
      case 'module':
        return `hidden w-32 ${padding} xl:table-cell`;
      case 'start_date':
        return `hidden w-36 ${padding} lg:table-cell`;
      case 'due_date':
        return `hidden w-36 ${padding} md:table-cell`;
      case 'updated_at':
        return `hidden w-36 ${padding} lg:table-cell`;
      default:
        return `hidden w-32 ${padding} xl:table-cell`;
    }
  };

  const renderHeadCell = (key: WorkItemsTableColumn) => {
    const Icon = COLUMN_ICONS[key];
    const sortColumn = SORTABLE_BY_COLUMN[key];
    const label = headerLabel(key);
    return (
      <TableHead
        key={key}
        className={variant === 'list' ? listColumnClass(key) : 'px-0'}
        aria-sort={sortColumn ? sortAriaValue(sortColumn) : undefined}
      >
        {sortColumn ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onSort(sortColumn)}
            className="text-muted-foreground hover:text-foreground w-full justify-start rounded-none px-3 font-medium"
          >
            {Icon && <Icon className="opacity-70" />}
            {label}
            {sortIndicator(sortColumn)}
          </Button>
        ) : (
          <span className="text-muted-foreground flex items-center gap-1.5 px-3 font-medium">
            {Icon && <Icon className="size-4 opacity-70" />}
            {label}
          </span>
        )}
      </TableHead>
    );
  };

  /** Read-only rendering for the columns that have no inline editor. */
  const renderStaticCell = (issue: IssueApiResponse, key: WorkItemsTableColumn) => {
    switch (key) {
      case 'created_at':
        return formatDate(issue.created_at);
      case 'updated_at':
        return formatDate(issue.updated_at);
      case 'id':
        return workItemId(issue);
      case 'state': {
        const state = stateMap.get(issue.state_id ?? '');
        return (
          <span className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: state?.color || 'var(--muted-foreground)' }}
              aria-hidden="true"
            />
            {state?.name ?? '—'}
          </span>
        );
      }
      case 'link':
        return t('views.zeroLinks', '0 links');
      case 'attachment_count':
        return t('views.zeroAttachments', '0 attachments');
      case 'sub_work_item_count':
        return t('views.zeroSubWorkItems', '0 sub-work items');
      case 'estimate':
        return issue.estimate_point_id ? t('views.estimateAssigned', 'Assigned') : '—';
      case 'module': {
        const names = (issue.module_ids ?? []).map((id) => moduleMap.get(id)?.name).filter(Boolean);
        return names.length ? names.join(', ') : '—';
      }
      case 'cycle': {
        const names = (issue.cycle_ids ?? []).map((id) => cycleMap.get(id)?.name).filter(Boolean);
        return names.length ? names.join(', ') : '—';
      }
      default:
        return '—';
    }
  };

  const renderCell = (issue: IssueApiResponse, key: WorkItemsTableColumn) => {
    if (key === 'state') {
      const state = stateMap.get(issue.state_id ?? '');
      const projectStates = states.filter((entry) => entry.project_id === issue.project_id);
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" className={cellTriggerClass}>
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: state?.color || 'var(--muted-foreground)' }}
                aria-hidden="true"
              />
              <span className={state ? 'truncate' : 'text-muted-foreground truncate'}>
                {state?.name ?? t('views.selectState', 'Select state')}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 w-52 overflow-y-auto">
            <DropdownMenuRadioGroup
              value={issue.state_id ?? ''}
              onValueChange={(stateId) => onPatch(issue, { state_id: stateId })}
            >
              {projectStates.map((option) => (
                <DropdownMenuRadioItem key={option.id} value={option.id}>
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: option.color || 'var(--muted-foreground)' }}
                    aria-hidden="true"
                  />
                  {option.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    if (key === 'priority') {
      const value = (issue.priority ?? 'none') as Priority;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" className={cellTriggerClass}>
              <Signal className="opacity-70" />
              <span className="truncate capitalize">
                {value === 'none' ? t('common.none', 'None') : value}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuRadioGroup
              value={value}
              onValueChange={(next) => onPatch(issue, { priority: next as Priority })}
            >
              {(['urgent', 'high', 'medium', 'low', 'none'] as Priority[]).map((priority) => (
                <DropdownMenuRadioItem key={priority} value={priority} className="capitalize">
                  {priority}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    if (key === 'assignee') {
      const assigneeIds = issue.assignee_ids ?? [];
      const assignee = assigneeIds[0] ? memberMap.get(assigneeIds[0]) : undefined;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" className={cellTriggerClass}>
              {assignee ? (
                <>
                  <Avatar className="size-6">
                    <AvatarImage
                      src={getImageUrl(assignee.member_avatar) ?? ''}
                      alt={assignee.member_display_name ?? ''}
                    />
                    <AvatarFallback className="text-foreground text-[10px]">
                      {memberInitial(assignee)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{memberLabel(assignee.member_id)}</span>
                </>
              ) : (
                <>
                  <User className="opacity-70" />
                  <span className="text-muted-foreground truncate">
                    {t('views.assignees', 'Assignees')}
                  </span>
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
            <DropdownMenuLabel>{t('views.assignees', 'Assignees')}</DropdownMenuLabel>
            {members.map((member) => (
              <DropdownMenuCheckboxItem
                key={member.id}
                checked={assigneeIds.includes(member.member_id)}
                onCheckedChange={(checked) =>
                  onPatch(issue, {
                    assignee_ids: checked
                      ? [...assigneeIds, member.member_id]
                      : assigneeIds.filter((id) => id !== member.member_id),
                  })
                }
              >
                {memberLabel(member.member_id)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    if (key === 'labels') {
      const labelIds = issue.label_ids ?? [];
      const firstLabel = labelIds[0] ? labelMap.get(labelIds[0]) : undefined;
      const projectLabels = labels.filter(
        (label) => !label.project_id || label.project_id === issue.project_id,
      );
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" className={cellTriggerClass}>
              {firstLabel ? (
                <>
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: firstLabel.color ?? 'currentColor' }}
                  />
                  <span className="truncate">{firstLabel.name}</span>
                  {labelIds.length > 1 && (
                    <Badge variant="secondary" className="ml-1">
                      +{labelIds.length - 1}
                    </Badge>
                  )}
                </>
              ) : (
                <>
                  <Tag className="opacity-70" />
                  <span className="text-muted-foreground truncate">
                    {t('views.selectLabels', 'Select labels')}
                  </span>
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
            {projectLabels.length === 0 ? (
              <DropdownMenuLabel className="text-muted-foreground font-normal">
                {t('views.noLabels', 'No labels.')}
              </DropdownMenuLabel>
            ) : (
              projectLabels.map((label) => (
                <DropdownMenuCheckboxItem
                  key={label.id}
                  checked={labelIds.includes(label.id)}
                  onCheckedChange={(checked) =>
                    onPatch(issue, {
                      label_ids: checked
                        ? [...labelIds, label.id]
                        : labelIds.filter((id) => id !== label.id),
                    })
                  }
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: label.color ?? 'currentColor' }}
                  />
                  {label.name}
                </DropdownMenuCheckboxItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    if (key === 'start_date' || key === 'due_date') {
      const isStart = key === 'start_date';
      const value = (isStart ? issue.start_date : issue.target_date) ?? '';
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" className={cellTriggerClass}>
              <CalendarDays className="opacity-70" />
              <span className={value ? 'truncate' : 'text-muted-foreground truncate'}>
                {value ? formatDate(value) : '—'}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-auto p-2">
            <Input
              type="date"
              value={value}
              aria-label={
                isStart
                  ? t('views.changeStartDate', 'Change start date')
                  : t('views.changeDueDate', 'Change due date')
              }
              onChange={(event) =>
                onPatch(
                  issue,
                  isStart
                    ? { start_date: event.target.value || null }
                    : { target_date: event.target.value || null },
                )
              }
              className="h-8"
            />
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return <span className="block px-3">{renderStaticCell(issue, key)}</span>;
  };

  const nameHeadCell = (
    <TableHead
      className={
        variant === 'spreadsheet' ? 'bg-muted/50 sticky left-0 z-20 min-w-56 px-0' : 'min-w-72 px-0'
      }
      aria-sort={sortAriaValue('name')}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onSort('name')}
        className="text-muted-foreground hover:text-foreground w-full justify-start rounded-none px-3 font-medium"
      >
        {t('views.workItems', 'Work items')}
        {sortIndicator('name')}
      </Button>
    </TableHead>
  );

  if (variant === 'spreadsheet') {
    return (
      <ScrollArea className="w-full">
        <Table className="min-w-max">
          <TableCaption className="sr-only">
            {t(
              'views.spreadsheetCaption',
              'Editable workspace work-item properties in a horizontally scrollable table.',
            )}
          </TableCaption>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              {nameHeadCell}
              {columns.map(renderHeadCell)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {issues.map((issue) => (
              <TableRow key={issue.id}>
                {/* Pinned so the name stays readable while the properties
                    scroll; its own background keeps the scrolled cells from
                    showing through. */}
                <TableCell className="bg-background sticky left-0 z-10 min-w-56 p-0">
                  <Link
                    to={issueHref(issue)}
                    className="hover:bg-muted/50 focus-visible:ring-ring flex h-11 items-center gap-2 px-3 outline-none transition-colors focus-visible:ring-2"
                  >
                    {properties.includes('id') && (
                      <span className="text-muted-foreground shrink-0 font-mono text-xs">
                        {workItemId(issue)}
                      </span>
                    )}
                    <span className="truncate font-medium">{issue.name}</span>
                  </Link>
                </TableCell>
                {columns.map((key) => (
                  <TableCell
                    key={key}
                    className={
                      EDITABLE_COLUMNS.includes(key) ? 'p-0' : 'text-muted-foreground p-0 py-3'
                    }
                  >
                    {renderCell(issue, key)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="w-full">
      <Table>
        <TableCaption className="sr-only">
          {t(
            'views.tableCaption',
            'Work items across the workspace, with project, state, priority, assignees, labels, due date, and last update.',
          )}
        </TableCaption>
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent">
            {nameHeadCell}
            {columns.map(renderHeadCell)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {issues.map((issue) => (
            <TableRow
              key={issue.id}
              className="cursor-pointer"
              onClick={(event) => {
                const target = event.target as HTMLElement;
                if (
                  target.closest(
                    'a, button, input, select, textarea, [role="menuitem"], [role="checkbox"]',
                  )
                ) {
                  return;
                }
                navigate(issueHref(issue));
              }}
            >
              <TableCell className="min-w-72 px-3 py-2">
                <Link
                  to={issueHref(issue)}
                  className="focus-visible:ring-ring flex min-h-7 min-w-0 items-center gap-2 rounded-sm outline-none focus-visible:ring-2"
                >
                  {properties.includes('id') && (
                    <span className="text-muted-foreground shrink-0 font-mono text-xs">
                      {workItemId(issue)}
                    </span>
                  )}
                  <span className="truncate font-medium">{issue.name}</span>
                </Link>
              </TableCell>
              {columns.map((key) => (
                <TableCell key={key} className={listColumnClass(key, true)}>
                  {key === 'updated_at' ? (
                    <time
                      dateTime={issue.updated_at}
                      title={formatDate(issue.updated_at)}
                      className="text-muted-foreground block px-3 text-xs"
                    >
                      {formatTimeAgo(issue.updated_at)}
                    </time>
                  ) : (
                    renderCell(issue, key)
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
