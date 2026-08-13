import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Calendar,
  Check,
  ChevronsUpDown,
  Columns3,
  Filter,
  GanttChartSquare,
  LayoutGrid,
  List,
  Plus,
  Search,
  Settings2,
  X,
} from 'lucide-react';
import { Badge } from '@/components/shadcn/ui/badge';
import { Button } from '@/components/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/shadcn/ui/dropdown-menu';
import { Input } from '@/components/shadcn/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/shadcn/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/shadcn/ui/toggle-group';
import { CreateViewDialog } from '@/components/shadcn/create-view-dialog';
import { useWorkspaceViewsState } from '../../contexts/WorkspaceViewsStateContext';
import { viewService } from '../../services/viewService';
import { workspaceService } from '../../services/workspaceService';
import { projectService } from '../../services/projectService';
import {
  DISPLAY_PROPERTY_KEYS,
  DISPLAY_PROPERTY_LABELS,
  VIEW_LAYOUTS,
  VIEW_LAYOUT_LABELS,
  type DisplayPropertyKey,
  type ViewLayout,
} from '../../types/workspaceViewDisplay';
import {
  GROUPING_OPTIONS,
  PRIORITIES,
  STATE_GROUPS,
  DEFAULT_WORKSPACE_VIEW_FILTERS,
  type GroupingOption,
  type Priority,
  type StateGroup,
} from '../../types/workspaceViewFilters';
import type {
  IssueViewApiResponse,
  ProjectApiResponse,
  WorkspaceMemberApiResponse,
} from '../../api/types';

/** How many people to list before the filter dropdown gets unwieldy. */
const MAX_PEOPLE_LISTED = 8;

const LAYOUT_ICONS: Record<ViewLayout, typeof List> = {
  list: List,
  kanban: Columns3,
  calendar: Calendar,
  spreadsheet: LayoutGrid,
  gantt_chart: GanttChartSquare,
};

const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  none: 'None',
};

const STATE_GROUP_LABELS: Record<StateGroup, string> = {
  backlog: 'Backlog',
  unstarted: 'Todo',
  started: 'In Progress',
  completed: 'Done',
  canceled: 'Cancelled',
};

const GROUPING_LABELS: Record<GroupingOption, string> = {
  all: 'All work items',
  active: 'Active',
  backlog: 'Backlog',
};

const LIST_DISPLAY_PROPERTY_KEYS: DisplayPropertyKey[] = [
  'id',
  'state',
  'priority',
  'assignee',
  'labels',
  'cycle',
  'module',
  'start_date',
  'due_date',
];

interface ViewsToolbarProps {
  workspaceSlug: string;
  onCreateWorkItem?: () => void;
}

interface FilterChipProps {
  label: string;
  removeLabel: string;
  onRemove: () => void;
}

function FilterChip({ label, removeLabel, onRemove }: FilterChipProps) {
  return (
    <Badge variant="secondary" className="h-8 gap-1 pr-1 pl-2.5">
      <span className="max-w-48 truncate">{label}</span>
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        className="hover:bg-background/80 size-6 rounded-full"
        onClick={onRemove}
        aria-label={removeLabel}
      >
        <X aria-hidden="true" />
      </Button>
    </Badge>
  );
}

/**
 * View picker, search, layout selector, filter and display controls for the
 * workspace views page, built from shadcn primitives.
 *
 * It reads and writes the same WorkspaceViewsState the shipped
 * WorkspaceViewsHeader drives, so the v2 page and the shipped one behave
 * identically; only the chrome differs. It lives in the page body — like the
 * Projects toolbar — because its controls need room to wrap on small screens
 * rather than competing with the breadcrumb in the 64px shell header.
 */
export function ViewsToolbar({ workspaceSlug, onCreateWorkItem }: ViewsToolbarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { viewId } = useParams<{ viewId?: string }>();
  const { filters, setFilters, display, setDisplay } = useWorkspaceViewsState();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [customViews, setCustomViews] = useState<IssueViewApiResponse[]>([]);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [viewPickerOpen, setViewPickerOpen] = useState(false);
  const [viewSearch, setViewSearch] = useState('');
  const [createViewOpen, setCreateViewOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    viewService
      .list(workspaceSlug)
      .then((list) => {
        if (!cancelled) setCustomViews(list ?? []);
      })
      .catch(() => {
        /* The static views are still selectable if the saved ones cannot load. */
      });
    projectService
      .list(workspaceSlug)
      .then((list) => {
        if (!cancelled) setProjects(list ?? []);
      })
      .catch(() => {
        /* Project filter just stays empty. */
      });
    workspaceService
      .listMembers(workspaceSlug)
      .then((list) => {
        if (!cancelled) setMembers(list ?? []);
      })
      .catch(() => {
        /* People filters just stay empty. */
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  const selectedViewId = viewId ?? 'all-issues';
  const staticViews = useMemo(
    () => [
      { id: 'all-issues', name: t('views.allWorkItems', 'All work items') },
      { id: 'assigned', name: t('views.assigned', 'Assigned') },
      { id: 'created', name: t('views.created', 'Created') },
      { id: 'subscribed', name: t('views.subscribed', 'Subscribed') },
    ],
    [t],
  );
  const allViews = useMemo(
    () => [...staticViews, ...customViews.map((v) => ({ id: v.id, name: v.name }))],
    [customViews, staticViews],
  );
  const selectedView = allViews.find((v) => v.id === selectedViewId);
  const selectedViewName = selectedView?.name ?? staticViews[0].name;
  const filteredViews = allViews.filter((v) =>
    v.name.toLowerCase().includes(viewSearch.trim().toLowerCase()),
  );
  const visibleDisplayPropertyKeys =
    display.layout === 'list' ? LIST_DISPLAY_PROPERTY_KEYS : DISPLAY_PROPERTY_KEYS;

  const activeFilterCount =
    filters.priority.length +
    filters.stateGroup.length +
    filters.assigneeIds.length +
    filters.createdByIds.length +
    filters.projectIds.length +
    (filters.grouping === 'all' ? 0 : 1);

  /** Adds or removes one entry of a multi-select filter. */
  const toggleFilterValue = <
    K extends 'priority' | 'stateGroup' | 'assigneeIds' | 'createdByIds' | 'projectIds',
  >(
    key: K,
    value: string,
  ) => {
    setFilters((prev) => {
      const current = prev[key] as string[];
      const next = current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value];
      return { ...prev, [key]: next } as typeof prev;
    });
  };

  const removeFilterValue = (
    key: 'priority' | 'stateGroup' | 'assigneeIds' | 'createdByIds' | 'projectIds',
    value: string,
  ) => {
    setFilters((prev) => {
      const current = prev[key] as string[];
      return { ...prev, [key]: current.filter((entry) => entry !== value) } as typeof prev;
    });
  };

  const toggleDisplayProperty = (key: DisplayPropertyKey) => {
    setDisplay((prev) => ({
      ...prev,
      properties: prev.properties.includes(key)
        ? prev.properties.filter((k) => k !== key)
        : [...prev.properties, key],
    }));
  };

  const peopleLabel = (member: WorkspaceMemberApiResponse) =>
    member.member_display_name || member.member_email || t('common.member', 'Member');

  const memberById = new Map(members.map((member) => [member.member_id ?? member.id, member]));
  const personLabel = (memberId: string) => {
    const member = memberById.get(memberId);
    return member ? peopleLabel(member) : memberId;
  };
  const projectLabel = (projectId: string) =>
    projects.find((project) => project.id === projectId)?.name ?? projectId;

  /* The search field is URL-backed, like the Projects one, so a filtered list
     survives a reload and can be shared. The saved-view filters stay in the
     shared state; this only narrows what the page renders. */
  const searchQuery = searchParams.get('q') ?? '';
  const setSearchQuery = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('q', value);
    else next.delete('q');
    setSearchParams(next, { replace: true });
  };

  const activeFilterChips: Array<{ key: string; label: string; onRemove: () => void }> = [];

  if (filters.grouping !== 'all') {
    activeFilterChips.push({
      key: `grouping-${filters.grouping}`,
      label: GROUPING_LABELS[filters.grouping],
      onRemove: () => setFilters((prev) => ({ ...prev, grouping: 'all' })),
    });
  }

  filters.priority.forEach((priority) => {
    activeFilterChips.push({
      key: `priority-${priority}`,
      label: `${t('views.priority', 'Priority')}: ${PRIORITY_LABELS[priority]}`,
      onRemove: () => removeFilterValue('priority', priority),
    });
  });

  filters.stateGroup.forEach((group) => {
    activeFilterChips.push({
      key: `state-${group}`,
      label: `${t('views.state', 'State')}: ${STATE_GROUP_LABELS[group]}`,
      onRemove: () => removeFilterValue('stateGroup', group),
    });
  });

  filters.projectIds.forEach((projectId) => {
    activeFilterChips.push({
      key: `project-${projectId}`,
      label: `${t('views.filter.projectLabel', 'Project')}: ${projectLabel(projectId)}`,
      onRemove: () => removeFilterValue('projectIds', projectId),
    });
  });

  filters.assigneeIds.forEach((memberId) => {
    activeFilterChips.push({
      key: `assignee-${memberId}`,
      label: `${t('views.assignees', 'Assignees')}: ${personLabel(memberId)}`,
      onRemove: () => removeFilterValue('assigneeIds', memberId),
    });
  });

  filters.createdByIds.forEach((memberId) => {
    activeFilterChips.push({
      key: `created-by-${memberId}`,
      label: `${t('views.createdBy', 'Created by')}: ${personLabel(memberId)}`,
      onRemove: () => removeFilterValue('createdByIds', memberId),
    });
  });

  return (
    <div
      className="bg-card/50 space-y-3 rounded-xl border p-3 shadow-xs sm:p-4"
      role="region"
      aria-label={t('views.toolbar', 'View controls')}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative order-last w-full min-w-0 sm:order-none sm:w-64 sm:flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t('views.searchPlaceholder', 'Search work items')}
            aria-label={t('views.searchPlaceholder', 'Search work items')}
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 justify-between sm:h-9 sm:flex-none"
            >
              <Filter aria-hidden="true" />
              {t('common.filters', 'Filters')}
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 min-w-5 px-1.5">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="max-h-[min(70vh,32rem)] w-64 overflow-y-auto"
          >
            <DropdownMenuLabel>{t('views.grouping', 'Grouping')}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={filters.grouping}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, grouping: value as GroupingOption }))
              }
            >
              {GROUPING_OPTIONS.map((option) => (
                <DropdownMenuRadioItem key={option} value={option}>
                  {GROUPING_LABELS[option]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>

            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t('views.priority', 'Priority')}</DropdownMenuLabel>
            {PRIORITIES.map((priority) => (
              <DropdownMenuCheckboxItem
                key={priority}
                checked={filters.priority.includes(priority)}
                onCheckedChange={() => toggleFilterValue('priority', priority)}
              >
                {PRIORITY_LABELS[priority]}
              </DropdownMenuCheckboxItem>
            ))}

            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t('views.state', 'State')}</DropdownMenuLabel>
            {STATE_GROUPS.map((group) => (
              <DropdownMenuCheckboxItem
                key={group}
                checked={filters.stateGroup.includes(group)}
                onCheckedChange={() => toggleFilterValue('stateGroup', group)}
              >
                {STATE_GROUP_LABELS[group]}
              </DropdownMenuCheckboxItem>
            ))}

            {projects.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>{t('common.projects', 'Projects')}</DropdownMenuLabel>
                {projects.slice(0, MAX_PEOPLE_LISTED).map((project) => (
                  <DropdownMenuCheckboxItem
                    key={project.id}
                    checked={filters.projectIds.includes(project.id)}
                    onCheckedChange={() => toggleFilterValue('projectIds', project.id)}
                  >
                    {project.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </>
            )}

            {members.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>{t('views.assignees', 'Assignees')}</DropdownMenuLabel>
                {members.slice(0, MAX_PEOPLE_LISTED).map((member) => (
                  <DropdownMenuCheckboxItem
                    key={`assignee-${member.id}`}
                    checked={filters.assigneeIds.includes(member.member_id)}
                    onCheckedChange={() => toggleFilterValue('assigneeIds', member.member_id)}
                  >
                    {peopleLabel(member)}
                  </DropdownMenuCheckboxItem>
                ))}

                <DropdownMenuSeparator />
                <DropdownMenuLabel>{t('views.createdBy', 'Created by')}</DropdownMenuLabel>
                {members.slice(0, MAX_PEOPLE_LISTED).map((member) => (
                  <DropdownMenuCheckboxItem
                    key={`created-by-${member.id}`}
                    checked={filters.createdByIds.includes(member.member_id)}
                    onCheckedChange={() => toggleFilterValue('createdByIds', member.member_id)}
                  >
                    {peopleLabel(member)}
                  </DropdownMenuCheckboxItem>
                ))}
              </>
            )}

            {activeFilterCount > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setFilters(DEFAULT_WORKSPACE_VIEW_FILTERS)}>
                  <X />
                  {t('common.clearFilters', 'Clear filters')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto flex max-w-full items-center gap-2 overflow-x-auto pb-1 sm:overflow-visible sm:pb-0">
          {onCreateWorkItem && (
            <Button
              type="button"
              className="order-first h-11 shrink-0 sm:order-last sm:h-9"
              onClick={onCreateWorkItem}
            >
              <Plus aria-hidden="true" />
              {t('views.newWorkItem', 'New work item')}
            </Button>
          )}

          {/* View picker. A popover rather than a dropdown menu, because the
              search field inside would fight the menu's own typeahead. */}
          <Popover
            open={viewPickerOpen}
            onOpenChange={(open) => {
              setViewPickerOpen(open);
              /* Cleared on close rather than on open, so the list is not
                 briefly filtered by the previous query as the popover
                 animates in. */
              if (!open) setViewSearch('');
            }}
          >
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-11 max-w-48 shrink-0 justify-between sm:h-9"
              >
                <span className="truncate">{selectedViewName}</span>
                <ChevronsUpDown className="opacity-60" aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-0">
              <div className="relative border-b p-2">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2" />
                <Input
                  value={viewSearch}
                  onChange={(e) => setViewSearch(e.target.value)}
                  placeholder={t('common.search', 'Search')}
                  aria-label={t('common.search', 'Search')}
                  className="h-8 pl-8"
                  autoFocus
                />
              </div>
              <div className="max-h-72 overflow-y-auto p-1">
                {filteredViews.length === 0 ? (
                  <p className="text-muted-foreground px-2 py-6 text-center text-sm">
                    {t('common.noResults', 'No results')}
                  </p>
                ) : (
                  filteredViews.map((view) => (
                    <button
                      key={view.id}
                      type="button"
                      onClick={() => {
                        setViewPickerOpen(false);
                        navigate(`/${workspaceSlug}/app-v2/views/${view.id}`);
                      }}
                      className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none focus-visible:ring-2"
                    >
                      <span className="min-w-0 flex-1 truncate">{view.name}</span>
                      {selectedViewId === view.id && <Check className="size-4 shrink-0" />}
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-11 shrink-0 justify-between sm:h-9"
              >
                <Settings2 aria-hidden="true" />
                {t('common.display', 'Display')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-[70vh] w-56 overflow-y-auto">
              <DropdownMenuLabel>
                {t('views.displayProperties', 'Display Properties')}
              </DropdownMenuLabel>
              {visibleDisplayPropertyKeys.map((key) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={display.properties.includes(key)}
                  onCheckedChange={() => toggleDisplayProperty(key)}
                >
                  {t(`display.property.${key}`, DISPLAY_PROPERTY_LABELS[key])}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={display.showSubWorkItems}
                onCheckedChange={(checked) =>
                  setDisplay((prev) => ({ ...prev, showSubWorkItems: checked }))
                }
              >
                {t('views.showSubWorkItems', 'Show sub-work items')}
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Layout selector. A single-select toggle group keeps the current
              layout visible without opening anything, as the shipped selector
              does. */}
          <ToggleGroup
            type="single"
            value={display.layout}
            onValueChange={(value) => {
              if (!value) return;
              setDisplay((prev) => ({ ...prev, layout: value as ViewLayout }));
            }}
            variant="outline"
            spacing={0}
            className="h-11 shrink-0 sm:h-9"
            aria-label={t('views.layout', 'Layout')}
          >
            {VIEW_LAYOUTS.map((layout) => {
              const Icon = LAYOUT_ICONS[layout];
              return (
                <ToggleGroupItem
                  key={layout}
                  value={layout}
                  className="h-11 px-3 sm:h-9"
                  aria-label={VIEW_LAYOUT_LABELS[layout]}
                  title={VIEW_LAYOUT_LABELS[layout]}
                >
                  <Icon aria-hidden="true" />
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>

          <Button
            type="button"
            variant="outline"
            className="h-11 shrink-0 sm:h-9"
            onClick={() => setCreateViewOpen(true)}
          >
            <Plus aria-hidden="true" />
            {t('common.addView', 'Add view')}
          </Button>
        </div>
      </div>

      {activeFilterChips.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2 border-t pt-3"
          aria-label={t('views.activeFilters', 'Active filters')}
        >
          <span className="text-muted-foreground text-xs font-medium">
            {t('views.activeFilters', 'Active filters')}
          </span>
          {activeFilterChips.map((filter) => (
            <FilterChip
              key={filter.key}
              label={filter.label}
              removeLabel={t('common.removeFilter', 'Remove {{filter}} filter', {
                filter: filter.label,
              })}
              onRemove={filter.onRemove}
            />
          ))}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8"
            onClick={() => setFilters(DEFAULT_WORKSPACE_VIEW_FILTERS)}
          >
            {t('common.clearAll', 'Clear all')}
          </Button>
        </div>
      )}

      <CreateViewDialog
        open={createViewOpen}
        onOpenChange={setCreateViewOpen}
        workspaceSlug={workspaceSlug}
        onCreated={(view) => setCustomViews((prev) => [...prev, view])}
      />
    </div>
  );
}
