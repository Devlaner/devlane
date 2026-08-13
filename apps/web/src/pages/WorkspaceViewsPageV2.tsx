import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CircleAlert,
  ChevronsUpDown,
  ListTodo,
  RefreshCw,
  SearchX,
  Signal,
  Tag,
  User,
} from 'lucide-react';
import {
  CreateWorkItemDialog,
  type CreateWorkItemDialogSubmit,
} from '@/components/shadcn/create-work-item-dialog';
import { ListPageSkeleton } from '@/components/shadcn/list-page-skeleton';
import { PageHeading } from '@/components/shadcn/page-heading';
import { ViewsToolbar } from '@/components/shadcn/views-toolbar';
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
import {
  Table,
  TableBody,
  TableCaption,
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
import { formatTimeAgo } from '../lib/projectV2';
import { getImageUrl } from '../lib/utils';
import { applyWorkspaceViewFilters } from '../lib/workspaceViewFiltersApply';
import { attachWorkItemRelations } from '../lib/workItemRelations';
import { cycleService } from '../services/cycleService';
import { issueService } from '../services/issueService';
import { labelService } from '../services/labelService';
import { moduleService } from '../services/moduleService';
import { projectService } from '../services/projectService';
import { stateService } from '../services/stateService';
import { viewService } from '../services/viewService';
import { workspaceService } from '../services/workspaceService';
import type {
  CycleApiResponse,
  IssueApiResponse,
  LabelApiResponse,
  ModuleApiResponse,
  ProjectApiResponse,
  StateApiResponse,
  WorkspaceApiResponse,
  WorkspaceMemberApiResponse,
} from '../api/types';
import type { Priority } from '../types';
import {
  DEFAULT_WORKSPACE_VIEW_FILTERS,
  parseWorkspaceViewFiltersFromSearchParams,
} from '../types/workspaceViewFilters';
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
const EDITABLE_COLUMNS = ['state', 'priority', 'assignee', 'labels', 'start_date', 'due_date'];

/** Compact list columns mirror the project work-items table's information order. */
const LIST_COLUMN_ORDER: (DisplayPropertyKey | 'updated_at')[] = [
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
  const navigate = useNavigate();
  const { workspaceSlug, viewId } = useParams<{ workspaceSlug?: string; viewId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, setFilters, display, setDisplay } = useWorkspaceViewsState();
  const { user: currentUser } = useAuth();

  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [issues, setIssues] = useState<IssueApiResponse[]>([]);
  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [labels, setLabels] = useState<LabelApiResponse[]>([]);
  const [cycles, setCycles] = useState<CycleApiResponse[]>([]);
  const [modules, setModules] = useState<ModuleApiResponse[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewNotFound, setViewNotFound] = useState(false);
  /* Only a saved view carries a name of its own; the static ones are named
     here so the page heading can label either kind. */
  const [savedViewName, setSavedViewName] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  /* Stable per-mount timestamp for the work-item layouts' date cells. */
  const [now] = useState(() => Date.now());
  /* Per-issue serialization for kanban drag-to-column (see handleCardMove). */
  const cardMoveChains = useRef<Map<string, Promise<void>>>(new Map());
  const cardMoveSeq = useRef<Map<string, number>>(new Map());

  useDocumentTitle(t('views.documentTitle', 'Views'));

  /* Apply a saved view once for the current route. The cancellation guard keeps
     a slow previous request from overwriting a newer route's title or filters. */
  useEffect(() => {
    let cancelled = false;
    const loadSavedView = Boolean(workspaceSlug && viewId && isCustomViewId(viewId));

    queueMicrotask(() => {
      if (cancelled) return;
      setSavedViewName(null);
      setViewNotFound(false);
      setViewLoading(loadSavedView);
    });

    if (!workspaceSlug || !viewId || !loadSavedView) {
      return () => {
        cancelled = true;
      };
    }

    viewService
      .get(workspaceSlug, viewId)
      .then((view) => {
        if (cancelled) return;
        setViewNotFound(false);
        setSavedViewName(view.name ?? null);
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
        if (cancelled) return;
        setViewLoading(false);
        setViewNotFound(true);
      });

    return () => {
      cancelled = true;
    };
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
    setLoadError(false);
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
          setCycles([]);
          setModules([]);
          setMembers([]);
          return null;
        }
        const n = projs.length;
        return Promise.all([
          workspaceService.listMembers(workspaceSlug),
          ...projs.map((p) => issueService.list(workspaceSlug, p.id, { limit: 100 })),
          ...projs.map((p) => stateService.list(workspaceSlug, p.id)),
          ...projs.map((p) => labelService.list(workspaceSlug, p.id)),
          ...projs.map((p) =>
            cycleService.list(workspaceSlug, p.id).catch(() => [] as CycleApiResponse[]),
          ),
          ...projs.map((p) =>
            moduleService.list(workspaceSlug, p.id).catch(() => [] as ModuleApiResponse[]),
          ),
        ]).then((results) => ({ results, n }));
      })
      .then((payload) => {
        if (cancelled || !payload) return;
        const { results, n } = payload;
        const [memberList, ...rest] = results;
        setMembers((memberList as WorkspaceMemberApiResponse[]) ?? []);
        setIssues((rest.slice(0, n) as IssueApiResponse[][]).flat());
        setStates((rest.slice(n, n * 2) as StateApiResponse[][]).flat());
        setLabels((rest.slice(n * 2, n * 3) as LabelApiResponse[][]).flat());
        setCycles((rest.slice(n * 3, n * 4) as CycleApiResponse[][]).flat());
        setModules((rest.slice(n * 4, n * 5) as ModuleApiResponse[][]).flat());
      })
      .catch(() => {
        if (cancelled) return;
        setWorkspace(null);
        setProjects([]);
        setIssues([]);
        setStates([]);
        setLabels([]);
        setCycles([]);
        setModules([]);
        setMembers([]);
        setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, reloadToken]);

  const stateMap = useMemo(() => new Map(states.map((s) => [s.id, s])), [states]);
  const labelMap = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);
  const cycleMap = useMemo(() => new Map(cycles.map((cycle) => [cycle.id, cycle])), [cycles]);
  const moduleMap = useMemo(() => new Map(modules.map((module) => [module.id, module])), [modules]);
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

  /* The toolbar's search is URL-backed and applies on top of the view's own
     filters, so a shared link lands on the same narrowed list. */
  const searchQuery = searchParams.get('q')?.trim().toLowerCase() ?? '';
  const visibleIssues = useMemo(() => {
    const list = display.showSubWorkItems
      ? sortedIssues
      : sortedIssues.filter((issue) => !issue.parent_id?.trim());
    if (!searchQuery) return list;
    return list.filter((issue) => {
      const project = projectMap.get(issue.project_id);
      const identifier = project
        ? `${project.identifier ?? project.id.slice(0, 8)}-${issue.sequence_id ?? ''}`.toLowerCase()
        : '';
      return (
        (issue.name ?? '').toLowerCase().includes(searchQuery) || identifier.includes(searchQuery)
      );
    });
  }, [sortedIssues, display.showSubWorkItems, searchQuery, projectMap]);

  const groupOf = useCallback(
    (issue: IssueApiResponse) => stateMap.get(issue.state_id ?? '')?.group?.toLowerCase(),
    [stateMap],
  );

  const completedCount = visibleIssues.filter((issue) => groupOf(issue) === 'completed').length;
  const openCount = visibleIssues.filter((issue) => {
    const group = groupOf(issue);
    return group !== 'completed' && group !== 'canceled' && group !== 'cancelled';
  }).length;

  const handleSort = (column: SortableColumn) => {
    const nextOrder: SortOrder =
      display.sortBy === column && display.sortOrder === 'desc' ? 'asc' : 'desc';
    setDisplay((prev) => ({ ...prev, sortBy: column, sortOrder: nextOrder }));
  };

  const updateIssue = useCallback(
    async (
      issue: IssueApiResponse,
      patch: Partial<{
        state_id: string | null;
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

  const handleCreateSave = async (data: CreateWorkItemDialogSubmit) => {
    if (!workspaceSlug || !data.title.trim()) return;
    setCreateError(null);
    try {
      const created = await issueService.create(workspaceSlug, data.projectId, {
        name: data.title.trim(),
        description: data.description || undefined,
        state_id: data.stateId || undefined,
        priority: data.priority || undefined,
        assignee_ids: data.assigneeIds?.length ? data.assigneeIds : undefined,
        label_ids: data.labelIds?.length ? data.labelIds : undefined,
        start_date: data.startDate || undefined,
        target_date: data.dueDate || undefined,
        parent_id: data.parentId || undefined,
      });
      if (created?.id) {
        const relationsAttached = await attachWorkItemRelations(
          workspaceSlug,
          data.projectId,
          created.id,
          { cycleId: data.cycleId, moduleIds: [data.moduleId] },
        );
        if (!relationsAttached) {
          toast.warning(
            t(
              'workItem.create.relationWarning',
              'Work item created, but one or more planning properties could not be attached.',
            ),
          );
        }
        setIssues((prev) => [created, ...prev.filter((issue) => issue.id !== created.id)]);
      }
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : t('workItem.list.createFailed', 'Failed to create work item'),
      );
      throw error;
    }
  };

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

  const currentViewId = viewId ?? 'all-issues';
  const staticViewLabels: Record<string, string> = {
    'all-issues': t('views.allWorkItems', 'All work items'),
    assigned: t('views.assigned', 'Assigned'),
    created: t('views.created', 'Created'),
    subscribed: t('views.subscribed', 'Subscribed'),
  };
  const pageTitle = isCustomViewId(currentViewId)
    ? (savedViewName ?? t('views.documentTitleFallback', 'View'))
    : (staticViewLabels[currentViewId] ?? staticViewLabels['all-issues']);

  /* The table is the densest layout, so the placeholder is shaped like it:
     heading, toolbar, then rows. */
  const contentSkeleton = (
    <div className="overflow-hidden rounded-xl border">
      <Skeleton className="h-10 w-full rounded-none" />
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="flex h-12 items-center gap-3 border-t px-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 max-w-80 flex-1" />
          <Skeleton className="hidden h-5 w-20 sm:block" />
        </div>
      ))}
    </div>
  );

  if (loading) {
    return <ListPageSkeleton label={t('views.loading', 'Loading work items')} />;
  }

  if (loadError || !workspace) {
    return (
      <Empty className="min-h-80 rounded-xl border border-dashed" role="alert">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
            <CircleAlert aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t('views.loadErrorTitle', 'Work items could not be loaded')}</EmptyTitle>
          <EmptyDescription>
            {t(
              'views.loadErrorDescription',
              'Check your connection and try again. Your work items have not been changed.',
            )}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            type="button"
            variant="outline"
            onClick={() => setReloadToken((value) => value + 1)}
          >
            <RefreshCw aria-hidden="true" />
            {t('common.retry', 'Try again')}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const baseUrl = `/${workspace.slug}`;
  const issueHref = (issue: IssueApiResponse) => {
    const project = projectMap.get(issue.project_id);
    return project ? `${baseUrl}/app-v2/projects/${project.id}/work-items/${issue.id}` : baseUrl;
  };

  const clearDiscoveryFilters = () => {
    setFilters(DEFAULT_WORKSPACE_VIEW_FILTERS);
    const next = new URLSearchParams(searchParams);
    next.delete('q');
    setSearchParams(next, { replace: true });
  };

  const hasDiscoveryFilters =
    Boolean(searchQuery) ||
    filters.priority.length > 0 ||
    filters.stateGroup.length > 0 ||
    filters.assigneeIds.length > 0 ||
    filters.createdByIds.length > 0 ||
    filters.projectIds.length > 0 ||
    filters.grouping !== 'all';

  const emptyState = (
    <Empty className="rounded-xl border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {issues.length === 0 ? <ListTodo aria-hidden="true" /> : <SearchX aria-hidden="true" />}
        </EmptyMedia>
        <EmptyTitle>
          {issues.length === 0
            ? t('views.emptyWorkItemsTitle', 'No work items yet')
            : t('views.noFilterResultsTitle', 'No work items found')}
        </EmptyTitle>
        <EmptyDescription>
          {issues.length === 0
            ? t(
                'views.emptyWorkItems',
                'No work items yet. Create one to start tracking work across your workspace.',
              )
            : t('views.noFilterResults', 'No work items match the current search and filters.')}
        </EmptyDescription>
      </EmptyHeader>
      {issues.length === 0 && projects.length > 0 && (
        <EmptyContent>
          <Button
            type="button"
            onClick={() => {
              setCreateError(null);
              setCreateOpen(true);
            }}
          >
            {t('views.newWorkItem', 'New work item')}
          </Button>
        </EmptyContent>
      )}
      {issues.length > 0 && hasDiscoveryFilters && (
        <EmptyContent>
          <Button type="button" variant="outline" onClick={clearDiscoveryFilters}>
            <SearchX aria-hidden="true" />
            {t('common.clearFilters', 'Clear filters')}
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );

  const notFoundState = (
    <Empty className="rounded-xl border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchX aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{t('views.viewDoesNotExist', 'View does not exist')}</EmptyTitle>
        <EmptyDescription>
          {t(
            'views.viewNotFoundDescription',
            "The view you are looking for does not exist or you don't have permission to view it.",
          )}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline">
          <Link to={`${baseUrl}/app-v2/views/all-issues`}>
            {t('views.allWorkItems', 'All work items')}
          </Link>
        </Button>
      </EmptyContent>
    </Empty>
  );

  /* Spreadsheet: the name column is pinned, the rest scroll horizontally.
     Created and updated are always present, matching the shipped table. */
  const scrollableColumns = SPREADSHEET_COLUMN_ORDER.filter(
    (key) =>
      key === 'created_at' ||
      key === 'updated_at' ||
      display.properties.includes(key as DisplayPropertyKey),
  );
  const listColumns = LIST_COLUMN_ORDER.filter(
    (key) => key === 'updated_at' || display.properties.includes(key as DisplayPropertyKey),
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

  const sortAriaValue = (column: SortableColumn): 'none' | 'ascending' | 'descending' => {
    if (display.sortBy !== column) return 'none';
    return display.sortOrder === 'asc' ? 'ascending' : 'descending';
  };

  const renderHeadCell = (key: (typeof scrollableColumns)[number]) => {
    const Icon = COLUMN_ICONS[key];
    const sortColumn = SORTABLE_BY_COLUMN[key];
    const label = headerLabel(key);
    return (
      <TableHead
        key={key}
        className="px-0"
        aria-sort={sortColumn ? sortAriaValue(sortColumn) : undefined}
      >
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

  const listColumnClass = (key: (typeof listColumns)[number], cell = false) => {
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

  const renderListHeadCell = (key: (typeof listColumns)[number]) => {
    const Icon = COLUMN_ICONS[key];
    const sortColumn = SORTABLE_BY_COLUMN[key];
    const label = headerLabel(key);
    return (
      <TableHead
        key={key}
        className={listColumnClass(key)}
        aria-sort={sortColumn ? sortAriaValue(sortColumn) : undefined}
      >
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

  const cellTriggerClass =
    'hover:bg-muted/50 flex h-11 w-full items-center gap-2 rounded-none px-3 text-left text-sm font-normal';

  const renderCell = (issue: IssueApiResponse, key: (typeof scrollableColumns)[number]) => {
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
              onValueChange={(stateId) => updateIssue(issue, { state_id: stateId })}
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
                    <AvatarFallback className="text-[10px] text-foreground">
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
              aria-label={
                isStart
                  ? t('views.changeStartDate', 'Change start date')
                  : t('views.changeDueDate', 'Change due date')
              }
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

  /** Wraps whichever layout is selected in the page's list chrome. */
  const renderContent = () => {
    if (viewNotFound) return notFoundState;
    if (viewLoading) return contentSkeleton;
    if (visibleIssues.length === 0) return emptyState;

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
        issues: visibleIssues,
        states,
        labels,
        members,
        prSummary: {},
        baseUrl,
        issueHref: (id: string) => {
          const issue = visibleIssues.find((i) => i.id === id);
          return issue ? issueHref(issue) : baseUrl;
        },
        now,
      };
      return (
        <section
          className="max-h-[70vh] overflow-auto rounded-xl border"
          aria-label={t('views.boardLabel', 'Work items board')}
        >
          {display.layout === 'kanban' && (
            <IssueLayoutBoard {...layoutProps} groupByStateGroup onCardMove={handleCardMove} />
          )}
          {display.layout === 'calendar' && <IssueLayoutCalendar {...layoutProps} />}
          {display.layout === 'gantt_chart' && <IssueLayoutGantt {...layoutProps} />}
        </section>
      );
    }

    if (display.layout === 'list') {
      return (
        <section
          className="rounded-xl border"
          aria-label={t('views.tableLabel', 'Work items table')}
        >
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
                  <TableHead className="min-w-72 px-0" aria-sort={sortAriaValue('name')}>
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
                  {listColumns.map(renderListHeadCell)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleIssues.map((issue) => {
                  const project = projectMap.get(issue.project_id);
                  return (
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
                          {display.properties.includes('id') && project && (
                            <span className="text-muted-foreground shrink-0 font-mono text-xs">
                              {project.identifier ?? project.id.slice(0, 8)}-
                              {issue.sequence_id ?? issue.id.slice(-4)}
                            </span>
                          )}
                          <span className="truncate font-medium">{issue.name}</span>
                        </Link>
                      </TableCell>
                      {listColumns.map((key) => (
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
                  );
                })}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </section>
      );
    }

    /* Spreadsheet: the name column is pinned, the rest scroll horizontally. */
    return (
      <section className="rounded-xl border" aria-label={t('views.tableLabel', 'Work items table')}>
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
                <TableHead
                  className="bg-muted/50 sticky left-0 z-20 min-w-56 px-0"
                  aria-sort={sortAriaValue('name')}
                >
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
              {visibleIssues.map((issue) => {
                const project = projectMap.get(issue.project_id);
                return (
                  <TableRow key={issue.id}>
                    {/* Pinned so the name stays readable while the properties
                        scroll; its own background keeps the scrolled cells from
                        showing through. */}
                    <TableCell className="bg-background sticky left-0 z-10 min-w-56 p-0">
                      <Link
                        to={issueHref(issue)}
                        className="hover:bg-muted/50 focus-visible:ring-ring flex h-11 items-center gap-2 px-3 outline-none transition-colors focus-visible:ring-2"
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
                          EDITABLE_COLUMNS.includes(key) ? 'p-0' : 'text-muted-foreground p-0 py-3'
                        }
                      >
                        {renderCell(issue, key)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </section>
    );
  };

  return (
    <div className="space-y-6 pb-8">
      <PageHeading
        title={pageTitle}
        description={t(
          'views.pageDescription',
          'Track work items across every project in your workspace.',
        )}
        summary={t(
          'views.summary',
          'Work items {{items}} · Open {{open}} · Completed {{completed}}',
          {
            items: visibleIssues.length,
            open: openCount,
            completed: completedCount,
          },
        )}
      />

      <ViewsToolbar
        workspaceSlug={workspace.slug}
        onCreateWorkItem={
          projects.length > 0
            ? () => {
                setCreateError(null);
                setCreateOpen(true);
              }
            : undefined
        }
      />

      <CreateWorkItemDialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setCreateError(null);
        }}
        workspaceSlug={workspace.slug}
        projects={projects}
        defaultProjectId={projects[0]?.id}
        createError={createError}
        onSave={handleCreateSave}
      />

      {renderContent()}

      {hasDiscoveryFilters && (
        <p className="sr-only" aria-live="polite">
          {t('views.visibleCount', '{{count}} work items visible', {
            count: visibleIssues.length,
          })}
        </p>
      )}
    </div>
  );
}
