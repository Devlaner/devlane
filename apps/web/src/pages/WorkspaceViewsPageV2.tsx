import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, CalendarDays, ChevronsUpDown, Signal, Tag, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/shadcn/ui/avatar';
import { Badge } from '@/components/shadcn/ui/badge';
import { Button } from '@/components/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/shadcn/ui/dropdown-menu';
import { Input } from '@/components/shadcn/ui/input';
import { Skeleton } from '@/components/shadcn/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/ui/table';
import { IssueLayoutBoard } from '../components/work-item/layouts/IssueLayoutBoard';
import { IssueLayoutCalendar } from '../components/work-item/layouts/IssueLayoutCalendar';
import { IssueLayoutGantt } from '../components/work-item/layouts/IssueLayoutGantt';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspaceViewsState } from '../contexts/WorkspaceViewsStateContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { getImageUrl } from '../lib/utils';
import { applyWorkspaceViewFilters } from '../lib/workspaceViewFiltersApply';
import { issueService } from '../services/issueService';
import { labelService } from '../services/labelService';
import { projectService } from '../services/projectService';
import { stateService } from '../services/stateService';
import { viewService } from '../services/viewService';
import { workspaceService } from '../services/workspaceService';
import type {
  IssueApiResponse,
  LabelApiResponse,
  ProjectApiResponse,
  StateApiResponse,
  WorkspaceApiResponse,
  WorkspaceMemberApiResponse,
} from '../api/types';
import type { Priority } from '../types';
import { parseWorkspaceViewFiltersFromSearchParams } from '../types/workspaceViewFilters';
import {
  DISPLAY_PROPERTY_KEYS,
  DISPLAY_PROPERTY_LABELS,
  SPREADSHEET_COLUMN_ORDER,
  VIEW_LAYOUTS,
  type DisplayPropertyKey,
  type SortableColumn,
  type SortOrder,
  type ViewLayout,
} from '../types/workspaceViewDisplay';

/** Views that exist without anyone creating them; anything else is saved. */
const STATIC_VIEW_IDS = ['all-issues', 'assigned', 'created', 'subscribed'];

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

const PRIORITY_BADGE: Record<Priority, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  urgent: 'destructive',
  high: 'destructive',
  medium: 'default',
  low: 'secondary',
  none: 'outline',
};

/** Columns the header can sort by; the rest are display-only. */
const SORTABLE_BY_COLUMN: Partial<
  Record<DisplayPropertyKey | 'created_at' | 'updated_at', SortableColumn>
> = {
  priority: 'priority',
  state: 'state',
  assignee: 'assignee',
  start_date: 'start_date',
  due_date: 'due_date',
  created_at: 'created_at',
  updated_at: 'updated_at',
};

const COLUMN_ICONS: Partial<Record<DisplayPropertyKey | 'created_at' | 'updated_at', typeof User>> =
  {
    priority: Signal,
    assignee: User,
    labels: Tag,
    start_date: CalendarDays,
    due_date: CalendarDays,
  };

/** Cells that open an editor rather than just rendering a value. */
const EDITABLE_COLUMNS = ['priority', 'assignee', 'labels', 'start_date', 'due_date'];

function isCustomViewId(viewId: string | undefined): boolean {
  if (!viewId) return false;
  return !STATIC_VIEW_IDS.includes(viewId);
}

/**
 * Design preview of the workspace views page, built from shadcn primitives. It
 * stands alongside WorkspaceViewsPage rather than replacing it, so the two can
 * be compared side by side.
 *
 * Data loading, filtering, sorting and inline editing mirror the shipped page,
 * and both read the same WorkspaceViewsState — only the chrome differs. The
 * view picker, layout selector, filters and display controls live in the
 * shell's header (ViewsToolbar). Kanban, calendar and gantt reuse the shipped
 * work-item layout components, which are not part of this preview.
 */
export function WorkspaceViewsPageV2() {
  const { t } = useTranslation();
  const { workspaceSlug, viewId } = useParams<{ workspaceSlug?: string; viewId?: string }>();
  const { filters, setFilters, display, setDisplay } = useWorkspaceViewsState();
  const { user: currentUser } = useAuth();

  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [issues, setIssues] = useState<IssueApiResponse[]>([]);
  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [labels, setLabels] = useState<LabelApiResponse[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewNotFound, setViewNotFound] = useState(false);

  /* Stable per-mount timestamp for the work-item layouts' date cells. */
  const [now] = useState(() => Date.now());
  const viewAppliedRef = useRef(false);
  const prevViewIdRef = useRef<string | undefined>(undefined);
  /* Per-issue serialization for kanban drag-to-column (see handleCardMove). */
  const cardMoveChains = useRef<Map<string, Promise<void>>>(new Map());
  const cardMoveSeq = useRef<Map<string, number>>(new Map());

  useDocumentTitle(t('views.documentTitle', 'Views'));

  /* A saved view's filters and display settings are applied to the shared state
     once per view id, rather than on every render of the URL. */
  useEffect(() => {
    if (prevViewIdRef.current !== viewId) {
      prevViewIdRef.current = viewId;
      viewAppliedRef.current = false;
    }
    if (!workspaceSlug || !viewId || !isCustomViewId(viewId) || viewAppliedRef.current) return;
    viewAppliedRef.current = true;
    queueMicrotask(() => setViewLoading(true));
    viewService
      .get(workspaceSlug, viewId)
      .then((view) => {
        setViewNotFound(false);
        const savedFilters = view.filters as Record<string, string> | undefined;
        if (savedFilters && typeof savedFilters === 'object') {
          setFilters(parseWorkspaceViewFiltersFromSearchParams(new URLSearchParams(savedFilters)));
        }
        const savedProperties = view.display_properties as Record<string, boolean> | undefined;
        if (savedProperties && typeof savedProperties === 'object') {
          const keys = Object.entries(savedProperties)
            .filter(([, enabled]) => enabled)
            .map(([key]) => key)
            .filter((key): key is DisplayPropertyKey =>
              DISPLAY_PROPERTY_KEYS.includes(key as DisplayPropertyKey),
            );
          setDisplay((prev) => ({ ...prev, properties: keys }));
        }
        const savedDisplay = view.display_filters as Record<string, unknown> | undefined;
        if (savedDisplay && typeof savedDisplay === 'object') {
          setDisplay((prev) => {
            const next = { ...prev, showSubWorkItems: savedDisplay.sub_issue === true };
            if (
              typeof savedDisplay.layout === 'string' &&
              VIEW_LAYOUTS.includes(savedDisplay.layout as ViewLayout)
            ) {
              next.layout = savedDisplay.layout as ViewLayout;
            }
            return next;
          });
        }
        setViewLoading(false);
      })
      .catch(() => {
        setViewLoading(false);
        setViewNotFound(true);
      });
  }, [workspaceSlug, viewId, setFilters, setDisplay]);

  /* Workspace views span every project, so states, labels and issues are
     gathered per project and flattened into one set. */
  useEffect(() => {
    if (!workspaceSlug) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- nothing to fetch without a slug
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    workspaceService
      .getBySlug(workspaceSlug)
      .then((w) => {
        if (cancelled) return;
        setWorkspace(w);
        return projectService.list(workspaceSlug);
      })
      .then((projs) => {
        if (cancelled) return null;
        setProjects(projs ?? []);
        if (!projs?.length) {
          setIssues([]);
          setStates([]);
          setLabels([]);
          setMembers([]);
          return null;
        }
        const n = projs.length;
        return Promise.all([
          workspaceService.listMembers(workspaceSlug),
          ...projs.map((p) => issueService.list(workspaceSlug, p.id, { limit: 100 })),
          ...projs.map((p) => stateService.list(workspaceSlug, p.id)),
          ...projs.map((p) => labelService.list(workspaceSlug, p.id)),
        ]).then((results) => ({ results, n }));
      })
      .then((payload) => {
        if (cancelled || !payload) return;
        const { results, n } = payload;
        const [memberList, ...rest] = results;
        setMembers((memberList as WorkspaceMemberApiResponse[]) ?? []);
        setIssues((rest.slice(0, n) as IssueApiResponse[][]).flat());
        setStates((rest.slice(n, n * 2) as StateApiResponse[][]).flat());
        setLabels((rest.slice(n * 2) as LabelApiResponse[][]).flat());
      })
      .catch(() => {
        if (cancelled) return;
        setWorkspace(null);
        setProjects([]);
        setIssues([]);
        setStates([]);
        setLabels([]);
        setMembers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  const stateMap = useMemo(() => new Map(states.map((s) => [s.id, s])), [states]);
  const labelMap = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);
  const memberMap = useMemo(() => new Map(members.map((m) => [m.member_id, m])), [members]);
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const filteredIssues = useMemo(() => {
    const list = applyWorkspaceViewFilters(issues, filters, stateMap);
    /* "subscribed" would filter by issue subscribers once the API exposes them. */
    if (viewId === 'assigned' && currentUser?.id) {
      return list.filter((i) => i.assignee_ids?.includes(currentUser.id));
    }
    if (viewId === 'created' && currentUser?.id) {
      return list.filter((i) => i.created_by_id === currentUser.id);
    }
    return list;
  }, [issues, filters, stateMap, viewId, currentUser]);

  const sortedIssues = useMemo(() => {
    const valueOf = (issue: IssueApiResponse): string | number => {
      switch (display.sortBy) {
        case 'name':
          return issue.name ?? '';
        case 'created_at':
          return issue.created_at ? new Date(issue.created_at).getTime() : 0;
        case 'updated_at':
          return issue.updated_at ? new Date(issue.updated_at).getTime() : 0;
        case 'priority':
          return PRIORITY_ORDER[issue.priority ?? 'none'] ?? 5;
        case 'state':
          return stateMap.get(issue.state_id ?? '')?.name ?? '—';
        case 'assignee': {
          const member = memberMap.get(issue.assignee_ids?.[0] ?? '');
          return member?.member_display_name ?? member?.member_email ?? '—';
        }
        case 'start_date':
          return issue.start_date ? new Date(issue.start_date).getTime() : 0;
        case 'due_date':
          return issue.target_date ? new Date(issue.target_date).getTime() : 0;
        default:
          return 0;
      }
    };
    return [...filteredIssues].sort((a, b) => {
      const left = valueOf(a);
      const right = valueOf(b);
      const cmp =
        typeof left === 'string' && typeof right === 'string'
          ? left.localeCompare(right, undefined, { sensitivity: 'base' })
          : Number(left) - Number(right);
      return display.sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [filteredIssues, display.sortBy, display.sortOrder, stateMap, memberMap]);

  const handleSort = (column: SortableColumn) => {
    const nextOrder: SortOrder =
      display.sortBy === column && display.sortOrder === 'desc' ? 'asc' : 'desc';
    setDisplay((prev) => ({ ...prev, sortBy: column, sortOrder: nextOrder }));
  };

  const updateIssue = useCallback(
    async (
      issue: IssueApiResponse,
      patch: Partial<{
        priority: Priority;
        assignee_ids: string[];
        label_ids: string[];
        start_date: string | null;
        target_date: string | null;
      }>,
    ) => {
      if (!workspaceSlug) return;
      try {
        await issueService.update(workspaceSlug, issue.project_id, issue.id, patch as never);
        setIssues((prev) => prev.map((i) => (i.id === issue.id ? { ...i, ...patch } : i)));
      } catch {
        /* The cell keeps its previous value; nothing is written locally. */
      }
    },
    [workspaceSlug],
  );

  /* Kanban drag-to-column: the board resolves the target to a state in the
     card's own project. PATCHes for one card are chained so they commit in
     order, and only the latest move's failure rolls back — a stale request
     cannot revert a newer one. */
  const handleCardMove = useCallback(
    (issueId: string, targetStateId: string) => {
      if (!workspaceSlug) return;
      const issue = issues.find((i) => i.id === issueId);
      if (!issue || issue.state_id === targetStateId) return;
      const prevStateId = issue.state_id;
      const seq = (cardMoveSeq.current.get(issueId) ?? 0) + 1;
      cardMoveSeq.current.set(issueId, seq);
      setIssues((prev) =>
        prev.map((i) => (i.id === issueId ? { ...i, state_id: targetStateId } : i)),
      );
      const chain = (cardMoveChains.current.get(issueId) ?? Promise.resolve())
        .catch(() => {})
        .then(() =>
          issueService.update(workspaceSlug, issue.project_id, issueId, {
            state_id: targetStateId,
          }),
        )
        .then(() => undefined)
        .catch(() => {
          if (cardMoveSeq.current.get(issueId) === seq) {
            setIssues((prev) =>
              prev.map((i) => (i.id === issueId ? { ...i, state_id: prevStateId } : i)),
            );
          }
        });
      cardMoveChains.current.set(issueId, chain);
    },
    [workspaceSlug, issues],
  );

  const formatDate = (value: string | undefined | null) =>
    value
      ? new Date(value).toLocaleDateString('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric',
        })
      : '—';

  const memberLabel = (memberId: string): string => {
    if (currentUser?.id && memberId === currentUser.id) return t('common.you', 'You');
    const member = memberMap.get(memberId);
    return (
      member?.member_display_name ??
      member?.member_email?.split('@')[0] ??
      t('common.member', 'Member')
    );
  };

  const memberInitial = (member: WorkspaceMemberApiResponse) =>
    (member.member_display_name ?? member.member_email ?? '?').charAt(0).toUpperCase();

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-11 w-full" />
        ))}
      </div>
    );
  }

  if (!workspace) {
    return (
      <p className="text-muted-foreground text-sm">
        {t('common.workspaceNotFound', 'Workspace not found.')}
      </p>
    );
  }

  if (viewLoading) {
    return (
      <p className="text-muted-foreground text-sm">{t('views.loadingView', 'Loading view…')}</p>
    );
  }

  if (viewNotFound) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center">
        <p className="font-medium">{t('views.viewDoesNotExist', 'View does not exist')}</p>
        <p className="text-muted-foreground max-w-md text-sm">
          {t(
            'views.viewNotFoundDescription',
            "The view you are looking for does not exist or you don't have permission to view it.",
          )}
        </p>
        <Button asChild variant="outline">
          <Link to={`/${workspace.slug}/app-v2/views/all-issues`}>
            {t('views.allWorkItems', 'All work items')}
          </Link>
        </Button>
      </div>
    );
  }

  const baseUrl = `/${workspace.slug}`;
  const issueHref = (issue: IssueApiResponse) => {
    const project = projectMap.get(issue.project_id);
    return project ? `${baseUrl}/projects/${project.id}/issues/${issue.id}` : baseUrl;
  };

  const emptyState = (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center">
      <p className="text-muted-foreground text-sm">
        {t(
          'views.emptyWorkItems',
          "No work items yet. Create one from a project's Work items section or add a view to get started.",
        )}
      </p>
    </div>
  );

  /* Kanban, calendar and gantt reuse the shipped work-item layouts, which take
     a single project. A representative one satisfies the prop while the map
     drives each card's own identifier and link. */
  if (
    display.layout === 'kanban' ||
    display.layout === 'calendar' ||
    display.layout === 'gantt_chart'
  ) {
    const layoutProject = projects[0];
    if (!layoutProject) return emptyState;
    const layoutProps = {
      workspaceSlug: workspace.slug,
      project: layoutProject,
      projectsById: Object.fromEntries(projectMap),
      issues: sortedIssues,
      states,
      labels,
      members,
      prSummary: {},
      baseUrl,
      issueHref: (id: string) => {
        const issue = sortedIssues.find((i) => i.id === id);
        return issue ? issueHref(issue) : baseUrl;
      },
      now,
    };
    return (
      <div className="min-h-0 flex-1 overflow-auto rounded-xl border">
        {display.layout === 'kanban' && (
          <IssueLayoutBoard {...layoutProps} groupByStateGroup onCardMove={handleCardMove} />
        )}
        {display.layout === 'calendar' && <IssueLayoutCalendar {...layoutProps} />}
        {display.layout === 'gantt_chart' && <IssueLayoutGantt {...layoutProps} />}
      </div>
    );
  }

  if (display.layout === 'list') {
    if (sortedIssues.length === 0) return emptyState;
    return (
      <div className="divide-y rounded-xl border">
        {sortedIssues.map((issue) => {
          const project = projectMap.get(issue.project_id);
          const assignee = issue.assignee_ids?.[0]
            ? memberMap.get(issue.assignee_ids[0])
            : undefined;
          return (
            <Link
              key={issue.id}
              to={issueHref(issue)}
              className="hover:bg-muted/50 flex items-center gap-3 px-4 py-3 transition-colors"
            >
              {project && (
                <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
                  {project.identifier ?? project.id.slice(0, 8)}-
                  {issue.sequence_id ?? issue.id.slice(-4)}
                </Badge>
              )}
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{issue.name}</span>
              {issue.priority && issue.priority !== 'none' && (
                <Badge variant={PRIORITY_BADGE[issue.priority as Priority]} className="shrink-0">
                  {issue.priority}
                </Badge>
              )}
              <span className="text-muted-foreground shrink-0 text-xs">
                {stateMap.get(issue.state_id ?? '')?.name ?? '—'}
              </span>
              {assignee && (
                <Avatar className="size-6 shrink-0">
                  <AvatarImage
                    src={getImageUrl(assignee.member_avatar) ?? ''}
                    alt={assignee.member_display_name ?? ''}
                  />
                  <AvatarFallback className="text-[10px]">{memberInitial(assignee)}</AvatarFallback>
                </Avatar>
              )}
            </Link>
          );
        })}
      </div>
    );
  }

  /* Spreadsheet: the name column is pinned, the rest scroll horizontally.
     Created and updated are always present, matching the shipped table. */
  const scrollableColumns = SPREADSHEET_COLUMN_ORDER.filter(
    (key) =>
      key === 'created_at' ||
      key === 'updated_at' ||
      display.properties.includes(key as DisplayPropertyKey),
  );

  const headerLabel = (key: (typeof scrollableColumns)[number]) => {
    if (key === 'created_at') return t('views.createdOn', 'Created on');
    if (key === 'updated_at') return t('views.updatedOn', 'Updated on');
    return DISPLAY_PROPERTY_LABELS[key as DisplayPropertyKey];
  };

  const sortIndicator = (column: SortableColumn) => {
    if (display.sortBy !== column) return <ChevronsUpDown className="size-3.5 opacity-40" />;
    return display.sortOrder === 'asc' ? (
      <ArrowUp className="size-3.5" />
    ) : (
      <ArrowDown className="size-3.5" />
    );
  };

  const renderHeadCell = (key: (typeof scrollableColumns)[number]) => {
    const Icon = COLUMN_ICONS[key];
    const sortColumn = SORTABLE_BY_COLUMN[key];
    const label = headerLabel(key);
    return (
      <TableHead key={key} className="border-l px-0">
        {sortColumn ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleSort(sortColumn)}
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
  const renderStaticCell = (issue: IssueApiResponse, key: (typeof scrollableColumns)[number]) => {
    switch (key) {
      case 'created_at':
        return formatDate(issue.created_at);
      case 'updated_at':
        return formatDate(issue.updated_at);
      case 'id': {
        const project = projectMap.get(issue.project_id);
        return project
          ? `${project.identifier ?? project.id.slice(0, 8)}-${issue.sequence_id ?? issue.id.slice(-4)}`
          : issue.id.slice(-4);
      }
      case 'state':
        return (
          <span className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full border" />
            {stateMap.get(issue.state_id ?? '')?.name ?? '—'}
          </span>
        );
      case 'link':
        return t('views.zeroLinks', '0 links');
      case 'attachment_count':
        return t('views.zeroAttachments', '0 attachments');
      case 'sub_work_item_count':
        return t('views.zeroSubWorkItems', '0 sub-work items');
      case 'estimate':
        return t('views.estimate', 'Estimate');
      case 'module':
        return t('views.selectModules', 'Select modules');
      case 'cycle':
        return t('views.selectCycle', 'Select cycle');
      default:
        return '—';
    }
  };

  const cellTriggerClass =
    'hover:bg-muted/50 flex h-11 w-full items-center gap-2 rounded-none px-3 text-left text-sm font-normal';

  const renderCell = (issue: IssueApiResponse, key: (typeof scrollableColumns)[number]) => {
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
              onValueChange={(next) => updateIssue(issue, { priority: next as Priority })}
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
                    <AvatarFallback className="text-[10px]">
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
                  updateIssue(issue, {
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
            {labels.length === 0 ? (
              <DropdownMenuLabel className="text-muted-foreground font-normal">
                {t('views.noLabels', 'No labels.')}
              </DropdownMenuLabel>
            ) : (
              labels.map((label) => (
                <DropdownMenuCheckboxItem
                  key={label.id}
                  checked={labelIds.includes(label.id)}
                  onCheckedChange={(checked) =>
                    updateIssue(issue, {
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
              onChange={(e) =>
                updateIssue(
                  issue,
                  isStart
                    ? { start_date: e.target.value || null }
                    : { target_date: e.target.value || null },
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

  return (
    <div className="min-h-0 flex-1 overflow-hidden rounded-xl border">
      <Table className="min-w-max">
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent">
            <TableHead className="bg-muted/50 sticky left-0 z-20 min-w-56 px-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleSort('name')}
                className="text-muted-foreground hover:text-foreground w-full justify-start rounded-none px-3 font-medium"
              >
                {t('views.workItems', 'Work items')}
                {sortIndicator('name')}
              </Button>
            </TableHead>
            {scrollableColumns.map(renderHeadCell)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedIssues.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={1 + scrollableColumns.length}
                className="text-muted-foreground h-32 text-center"
              >
                {t(
                  'views.emptyWorkItems',
                  "No work items yet. Create one from a project's Work items section or add a view to get started.",
                )}
              </TableCell>
            </TableRow>
          ) : (
            sortedIssues.map((issue) => {
              const project = projectMap.get(issue.project_id);
              return (
                <TableRow key={issue.id}>
                  {/* Pinned so the name stays readable while the properties
                      scroll; its own background keeps the scrolled cells from
                      showing through. */}
                  <TableCell className="bg-background sticky left-0 z-10 min-w-56 p-0">
                    <Link
                      to={issueHref(issue)}
                      className="hover:bg-muted/50 flex h-11 items-center gap-2 px-3 transition-colors"
                    >
                      {display.properties.includes('id') && project && (
                        <span className="text-muted-foreground shrink-0 font-mono text-xs">
                          {project.identifier ?? project.id.slice(0, 8)}-
                          {issue.sequence_id ?? issue.id.slice(-4)}
                        </span>
                      )}
                      <span className="truncate font-medium">{issue.name}</span>
                    </Link>
                  </TableCell>
                  {scrollableColumns.map((key) => (
                    <TableCell
                      key={key}
                      className={
                        EDITABLE_COLUMNS.includes(key)
                          ? 'border-l p-0'
                          : 'text-muted-foreground border-l p-0 py-3'
                      }
                    >
                      {renderCell(issue, key)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
