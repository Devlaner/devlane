import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Input, Modal } from "../components/ui";
import { useWorkspaceViewsState } from "../contexts/WorkspaceViewsStateContext";
import { useAuth } from "../contexts/AuthContext";
import { workspaceService } from "../services/workspaceService";
import { projectService } from "../services/projectService";
import { viewService } from "../services/viewService";
import type {
  WorkspaceApiResponse,
  ProjectApiResponse,
  IssueViewApiResponse,
  ProjectMemberApiResponse,
  WorkspaceMemberApiResponse,
} from "../api/types";

type CreatedDatePreset = "1_week" | "2_weeks" | "1_month";

type ProjectViewsFilters = {
  query: string;
  favoritesOnly: boolean;
  createdDatePreset: CreatedDatePreset | "custom" | null;
  createdAfter: string | null;
  createdBefore: string | null;
  createdByIds: string[];
};

const PROJECT_VIEWS_FILTER_EVENT = "project-views-filter-change";
const PROJECT_MEMBER_ROLE_MIN_CREATE = 10;

function getProjectViewsFavoritesKey(workspaceId: string, projectId: string) {
  return `project-view-favorites:${workspaceId}:${projectId}`;
}

function readFavorites(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function ViewsPage() {
  const navigate = useNavigate();
  const { workspaceSlug, projectId } = useParams<{
    workspaceSlug: string;
    projectId: string;
  }>();
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [views, setViews] = useState<IssueViewApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { display } = useWorkspaceViewsState();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpenId, setEditOpenId] = useState<string | null>(null);
  const [deleteOpenId, setDeleteOpenId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ProjectViewsFilters>({
    query: "",
    favoritesOnly: false,
    createdDatePreset: null,
    createdAfter: null,
    createdBefore: null,
    createdByIds: [],
  });
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMemberApiResponse[]>(
    [],
  );
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  const loadPageData = useCallback(() => {
    if (!workspaceSlug || !projectId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset loading when no slug/project (kept for future use)
      setLoading(false);
      return Promise.resolve();
    }
    setLoading(true);
    setLoadError(null);
    return Promise.all([
      workspaceService.getBySlug(workspaceSlug),
      projectService.get(workspaceSlug, projectId),
      viewService.list(workspaceSlug, projectId),
      workspaceService.listMembers(workspaceSlug),
      projectService.listMembers(workspaceSlug, projectId),
    ])
      .then(([w, p, list, mem, projectMem]) => {
        setWorkspace(w ?? null);
        setProject(p ?? null);
        setViews(list ?? []);
        setMembers(mem ?? []);
        setProjectMembers(projectMem ?? []);
      })
      .catch(() => {
        setWorkspace(null);
        setProject(null);
        setViews([]);
        setMembers([]);
        setProjectMembers([]);
        setLoadError(
          "Unable to load project views right now. Please refresh and try again.",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [workspaceSlug, projectId]);

  useEffect(() => {
    void loadPageData();
  }, [loadPageData]);

  useEffect(() => {
    const handleOpenCreate = () => setCreateOpen(true);
    window.addEventListener("project-views-create-open", handleOpenCreate);
    return () => {
      window.removeEventListener("project-views-create-open", handleOpenCreate);
    };
  }, []);

  useEffect(() => {
    if (!workspace?.id || !projectId) return;
    const key = getProjectViewsFavoritesKey(workspace.id, projectId);
    setFavoriteIds(readFavorites(key));
  }, [workspace?.id, projectId]);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<ProjectViewsFilters>;
      if (!ce.detail) return;
      setFilters((prev) => ({ ...prev, ...ce.detail }));
    };
    window.addEventListener(PROJECT_VIEWS_FILTER_EVENT, handler as EventListener);
    return () => {
      window.removeEventListener(
        PROJECT_VIEWS_FILTER_EVENT,
        handler as EventListener,
      );
    };
  }, []);

  const toggleFavorite = (viewId: string) => {
    if (!workspace?.id || !projectId) return;
    const key = getProjectViewsFavoritesKey(workspace.id, projectId);
    setFavoriteIds((prev) => {
      const next = prev.includes(viewId)
        ? prev.filter((id) => id !== viewId)
        : [...prev, viewId];
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const filteredViews = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const now = Date.now();
    const days =
      filters.createdDatePreset === "1_week"
        ? 7
        : filters.createdDatePreset === "2_weeks"
          ? 14
          : filters.createdDatePreset === "1_month"
            ? 30
            : null;
    const createdAfter = days ? now - days * 24 * 60 * 60 * 1000 : null;
    const customAfter = filters.createdAfter
      ? new Date(filters.createdAfter).getTime()
      : null;
    const customBefore = filters.createdBefore
      ? new Date(filters.createdBefore).getTime()
      : null;
    return views.filter((v) => {
      if (q) {
        const hay = `${v.name ?? ""} ${v.description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.favoritesOnly && !favoriteIds.includes(v.id)) return false;
      if (filters.createdByIds.length && !filters.createdByIds.includes(v.owned_by_id))
        return false;
      if (createdAfter) {
        const ts = v.created_at ? new Date(v.created_at).getTime() : 0;
        if (!ts || ts < createdAfter) return false;
      }
      if (filters.createdDatePreset === "custom") {
        const ts = v.created_at ? new Date(v.created_at).getTime() : 0;
        if (!ts) return false;
        if (customAfter && ts < customAfter) return false;
        if (customBefore && ts > customBefore + 24 * 60 * 60 * 1000 - 1)
          return false;
      }
      return true;
    });
  }, [views, filters, favoriteIds]);

  const sortedViews = useMemo(() => {
    const list = [...filteredViews];
    const sortBy = display.sortBy;
    const sortOrder = display.sortOrder;
    list.sort((a, b) => {
      let va: string | number = "";
      let vb: string | number = "";
      if (sortBy === "name") {
        va = a.name ?? "";
        vb = b.name ?? "";
      } else if (sortBy === "created_at") {
        va = a.created_at ? new Date(a.created_at).getTime() : 0;
        vb = b.created_at ? new Date(b.created_at).getTime() : 0;
      } else {
        va = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        vb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      }
      const cmp =
        typeof va === "string" && typeof vb === "string"
          ? va.localeCompare(vb, undefined, { sensitivity: "base" })
          : Number(va) - Number(vb);
      return sortOrder === "asc" ? cmp : -cmp;
    });
    return list;
  }, [filteredViews, display.sortBy, display.sortOrder]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceSlug || !projectId || !title.trim() || !canCreateViews) return;
    setSubmitting(true);
    setError(null);
    try {
      await viewService.create(workspaceSlug, {
        name: title.trim(),
        description: description.trim() || undefined,
        project_id: projectId,
      });
      setCreateOpen(false);
      setTitle("");
      setDescription("");
      await loadPageData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create view.");
    } finally {
      setSubmitting(false);
    }
  };

  const activeView = useMemo(
    () => views.find((v) => v.id === editOpenId) ?? null,
    [views, editOpenId],
  );
  const deleteView = useMemo(
    () => views.find((v) => v.id === deleteOpenId) ?? null,
    [views, deleteOpenId],
  );

  const openEdit = (view: IssueViewApiResponse) => {
    setEditOpenId(view.id);
    setEditTitle(view.name ?? "");
    setEditDescription(view.description ?? "");
    setError(null);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceSlug || !activeView || !editTitle.trim()) return;
    setEditing(true);
    setError(null);
    try {
      await viewService.update(workspaceSlug, activeView.id, {
        name: editTitle.trim(),
        description: editDescription.trim() || undefined,
      });
      setEditOpenId(null);
      await loadPageData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update view.");
    } finally {
      setEditing(false);
    }
  };

  const handleDelete = async () => {
    if (!workspaceSlug || !deleteView) return;
    setDeleting(true);
    setError(null);
    try {
      await viewService.remove(workspaceSlug, deleteView.id);
      setDeleteOpenId(null);
      await loadPageData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete view.");
    } finally {
      setDeleting(false);
    }
  };

  const copyViewLink = async (viewId: string) => {
    if (!workspaceSlug || !projectId) return;
    setCopyingId(viewId);
    try {
      const href = `${window.location.origin}/${workspaceSlug}/projects/${projectId}/views/${viewId}`;
      await navigator.clipboard.writeText(href);
    } finally {
      setTimeout(() => setCopyingId((prev) => (prev === viewId ? null : prev)), 800);
    }
  };

  const formatDate = (value?: string) =>
    value
      ? new Date(value).toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
        })
      : "—";

  const IconStar = ({ filled }: { filled: boolean }) => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polygon points="12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9" />
    </svg>
  );

  const memberNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of members) {
      const label =
        member.member_display_name?.trim() ||
        member.member_email?.split("@")[0]?.trim() ||
        "Member";
      map.set(member.member_id, label);
    }
    return map;
  }, [members]);

  const myProjectRole = useMemo(() => {
    if (!user) return null;
    const current = projectMembers.find((m) => m.member_id === user.id);
    return current?.role ?? null;
  }, [projectMembers, user]);

  const viewsFeatureEnabled = project?.issue_views_view !== false;
  const canCreateViews =
    !!user &&
    viewsFeatureEnabled &&
    (project?.owner_id === user.id ||
      (typeof myProjectRole === "number" &&
        myProjectRole >= PROJECT_MEMBER_ROLE_MIN_CREATE));

  const noViewsAtAll = views.length === 0;
  const hasFilteredOutResults = views.length > 0 && sortedViews.length === 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-(--txt-tertiary)">
        Loading…
      </div>
    );
  }
  if (!workspace || !project) {
    return (
      <div className="px-6 py-8 text-sm text-(--txt-secondary)">
        {loadError ?? "Project not found."}
      </div>
    );
  }
  if (!viewsFeatureEnabled) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-10">
        <div className="max-w-xl rounded-lg border border-(--border-subtle) bg-(--bg-layer-1) p-6 text-center">
          <h2 className="text-lg font-semibold text-(--txt-primary)">
            Views are disabled for this project
          </h2>
          <p className="mt-2 text-sm text-(--txt-secondary)">
            Enable the Views feature in project settings to create and manage
            project views.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="-mt-(--padding-page) -mr-(--padding-page) -mb-(--padding-page) flex min-h-0 flex-1 flex-col">
        {noViewsAtAll ? (
          <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto px-8 py-10">
            <div className="w-full max-w-5xl">
              <h2 className="text-2xl font-semibold text-(--txt-primary)">
                Save filtered views for your project. Create as many as you need
              </h2>
              <p className="mt-2 max-w-4xl text-sm text-(--txt-secondary)">
                Views are a set of saved filters that you use frequently or want
                easy access to. All your colleagues in a project can see
                everyone&apos;s views and choose whichever suits their needs
                best.
              </p>
              <div className="mt-6 rounded-lg border border-(--border-subtle) bg-(--bg-layer-1) p-6">
                <div className="mx-auto flex h-80 w-full max-w-4xl items-center justify-center rounded-md border border-(--border-subtle) bg-(--bg-surface-1)">
                  <div className="space-y-3 text-center">
                    <div className="mx-auto h-12 w-12 rounded-md border border-(--border-subtle) bg-(--bg-layer-1)" />
                    <p className="text-sm text-(--txt-tertiary)">
                      No project views yet
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-7 flex justify-center">
                <Button
                  size="sm"
                  onClick={() => setCreateOpen(true)}
                  disabled={!canCreateViews}
                >
                  Create your first view
                </Button>
              </div>
            </div>
          </div>
        ) : hasFilteredOutResults ? (
          <div className="flex min-h-0 flex-1 items-center justify-center px-8 py-10">
            <div className="max-w-lg text-center">
              <h3 className="text-lg font-semibold text-(--txt-primary)">
                No views match your filters
              </h3>
              <p className="mt-2 text-sm text-(--txt-secondary)">
                Try clearing or relaxing your search, created date, favorites, or
                created-by filters.
              </p>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="divide-y divide-(--border-subtle)">
              {sortedViews.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between px-6 py-4 hover:bg-(--bg-layer-1-hover)"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="flex size-8 items-center justify-center rounded-md text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2-hover) hover:text-(--txt-icon-secondary)"
                        aria-label={
                          favoriteIds.includes(v.id)
                            ? "Unfavorite view"
                            : "Favorite view"
                        }
                        onClick={() => toggleFavorite(v.id)}
                      >
                        <IconStar filled={favoriteIds.includes(v.id)} />
                      </button>
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/${workspaceSlug}/projects/${projectId}/views/${v.id}`,
                            )
                          }
                          className="max-w-120 truncate text-left text-sm font-medium text-(--txt-primary) hover:underline"
                        >
                          {v.name}
                        </button>
                        <p className="mt-0.5 truncate text-xs text-(--txt-secondary)">
                          {v.description || "Saved project view"}
                        </p>
                        <p className="mt-0.5 text-xs text-(--txt-tertiary)">
                          Created by {memberNameById.get(v.owned_by_id) ?? "Member"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="ml-4 flex shrink-0 items-center gap-2 text-xs text-(--txt-tertiary)">
                    <span>Updated {formatDate(v.updated_at)}</span>
                    <button
                      type="button"
                      onClick={() => copyViewLink(v.id)}
                      className="rounded px-2 py-1 text-(--txt-secondary) hover:bg-(--bg-layer-2-hover) hover:text-(--txt-primary)"
                    >
                      {copyingId === v.id ? "Copied" : "Copy link"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        window.open(
                          `/${workspaceSlug}/projects/${projectId}/views/${v.id}`,
                          "_blank",
                        )
                      }
                      className="rounded px-2 py-1 text-(--txt-secondary) hover:bg-(--bg-layer-2-hover) hover:text-(--txt-primary)"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      disabled={!canCreateViews}
                      onClick={() => openEdit(v)}
                      className="rounded px-2 py-1 text-(--txt-secondary) hover:bg-(--bg-layer-2-hover) hover:text-(--txt-primary) disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={!canCreateViews}
                      onClick={() => setDeleteOpenId(v.id)}
                      className="rounded px-2 py-1 text-(--txt-danger-primary) hover:bg-(--bg-layer-2-hover) disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <Modal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setError(null);
        }}
        title="New view"
        className="max-w-lg"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCreateOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="project-create-view-form"
              disabled={submitting || !title.trim() || !canCreateViews}
            >
              {submitting ? "Creating..." : "Add view"}
            </Button>
          </>
        }
      >
        <form
          id="project-create-view-form"
          onSubmit={handleCreate}
          className="space-y-4"
        >
          <Input
            label="Name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="View name"
            autoFocus
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
              className="w-full rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
            />
          </div>
          {error && (
            <p className="text-sm text-(--txt-danger-primary)">{error}</p>
          )}
        </form>
      </Modal>
      <Modal
        open={!!editOpenId}
        onClose={() => {
          setEditOpenId(null);
          setError(null);
        }}
        title="Edit view"
        className="max-w-lg"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditOpenId(null)}
              disabled={editing}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="project-edit-view-form"
              disabled={editing || !editTitle.trim()}
            >
              {editing ? "Saving..." : "Save changes"}
            </Button>
          </>
        }
      >
        <form
          id="project-edit-view-form"
          onSubmit={handleEdit}
          className="space-y-4"
        >
          <Input
            label="Name"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="View name"
            autoFocus
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
              Description
            </label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
              className="w-full rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
            />
          </div>
          {error && (
            <p className="text-sm text-(--txt-danger-primary)">{error}</p>
          )}
        </form>
      </Modal>
      <Modal
        open={!!deleteOpenId}
        onClose={() => {
          setDeleteOpenId(null);
          setError(null);
        }}
        title="Delete view"
        className="max-w-md"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeleteOpenId(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-(--txt-secondary)">
          Delete view{" "}
          <span className="font-medium text-(--txt-primary)">
            {deleteView?.name ?? "this view"}
          </span>
          ? This action cannot be undone.
        </p>
        {error && (
          <p className="mt-3 text-sm text-(--txt-danger-primary)">{error}</p>
        )}
      </Modal>
    </>
  );
}
