import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { viewService } from "../services/viewService";
import type { IssueViewApiResponse } from "../api/types";

const DEFAULT_VIEWS = [
  { id: "all-issues", name: "All work items" },
  { id: "assigned", name: "Assigned" },
  { id: "created", name: "Created" },
  { id: "subscribed", name: "Subscribed" },
] as const;

const IconSearch = (props: React.SVGAttributes<SVGSVGElement>) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden {...props}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

export function WorkspaceViewsListPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const [query, setQuery] = useState("");
  const [customViews, setCustomViews] = useState<IssueViewApiResponse[]>([]);

  useEffect(() => {
    if (!workspaceSlug) return;
    viewService
      .list(workspaceSlug)
      .then((list) => setCustomViews(list ?? []))
      .catch(() => setCustomViews([]));
  }, [workspaceSlug]);

  const q = (s: string) => s.trim().toLowerCase();
  const filteredDefault = DEFAULT_VIEWS.filter((v) => q(v.name).includes(q(query)));
  const filteredCustom = customViews.filter((v) => q(v.name).includes(q(query)));

  if (!workspaceSlug) return null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-11 w-full items-center gap-2.5 border-b border-[var(--border-subtle)] px-5 py-3">
        <span className="text-[var(--txt-icon-tertiary)]">
          <IconSearch />
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search views"
          className="min-w-0 flex-1 bg-transparent text-sm text-[var(--txt-primary)] placeholder:text-[var(--txt-placeholder)] focus:outline-none"
        />
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto">
        {filteredDefault.map((view) => (
          <div
            key={view.id}
            className="border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--bg-layer-1-hover)]"
          >
            <Link
              to={`/${workspaceSlug}/views/${view.id}`}
              className="flex h-[52px] w-full items-center px-5 py-4"
            >
              <p className="truncate text-[13px] font-medium leading-4 text-[var(--txt-primary)]">
                {view.name}
              </p>
            </Link>
          </div>
        ))}
        {filteredCustom.map((view) => (
          <div
            key={view.id}
            className="border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--bg-layer-1-hover)]"
          >
            <Link
              to={`/${workspaceSlug}/views/${view.id}`}
              className="flex min-h-[52px] w-full flex-col justify-center px-5 py-4"
            >
              <p className="truncate text-[13px] font-medium leading-4 text-[var(--txt-primary)]">
                {view.name}
              </p>
              {view.description && (
                <p className="mt-0.5 truncate text-[11px] text-[var(--txt-secondary)]">
                  {view.description}
                </p>
              )}
            </Link>
          </div>
        ))}
        {filteredDefault.length === 0 && filteredCustom.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-[var(--txt-tertiary)]">
            No views match your search.
          </div>
        )}
      </div>
    </div>
  );
}
