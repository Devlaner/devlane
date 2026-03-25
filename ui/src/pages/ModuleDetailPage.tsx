import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Avatar, Badge, Button } from '../components/ui';
import { CreateWorkItemModal } from '../components/CreateWorkItemModal';
import { AddExistingWorkItemModal } from '../components/AddExistingWorkItemModal';
import { workspaceService } from '../services/workspaceService';
import { projectService } from '../services/projectService';
import { moduleService } from '../services/moduleService';
import { issueService } from '../services/issueService';
import { stateService } from '../services/stateService';
import { labelService } from '../services/labelService';
import { cycleService } from '../services/cycleService';
import type {
  WorkspaceApiResponse,
  ProjectApiResponse,
  ModuleApiResponse,
  IssueApiResponse,
  StateApiResponse,
  LabelApiResponse,
  WorkspaceMemberApiResponse,
  CycleApiResponse,
} from '../api/types';
import type { Priority } from '../types';
import { getImageUrl } from '../lib/utils';
import { slugify } from '../lib/slug';
import {
  DEFAULT_MODULE_WORK_ITEMS_DISPLAY,
  DEFAULT_MODULE_WORK_ITEMS_FILTERS,
  MODULE_WORK_ITEMS_COUNT_EVENT,
  MODULE_WORK_ITEMS_DISPLAY_EVENT,
  MODULE_WORK_ITEMS_FILTER_EVENT,
  MODULE_WORK_ITEMS_OPEN_ADD_EXISTING_EVENT,
  moduleWorkItemsPrefsKey,
  parseModuleWorkItemsPrefs,
  type ModuleWorkItemsDisplayState,
  type ModuleWorkItemsFiltersState,
} from '../lib/moduleWorkItemsPrefs';
import {
  applyModuleSubWorkFilter,
  filterModuleIssues,
  sortModuleIssuesDefault,
} from '../lib/moduleWorkItemsApply';

const priorityVariant: Record<Priority, 'danger' | 'warning' | 'default' | 'neutral'> = {
  urgent: 'danger',
  high: 'danger',
  medium: 'warning',
  low: 'default',
  none: 'neutral',
};

const IconCalendar = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const IconCalendarClock = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M8 2v4M16 2v4" />
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M3 10h18" />
    <path d="M12 14v3" />
    <path d="M12 17h.01" />
  </svg>
);

const IconUser = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconTag = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
  </svg>
);

const IconEye = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconModuleSmall = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <rect width="6" height="6" x="3" y="3" rx="0.5" />
    <rect width="6" height="6" x="15" y="3" rx="0.5" />
    <rect width="6" height="6" x="3" y="15" rx="0.5" />
    <rect width="6" height="6" x="15" y="15" rx="0.5" />
  </svg>
);

const IconEstimate = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    <path d="M19 3v4M21 5h-4" />
  </svg>
);

const IconPriorityNone = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <line x1="5" y1="19" x2="19" y2="5" />
  </svg>
);

const IconMoreHorizontal = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <circle cx="5" cy="12" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="19" cy="12" r="1.5" />
  </svg>
);

const IconPlus = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </svg>
);

const IconModule = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    className="text-(--txt-icon-tertiary)"
    aria-hidden
  >
    <rect width="8" height="8" x="3" y="3" rx="1" />
    <rect width="8" height="8" x="13" y="3" rx="1" />
    <rect width="8" height="8" x="3" y="13" rx="1" />
    <rect width="8" height="8" x="13" y="13" rx="1" />
  </svg>
);

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const day = d.getDate();
  const month = d.toLocaleString('en-US', { month: 'short' });
  return `${day} ${month}`;
}

function StateIcon({ stateName }: { stateName: string }) {
  const lower = stateName.toLowerCase();
  const dashed = lower.includes('backlog') || lower.includes('unstarted');
  if (dashed) {
    return (
      <span
        className="flex size-4 shrink-0 items-center justify-center rounded border border-(--border-subtle) border-dashed text-(--txt-icon-tertiary)"
        aria-hidden
      >
        <span className="size-2 rounded-full border border-current border-dashed" />
      </span>
    );
  }
  return (
    <span
      className="flex size-4 shrink-0 items-center justify-center rounded border border-(--border-subtle) text-(--txt-icon-tertiary)"
      aria-hidden
    >
      <span className="size-2 rounded-full border border-current" />
    </span>
  );
}

export function ModuleDetailPage() {
  const { workspaceSlug, projectId, moduleId } = useParams<{
    workspaceSlug: string;
    projectId: string;
    moduleId: string;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [module, setModule] = useState<ModuleApiResponse | null>(null);
  const [resolvedModuleId, setResolvedModuleId] = useState<string | null>(null);
  const [issues, setIssues] = useState<IssueApiResponse[]>([]);
  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [labels, setLabels] = useState<LabelApiResponse[]>([]);
  const [cycles, setCycles] = useState<CycleApiResponse[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [addExistingOpen, setAddExistingOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [listFilters, setListFilters] = useState<ModuleWorkItemsFiltersState>(
    DEFAULT_MODULE_WORK_ITEMS_FILTERS,
  );
  const [listDisplay, setListDisplay] = useState<ModuleWorkItemsDisplayState>(
    DEFAULT_MODULE_WORK_ITEMS_DISPLAY,
  );

  const createParam = searchParams.get('create') === '1';

  useEffect(() => {
    if (createParam && projectId) {
      queueMicrotask(() => setCreateOpen(true));
    }
  }, [createParam, projectId]);

  useLayoutEffect(() => {
    const onFilter = (e: Event) => {
      const d = (e as CustomEvent<ModuleWorkItemsFiltersState>).detail;
      if (d) setListFilters(d);
    };
    const onDisplay = (e: Event) => {
      const d = (e as CustomEvent<ModuleWorkItemsDisplayState>).detail;
      if (d) setListDisplay(d);
    };
    window.addEventListener(MODULE_WORK_ITEMS_FILTER_EVENT, onFilter);
    window.addEventListener(MODULE_WORK_ITEMS_DISPLAY_EVENT, onDisplay);
    return () => {
      window.removeEventListener(MODULE_WORK_ITEMS_FILTER_EVENT, onFilter);
      window.removeEventListener(MODULE_WORK_ITEMS_DISPLAY_EVENT, onDisplay);
    };
  }, []);

  useEffect(() => {
    const onOpenAdd = () => setAddExistingOpen(true);
    window.addEventListener(MODULE_WORK_ITEMS_OPEN_ADD_EXISTING_EVENT, onOpenAdd);
    return () => window.removeEventListener(MODULE_WORK_ITEMS_OPEN_ADD_EXISTING_EVENT, onOpenAdd);
  }, []);

  useEffect(() => {
    if (!workspaceSlug || !projectId || !resolvedModuleId) return;
    const raw = localStorage.getItem(moduleWorkItemsPrefsKey(workspaceSlug, projectId, resolvedModuleId));
    const parsed = parseModuleWorkItemsPrefs(raw);
    if (parsed) {
      setListFilters({ ...DEFAULT_MODULE_WORK_ITEMS_FILTERS, ...parsed.filters });
      setListDisplay({ ...DEFAULT_MODULE_WORK_ITEMS_DISPLAY, ...parsed.display });
    }
  }, [workspaceSlug, projectId, resolvedModuleId]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(MODULE_WORK_ITEMS_COUNT_EVENT, { detail: { count: issues.length } }),
    );
  }, [issues.length]);

  const handleCloseCreate = () => {
    setCreateOpen(false);
    setCreateError(null);
    searchParams.delete('create');
    setSearchParams(searchParams, { replace: true });
  };

  const refetchIssues = () => {
    if (!workspaceSlug || !projectId || !resolvedModuleId) return;
    issueService
      .list(workspaceSlug, projectId, { limit: 1000 })
      .then((list) => {
        setIssues((list ?? []).filter((i) => i.module_ids?.includes(resolvedModuleId)));
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (!workspaceSlug || !projectId || !moduleId) {
      queueMicrotask(() => setLoading(false));
      return;
    }
    let cancelled = false;
    queueMicrotask(() => setLoading(true));
    Promise.all([
      workspaceService.getBySlug(workspaceSlug),
      projectService.get(workspaceSlug, projectId),
      moduleService.list(workspaceSlug, projectId),
      issueService.list(workspaceSlug, projectId, { limit: 1000 }),
      stateService.list(workspaceSlug, projectId),
      labelService.list(workspaceSlug, projectId),
      cycleService.list(workspaceSlug, projectId),
      workspaceService.listMembers(workspaceSlug),
      projectService.list(workspaceSlug),
    ])
      .then(([w, p, mods, iss, st, lab, cyc, mem, proj]) => {
        if (cancelled) return;
        setWorkspace(w ?? null);
        setProject(p ?? null);
        const key = moduleId.trim().toLowerCase();
        const found =
          (mods ?? []).find((x) => x.id === moduleId) ??
          (mods ?? []).find((x) => slugify(x.name) === key) ??
          null;
        setModule(found);
        setResolvedModuleId(found?.id ?? null);
        setIssues((iss ?? []).filter((i) => i.module_ids?.includes(found?.id ?? '')));
        setStates(st ?? []);
        setLabels(lab ?? []);
        setCycles(cyc ?? []);
        setMembers(mem ?? []);
        setProjects(proj ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setWorkspace(null);
          setProject(null);
          setModule(null);
          setResolvedModuleId(null);
          setIssues([]);
          setStates([]);
          setLabels([]);
          setCycles([]);
          setMembers([]);
          setProjects([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, moduleId]);

  const handleCreateSave = async (data: {
    title: string;
    description?: string;
    projectId: string;
    stateId?: string;
    priority?: Priority;
    assigneeIds?: string[];
    labelIds?: string[];
    startDate?: string;
    dueDate?: string;
    cycleId?: string | null;
    moduleId?: string | null;
    parentId?: string | null;
  }) => {
    if (!workspaceSlug || !data.title.trim() || !resolvedModuleId) return;
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
        await moduleService.addIssue(workspaceSlug, data.projectId, resolvedModuleId, created.id);
      }
      refetchIssues();
      handleCloseCreate();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create work item');
    }
  };

  const getStateName = (stateId: string | null | undefined) =>
    stateId ? (states.find((s) => s.id === stateId)?.name ?? stateId) : 'No state';
  const getLabelNames = (labelIds: string[] = []) =>
    labelIds
      .map((id) => labels.find((l) => l.id === id)?.name)
      .filter((name): name is string => Boolean(name));
  const getUser = (userId: string | null) => {
    if (!userId) return null;
    const m = members.find((x) => x.member_id === userId);
    const display = m?.member_display_name?.trim();
    const emailUser = m?.member_email?.split('@')[0]?.trim();
    const name = display || emailUser || 'Member';
    const avatarUrl = m?.member_avatar ?? null;
    return { id: userId, name, avatarUrl };
  };

  const stateOrderMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of states) {
      m.set(s.id, s.sort_order ?? 0);
    }
    return m;
  }, [states]);

  const { visibleFlat, groupedSections } = useMemo(() => {
    let base = applyModuleSubWorkFilter(issues, listDisplay);
    base = filterModuleIssues(base, listFilters);
    base = sortModuleIssuesDefault(base, stateOrderMap);

    if (!listDisplay.groupByState) {
      return { visibleFlat: base, groupedSections: null as null };
    }

    const byState: Record<string, IssueApiResponse[]> = {};
    for (const s of states) {
      byState[s.id] = [];
    }
    byState['__none__'] = [];
    for (const issue of base) {
      const sid = issue.state_id;
      if (sid && states.some((s) => s.id === sid)) {
        byState[sid].push(issue);
      } else {
        byState['__none__'].push(issue);
      }
    }

    const orderKeys: string[] = [...states.map((s) => s.id), '__none__'];
    const sections = orderKeys
      .map((key) => ({
        key,
        title: key === '__none__' ? 'No state' : (states.find((s) => s.id === key)?.name ?? key),
        items: byState[key] ?? [],
      }))
      .filter((sec) => sec.items.length > 0);

    return { visibleFlat: base, groupedSections: sections };
  }, [issues, listDisplay, listFilters, stateOrderMap, states]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-(--txt-tertiary)">
        Loading…
      </div>
    );
  }
  if (!workspace || !project || !module) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8">
        <p className="text-(--txt-secondary)">Module not found.</p>
        {workspace && projectId && (
          <Link
            to={`/${workspace.slug}/projects/${projectId}/modules`}
            className="text-sm font-medium text-(--brand-default) hover:underline"
          >
            Back to Modules
          </Link>
        )}
      </div>
    );
  }

  const baseUrl = `/${workspace.slug}/projects/${project.id}`;

  const issueDisplayId = (issue: IssueApiResponse): string => {
    const ident = project.identifier ?? project.id.slice(0, 8);
    if (issue.sequence_id != null && Number.isFinite(issue.sequence_id)) {
      return `${ident}-${issue.sequence_id}`;
    }
    const compact = issue.id.replace(/-/g, '').slice(0, 8);
    return `${ident}-${compact}`;
  };

  const cycleLabel = (issue: IssueApiResponse): string | null => {
    const ids = issue.cycle_ids ?? [];
    if (ids.length === 0) return null;
    const c = cycles.find((x) => ids.includes(x.id));
    return c?.name ?? null;
  };

  const renderIssueRow = (issue: IssueApiResponse) => {
    const primaryAssigneeId = issue.assignee_ids?.[0] ?? null;
    const assignee = getUser(primaryAssigneeId);
    const labelNames = getLabelNames(issue.label_ids ?? []);
    const sn = getStateName(issue.state_id ?? undefined);
    const pri = (issue.priority as Priority) ?? 'none';
    const cycle = cycleLabel(issue);

    return (
      <li key={issue.id}>
        <Link
          to={`${baseUrl}/issues/${issue.id}`}
          className="flex min-h-12 items-center gap-2 px-4 py-2.5 no-underline transition-colors hover:bg-(--bg-layer-1-hover)"
        >
          <span className="min-w-0 flex-1 truncate text-sm">
            <span className="font-medium text-(--txt-secondary)">{issueDisplayId(issue)}</span>
            <span className="ml-2 text-(--txt-primary)">{issue.name}</span>
          </span>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 text-(--txt-icon-tertiary)">
            {listDisplay.showState ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-1) px-2 py-0.5 text-xs font-medium text-(--txt-secondary)"
                title={sn}
              >
                <StateIcon stateName={sn} />
                {sn}
              </span>
            ) : null}
            {listDisplay.showPriority ? (
              <span
                className="flex size-7 items-center justify-center rounded-md border border-(--border-subtle) bg-(--bg-layer-1)"
                title={pri}
              >
                {pri === 'none' ? (
                  <IconPriorityNone />
                ) : (
                  <Badge
                    variant={priorityVariant[pri]}
                    className="!px-1 !py-0 text-[9px] uppercase"
                  >
                    {pri[0] ?? pri}
                  </Badge>
                )}
              </span>
            ) : null}
            {listDisplay.showStartDate ? (
              <span
                className="flex size-7 items-center justify-center rounded-md border border-(--border-subtle) bg-(--bg-layer-1)"
                title={issue.start_date ? `Start: ${formatDate(issue.start_date)}` : 'Start date'}
              >
                <IconCalendarClock />
              </span>
            ) : null}
            {listDisplay.showDueDate ? (
              <span
                className="flex size-7 items-center justify-center rounded-md border border-(--border-subtle) bg-(--bg-layer-1)"
                title={
                  issue.target_date ? `Due: ${formatDate(issue.target_date)}` : 'Due date'
                }
              >
                <IconCalendar />
              </span>
            ) : null}
            {listDisplay.showAssignee ? (
              <span
                className="flex size-7 items-center justify-center rounded-md border border-(--border-subtle) bg-(--bg-layer-1)"
                title={assignee?.name ?? 'Unassigned'}
              >
                {assignee ? (
                  <Avatar
                    name={assignee.name}
                    src={getImageUrl(assignee.avatarUrl) ?? undefined}
                    size="sm"
                    className="h-6 w-6 text-[10px]"
                  />
                ) : (
                  <IconUser />
                )}
              </span>
            ) : null}
            {listDisplay.showModule ? (
              <span
                className="inline-flex max-w-36 items-center gap-1 truncate rounded-md border border-(--border-subtle) bg-(--bg-layer-1) px-2 py-0.5 text-xs font-medium text-(--txt-secondary)"
                title={module.name}
              >
                <IconModuleSmall />
                <span className="truncate">{module.name}</span>
              </span>
            ) : null}
            <span
              className="flex size-7 items-center justify-center rounded-md border border-(--border-subtle) bg-(--bg-layer-1) opacity-50"
              title="Estimate"
            >
              <IconEstimate />
            </span>
            {listDisplay.showLabels ? (
              <span
                className="flex size-7 items-center justify-center rounded-md border border-(--border-subtle) bg-(--bg-layer-1)"
                title={labelNames.length ? labelNames.join(', ') : 'Labels'}
              >
                {labelNames.length > 0 ? <IconTag /> : <span className="opacity-40"><IconTag /></span>}
              </span>
            ) : null}
            {cycle ? (
              <span
                className="hidden max-w-28 truncate rounded-md border border-(--border-subtle) bg-(--bg-layer-1) px-2 py-0.5 text-[11px] font-medium text-(--txt-secondary) sm:inline"
                title={`Cycle: ${cycle}`}
              >
                {cycle}
              </span>
            ) : null}
            {listDisplay.showVisibility ? (
              <span className="flex size-7 items-center justify-center rounded-md border border-(--border-subtle) bg-(--bg-layer-1)">
                <IconEye />
              </span>
            ) : null}
            <button
              type="button"
              className="flex size-7 items-center justify-center rounded-md border border-(--border-subtle) bg-(--bg-layer-1) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
              aria-label="More options"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <IconMoreHorizontal />
            </button>
          </div>
        </Link>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {issues.length === 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-[30px] leading-tight font-semibold text-(--txt-primary)">
              No work items in the module
            </h2>
            <p className="mt-1 text-sm text-(--txt-secondary)">
              Create or add work items which you want to accomplish as part of this module
            </p>
          </div>

          <div className="relative overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-surface-1) px-6 py-10">
            <div className="mx-auto max-w-190">
              <div className="relative rounded-md border border-(--border-subtle) bg-(--bg-layer-1) p-6">
                <div className="absolute top-6 left-6 flex size-16 items-center justify-center rounded-md border border-(--border-subtle) bg-(--bg-surface-1)">
                  <IconModule />
                </div>

                <div className="ml-24 rounded-md border border-(--border-subtle) bg-(--bg-surface-1)">
                  <div className="flex items-center gap-2 border-b border-(--border-subtle) px-3 py-2 text-xs text-(--txt-tertiary)">
                    <span className="font-medium">Backlog</span>
                    <span>7</span>
                  </div>
                  <div className="divide-y divide-(--border-subtle)">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <div key={n} className="h-8 bg-(--bg-surface-1)" />
                    ))}
                  </div>
                </div>

                <div className="pointer-events-none absolute top-34 left-10 w-70 rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-3 shadow-(--shadow-raised)">
                  <div className="h-4 w-42 rounded bg-(--bg-layer-1)" />
                  <div className="mt-3 h-2.5 w-28 rounded bg-(--bg-layer-1)" />
                  <div className="mt-3 h-2 w-full rounded bg-(--bg-layer-1)" />
                  <div className="mt-3 flex items-center justify-between">
                    <div className="h-3 w-20 rounded bg-(--bg-layer-1)" />
                    <div className="h-3 w-12 rounded bg-(--bg-layer-1)" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => setSearchParams({ create: '1' })}
              >
                <IconPlus />
                Create new work items
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5"
                onClick={() => setAddExistingOpen(true)}
              >
                Add an existing work item
              </Button>
            </div>
          </div>
        </section>
      )}

      {issues.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold text-(--txt-primary)">
              <span
                className="flex size-4 shrink-0 items-center justify-center rounded border border-(--border-subtle) border-dashed text-(--txt-icon-tertiary)"
                aria-hidden
              >
                <span className="size-2 rounded-full border border-current border-dashed" />
              </span>
              All work items {visibleFlat.length}
              <button
                type="button"
                className="flex size-7 items-center justify-center rounded-md text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
                aria-label="Add work item"
                onClick={() => setSearchParams({ create: '1' })}
              >
                <IconPlus />
              </button>
            </h2>
          </div>

          {visibleFlat.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-4 py-12">
              <p className="text-sm text-(--txt-tertiary)">No work items match your filters.</p>
            </div>
          ) : !listDisplay.groupByState ? (
            <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1)">
              <ul className="divide-y divide-(--border-subtle)">{visibleFlat.map(renderIssueRow)}</ul>
              <div className="border-t border-(--border-subtle) px-4 py-2.5">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-sm font-medium text-(--txt-tertiary) transition-colors hover:text-(--txt-secondary)"
                  onClick={() => setSearchParams({ create: '1' })}
                >
                  <IconPlus />
                  New work item
                </button>
                <button
                  type="button"
                  className="mt-2 text-sm font-medium text-(--txt-tertiary) underline decoration-dotted hover:text-(--txt-secondary)"
                  onClick={() => setAddExistingOpen(true)}
                >
                  Add an existing work item
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedSections?.map((sec) => (
                <section key={sec.key} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <span
                      className="flex size-4 shrink-0 items-center justify-center rounded border border-(--border-subtle) border-dashed text-(--txt-icon-tertiary)"
                      aria-hidden
                    >
                      <span className="size-2 rounded-full border border-current border-dashed" />
                    </span>
                    <h3 className="text-sm font-semibold text-(--txt-primary)">
                      {sec.title}
                      <span className="ml-2 font-normal text-(--txt-tertiary)">{sec.items.length}</span>
                    </h3>
                  </div>
                  <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1)">
                    <ul className="divide-y divide-(--border-subtle)">{sec.items.map(renderIssueRow)}</ul>
                  </div>
                </section>
              ))}
              <div className="rounded-md border border-dashed border-(--border-subtle) bg-(--bg-surface-1) px-4 py-2.5">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-sm font-medium text-(--txt-tertiary) hover:text-(--txt-secondary)"
                  onClick={() => setSearchParams({ create: '1' })}
                >
                  <IconPlus />
                  New work item
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <AddExistingWorkItemModal
        open={addExistingOpen}
        onClose={() => setAddExistingOpen(false)}
        workspaceSlug={workspace.slug}
        projectId={project.id}
        moduleId={resolvedModuleId ?? ''}
        projectIdentifier={project.identifier ?? project.id.slice(0, 8)}
        onAdded={refetchIssues}
      />
      <CreateWorkItemModal
        open={createOpen}
        onClose={handleCloseCreate}
        workspaceSlug={workspace.slug}
        projects={projects}
        defaultProjectId={project.id}
        defaultModuleId={resolvedModuleId}
        onSave={handleCreateSave}
        createError={createError}
      />
    </div>
  );
}
