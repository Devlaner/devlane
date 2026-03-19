import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { viewService } from "../services/viewService";
import type { IssueViewApiResponse } from "../api/types";

function resolveAccessLabel(view: IssueViewApiResponse): string | null {
  if (typeof view.access === "string") {
    if (view.access.toLowerCase() === "public") return "Public";
    if (view.access.toLowerCase() === "private") return "Private";
  }
  if (typeof view.access === "number") {
    if (view.access === 1) return "Public";
    if (view.access === 0) return "Private";
  }
  return null;
}

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
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {resolveAccessLabel(view) ? (
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                resolveAccessLabel(view) === "Public"
                  ? "border-emerald-300/60 bg-emerald-500/10 text-emerald-700"
                  : "border-slate-300/70 bg-slate-500/10 text-slate-700"
              }`}
            >
              {resolveAccessLabel(view)}
            </span>
          ) : null}
          {view.anchor ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-fuchsia-300/60 bg-fuchsia-500/10 px-2.5 py-0.5 text-xs font-medium text-fuchsia-700">
              <span className="size-1.5 rounded-full bg-fuchsia-600" />
              Live
            </span>
          ) : null}
          {view.is_favorite ? (
            <span className="inline-flex items-center rounded-full border border-amber-300/60 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700">
              Favorite
            </span>
          ) : null}
        </div>
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
