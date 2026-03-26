import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui';
import { CreateWorkItemModal } from '../components/CreateWorkItemModal';
import { DraftIssueRowProperties } from '../components/drafts/DraftIssueRowProperties';
import { workspaceService } from '../services/workspaceService';
import { projectService } from '../services/projectService';
import { issueService } from '../services/issueService';
import { cycleService } from '../services/cycleService';
import { moduleService } from '../services/moduleService';
import { stateService } from '../services/stateService';
import { labelService } from '../services/labelService';
import type {
  WorkspaceApiResponse,
  ProjectApiResponse,
  IssueApiResponse,
  StateApiResponse,
  LabelApiResponse,
  CycleApiResponse,
  ModuleApiResponse,
  WorkspaceMemberApiResponse,
} from '../api/types';
import type { Priority } from '../types';

const PAGE_SIZE = 50;

/** Plane-style key + sequence (e.g. LOGI1). Never use placeholder em-dashes for the key. */
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

const IconFolderPlus = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.25"
    className="text-(--txt-icon-tertiary)"
    aria-hidden
  >
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    <line x1="12" x2="12" y1="11" y2="17" />
    <line x1="9" x2="15" y1="14" y2="14" />
  </svg>
);

const IconFileDraft = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.25"
    className="text-(--txt-icon-tertiary)"
    aria-hidden
  >
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M8 13h8" />
    <path d="M8 17h6" />
  </svg>
);

export function DraftsPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [propDropdownId, setPropDropdownId] = useState<string | null>(null);

  const projectById = useMemo(() => {
    const m = new Map<string, ProjectApiResponse>();
    for (const p of projects) m.set(p.id, p);
    return m;
  }, [projects]);

  const projectIdsKey = useMemo(
    () => [...new Set(drafts.map((d) => d.project_id))].sort().join(','),
    [drafts],
  );

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
        setError('Could not load drafts.');
      } finally {
        if (reset) setListLoading(false);
      }
    },
    [workspaceSlug, offset],
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
          setError('Could not load workspace.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  useEffect(() => {
    if (!workspaceSlug || !workspace) return;
    void loadDrafts(true);
  }, [workspaceSlug, workspace, loadDrafts]);

  useEffect(() => {
    const shouldOpen = searchParams.get('create') === '1';
    if (shouldOpen) setCreateOpen(true);
  }, [searchParams]);

  const setPropDropdownOpen = useCallback((id: string | null) => {
    setPropDropdownId(id);
    if (id) setMenuOpenId(null);
  }, []);

  useEffect(() => {
    if (!menuOpenId) return;
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest?.('[data-draft-actions]')) return;
      setMenuOpenId(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpenId]);

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
      setError('Could not update draft.');
    } finally {
      setRowBusy(null);
    }
  };

  const handleModuleChange = async (issue: IssueApiResponse, moduleId: string | null) => {
    if (!workspaceSlug) return;
    const cur = issue.module_ids?.[0] ?? null;
    if (cur === moduleId) return;
    setRowBusy(issue.id);
    try {
      if (cur) {
        await moduleService.removeIssue(workspaceSlug, issue.project_id, cur, issue.id);
      }
      if (moduleId) {
        await moduleService.addIssue(workspaceSlug, issue.project_id, moduleId, issue.id);
      }
      const fresh = await issueService.get(workspaceSlug, issue.project_id, issue.id);
      setDrafts((prev) => prev.map((i) => (i.id === issue.id ? { ...i, ...fresh } : i)));
    } catch {
      setError('Could not update module.');
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
      if (cur) {
        await cycleService.removeIssue(workspaceSlug, issue.project_id, cur, issue.id);
      }
      if (cycleId) {
        await cycleService.addIssue(workspaceSlug, issue.project_id, cycleId, issue.id);
      }
      const fresh = await issueService.get(workspaceSlug, issue.project_id, issue.id);
      setDrafts((prev) => prev.map((i) => (i.id === issue.id ? { ...i, ...fresh } : i)));
    } catch {
      setError('Could not update cycle.');
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
      setCreateOpen(false);
      await loadDrafts(true);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create draft.');
    }
  };

  const handlePublish = async (issue: IssueApiResponse) => {
    if (!workspaceSlug) return;
    setMenuOpenId(null);
    setPropDropdownId(null);
    setRowBusy(issue.id);
    try {
      await issueService.update(workspaceSlug, issue.project_id, issue.id, { is_draft: false });
      setDrafts((prev) => prev.filter((i) => i.id !== issue.id));
    } catch {
      setError('Could not publish draft.');
    } finally {
      setRowBusy(null);
    }
  };

  const handleDelete = async (issue: IssueApiResponse) => {
    if (!workspaceSlug) return;
    if (!window.confirm(`Delete draft “${issue.name}”?`)) return;
    setMenuOpenId(null);
    setPropDropdownId(null);
    setRowBusy(issue.id);
    try {
      await issueService.delete(workspaceSlug, issue.project_id, issue.id);
      setDrafts((prev) => prev.filter((i) => i.id !== issue.id));
    } catch {
      setError('Could not delete draft.');
    } finally {
      setRowBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-(--txt-tertiary)">
        Loading…
      </div>
    );
  }

  if (!workspaceSlug || !workspace) {
    return <div className="text-sm text-(--txt-secondary)">Workspace not found.</div>;
  }

  const base = `/${workspace.slug}`;

  if (projects.length === 0) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center">
        <IconFolderPlus />
        <h1 className="mt-6 text-lg font-semibold text-(--txt-primary)">No projects yet</h1>
        <p className="mt-2 text-sm text-(--txt-secondary)">
          Create a project in this workspace before you can add draft work items.
        </p>
        <Link
          to={`${base}/projects`}
          className="mt-6 inline-flex h-9 items-center justify-center rounded-md bg-(--bg-accent-primary) px-4 text-sm font-medium text-(--txt-on-color) no-underline hover:bg-(--bg-accent-primary-hover)"
        >
          Create project
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-0">
      {error && (
        <p className="px-(--padding-page) pt-3 text-sm text-(--txt-danger-primary)" role="alert">
          {error}
        </p>
      )}

      {listLoading && drafts.length === 0 ? (
        <div className="flex justify-center px-(--padding-page) py-8 text-sm text-(--txt-tertiary)">
          Loading drafts…
        </div>
      ) : drafts.length === 0 ? (
        <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center">
          <IconFileDraft />
          <h2 className="mt-6 text-lg font-semibold text-(--txt-primary)">No draft work items</h2>
          <p className="mt-2 text-sm text-(--txt-secondary)">
            Capture ideas as drafts and publish them into a project when you are ready.
          </p>
          <Button
            variant="primary"
            className="mt-6"
            type="button"
            onClick={() => setCreateOpen(true)}
          >
            Draft a work item
          </Button>
        </div>
      ) : (
        <div className="bg-(--bg-canvas)">
          <ul className="divide-y divide-(--border-subtle)">
            {drafts.map((issue) => {
              const proj = projectById.get(issue.project_id);
              const displayId = draftDisplayId(proj, issue);
              const busy = rowBusy === issue.id;
              const states = statesByProject.get(issue.project_id) ?? [];
              const labels = labelsByProject.get(issue.project_id) ?? [];
              const modules = modulesByProject.get(issue.project_id) ?? [];
              const cycles = cyclesByProject.get(issue.project_id) ?? [];
              const issueUrl = `${base}/projects/${issue.project_id}/issues/${issue.id}`;

              return (
                <li key={issue.id} className="bg-(--bg-surface-1) hover:bg-(--bg-layer-1-hover)">
                  <div className="flex min-h-11 w-full items-center justify-between gap-3 px-(--padding-page) py-2.5">
                    <div
                      role="button"
                      tabIndex={0}
                      className="flex min-w-0 flex-1 cursor-default items-center gap-2 truncate text-[13px]"
                      onDoubleClick={() => navigate(issueUrl)}
                      aria-label={`Open draft ${issue.name}`}
                    >
                      <span className="shrink-0 font-medium text-(--txt-tertiary)">
                        {displayId}
                      </span>
                      <span className="truncate text-(--txt-primary)">{issue.name}</span>
                    </div>

                    <DraftIssueRowProperties
                      issue={issue}
                      project={proj}
                      states={states}
                      labels={labels}
                      modules={modules}
                      cycles={cycles}
                      members={members}
                      busy={busy}
                      openDropdownId={propDropdownId}
                      setOpenDropdownId={setPropDropdownOpen}
                      onPatch={handlePatch}
                      onModuleChange={handleModuleChange}
                      onCycleChange={handleCycleChange}
                      rowMenuOpen={menuOpenId === issue.id}
                      onToggleRowMenu={() =>
                        setMenuOpenId((id) => {
                          const next = id === issue.id ? null : issue.id;
                          if (next) setPropDropdownId(null);
                          return next;
                        })
                      }
                      onPublish={() => void handlePublish(issue)}
                      onDelete={() => void handleDelete(issue)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          {hasMore ? (
            <div className="border-t border-(--border-subtle) bg-(--bg-surface-1) p-3 text-center">
              <button
                type="button"
                className="text-[13px] font-medium text-(--brand-default) underline-offset-2 hover:underline"
                onClick={() => void loadDrafts(false)}
              >
                Load more
              </button>
            </div>
          ) : null}
        </div>
      )}

      <CreateWorkItemModal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setCreateError(null);
          if (searchParams.get('create') === '1') {
            searchParams.delete('create');
            setSearchParams(searchParams, { replace: true });
          }
        }}
        workspaceSlug={workspace.slug}
        projects={projects}
        defaultProjectId={projects[0]?.id}
        draftOnly
        createError={createError}
        onSave={handleCreateSave}
      />
    </div>
  );
}
