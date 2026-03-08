import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../ui";
import { useAuth } from "../../contexts/AuthContext";
import { workspaceService } from "../../services/workspaceService";
import { projectService } from "../../services/projectService";
import type { WorkspaceApiResponse, ProjectApiResponse } from "../../api/types";

export function Header() {
  const { user, logout } = useAuth();
  const { workspaceSlug, projectId } = useParams<{
    workspaceSlug?: string;
    projectId?: string;
  }>();
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);

  useEffect(() => {
    if (!workspaceSlug) {
      setWorkspace(null);
      setProject(null);
      return;
    }
    let cancelled = false;
    workspaceService
      .getBySlug(workspaceSlug)
      .then((w) => {
        if (!cancelled) setWorkspace(w);
      })
      .catch(() => {
        if (!cancelled) setWorkspace(null);
      });
    if (projectId) {
      projectService
        .get(workspaceSlug!, projectId)
        .then((p) => {
          if (!cancelled) setProject(p ?? null);
        })
        .catch(() => {
          if (!cancelled) setProject(null);
        });
    } else {
      setProject(null);
    }
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId]);

  const breadcrumbs: { label: string; href?: string }[] = [];
  if (workspace) {
    breadcrumbs.push({ label: workspace.name, href: `/${workspace.slug}` });
    if (project) {
      breadcrumbs.push({
        label: project.name,
        href: `/${workspace.slug}/projects/${project.id}`,
      });
    }
  }

  return (
    <header
      className="flex h-[var(--height-header)] shrink-0 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-surface-1)] px-4"
      role="banner"
    >
      <div className="flex items-center gap-4">
        <Link
          to={workspace ? `/${workspace.slug}` : "/"}
          className="text-lg font-semibold text-[var(--txt-primary)] no-underline hover:text-[var(--txt-accent-primary)]"
        >
          Devlane
        </Link>
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-sm"
        >
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <span className="text-[var(--txt-tertiary)]">/</span>}
              {b.href ? (
                <Link
                  to={b.href}
                  className="text-[var(--txt-secondary)] no-underline hover:text-[var(--txt-primary)]"
                >
                  {b.label}
                </Link>
              ) : (
                <span className="text-[var(--txt-primary)]">{b.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-[var(--txt-secondary)]">
          {user?.name}
        </span>
        <Button variant="ghost" size="sm" onClick={logout}>
          Log out
        </Button>
      </div>
    </header>
  );
}
