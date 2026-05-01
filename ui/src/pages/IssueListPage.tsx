import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui';
import { CreateWorkItemModal } from '../components/CreateWorkItemModal';
import { workspaceService } from '../services/workspaceService';
import { projectService } from '../services/projectService';
import { issueService } from '../services/issueService';
import { stateService } from '../services/stateService';
import { labelService } from '../services/labelService';
import { cycleService } from '../services/cycleService';
import { moduleService } from '../services/moduleService';
import { integrationService } from '../services/integrationService';
import { IssueLayoutList } from '../components/work-item/layouts/IssueLayoutList';
import { IssueLayoutBoard } from '../components/work-item/layouts/IssueLayoutBoard';
import { IssueLayoutSpreadsheet } from '../components/work-item/layouts/IssueLayoutSpreadsheet';
import { IssueLayoutCalendar } from '../components/work-item/layouts/IssueLayoutCalendar';
import { IssueLayoutGantt } from '../components/work-item/layouts/IssueLayoutGantt';
import { parseIssueLayout } from '../components/work-item/layouts/IssueLayoutTypes';
import type {
  WorkspaceApiResponse,
  ProjectApiResponse,
  IssueApiResponse,
  StateApiResponse,
  LabelApiResponse,
  WorkspaceMemberApiResponse,
  CycleApiResponse,
  ModuleApiResponse,
  GitHubIssueSummaryEntry,
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
import { normalizeUuidKey } from '../lib/utils';

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
  const [prSummary, setPrSummary] = useState<Record<string, GitHubIssueSummaryEntry>>({});
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

  // Bulk-fetch GitHub PR summaries for the loaded issues. Re-runs when the
  // set of issue IDs changes (stable join key). The service short-circuits to
  // {} for an empty list, and a 404 (no integration / project not linked)
  // also collapses to "no badges" silently.
  const issueIDsKey = useMemo(
    () =>
      issues
        .map((i) => i.id)
        .sort()
        .join(','),
    [issues],
  );
  useEffect(() => {
    if (!workspaceSlug || !projectId) return;
    let cancelled = false;
    const ids = issueIDsKey ? issueIDsKey.split(',') : [];
    integrationService
      .githubIssueSummary(workspaceSlug, projectId, ids)
      .then((map) => {
        if (!cancelled) setPrSummary(map);
      })
      .catch(() => {
        if (!cancelled) setPrSummary({});
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, issueIDsKey]);

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

  // Stable "now" timestamp used by overdue/relative-date cells. Sampled once
  // at mount via useState's lazy initializer (allowed to be impure) so each
  // row stays pure for the rest of the render-tree's lifetime.
  const [now] = useState(() => Date.now());

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
    isDraft?: boolean;
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
        is_draft: data.isDraft === true ? true : undefined,
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

  const layout = parseIssueLayout(searchParams.get('layout'));
  const issueHref = (id: string) => `${baseUrl}/issues/${id}`;
  const layoutProps = {
    workspaceSlug: workspace.slug,
    project,
    issues: groupedIssues.isFlat
      ? (groupedIssues.groups.get(groupedIssues.order[0]) ?? [])
      : filteredIssues,
    states,
    labels,
    members,
    prSummary,
    baseUrl,
    issueHref,
    now,
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
          {layout === 'list' && (
            <IssueLayoutList
              {...layoutProps}
              groupedIssues={groupedIssues}
              hasCol={hasCol}
              showEmptyGroups={listDisplay.showEmptyGroups}
              subWorkCountByParentId={subWorkCountByParentId}
              cycleName={cycleName}
              moduleName={moduleName}
            />
          )}
          {layout === 'board' && <IssueLayoutBoard {...layoutProps} />}
          {layout === 'spreadsheet' && <IssueLayoutSpreadsheet {...layoutProps} />}
          {layout === 'calendar' && <IssueLayoutCalendar {...layoutProps} />}
          {layout === 'gantt' && <IssueLayoutGantt {...layoutProps} />}
          {layout === 'list' && (
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
          )}
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
