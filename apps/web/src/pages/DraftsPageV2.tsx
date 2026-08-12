import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  CalendarDays,
  Copy,
  FileText,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Send,
  Signal,
  Tag,
  Trash2,
  User,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/shadcn/ui/avatar';
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
import { Skeleton } from '@/components/shadcn/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/ui/table';
import { CreateWorkItemDialog } from '@/components/shadcn/create-work-item-dialog';
import type { WorkItemInitialValues } from '../components/CreateWorkItemModal';
import { useAuth } from '../contexts/AuthContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { getImageUrl } from '../lib/utils';
import { cycleService } from '../services/cycleService';
import { issueService } from '../services/issueService';
import { labelService } from '../services/labelService';
import { moduleService } from '../services/moduleService';
import { projectService } from '../services/projectService';
import { stateService } from '../services/stateService';
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

const PAGE_SIZE = 50;

const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low', 'none'];

/** Key + sequence (e.g. LOGI1). Never use placeholder em-dashes for the key. */
function projectIssueKey(proj: ProjectApiResponse | undefined, issue: IssueApiResponse): string {
  const raw = proj?.identifier?.trim();
  if (raw && raw.length > 0) return raw.toUpperCase();
  const name = proj?.name?.trim() ?? '';
  const letters = name.replace(/[^a-zA-Z0-9]/g, '');
  if (letters.length >= 4) return letters.slice(0, 4).toUpperCase();
  if (letters.length > 0) return letters.toUpperCase().padEnd(4, 'X').slice(0, 4);
  const idPart = (issue.project_id || '').replace(/-/g, '');
  return (idPart.slice(0, 4) || 'ITEM').toUpperCase();
}

function draftDisplayId(proj: ProjectApiResponse | undefined, issue: IssueApiResponse): string {
  const key = projectIssueKey(proj, issue);
  const seq = issue.sequence_id;
  return seq != null ? `${key}${seq}` : key;
}

/**
 * Design preview of the workspace drafts page, built from shadcn primitives. It
 * stands alongside DraftsPage rather than replacing it, so the two can be
 * compared side by side.
 *
 * Data loading, inline property editing, publish, duplicate and delete mirror
 * the shipped page — only the chrome differs: the row of ad-hoc property
 * buttons becomes a spreadsheet-style table, search, project filter and the
 * create action move into the shell's header (DraftsToolbar), and the composer
 * is the v2 CreateWorkItemDialog.
 */
export function DraftsPageV2() {
  const { t } = useTranslation();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: currentUser } = useAuth();

  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [drafts, setDrafts] = useState<IssueApiResponse[]>([]);
  const [statesByProject, setStatesByProject] = useState<Map<string, StateApiResponse[]>>(
    new Map(),
  );
  const [labelsByProject, setLabelsByProject] = useState<Map<string, LabelApiResponse[]>>(
    new Map(),
  );
  const [modulesByProject, setModulesByProject] = useState<Map<string, ModuleApiResponse[]>>(
    new Map(),
  );
  const [cyclesByProject, setCyclesByProject] = useState<Map<string, CycleApiResponse[]>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingIssueId, setEditingIssueId] = useState<string | null>(null);
  const [modalInitialValues, setModalInitialValues] = useState<WorkItemInitialValues | undefined>();
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  useDocumentTitle(t('drafts.documentTitle', 'Drafts'));

  const query = searchParams.get('q') ?? '';
  const projectFilter = useMemo(
    () => (searchParams.get('project') ?? '').split(',').filter(Boolean),
    [searchParams],
  );

  const projectById = useMemo(() => {
    const m = new Map<string, ProjectApiResponse>();
    for (const p of projects) m.set(p.id, p);
    return m;
  }, [projects]);

  const memberMap = useMemo(() => new Map(members.map((m) => [m.member_id, m])), [members]);

  const projectIdsKey = useMemo(
    () => [...new Set(drafts.map((d) => d.project_id))].sort().join(','),
    [drafts],
  );

  /* Drafts span every project, so the property options each row's dropdowns
     offer are gathered per project rather than once for the workspace. */
  useEffect(() => {
    if (!workspaceSlug || !projectIdsKey) {
      setStatesByProject(new Map());
      setLabelsByProject(new Map());
      setModulesByProject(new Map());
      setCyclesByProject(new Map());
      return;
    }
    const ids = projectIdsKey.split(',').filter(Boolean);
    let cancelled = false;
    Promise.all(
      ids.map(async (pid) => {
        const [states, labels, modules, cycles] = await Promise.all([
          stateService.list(workspaceSlug, pid),
          labelService.list(workspaceSlug, pid),
          moduleService.list(workspaceSlug, pid),
          cycleService.list(workspaceSlug, pid),
        ]);
        return { pid, states, labels, modules, cycles };
      }),
    )
      .then((rows) => {
        if (cancelled) return;
        const sm = new Map<string, StateApiResponse[]>();
        const lm = new Map<string, LabelApiResponse[]>();
        const mm = new Map<string, ModuleApiResponse[]>();
        const cm = new Map<string, CycleApiResponse[]>();
        for (const { pid, states, labels, modules, cycles } of rows) {
          sm.set(pid, states ?? []);
          lm.set(pid, labels ?? []);
          mm.set(pid, modules ?? []);
          cm.set(pid, cycles ?? []);
        }
        setStatesByProject(sm);
        setLabelsByProject(lm);
        setModulesByProject(mm);
        setCyclesByProject(cm);
      })
      .catch(() => {
        if (!cancelled) {
          setStatesByProject(new Map());
          setLabelsByProject(new Map());
          setModulesByProject(new Map());
          setCyclesByProject(new Map());
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectIdsKey]);

  const loadDrafts = useCallback(
    async (reset: boolean) => {
      if (!workspaceSlug) return;
      const nextOffset = reset ? 0 : offset;
      if (reset) setListLoading(true);
      setError(null);
      try {
        const batch = await issueService.listWorkspaceDrafts(workspaceSlug, {
          limit: PAGE_SIZE + 1,
          offset: nextOffset,
        });
        const more = batch.length > PAGE_SIZE;
        const slice = more ? batch.slice(0, PAGE_SIZE) : batch;
        setDrafts((prev) => (reset ? slice : [...prev, ...slice]));
        setHasMore(more);
        setOffset(nextOffset + slice.length);
        setError(null);
      } catch {
        if (reset) setDrafts([]);
        setError(t('drafts.loadError', 'Could not load drafts.'));
      } finally {
        if (reset) setListLoading(false);
      }
    },
    [workspaceSlug, offset, t],
  );

  useEffect(() => {
    if (!workspaceSlug) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      workspaceService.getBySlug(workspaceSlug),
      projectService.list(workspaceSlug),
      workspaceService.listMembers(workspaceSlug),
    ])
      .then(([w, plist, mems]) => {
        if (cancelled) return;
        setWorkspace(w ?? null);
        setProjects(plist ?? []);
        setMembers(mems ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setWorkspace(null);
          setProjects([]);
          setMembers([]);
          setError(t('drafts.loadWorkspaceError', 'Could not load workspace.'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, t]);

  useEffect(() => {
    if (!workspaceSlug || !workspace) return;
    void loadDrafts(true);
    /* loadDrafts changes with every offset write, which would refetch the first
       page after each "load more". The first page is wanted per workspace. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceSlug, workspace]);

  /* The toolbar's create button writes `?create=1`, matching how the shipped
     page is deep-linked into the composer. */
  useEffect(() => {
    if (searchParams.get('create') === '1') setCreateOpen(true);
  }, [searchParams]);

  const clearCreateParam = useCallback(() => {
    if (searchParams.get('create') !== '1') return;
    const next = new URLSearchParams(searchParams);
    next.delete('create');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const handlePatch = async (issue: IssueApiResponse, payload: Record<string, unknown>) => {
    if (!workspaceSlug) return;
    setRowBusy(issue.id);
    try {
      const updated = await issueService.update(
        workspaceSlug,
        issue.project_id,
        issue.id,
        payload as Parameters<typeof issueService.update>[3],
      );
      setDrafts((prev) => prev.map((i) => (i.id === issue.id ? { ...i, ...updated } : i)));
    } catch {
      setError(t('drafts.updateError', 'Could not update draft.'));
    } finally {
      setRowBusy(null);
    }
  };

  /* Modules and cycles are membership rather than fields: the old one is
     removed before the new one is added, then the issue is re-read so the
     row shows what the server actually recorded. */
  const handleModuleChange = async (issue: IssueApiResponse, moduleId: string | null) => {
    if (!workspaceSlug) return;
    const cur = issue.module_ids?.[0] ?? null;
    if (cur === moduleId) return;
    setRowBusy(issue.id);
    try {
      if (cur) await moduleService.removeIssue(workspaceSlug, issue.project_id, cur, issue.id);
      if (moduleId) {
        await moduleService.addIssue(workspaceSlug, issue.project_id, moduleId, issue.id);
      }
      const fresh = await issueService.get(workspaceSlug, issue.project_id, issue.id);
      setDrafts((prev) => prev.map((i) => (i.id === issue.id ? { ...i, ...fresh } : i)));
    } catch {
      setError(t('drafts.updateModuleError', 'Could not update module.'));
    } finally {
      setRowBusy(null);
    }
  };

  const handleCycleChange = async (issue: IssueApiResponse, cycleId: string | null) => {
    if (!workspaceSlug) return;
    const cur = issue.cycle_ids?.[0] ?? null;
    if (cur === cycleId) return;
    setRowBusy(issue.id);
    try {
      if (cur) await cycleService.removeIssue(workspaceSlug, issue.project_id, cur, issue.id);
      if (cycleId) {
        await cycleService.addIssue(workspaceSlug, issue.project_id, cycleId, issue.id);
      }
      const fresh = await issueService.get(workspaceSlug, issue.project_id, issue.id);
      setDrafts((prev) => prev.map((i) => (i.id === issue.id ? { ...i, ...fresh } : i)));
    } catch {
      setError(t('drafts.updateCycleError', 'Could not update cycle.'));
    } finally {
      setRowBusy(null);
    }
  };

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
    isDraft?: boolean;
  }) => {
    if (!workspaceSlug || !data.title.trim()) return;
    setCreateError(null);
    try {
      if (editingIssueId) {
        const existing = drafts.find((d) => d.id === editingIssueId);
        if (existing) {
          await issueService.update(workspaceSlug, existing.project_id, editingIssueId, {
            name: data.title.trim(),
            description: data.description || undefined,
            state_id: data.stateId || undefined,
            priority: data.priority || undefined,
            assignee_ids: data.assigneeIds?.length ? data.assigneeIds : [],
            label_ids: data.labelIds?.length ? data.labelIds : [],
            start_date: data.startDate || null,
            target_date: data.dueDate || null,
            parent_id: data.parentId || null,
          });
        }
      } else {
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
      }
      /* Whether the dialog closes is its own call — "create more" keeps it
         open — so this only clears what an edit or duplicate flow set up. */
      setEditingIssueId(null);
      setModalInitialValues(undefined);
      clearCreateParam();
      await loadDrafts(true);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : t('drafts.saveFailed', 'Failed to save draft.'),
      );
    }
  };

  const handlePublish = async (issue: IssueApiResponse) => {
    if (!workspaceSlug) return;
    setRowBusy(issue.id);
    try {
      await issueService.update(workspaceSlug, issue.project_id, issue.id, { is_draft: false });
      setDrafts((prev) => prev.filter((i) => i.id !== issue.id));
    } catch {
      setError(t('drafts.publishError', 'Could not publish draft.'));
    } finally {
      setRowBusy(null);
    }
  };

  const handleDelete = async (issue: IssueApiResponse) => {
    if (!workspaceSlug) return;
    if (
      !window.confirm(t('drafts.deleteConfirm', 'Delete draft “{{name}}”?', { name: issue.name }))
    )
      return;
    setRowBusy(issue.id);
    try {
      await issueService.delete(workspaceSlug, issue.project_id, issue.id);
      setDrafts((prev) => prev.filter((i) => i.id !== issue.id));
    } catch {
      setError(t('drafts.deleteError', 'Could not delete draft.'));
    } finally {
      setRowBusy(null);
    }
  };

  const issueToInitialValues = (issue: IssueApiResponse): WorkItemInitialValues => ({
    title: issue.name,
    description: issue.description_html ?? '',
    projectId: issue.project_id,
    stateId: issue.state_id ?? undefined,
    priority: (issue.priority as Priority) ?? undefined,
    assigneeIds: issue.assignee_ids ?? [],
    labelIds: issue.label_ids ?? [],
    startDate: issue.start_date?.slice(0, 10) ?? undefined,
    dueDate: issue.target_date?.slice(0, 10) ?? undefined,
    cycleId: issue.cycle_ids?.[0] ?? null,
    moduleId: issue.module_ids?.[0] ?? null,
    parentId: issue.parent_id ?? null,
  });

  const handleEdit = (issue: IssueApiResponse) => {
    setEditingIssueId(issue.id);
    setModalInitialValues(issueToInitialValues(issue));
    setCreateOpen(true);
  };

  const handleDuplicate = (issue: IssueApiResponse) => {
    setEditingIssueId(null);
    setModalInitialValues({
      ...issueToInitialValues(issue),
      title: t('drafts.copySuffix', '{{name}} (copy)', { name: issue.name }),
    });
    setCreateOpen(true);
  };

  /* Search and the project filter are applied here rather than in the request:
     the drafts endpoint takes only limit and offset. */
  const visibleDrafts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return drafts.filter((issue) => {
      if (projectFilter.length && !projectFilter.includes(issue.project_id)) return false;
      if (!needle) return true;
      const proj = projectById.get(issue.project_id);
      return (
        issue.name?.toLowerCase().includes(needle) ||
        draftDisplayId(proj, issue).toLowerCase().includes(needle)
      );
    });
  }, [drafts, query, projectFilter, projectById]);

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

  if (!workspaceSlug || !workspace) {
    return (
      <p className="text-muted-foreground text-sm">
        {t('common.workspaceNotFound', 'Workspace not found.')}
      </p>
    );
  }

  const base = `/${workspace.slug}`;

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center">
        <FolderPlus className="text-muted-foreground size-10" strokeWidth={1.25} />
        <p className="font-medium">{t('drafts.noProjects', 'No projects yet')}</p>
        <p className="text-muted-foreground max-w-md text-sm">
          {t(
            'drafts.noProjectsHint',
            'Create a project in this workspace before you can add draft work items.',
          )}
        </p>
        <Button asChild>
          <Link to={`${base}/app-v2/projects`}>{t('drafts.createProject', 'Create project')}</Link>
        </Button>
      </div>
    );
  }

  const cellTriggerClass =
    'hover:bg-muted/50 flex h-11 w-full items-center gap-2 rounded-none px-3 text-left text-sm font-normal';

  const renderPriorityCell = (issue: IssueApiResponse) => {
    const value = (issue.priority ?? 'none') as Priority;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={rowBusy === issue.id}>
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
            onValueChange={(next) => void handlePatch(issue, { priority: next })}
          >
            {PRIORITIES.map((priority) => (
              <DropdownMenuRadioItem key={priority} value={priority} className="capitalize">
                {priority}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const renderStateCell = (issue: IssueApiResponse) => {
    const states = statesByProject.get(issue.project_id) ?? [];
    const current = states.find((s) => s.id === issue.state_id);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={rowBusy === issue.id}>
          <Button type="button" variant="ghost" className={cellTriggerClass}>
            <span
              className="size-2.5 shrink-0 rounded-full border"
              style={current?.color ? { backgroundColor: current.color } : undefined}
            />
            <span className={current ? 'truncate' : 'text-muted-foreground truncate'}>
              {current?.name ?? t('views.state', 'State')}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
          {states.length === 0 ? (
            <DropdownMenuLabel className="text-muted-foreground font-normal">
              {t('drafts.noStates', 'No states.')}
            </DropdownMenuLabel>
          ) : (
            <DropdownMenuRadioGroup
              value={issue.state_id ?? ''}
              onValueChange={(next) => void handlePatch(issue, { state_id: next })}
            >
              {states.map((state) => (
                <DropdownMenuRadioItem key={state.id} value={state.id}>
                  {state.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const renderAssigneeCell = (issue: IssueApiResponse) => {
    const assigneeIds = issue.assignee_ids ?? [];
    const assignee = assigneeIds[0] ? memberMap.get(assigneeIds[0]) : undefined;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={rowBusy === issue.id}>
          <Button type="button" variant="ghost" className={cellTriggerClass}>
            {assignee ? (
              <>
                <Avatar className="size-6">
                  <AvatarImage
                    src={getImageUrl(assignee.member_avatar) ?? ''}
                    alt={assignee.member_display_name ?? ''}
                  />
                  <AvatarFallback className="text-[10px]">{memberInitial(assignee)}</AvatarFallback>
                </Avatar>
                <span className="truncate">{memberLabel(assignee.member_id)}</span>
                {assigneeIds.length > 1 && (
                  <Badge variant="secondary" className="ml-1">
                    +{assigneeIds.length - 1}
                  </Badge>
                )}
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
                void handlePatch(issue, {
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
  };

  const renderLabelsCell = (issue: IssueApiResponse) => {
    const labels = labelsByProject.get(issue.project_id) ?? [];
    const labelIds = issue.label_ids ?? [];
    const first = labelIds[0] ? labels.find((l) => l.id === labelIds[0]) : undefined;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={rowBusy === issue.id}>
          <Button type="button" variant="ghost" className={cellTriggerClass}>
            {first ? (
              <>
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: first.color ?? 'currentColor' }}
                />
                <span className="truncate">{first.name}</span>
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
                  void handlePatch(issue, {
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
  };

  /** Modules and cycles share a shape: single-select, clearable membership. */
  const renderMembershipCell = (issue: IssueApiResponse, kind: 'module' | 'cycle') => {
    const options =
      kind === 'module'
        ? (modulesByProject.get(issue.project_id) ?? [])
        : (cyclesByProject.get(issue.project_id) ?? []);
    const currentId = (kind === 'module' ? issue.module_ids?.[0] : issue.cycle_ids?.[0]) ?? null;
    const current = options.find((o) => o.id === currentId);
    const placeholder =
      kind === 'module'
        ? t('views.selectModules', 'Select modules')
        : t('views.selectCycle', 'Select cycle');
    const apply = (next: string | null) =>
      kind === 'module' ? handleModuleChange(issue, next) : handleCycleChange(issue, next);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={rowBusy === issue.id}>
          <Button type="button" variant="ghost" className={cellTriggerClass}>
            <span className={current ? 'truncate' : 'text-muted-foreground truncate'}>
              {current?.name ?? placeholder}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
          {options.length === 0 ? (
            <DropdownMenuLabel className="text-muted-foreground font-normal">
              {placeholder}
            </DropdownMenuLabel>
          ) : (
            <>
              {options.map((option) => (
                <DropdownMenuItem key={option.id} onSelect={() => void apply(option.id)}>
                  {option.name}
                </DropdownMenuItem>
              ))}
              {currentId && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void apply(null)}>
                    {t('common.clear', 'Clear')}
                  </DropdownMenuItem>
                </>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const renderDateCell = (issue: IssueApiResponse, kind: 'start' | 'due') => {
    const value = (kind === 'start' ? issue.start_date : issue.target_date)?.slice(0, 10) ?? '';
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={rowBusy === issue.id}>
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
              void handlePatch(
                issue,
                kind === 'start'
                  ? { start_date: e.target.value || null }
                  : { target_date: e.target.value || null },
              )
            }
            className="h-8"
          />
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const emptyState =
    drafts.length === 0 ? (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center">
        <FileText className="text-muted-foreground size-10" strokeWidth={1.25} />
        <p className="font-medium">{t('drafts.empty', 'No draft work items')}</p>
        <p className="text-muted-foreground max-w-md text-sm">
          {t(
            'drafts.emptyHint',
            'Capture ideas as drafts and publish them into a project when you are ready.',
          )}
        </p>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          {t('drafts.draftWorkItem', 'Draft a work item')}
        </Button>
      </div>
    ) : (
      /* Drafts exist but the toolbar's search or project filter hid them all,
         so the call to action is to widen the filter, not to create. */
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center">
        <p className="text-muted-foreground text-sm">
          {t('drafts.noMatches', 'No drafts match the current search or filters.')}
        </p>
      </div>
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      {listLoading && drafts.length === 0 ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-11 w-full" />
          ))}
        </div>
      ) : visibleDrafts.length === 0 ? (
        emptyState
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-auto rounded-xl border">
            <Table className="min-w-max">
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="bg-muted/50 sticky left-0 z-20 min-w-64 px-3">
                    {t('drafts.documentTitle', 'Drafts')}
                  </TableHead>
                  <TableHead className="border-l px-3">{t('common.project', 'Project')}</TableHead>
                  <TableHead className="border-l px-3">{t('views.priority', 'Priority')}</TableHead>
                  <TableHead className="border-l px-3">{t('views.state', 'State')}</TableHead>
                  <TableHead className="border-l px-3">
                    {t('views.assignees', 'Assignees')}
                  </TableHead>
                  <TableHead className="border-l px-3">{t('views.labels', 'Labels')}</TableHead>
                  <TableHead className="border-l px-3">{t('views.module', 'Module')}</TableHead>
                  <TableHead className="border-l px-3">{t('views.cycle', 'Cycle')}</TableHead>
                  <TableHead className="border-l px-3">
                    {t('views.startDate', 'Start date')}
                  </TableHead>
                  <TableHead className="border-l px-3">{t('views.dueDate', 'Due date')}</TableHead>
                  <TableHead className="w-12 border-l px-3">
                    <span className="sr-only">{t('common.actions', 'Actions')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleDrafts.map((issue) => {
                  const proj = projectById.get(issue.project_id);
                  const issueUrl = `${base}/app-v2/projects/${issue.project_id}/work-items/${issue.id}`;
                  return (
                    <TableRow key={issue.id} data-busy={rowBusy === issue.id || undefined}>
                      {/* Pinned so the title stays readable while the
                          properties scroll; its own background keeps the
                          scrolled cells from showing through. */}
                      <TableCell className="bg-background sticky left-0 z-10 min-w-64 p-0">
                        <Link
                          to={issueUrl}
                          className="hover:bg-muted/50 flex h-11 items-center gap-2 px-3 transition-colors"
                        >
                          <span className="text-muted-foreground shrink-0 font-mono text-xs">
                            {draftDisplayId(proj, issue)}
                          </span>
                          <span className="truncate font-medium">{issue.name}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground border-l px-3 text-sm">
                        {proj?.name ?? '—'}
                      </TableCell>
                      <TableCell className="border-l p-0">{renderPriorityCell(issue)}</TableCell>
                      <TableCell className="border-l p-0">{renderStateCell(issue)}</TableCell>
                      <TableCell className="border-l p-0">{renderAssigneeCell(issue)}</TableCell>
                      <TableCell className="border-l p-0">{renderLabelsCell(issue)}</TableCell>
                      <TableCell className="border-l p-0">
                        {renderMembershipCell(issue, 'module')}
                      </TableCell>
                      <TableCell className="border-l p-0">
                        {renderMembershipCell(issue, 'cycle')}
                      </TableCell>
                      <TableCell className="border-l p-0">
                        {renderDateCell(issue, 'start')}
                      </TableCell>
                      <TableCell className="border-l p-0">{renderDateCell(issue, 'due')}</TableCell>
                      <TableCell className="border-l p-0 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild disabled={rowBusy === issue.id}>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={t('drafts.rowActions', 'Draft actions')}
                            >
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onSelect={() => handleEdit(issue)}>
                              <Pencil />
                              {t('common.edit', 'Edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => handleDuplicate(issue)}>
                              <Copy />
                              {t('common.duplicate', 'Duplicate')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => void handlePublish(issue)}>
                              <Send />
                              {t('drafts.moveToIssues', 'Move to work items')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => void handleDelete(issue)}
                            >
                              <Trash2 />
                              {t('common.delete', 'Delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {hasMore && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadDrafts(false)}
              >
                {t('common.loadMore', 'Load more')}
              </Button>
            </div>
          )}
        </>
      )}

      <CreateWorkItemDialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setCreateError(null);
          setEditingIssueId(null);
          setModalInitialValues(undefined);
          clearCreateParam();
        }}
        workspaceSlug={workspace.slug}
        projects={projects}
        defaultProjectId={projects[0]?.id}
        initialValues={modalInitialValues}
        draftOnly
        createError={createError}
        onSave={handleCreateSave}
      />
    </div>
  );
}
