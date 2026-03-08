import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge, Avatar, Button } from "../components/ui";
import { CreateWorkItemModal } from "../components/CreateWorkItemModal";
import { workspaceService } from "../services/workspaceService";
import { projectService } from "../services/projectService";
import { issueService } from "../services/issueService";
import { stateService } from "../services/stateService";
import type {
  WorkspaceApiResponse,
  ProjectApiResponse,
  IssueApiResponse,
  StateApiResponse,
} from "../api/types";
import type { Priority } from "../types";

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

const IconChevronDown = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);
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
const IconGrid = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <rect width="7" height="7" x="3" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="14" rx="1" />
    <rect width="7" height="7" x="3" y="14" rx="1" />
  </svg>
);
const IconCycle = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);
const IconRadio = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
  </svg>
);
const IconBarChart = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <line x1="12" y1="20" x2="12" y2="10" />
    <line x1="18" y1="20" x2="18" y2="4" />
    <line x1="6" y1="20" x2="6" y2="16" />
  </svg>
);
const IconArrowUp = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="m18 15-6-6-6 6" />
  </svg>
);
export function WorkspaceViewsPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const [createOpen, setCreateOpen] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [issues, setIssues] = useState<IssueApiResponse[]>([]);
  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceSlug) {
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
        if (cancelled || !projs?.length) return;
        setProjects(projs);
        return Promise.all([
          ...projs.map((p) =>
            issueService.list(workspaceSlug!, p.id, { limit: 100 }),
          ),
          ...projs.map((p) => stateService.list(workspaceSlug!, p.id)),
        ]);
      })
      .then((results) => {
        if (cancelled || !results) return;
        const half = results.length / 2;
        const issueArrays = results.slice(0, half) as IssueApiResponse[][];
        const stateArrays = results.slice(half) as StateApiResponse[][];
        setIssues(issueArrays.flat());
        setStates(stateArrays.flat());
      })
      .catch(() => {
        if (!cancelled) setWorkspace(null);
        setProjects([]);
        setIssues([]);
        setStates([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  const getProject = (projectId: string) =>
    projects.find((p) => p.id === projectId);
  const getStateName = (stateId: string | null | undefined) =>
    stateId ? (states.find((s) => s.id === stateId)?.name ?? stateId) : "—";
  const getUser = (_userId: string | null) => null;
  const getLabelNames = (_labelIds: string[] = []) => [] as string[];
  const getCycleName = (_projectId: string, _cycleId: string | null) => null;
  const getModuleName = (_projectId: string, _moduleId: string | null) => null;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-[var(--txt-tertiary)]">
        Loading…
      </div>
    );
  }
  if (!workspace) {
    return (
      <div className="text-[var(--txt-secondary)]">Workspace not found.</div>
    );
  }

  const baseUrl = `/${workspace.slug}`;

  return (
    <div className="space-y-4">
      {/* Work items table (all workspace issues) */}
      <div className="overflow-x-auto rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)]">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-layer-1)]">
              <th className="w-10 py-3 pr-2">
                <input
                  type="checkbox"
                  className="rounded border-[var(--border-subtle)]"
                  aria-label="Select all"
                />
              </th>
              <th className="py-3 pr-4 font-medium text-[var(--txt-secondary)]">
                <span className="flex items-center gap-1.5">
                  Work items
                  <IconChevronDown />
                </span>
              </th>
              <th className="py-3 pr-4 font-medium text-[var(--txt-secondary)]">
                <span className="flex items-center gap-1.5">
                  <IconRadio />
                  State
                  <IconChevronDown />
                </span>
              </th>
              <th className="py-3 pr-4 font-medium text-[var(--txt-secondary)]">
                <span className="flex items-center gap-1.5">
                  <IconBarChart />
                  Priority
                  <IconChevronDown />
                </span>
              </th>
              <th className="py-3 pr-4 font-medium text-[var(--txt-secondary)]">
                <span className="flex items-center gap-1.5">
                  <IconUser />
                  Assignees
                  <IconChevronDown />
                </span>
              </th>
              <th className="py-3 pr-4 font-medium text-[var(--txt-secondary)]">
                <span className="flex items-center gap-1.5">
                  <IconTag />
                  Labels
                  <IconChevronDown />
                </span>
              </th>
              <th className="py-3 pr-4 font-medium text-[var(--txt-secondary)]">
                <span className="flex items-center gap-1.5">
                  <IconGrid />
                  Modules
                  <IconChevronDown />
                </span>
              </th>
              <th className="py-3 pr-4 font-medium text-[var(--txt-secondary)]">
                <span className="flex items-center gap-1.5">
                  <IconCycle />
                  Cycle
                  <IconChevronDown />
                </span>
              </th>
              <th className="py-3 pr-4 font-medium text-[var(--txt-secondary)]">
                <span className="flex items-center gap-1.5">
                  <IconCalendar />
                  Start date
                  <IconChevronDown />
                </span>
              </th>
              <th className="py-3 pr-4 font-medium text-[var(--txt-secondary)]">
                <span className="flex items-center gap-1.5">
                  <IconCalendar />
                  Due date
                  <IconChevronDown />
                </span>
              </th>
              <th className="w-10 py-3 pl-2" />
            </tr>
          </thead>
          <tbody>
            {issues.length === 0 ? (
              <tr>
                <td
                  colSpan={11}
                  className="py-12 text-center text-sm text-[var(--txt-tertiary)]"
                >
                  No work items yet. Create one from a project&apos;s Work items
                  section or add a view to get started.
                </td>
              </tr>
            ) : (
              issues.map((issue) => {
                const project = getProject(issue.project_id);
                const assignee = getUser(null);
                const labelNames = getLabelNames([]);
                const cycleName = getCycleName(issue.project_id, null);
                const moduleName = getModuleName(issue.project_id, null);
                const displayId = project
                  ? `${project.identifier ?? project.id.slice(0, 8)}-${issue.sequence_id ?? issue.id.slice(-4)}`
                  : issue.id.slice(-4);
                const issueBaseUrl = project
                  ? `${baseUrl}/projects/${project.id}`
                  : baseUrl;
                return (
                  <tr
                    key={issue.id}
                    className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-layer-1-hover)]"
                  >
                    <td className="py-2.5 pr-2">
                      <input
                        type="checkbox"
                        className="rounded border-[var(--border-subtle)]"
                        aria-label={`Select ${displayId}`}
                      />
                    </td>
                    <td className="py-2.5 pr-4">
                      <Link
                        to={`${issueBaseUrl}/issues/${issue.id}`}
                        className="font-medium text-[var(--txt-accent-primary)] no-underline hover:underline"
                      >
                        {displayId}
                      </Link>
                      <span className="ml-2 text-[var(--txt-primary)]">
                        {issue.name}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <Badge variant="neutral" className="text-xs font-medium">
                        {getStateName(issue.state_id ?? undefined)}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-4">
                      <Badge
                        variant={
                          priorityVariant[
                            (issue.priority as Priority) ?? "none"
                          ]
                        }
                        className="!px-1.5 !py-0 text-[10px]"
                      >
                        {issue.priority === "none" || !issue.priority
                          ? "None"
                          : issue.priority}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-4">
                      <button
                        type="button"
                        className="text-[var(--txt-secondary)] hover:text-[var(--txt-primary)]"
                      >
                        {assignee ? (
                          <span className="flex items-center gap-1.5">
                            <Avatar
                              name={assignee.name}
                              src={assignee.avatarUrl}
                              size="sm"
                              className="h-5 w-5 text-[10px]"
                            />
                            {assignee.name}
                          </span>
                        ) : (
                          "Assignees"
                        )}
                      </button>
                    </td>
                    <td className="py-2.5 pr-4">
                      <button
                        type="button"
                        className="text-[var(--txt-secondary)] hover:text-[var(--txt-primary)]"
                      >
                        {labelNames.length > 0
                          ? labelNames.join(", ")
                          : "Select labels"}
                      </button>
                    </td>
                    <td className="py-2.5 pr-4">
                      <button
                        type="button"
                        className="text-[var(--txt-secondary)] hover:text-[var(--txt-primary)]"
                      >
                        {moduleName ?? "Select modules"}
                      </button>
                    </td>
                    <td className="py-2.5 pr-4">
                      <button
                        type="button"
                        className="text-[var(--txt-secondary)] hover:text-[var(--txt-primary)]"
                      >
                        {cycleName ?? "Select cycle"}
                      </button>
                    </td>
                    <td className="py-2.5 pr-4">
                      <button
                        type="button"
                        className="text-[var(--txt-secondary)] hover:text-[var(--txt-primary)]"
                      >
                        Start date
                      </button>
                    </td>
                    <td className="py-2.5 pr-4">
                      <button
                        type="button"
                        className="text-[var(--txt-secondary)] hover:text-[var(--txt-primary)]"
                      >
                        Due date
                      </button>
                    </td>
                    <td className="py-2.5 pl-2">
                      <button
                        type="button"
                        className="flex size-8 items-center justify-center rounded text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-1-hover)] hover:text-[var(--txt-icon-secondary)]"
                        aria-label="More"
                      >
                        <IconArrowUp />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {issues.length > 0 && (
        <div className="flex justify-start">
          <Button
            size="sm"
            variant="secondary"
            className="gap-1.5 border-dashed text-[13px] font-medium"
            onClick={() => setCreateOpen(true)}
          >
            New work item
          </Button>
        </div>
      )}

      <CreateWorkItemModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        workspaceSlug={workspace.slug}
        projects={projects}
        defaultProjectId={projects[0]?.id}
      />
    </div>
  );
}
