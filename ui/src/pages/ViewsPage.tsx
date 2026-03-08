import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { workspaceService } from "../services/workspaceService";
import { projectService } from "../services/projectService";
import { viewService } from "../services/viewService";
import type {
  WorkspaceApiResponse,
  ProjectApiResponse,
  IssueViewApiResponse,
} from "../api/types";

export function ViewsPage() {
  const { workspaceSlug, projectId } = useParams<{
    workspaceSlug: string;
    projectId: string;
  }>();
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [views, setViews] = useState<IssueViewApiResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceSlug || !projectId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      workspaceService.getBySlug(workspaceSlug),
      projectService.get(workspaceSlug, projectId),
      viewService.list(workspaceSlug, projectId),
    ])
      .then(([w, p, list]) => {
        if (!cancelled) {
          setWorkspace(w ?? null);
          setProject(p ?? null);
          setViews(list ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWorkspace(null);
          setProject(null);
          setViews([]);
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
      <div className="flex items-center justify-center p-8 text-sm text-[var(--txt-tertiary)]">
        Loading…
      </div>
    );
  }
  if (!workspace || !project) {
    return (
      <div className="text-[var(--txt-secondary)]">Project not found.</div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--txt-secondary)]">
        Saved views let you quickly access filtered work items. Create a view
        from the &quot;Add view&quot; button above.
      </p>
      {views.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-[var(--border-subtle)] border-dashed bg-[var(--bg-layer-1)] py-12">
          <p className="text-sm text-[var(--txt-tertiary)]">
            No saved views yet.
          </p>
          <p className="mt-1 text-xs text-[var(--txt-tertiary)]">
            Create a view to save your filters and display options.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {views.map((v) => (
            <li
              key={v.id}
              className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] px-3 py-2"
            >
              <span className="font-medium text-[var(--txt-primary)]">
                {v.name}
              </span>
              {v.description && (
                <p className="mt-0.5 text-sm text-[var(--txt-secondary)]">
                  {v.description}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
