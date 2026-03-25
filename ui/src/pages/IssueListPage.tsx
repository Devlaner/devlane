import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Badge, Avatar, Button } from '../components/ui';
import { CreateWorkItemModal } from '../components/CreateWorkItemModal';
import { workspaceService } from '../services/workspaceService';
import { projectService } from '../services/projectService';
import { issueService } from '../services/issueService';
import { stateService } from '../services/stateService';
import { labelService } from '../services/labelService';
import { cycleService } from '../services/cycleService';
import { moduleService } from '../services/moduleService';
import type {
  WorkspaceApiResponse,
  ProjectApiResponse,
  IssueApiResponse,
  StateApiResponse,
  LabelApiResponse,
  WorkspaceMemberApiResponse,
  CycleApiResponse,
  ModuleApiResponse,
} from '../api/types';
import type { Priority } from '../types';
import type { StateGroup } from '../types/workspaceViewFilters';
import type { SavedViewDisplayPropertyId } from '../lib/projectSavedViewDisplay';
import { buildGroupedIssues } from '../lib/issueListGroupAndSort';
import {
  cloneDefaultProjectIssuesDisplay,
  fromDisplayPayload,
  type ProjectIssuesDisplayState,
} from '../lib/projectIssuesDisplay';
import {
  DEFAULT_PROJECT_ISSUES_FILTERS,
  PROJECT_ISSUES_DISPLAY_EVENT,
  PROJECT_ISSUES_FILTER_EVENT,
  type ProjectIssuesDisplayPayload,
  type ProjectIssuesFiltersState,
} from '../lib/projectIssuesEvents';
import { findWorkspaceMemberByUserId, getImageUrl, normalizeUuidKey } from '../lib/utils';

const priorityVariant: Record<Priority, 'danger' | 'warning' | 'default' | 'neutral'> = {
  urgent: 'danger',
  high: 'danger',
  medium: 'warning',
  low: 'default',
  none: 'neutral',
};

function issueMentionSearchBlob(issue: IssueApiResponse): string {
  const parts: string[] = [];
  if (issue.name) parts.push(issue.name);
  if (issue.description_html) parts.push(issue.description_html);
  if (issue.description && typeof issue.description === 'object') {
    try {
      parts.push(JSON.stringify(issue.description));
    } catch {
      /* non-serializable rich text */
    }
  }
  return parts.join('\n').toLowerCase();
}

/** Best-effort: match user id (or @-prefixed) in title / description HTML / JSON description. */
function issueMentionsUserId(issue: IssueApiResponse, userId: string): boolean {
  const blob = issueMentionSearchBlob(issue);
  if (!blob) return false;
  const u = userId.toLowerCase().trim();
  if (!u) return false;
  if (blob.includes(`@${u}`)) return true;
  return blob.includes(u);
}

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
const IconMoreVertical = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <circle cx="12" cy="5" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="12" cy="19" r="1.5" />
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

const IconLinkOut = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" x2="21" y1="14" y2="3" />
  </svg>
);

function formatShortDate(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleDateString();
}

export function IssueListPage() {
  const { workspaceSlug, projectId } = useParams<{
    workspaceSlug: string;
    projectId: string;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [issues, setIssues] = useState<IssueApiResponse[]>([]);
  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [labels, setLabels] = useState<LabelApiResponse[]>([]);
  const [cycles, setCycles] = useState<CycleApiResponse[]>([]);
  const [modules, setModules] = useState<ModuleApiResponse[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [createError, setCreateError] = useState<string | null>(null);
  const [listFilters, setListFilters] = useState<ProjectIssuesFiltersState>(() => ({
    ...DEFAULT_PROJECT_ISSUES_FILTERS,
  }));
  const [listDisplay, setListDisplay] = useState<ProjectIssuesDisplayState>(() =>
    cloneDefaultProjectIssuesDisplay(),
  );

  const refetchIssues = () => {
    if (!workspaceSlug || !projectId) return;
    issueService
      .list(workspaceSlug, projectId, { limit: 100 })
      .then(setIssues)
      .catch(() => {});
  };

  useEffect(() => {
    if (!workspaceSlug || !projectId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset loading when no slug/project (kept for future use)
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      workspaceService.getBySlug(workspaceSlug),
      projectService.get(workspaceSlug, projectId),
      projectService.list(workspaceSlug),
      issueService.list(workspaceSlug, projectId, { limit: 100 }),
      stateService.list(workspaceSlug, projectId),
      labelService.list(workspaceSlug, projectId),
      cycleService.list(workspaceSlug, projectId),
      moduleService.list(workspaceSlug, projectId),
      workspaceService.listMembers(workspaceSlug),
    ])
      .then(([w, p, list, iss, st, lab, cyc, mod, mem]) => {
        if (cancelled) return;
        setWorkspace(w);
        setProject(p);
        setProjects(list ?? []);
        setIssues(iss ?? []);
        setStates(st ?? []);
        setLabels(lab ?? []);
        setCycles(cyc ?? []);
        setModules(mod ?? []);
        setMembers(mem ?? []);
      })
      .catch(() => {
        if (!cancelled) setWorkspace(null);
        setProject(null);
        setProjects([]);
        setIssues([]);
        setStates([]);
        setLabels([]);
        setCycles([]);
        setModules([]);
        setMembers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId]);

  useLayoutEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{
        workspaceSlug: string;
        projectId: string;
        filters: ProjectIssuesFiltersState;
      }>;
      const d = ce.detail;
      if (!d || d.workspaceSlug !== workspaceSlug || d.projectId !== projectId) return;
      setListFilters({ ...DEFAULT_PROJECT_ISSUES_FILTERS, ...d.filters });
    };
    window.addEventListener(PROJECT_ISSUES_FILTER_EVENT, handler);
    return () => window.removeEventListener(PROJECT_ISSUES_FILTER_EVENT, handler);
  }, [workspaceSlug, projectId]);

  useLayoutEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{
        workspaceSlug: string;
        projectId: string;
        display: ProjectIssuesDisplayPayload;
      }>;
      const d = ce.detail;
      if (!d || d.workspaceSlug !== workspaceSlug || d.projectId !== projectId) return;
      setListDisplay(fromDisplayPayload(d.display));
    };
    window.addEventListener(PROJECT_ISSUES_DISPLAY_EVENT, handler);
    return () => window.removeEventListener(PROJECT_ISSUES_DISPLAY_EVENT, handler);
  }, [workspaceSlug, projectId]);

  const filteredIssues = useMemo(() => {
    const stateGroupMap: Record<string, StateGroup> = {
      backlog: 'backlog',
      unstarted: 'unstarted',
      started: 'started',
      completed: 'completed',
      canceled: 'canceled',
      cancelled: 'canceled',
    };
    const getStateGroup = (stateId: string | null | undefined): StateGroup | undefined => {
      if (!stateId) return undefined;
      const s = states.find((x) => x.id === stateId);
      const g = s?.group?.toLowerCase();
      return g ? stateGroupMap[g] : undefined;
    };

    let list = issues;
    if (listFilters.priorities.length) {
      list = list.filter((i) => {
        const p = (i.priority as Priority) ?? 'none';
        return listFilters.priorities.includes(p);
      });
    }
    if (listFilters.stateGroups.length) {
      list = list.filter((i) => {
        const g = getStateGroup(i.state_id ?? undefined);
        return g && listFilters.stateGroups.includes(g);
      });
    }
    if (listFilters.assigneeIds.length) {
      list = list.filter((i) =>
        i.assignee_ids?.some((aid) =>
          listFilters.assigneeIds.some((fid) => normalizeUuidKey(fid) === normalizeUuidKey(aid)),
        ),
      );
    }
    if (listFilters.createdByIds.length) {
      list = list.filter((i) =>
        listFilters.createdByIds.some(
          (fid) => normalizeUuidKey(fid) === normalizeUuidKey(i.created_by_id),
        ),
      );
    }
    if (listFilters.cycleIds.length) {
      list = list.filter((i) =>
        i.cycle_ids?.some((cid) =>
          listFilters.cycleIds.some((fid) => normalizeUuidKey(fid) === normalizeUuidKey(cid)),
        ),
      );
    }
    if (listFilters.labelIds.length) {
      list = list.filter((i) =>
        i.label_ids?.some((lid) =>
          listFilters.labelIds.some((fid) => normalizeUuidKey(fid) === normalizeUuidKey(lid)),
        ),
      );
    }
    if (listFilters.mentionedUserIds.length) {
      list = list.filter((i) =>
        listFilters.mentionedUserIds.some((uid) => issueMentionsUserId(i, uid)),
      );
    }
    if (listFilters.workItemGrouping === 'active') {
      list = list.filter((i) => {
        const g = getStateGroup(i.state_id ?? undefined);
        return g === 'unstarted' || g === 'started';
      });
    } else if (listFilters.workItemGrouping === 'backlog') {
      list = list.filter((i) => getStateGroup(i.state_id ?? undefined) === 'backlog');
    }
    const now = new Date();
    const addDays = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
    const startDateEffective =
      listFilters.startDate.length &&
      !(
        listFilters.startDate.includes('custom') &&
        (!listFilters.startAfter || !listFilters.startBefore)
      );
    if (startDateEffective) {
      list = list.filter((i) => {
        const sd = i.start_date ? new Date(i.start_date) : null;
        if (!sd) return false;
        return listFilters.startDate.some((preset) => {
          if (preset === 'custom' && listFilters.startAfter && listFilters.startBefore) {
            const after = new Date(listFilters.startAfter);
            const before = new Date(listFilters.startBefore);
            return sd >= after && sd <= before;
          }
          if (preset === 'custom') return false;
          const end =
            preset === '1_week'
              ? addDays(7)
              : preset === '2_weeks'
                ? addDays(14)
                : preset === '1_month'
                  ? addDays(30)
                  : preset === '2_months'
                    ? addDays(60)
                    : null;
          return Boolean(end && sd >= now && sd <= end);
        });
      });
    }
    const dueDateEffective =
      listFilters.dueDate.length &&
      !(
        listFilters.dueDate.includes('custom') &&
        (!listFilters.dueAfter || !listFilters.dueBefore)
      );
    if (dueDateEffective) {
      list = list.filter((i) => {
        const td = i.target_date ? new Date(i.target_date) : null;
        if (!td) return false;
        return listFilters.dueDate.some((preset) => {
          if (preset === 'custom' && listFilters.dueAfter && listFilters.dueBefore) {
            const after = new Date(listFilters.dueAfter);
            const before = new Date(listFilters.dueBefore);
            return td >= after && td <= before;
          }
          if (preset === 'custom') return false;
          const end =
            preset === '1_week'
              ? addDays(7)
              : preset === '2_weeks'
                ? addDays(14)
                : preset === '1_month'
                  ? addDays(30)
                  : preset === '2_months'
                    ? addDays(60)
                    : null;
          return Boolean(end && td >= now && td <= end);
        });
      });
    }
    return list;
  }, [issues, states, listFilters]);

  const subWorkCountByParentId = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of issues) {
      const pid = i.parent_id?.trim();
      if (!pid) continue;
      m.set(pid, (m.get(pid) ?? 0) + 1);
    }
    return m;
  }, [issues]);

  const baseForGrouping = useMemo(() => {
    let list = filteredIssues;
    if (!listDisplay.showSubWorkItems) {
      list = list.filter((i) => !i.parent_id?.trim());
    }
    return list;
  }, [filteredIssues, listDisplay.showSubWorkItems]);

  const groupedIssues = useMemo(
    () =>
      buildGroupedIssues({
        baseForGrouping,
        groupBy: listDisplay.groupBy,
        orderBy: listDisplay.orderBy,
        showEmptyGroups: listDisplay.showEmptyGroups,
        states,
        cycles,
        modules,
        labels,
        members,
      }),
    [
      baseForGrouping,
      listDisplay.groupBy,
      listDisplay.orderBy,
      listDisplay.showEmptyGroups,
      states,
      cycles,
      modules,
      labels,
      members,
    ],
  );

  const getStateName = (stateId: string | null | undefined) =>
    stateId ? (states.find((s) => s.id === stateId)?.name ?? stateId) : '—';
  const getLabelNames = (labelIds: string[] = []) =>
    labelIds
      .map((id) => labels.find((l) => l.id === id)?.name)
      .filter((name): name is string => Boolean(name));
  const getUser = (userId: string | null) => {
    if (!userId) return null;
    const m = findWorkspaceMemberByUserId(members, userId);
    const display = m?.member_display_name?.trim() ?? '';
    const emailUser = m?.member_email?.trim().split('@')[0]?.trim() ?? '';
    const name = display !== '' ? display : emailUser !== '' ? emailUser : userId.slice(0, 8);
    const raw = m?.member_avatar?.trim();
    const avatarUrl = raw ? raw : null;
    return { id: userId, name, avatarUrl };
  };

  const createParam = searchParams.get('create') === '1';

  useEffect(() => {
    if (createParam && projectId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: open create modal from URL (kept for future use)
      setCreateOpen(true);
    }
  }, [createParam, projectId]);

  const handleCloseCreate = () => {
    setCreateOpen(false);
    setCreateError(null);
    searchParams.delete('create');
    setSearchParams(searchParams, { replace: true });
  };

  const handleCreateSave = async (data: {
    title: string;
    description?: string;
    projectId: string;
    stateId?: string;
    priority?: import('../types').Priority;
    assigneeIds?: string[];
    labelIds?: string[];
    startDate?: string;
    dueDate?: string;
    cycleId?: string | null;
    moduleId?: string | null;
    parentId?: string | null;
  }) => {
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
        if (data.cycleId) {
          await cycleService.addIssue(workspaceSlug, data.projectId, data.cycleId, created.id);
        }
        if (data.moduleId) {
          await moduleService.addIssue(workspaceSlug, data.projectId, data.moduleId, created.id);
        }
      }
      refetchIssues();
      handleCloseCreate();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create work item');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-(--txt-tertiary)">
        Loading…
      </div>
    );
  }
  if (!workspace || !project) {
    return <div className="text-(--txt-secondary)">Project not found.</div>;
  }

  const baseUrl = `/${workspace.slug}/projects/${project.id}`;
  const dp = listDisplay.displayProperties;
  const hasCol = (id: SavedViewDisplayPropertyId) => dp.has(id);

  const cycleName = (issue: IssueApiResponse) => {
    const id = issue.cycle_ids?.[0];
    return id ? (cycles.find((c) => c.id === id)?.name ?? '—') : '—';
  };

  const moduleName = (issue: IssueApiResponse) => {
    const id = issue.module_ids?.[0];
    return id ? (modules.find((m) => m.id === id)?.name ?? '—') : '—';
  };

  const renderIssueRow = (issue: IssueApiResponse) => {
    const primaryAssigneeId =
      issue.assignee_ids && issue.assignee_ids.length > 0 ? issue.assignee_ids[0] : null;
    const assignee = getUser(primaryAssigneeId);
    const labelNames = getLabelNames(issue.label_ids ?? []);
    const displayId = `${project.identifier ?? project.id.slice(0, 8)}-${issue.sequence_id ?? issue.id.slice(-4)}`;
    const startStr = formatShortDate(issue.start_date);
    const dueStr = formatShortDate(issue.target_date);
    const subN = subWorkCountByParentId.get(issue.id) ?? 0;
    const issueUrl = `${baseUrl}/issues/${issue.id}`;

    return (
      <li key={issue.id}>
        <Link
          to={issueUrl}
          className="flex min-h-12 items-center gap-3 px-4 py-2.5 no-underline transition-colors hover:bg-(--bg-layer-1-hover)"
        >
          <span className="min-w-0 flex-1 truncate text-sm">
            {hasCol('id') ? (
              <>
                <span className="font-medium text-(--txt-accent-primary)">{displayId}</span>
                <span className="ml-2 text-(--txt-primary)">{issue.name}</span>
              </>
            ) : (
              <span className="text-(--txt-primary)">{issue.name}</span>
            )}
          </span>
          <div className="flex shrink-0 flex-wrap items-center gap-2 text-(--txt-icon-tertiary)">
            {hasCol('state') ? (
              <span title={getStateName(issue.state_id ?? undefined)}>
                <Badge variant="neutral" className="text-xs font-medium">
                  {getStateName(issue.state_id ?? undefined)}
                </Badge>
              </span>
            ) : null}
            {hasCol('priority') ? (
              <span
                title={issue.priority ?? ''}
                className="flex size-6 items-center justify-center"
              >
                <Badge
                  variant={priorityVariant[(issue.priority as Priority) ?? 'none']}
                  className="!px-1.5 !py-0 text-[10px]"
                >
                  {issue.priority ?? '—'}
                </Badge>
              </span>
            ) : null}
            {hasCol('start_date') ? (
              <span
                className="max-w-[4.5rem] truncate text-[11px] text-(--txt-secondary)"
                title={issue.start_date ?? ''}
              >
                {startStr ?? '—'}
              </span>
            ) : null}
            {hasCol('due_date') ? (
              <span
                className="flex size-6 items-center justify-center"
                title={dueStr ?? 'Due date'}
              >
                <IconCalendar />
              </span>
            ) : null}
            {hasCol('assignee') ? (
              <span
                className="flex size-6 items-center justify-center"
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
            {hasCol('labels') ? (
              <span
                className="flex size-6 items-center justify-center"
                title={labelNames.length ? labelNames.join(', ') : 'Labels'}
              >
                {labelNames.length > 0 ? (
                  <IconTag />
                ) : (
                  <span className="opacity-40">
                    <IconTag />
                  </span>
                )}
              </span>
            ) : null}
            {hasCol('sub_work_count') ? (
              <span
                className="min-w-6 text-center text-[11px] text-(--txt-secondary)"
                title="Sub-work items"
              >
                {subN}
              </span>
            ) : null}
            {hasCol('attachment_count') ? (
              <span
                className="min-w-6 text-center text-[11px] text-(--txt-secondary)"
                title="Attachments"
              >
                —
              </span>
            ) : null}
            {hasCol('estimate') ? (
              <span className="text-[11px] text-(--txt-secondary)">—</span>
            ) : null}
            {hasCol('module') ? (
              <span
                className="max-w-[5rem] truncate text-[11px] text-(--txt-secondary)"
                title="Module"
              >
                {moduleName(issue)}
              </span>
            ) : null}
            {hasCol('cycle') ? (
              <span
                className="max-w-[5rem] truncate text-[11px] text-(--txt-secondary)"
                title="Cycle"
              >
                {cycleName(issue)}
              </span>
            ) : null}
            {hasCol('link') ? (
              <a
                href={issueUrl}
                target="_blank"
                rel="noreferrer"
                className="flex size-6 items-center justify-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
                title="Open in new tab"
                onClick={(e) => e.stopPropagation()}
              >
                <IconLinkOut />
              </a>
            ) : null}
            <span className="flex size-6 items-center justify-center" title="Visibility">
              <IconEye />
            </span>
            <button
              type="button"
              className="flex size-6 items-center justify-center rounded hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
              aria-label="More options"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <IconMoreVertical />
            </button>
          </div>
        </Link>
      </li>
    );
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-4 border-b border-(--border-subtle) px-4 py-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-(--txt-primary)">
          <span
            className="flex size-4 shrink-0 items-center justify-center rounded border border-(--border-subtle) border-dashed text-(--txt-icon-tertiary)"
            aria-hidden
          >
            <span className="size-2 rounded-full border border-current border-dashed" />
          </span>
          All work items {filteredIssues.length}
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

      {issues.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 px-4 py-12">
          <p className="text-sm text-(--txt-tertiary)">No work items yet.</p>
          <Button size="sm" className="gap-1.5" onClick={() => setSearchParams({ create: '1' })}>
            <IconPlus />
            New work item
          </Button>
        </div>
      ) : filteredIssues.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 px-4 py-12">
          <p className="text-sm text-(--txt-tertiary)">No work items match your filters.</p>
        </div>
      ) : (
        <>
          {groupedIssues.isFlat ? (
            <ul className="w-full divide-y divide-(--border-subtle)">
              {(groupedIssues.groups.get(groupedIssues.order[0]) ?? []).map((issue) =>
                renderIssueRow(issue),
              )}
            </ul>
          ) : (
            <div className="space-y-6 px-4 py-4">
              {groupedIssues.order.map((sectionKey) => {
                const sectionIssues = groupedIssues.groups.get(sectionKey) ?? [];
                if (sectionIssues.length === 0 && !listDisplay.showEmptyGroups) return null;
                const title = groupedIssues.title(sectionKey);
                return (
                  <section key={sectionKey} className="space-y-2">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-(--txt-primary)">
                      {title}
                      <span className="font-normal text-(--txt-tertiary)">
                        {sectionIssues.length}
                      </span>
                    </h3>
                    <ul className="w-full divide-y divide-(--border-subtle) rounded-md border border-(--border-subtle) bg-(--bg-surface-1)">
                      {sectionIssues.map((issue) => renderIssueRow(issue))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
          <div className="border-t border-(--border-subtle) px-4 py-2.5">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-md border border-dashed border-(--border-subtle) bg-transparent px-3 py-2 text-sm font-medium text-(--txt-secondary) hover:border-(--border-strong) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
              onClick={() => setSearchParams({ create: '1' })}
            >
              <IconPlus />
              New work item
            </button>
          </div>
        </>
      )}

      <CreateWorkItemModal
        open={createOpen}
        onClose={handleCloseCreate}
        workspaceSlug={workspace.slug}
        projects={projects}
        defaultProjectId={project.id}
        onSave={handleCreateSave}
        createError={createError}
      />
    </div>
  );
}
