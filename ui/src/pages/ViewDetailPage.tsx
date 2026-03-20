import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { viewService } from "../services/viewService";
import { issueService } from "../services/issueService";
import type { IssueApiResponse, IssueViewApiResponse } from "../api/types";
import { getViewAccessMeta } from "../lib/viewAccess";

export function ViewDetailPage() {
  const { workspaceSlug, projectId, viewId } = useParams<{
    workspaceSlug: string;
    projectId: string;
    viewId: string;
  }>();
  const [view, setView] = useState<IssueViewApiResponse | null>(null);
  const [issues, setIssues] = useState<IssueApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceSlug || !viewId) {
      queueMicrotask(() => {
        setLoading(false);
        setError("View not found.");
      });
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
    });
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

  useEffect(() => {
    if (!workspaceSlug || !projectId) return;
    let cancelled = false;
    queueMicrotask(() => setIssuesLoading(true));
    issueService
      .list(workspaceSlug, projectId, { limit: 200 })
      .then((data) => {
        if (!cancelled) setIssues(data ?? []);
      })
      .catch(() => {
        if (!cancelled) setIssues([]);
      })
      .finally(() => {
        if (!cancelled) setIssuesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId]);

  const filteredIssues = useMemo(() => {
    if (!view) return [];
    let list = [...issues];
    const rawFilters = view.filters;
    const filters =
      rawFilters && typeof rawFilters === "object"
        ? (rawFilters as Record<string, unknown>)
        : {};

    const readList = (key: string) => {
      const value = filters[key];
      if (Array.isArray(value)) return value.map(String);
      if (typeof value === "string" && value.trim().length > 0)
        return value
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      return [] as string[];
    };

    const stateIds = readList("state");
    const assigneeIds = readList("assignee");
    const createdByIds = readList("created_by");
    const labelIds = readList("label");
    const priority = readList("priority");

    if (stateIds.length) {
      list = list.filter((i) => i.state_id && stateIds.includes(i.state_id));
    }
    if (assigneeIds.length) {
      list = list.filter((i) =>
        i.assignee_ids?.some((id) => assigneeIds.includes(id)),
      );
    }
    if (createdByIds.length) {
      list = list.filter(
        (i) => i.created_by_id && createdByIds.includes(i.created_by_id),
      );
    }
    if (labelIds.length) {
      list = list.filter((i) => i.label_ids?.some((id) => labelIds.includes(id)));
    }
    if (priority.length) {
      list = list.filter((i) => i.priority && priority.includes(i.priority));
    }

    const queryText =
      (view.query &&
      typeof view.query === "object" &&
      typeof (view.query as Record<string, unknown>).search === "string"
        ? ((view.query as Record<string, unknown>).search as string)
        : null) ??
      null;
    if (queryText && queryText.trim()) {
      const q = queryText.trim().toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q));
    }

    return list;
  }, [issues, view]);

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
          {getViewAccessMeta(view) ? (
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                getViewAccessMeta(view)?.tone === "public"
                  ? "border-emerald-300/60 bg-emerald-500/10 text-emerald-700"
                  : getViewAccessMeta(view)?.tone === "private"
                    ? "border-slate-300/70 bg-slate-500/10 text-slate-700"
                    : "border-violet-300/60 bg-violet-500/10 text-violet-700"
              }`}
            >
              {getViewAccessMeta(view)?.label}
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
          <div className="flex justify-between gap-4">
            <span className="text-(--txt-tertiary)">Filtered work items</span>
            <span className="text-(--txt-primary)">
              {issuesLoading ? "Loading..." : filteredIssues.length}
            </span>
          </div>
        </div>
        {filteredIssues.length > 0 && (
          <div className="mt-5 overflow-hidden rounded-lg border border-(--border-subtle)">
            <div className="max-h-80 overflow-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-(--bg-layer-1)">
                  <tr className="text-left text-(--txt-tertiary)">
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Priority</th>
                    <th className="px-3 py-2 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIssues.slice(0, 50).map((issue) => (
                    <tr
                      key={issue.id}
                      className="border-t border-(--border-subtle) text-(--txt-primary)"
                    >
                      <td className="px-3 py-2">{issue.name}</td>
                      <td className="px-3 py-2">{issue.priority ?? "none"}</td>
                      <td className="px-3 py-2">
                        {new Date(issue.updated_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
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
