import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Avatar } from '../components/ui';
import { workspaceService } from '../services/workspaceService';
import { projectService } from '../services/projectService';
import { pageService } from '../services/pageService';
import type { WorkspaceApiResponse, ProjectApiResponse, PageApiResponse } from '../api/types';

const IconSearch = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
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
const IconFilter = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);
const IconGlobe = () => (
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
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);
const IconInfo = () => (
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
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);
const IconStar = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);
const IconMoreVertical = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <circle cx="12" cy="5" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="12" cy="19" r="1.5" />
  </svg>
);
const IconAlertTriangle = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className="shrink-0 text-(--warning-default)"
    aria-hidden
  >
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);
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

type PageTab = 'public' | 'private' | 'archived';

export function PagesPage() {
  const { workspaceSlug, projectId } = useParams<{
    workspaceSlug: string;
    projectId: string;
  }>();
  const [tab, setTab] = useState<PageTab>('public');
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [pages, setPages] = useState<PageApiResponse[]>([]);
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
      pageService.list(workspaceSlug, projectId),
    ])
      .then(([w, p, list]) => {
        if (!cancelled) {
          setWorkspace(w ?? null);
          setProject(p ?? null);
          setPages(list ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWorkspace(null);
          setProject(null);
          setPages([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId]);

  const filteredPages =
    tab === 'public'
      ? pages.filter((p) => p.access === 0)
      : tab === 'private'
        ? pages.filter((p) => p.access === 1)
        : pages.filter((p) => p.archived_at);

  const getUser = (userId: string | null): { name: string; avatarUrl?: string | null } | null => {
    void userId; // reserved for future assignee display
    return null;
  };

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
    <div className="space-y-4">
      {/* Tabs: Public | Private | Archived */}
      <div className="flex gap-1 border-b border-(--border-subtle)">
        {(['public', 'private', 'archived'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium capitalize ${
              tab === t
                ? 'border-(--brand-default) text-(--txt-primary)'
                : 'border-transparent text-(--txt-secondary) hover:text-(--txt-primary)'
            }`}
          >
            {t === 'public' ? 'Public' : t === 'private' ? 'Private' : 'Archived'}
          </button>
        ))}
      </div>

      {/* Toolbar: search, sort, filters */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-md border border-(--border-subtle) bg-(--bg-layer-2) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2-hover)"
          aria-label="Search"
        >
          <IconSearch />
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
          >
            <IconCalendar /> Date modified <IconChevronDown />
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
          >
            <IconFilter /> Filters <IconChevronDown />
          </button>
        </div>
      </div>

      {/* Page list */}
      <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1)">
        {filteredPages.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-(--txt-tertiary)">No {tab} pages yet.</p>
        ) : (
          <ul className="divide-y divide-(--border-subtle)">
            {filteredPages.map((page) => {
              const updatedBy = getUser(page.updated_by_id ?? page.owned_by_id ?? null);
              return (
                <li key={page.id}>
                  <Link
                    to={`${baseUrl}/pages/${page.id}`}
                    className="flex items-center gap-3 px-4 py-3 no-underline transition-colors hover:bg-(--bg-layer-1-hover)"
                  >
                    {page.archived_at ? (
                      <IconAlertTriangle />
                    ) : (
                      <span className="flex size-9 shrink-0 items-center justify-center rounded border border-(--border-subtle) bg-(--bg-layer-2) text-(--txt-icon-tertiary)">
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      </span>
                    )}
                    <span className="min-w-0 flex-1 font-medium text-(--txt-primary)">
                      {page.title ?? page.name}
                    </span>
                    <div className="flex shrink-0 items-center gap-2 text-(--txt-icon-tertiary)">
                      {updatedBy && (
                        <Avatar
                          name={updatedBy.name}
                          src={updatedBy.avatarUrl}
                          size="sm"
                          className="h-6 w-6 text-[10px]"
                        />
                      )}
                      <span
                        className="flex size-8 items-center justify-center rounded hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
                        title="Visibility"
                      >
                        <IconGlobe />
                      </span>
                      <span
                        className="flex size-8 items-center justify-center rounded hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
                        title="Info"
                      >
                        <IconInfo />
                      </span>
                      <span
                        className="flex size-8 items-center justify-center rounded hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
                        title="Favorite"
                      >
                        <IconStar />
                      </span>
                      <button
                        type="button"
                        className="flex size-8 items-center justify-center rounded hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
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
        )}
      </div>
    </div>
  );
}
