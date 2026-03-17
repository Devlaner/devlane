import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card, CardContent, Badge } from "../components/ui";
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

export function BoardPage() {
  const { workspaceSlug, projectId } = useParams<{
    workspaceSlug: string;
    projectId: string;
  }>();
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [issues, setIssues] = useState<IssueApiResponse[]>([]);
  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [loading, setLoading] = useState(true);

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
      issueService.list(workspaceSlug, projectId, { limit: 100 }),
      stateService.list(workspaceSlug, projectId),
    ])
      .then(([w, p, iss, st]) => {
        if (!cancelled) {
          setWorkspace(w ?? null);
          setProject(p ?? null);
          setIssues(iss ?? []);
          setStates(st ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWorkspace(null);
          setProject(null);
          setIssues([]);
          setStates([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-(--txt-tertiary)">
        Loading…
      </div>
    );
  }
  if (!workspace || !project) {
    return (
      <div className="text-(--txt-secondary)">Project not found.</div>
    );
  }

  const baseUrl = `/${workspace.slug}/projects/${project.id}`;
  const issuesByState = states.map((state) => ({
    state,
    issues: issues.filter((i) => i.state_id === state.id),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-(--txt-primary)">
        Board
      </h1>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {issuesByState.map(({ state, issues: stateIssues }) => (
          <div
            key={state.id}
            className="flex w-72 shrink-0 flex-col rounded-(--radius-lg) border border-(--border-subtle) bg-(--bg-layer-1)"
          >
            <div
              className="border-b border-(--border-subtle) px-4 py-3"
              style={{
                borderLeftWidth: "4px",
                borderLeftColor: state.color ?? "var(--border-subtle)",
              }}
            >
              <h2 className="font-medium text-(--txt-primary)">
                {state.name}
              </h2>
              <p className="text-xs text-(--txt-tertiary)">
                {stateIssues.length} issue{stateIssues.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {stateIssues.map((issue) => (
                <Link
                  key={issue.id}
                  to={`${baseUrl}/issues/${issue.id}`}
                  className="block no-underline"
                >
                  <Card
                    variant="elevated"
                    className="cursor-pointer transition-shadow hover:shadow-(--shadow-overlay)"
                  >
                    <CardContent className="p-3">
                      <p className="font-medium text-(--txt-primary)">
                        {issue.name}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            priorityVariant[
                              (issue.priority as Priority) ?? "none"
                            ]
                          }
                        >
                          {issue.priority ?? "—"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
              {stateIssues.length === 0 && (
                <p className="py-4 text-center text-sm text-(--txt-tertiary)">
                  No issues
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
