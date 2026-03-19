import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { viewService } from "../services/viewService";
import type { IssueViewApiResponse } from "../api/types";

export function ViewDetailPage() {
  const { workspaceSlug, projectId, viewId } = useParams<{
    workspaceSlug: string;
    projectId: string;
    viewId: string;
  }>();
  const [view, setView] = useState<IssueViewApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceSlug || !viewId) {
      setLoading(false);
      setError("View not found.");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    viewService
      .get(workspaceSlug, viewId)
      .then((data) => {
        if (!cancelled) setView(data ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setView(null);
          setError("Unable to load this view.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, viewId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-(--txt-tertiary)">
        Loading view...
      </div>
    );
  }

  if (!view) {
    return (
      <div className="px-6 py-8">
        <p className="text-sm text-(--txt-secondary)">
          {error ?? "View not found."}
        </p>
        {workspaceSlug && projectId && (
          <Link
            to={`/${workspaceSlug}/projects/${projectId}/views`}
            className="mt-3 inline-block text-sm text-(--brand-default) hover:underline"
          >
            Back to views
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto px-6 py-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-semibold text-(--txt-primary)">
          {view.name}
        </h1>
        <p className="mt-2 text-sm text-(--txt-secondary)">
          {view.description || "No description"}
        </p>
        <div className="mt-6 grid gap-3 rounded-lg border border-(--border-subtle) bg-(--bg-layer-1) p-4 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-(--txt-tertiary)">Created</span>
            <span className="text-(--txt-primary)">
              {new Date(view.created_at).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-(--txt-tertiary)">Updated</span>
            <span className="text-(--txt-primary)">
              {new Date(view.updated_at).toLocaleString()}
            </span>
          </div>
        </div>
        {workspaceSlug && projectId && (
          <Link
            to={`/${workspaceSlug}/projects/${projectId}/views`}
            className="mt-5 inline-block text-sm text-(--brand-default) hover:underline"
          >
            Back to all views
          </Link>
        )}
      </div>
    </div>
  );
}
