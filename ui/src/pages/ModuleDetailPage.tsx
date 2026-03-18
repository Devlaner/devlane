import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Avatar, Badge, Button } from "../components/ui";
import { CreateWorkItemModal } from "../components/CreateWorkItemModal";
import { AddExistingWorkItemModal } from "../components/AddExistingWorkItemModal";
import { workspaceService } from "../services/workspaceService";
import { projectService } from "../services/projectService";
import { moduleService } from "../services/moduleService";
import { issueService } from "../services/issueService";
import { stateService } from "../services/stateService";
import { labelService } from "../services/labelService";
import type {
  WorkspaceApiResponse,
  ProjectApiResponse,
  ModuleApiResponse,
  IssueApiResponse,
  StateApiResponse,
  LabelApiResponse,
  WorkspaceMemberApiResponse,
} from "../api/types";
import type { Priority } from "../types";
import { getImageUrl } from "../lib/utils";
import { slugify } from "../lib/slug";

const priorityVariant: Record<
  Priority,
  "danger" | "warning" | "default" | "neutral"
> = {
  urgent: "danger",
  high: "danger",
  medium: "warning",
  low: "default",
  none: "neutral",
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
const IconMoreVertical = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden
  >
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
  if (!iso) return "—";
  const d = new Date(iso);
  const day = d.getDate();
  const month = d.toLocaleString("en-US", { month: "short" });
  return `${day} ${month}`;
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
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [addExistingOpen, setAddExistingOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const createParam = searchParams.get("create") === "1";

  useEffect(() => {
    if (createParam && projectId) {
      queueMicrotask(() => setCreateOpen(true));
    }
  }, [createParam, projectId]);

  const handleCloseCreate = () => {
    setCreateOpen(false);
    setCreateError(null);
    searchParams.delete("create");
    setSearchParams(searchParams, { replace: true });
  };

  const refetchIssues = () => {
    if (!workspaceSlug || !projectId || !resolvedModuleId) return;
    issueService
      .list(workspaceSlug, projectId, { limit: 1000 })
      .then((list) => {
        setIssues(
          (list ?? []).filter((i) => i.module_ids?.includes(resolvedModuleId)),
        );
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
      workspaceService.listMembers(workspaceSlug),
      projectService.list(workspaceSlug),
    ])
      .then(([w, p, mods, iss, st, lab, mem, proj]) => {
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
        setIssues(
          (iss ?? []).filter((i) => i.module_ids?.includes(found?.id ?? "")),
        );
        setStates(st ?? []);
        setLabels(lab ?? []);
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
        await moduleService.addIssue(
          workspaceSlug,
          data.projectId,
          resolvedModuleId,
          created.id,
        );
      }
      refetchIssues();
      handleCloseCreate();
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to create work item",
      );
    }
  };

  const getStateName = (stateId: string | null | undefined) =>
    stateId ? (states.find((s) => s.id === stateId)?.name ?? stateId) : "—";
  const getLabelNames = (labelIds: string[] = []) =>
    labelIds
      .map((id) => labels.find((l) => l.id === id)?.name)
      .filter((name): name is string => Boolean(name));
  const getUser = (userId: string | null) => {
    if (!userId) return null;
    const m = members.find((x) => x.member_id === userId);
    const display = m?.member_display_name?.trim();
    const emailUser = m?.member_email?.split("@")[0]?.trim();
    const name = display || emailUser || "Member";
    const avatarUrl = m?.member_avatar ?? null;
    return { id: userId, name, avatarUrl };
  };

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
  const displayId = (issue: IssueApiResponse) =>
    `${project.identifier ?? project.id.slice(0, 8)}-${issue.sequence_id ?? issue.id.slice(-4)}`;

  const issuesByState = states.reduce<Record<string, IssueApiResponse[]>>(
    (acc, s) => {
      acc[s.id] = issues.filter((i) => (i.state_id ?? "") === s.id);
      return acc;
    },
    {},
  );
  const ungrouped = issues.filter(
    (i) => !i.state_id || !states.some((s) => s.id === i.state_id),
  );
  if (ungrouped.length > 0) {
    issuesByState[""] = ungrouped;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Empty state */}
      {issues.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-(--border-subtle) bg-(--bg-surface-1) px-6 py-16">
          <IconModule />
          <div className="text-center">
            <h2 className="text-lg font-semibold text-(--txt-primary)">
              No work items in the module
            </h2>
            <p className="mt-1 text-sm text-(--txt-secondary)">
              Create or add work items which you want to accomplish as part of
              this module.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => setSearchParams({ create: "1" })}
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
      )}

      {/* Work items by state */}
      {issues.length > 0 && (
        <div className="space-y-6">
          {states.map((state) => {
            const stateIssues = issuesByState[state.id] ?? [];
            if (stateIssues.length === 0) return null;
            return (
              <section
                key={state.id}
                className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) overflow-hidden"
              >
                <div className="flex items-center gap-2 border-b border-(--border-subtle) bg-(--bg-layer-2) px-4 py-2">
                  <span
                    className="flex size-4 shrink-0 items-center justify-center rounded border border-(--border-subtle) border-dashed text-(--txt-icon-tertiary)"
                    aria-hidden
                  >
                    <span className="size-2 rounded-full border border-current border-dashed" />
                  </span>
                  <span className="text-sm font-medium text-(--txt-primary)">
                    {state.name} {stateIssues.length}
                  </span>
                </div>
                <ul className="divide-y divide-(--border-subtle)">
                  {stateIssues.map((issue) => {
                    const primaryAssigneeId = issue.assignee_ids?.[0] ?? null;
                    const assignee = getUser(primaryAssigneeId);
                    const labelNames = getLabelNames(issue.label_ids ?? []);
                    return (
                      <li key={issue.id}>
                        <Link
                          to={`${baseUrl}/issues/${issue.id}`}
                          className="flex min-h-12 items-center gap-3 px-4 py-2.5 no-underline transition-colors hover:bg-(--bg-layer-1-hover)"
                        >
                          <span className="min-w-0 flex-1 truncate text-sm">
                            <span className="font-medium text-(--txt-accent-primary)">
                              {displayId(issue)}
                            </span>
                            <span className="ml-2 text-(--txt-primary)">
                              {issue.name}
                            </span>
                          </span>
                          <div className="flex shrink-0 items-center gap-2 text-(--txt-icon-tertiary)">
                            <Badge
                              variant="neutral"
                              className="text-xs font-medium"
                            >
                              {getStateName(issue.state_id ?? undefined)}
                            </Badge>
                            <Badge
                              variant={
                                priorityVariant[
                                  (issue.priority as Priority) ?? "none"
                                ]
                              }
                              className="px-1.5! py-0! text-[10px]"
                            >
                              {issue.priority ?? "—"}
                            </Badge>
                            <span
                              title={formatDate(issue.target_date ?? undefined)}
                              className="flex size-6 items-center justify-center"
                            >
                              <IconCalendar />
                            </span>
                            <span
                              title={assignee?.name ?? "Unassigned"}
                              className="flex size-6 items-center justify-center"
                            >
                              {assignee ? (
                                <Avatar
                                  name={assignee.name}
                                  src={
                                    getImageUrl(assignee.avatarUrl) ?? undefined
                                  }
                                  size="sm"
                                  className="h-6 w-6 text-[10px]"
                                />
                              ) : (
                                <IconUser />
                              )}
                            </span>
                            <span
                              title={
                                labelNames.length
                                  ? labelNames.join(", ")
                                  : "Labels"
                              }
                              className="flex size-6 items-center justify-center"
                            >
                              <IconTag />
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
                  })}
                </ul>
              </section>
            );
          })}
          {(issuesByState[""]?.length ?? 0) > 0 && (
            <section className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) overflow-hidden">
              <div className="flex items-center gap-2 border-b border-(--border-subtle) bg-(--bg-layer-2) px-4 py-2">
                <span className="text-sm font-medium text-(--txt-primary)">
                  No state {issuesByState[""].length}
                </span>
              </div>
              <ul className="divide-y divide-(--border-subtle)">
                {issuesByState[""].map((issue) => {
                  const primaryAssigneeId = issue.assignee_ids?.[0] ?? null;
                  const assignee = getUser(primaryAssigneeId);
                  return (
                    <li key={issue.id}>
                      <Link
                        to={`${baseUrl}/issues/${issue.id}`}
                        className="flex min-h-12 items-center gap-3 px-4 py-2.5 no-underline transition-colors hover:bg-(--bg-layer-1-hover)"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm">
                          <span className="font-medium text-(--txt-accent-primary)">
                            {displayId(issue)}
                          </span>
                          <span className="ml-2 text-(--txt-primary)">
                            {issue.name}
                          </span>
                        </span>
                        <div className="flex shrink-0 items-center gap-2">
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
                          <button
                            type="button"
                            className="flex size-6 items-center justify-center rounded hover:bg-(--bg-layer-1-hover)"
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
                })}
              </ul>
            </section>
          )}
        </div>
      )}

      {issues.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-3 border-t border-(--border-subtle) pt-6">
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setSearchParams({ create: "1" })}
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
      )}

      <AddExistingWorkItemModal
        open={addExistingOpen}
        onClose={() => setAddExistingOpen(false)}
        workspaceSlug={workspace.slug}
        projectId={project.id}
        moduleId={resolvedModuleId ?? ""}
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
