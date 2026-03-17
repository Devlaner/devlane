import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card, CardContent, Badge, Button } from "../components/ui";
import { workspaceService } from "../services/workspaceService";
import { projectService } from "../services/projectService";
import { issueService } from "../services/issueService";
import { stateService } from "../services/stateService";
import { recentsService } from "../services/recentsService";
import type {
  WorkspaceApiResponse,
  ProjectApiResponse,
  IssueApiResponse,
  StateApiResponse,
} from "../api/types";

export function ProjectHomePage() {
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
          if (workspaceSlug && projectId) {
            recentsService
              .record(workspaceSlug, {
                entity_name: "project",
                entity_identifier: projectId,
                project_id: projectId,
              })
              .catch(() => {});
          }
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

  const getStateName = (stateId: string | null | undefined) =>
    stateId ? (states.find((s) => s.id === stateId)?.name ?? stateId) : "—";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-(--txt-primary)">
          {project.name}
        </h1>
        {project.description && (
          <p className="mt-1 text-sm text-(--txt-secondary)">
            {project.description}
          </p>
        )}
      </div>
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium text-(--txt-secondary)">
            Recent issues
          </h2>
          <div className="flex items-center gap-2">
            <Link to={`${baseUrl}/issues?create=1`}>
              <Button variant="primary" size="sm">
                New work item
              </Button>
            </Link>
            <Link to={`${baseUrl}/issues`}>
              <Button variant="secondary" size="sm">
                View all
              </Button>
            </Link>
          </div>
        </div>
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-(--border-subtle)">
              {issues.slice(0, 5).map((issue) => (
                <li key={issue.id}>
                  <Link
                    to={`${baseUrl}/issues/${issue.id}`}
                    className="flex items-center justify-between gap-4 px-4 py-3 no-underline transition-colors hover:bg-(--bg-layer-1-hover)"
                  >
                    <span className="font-medium text-(--txt-primary)">
                      {issue.name}
                    </span>
                    <Badge variant="neutral">
                      {getStateName(issue.state_id ?? undefined)}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
            {issues.length === 0 && (
              <p className="px-4 py-6 text-sm text-(--txt-tertiary)">
                No issues yet.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
