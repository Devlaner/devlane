import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Button, Input, Modal } from "../components/ui";
import { useWorkspaceViewsState } from "../contexts/WorkspaceViewsStateContext";
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
  const { display } = useWorkspaceViewsState();
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPageData = useCallback(() => {
    if (!workspaceSlug || !projectId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset loading when no slug/project (kept for future use)
      setLoading(false);
      return Promise.resolve();
    }
    setLoading(true);
    return Promise.all([
      workspaceService.getBySlug(workspaceSlug),
      projectService.get(workspaceSlug, projectId),
      viewService.list(workspaceSlug, projectId),
    ])
      .then(([w, p, list]) => {
        setWorkspace(w ?? null);
        setProject(p ?? null);
        setViews(list ?? []);
      })
      .catch(() => {
        setWorkspace(null);
        setProject(null);
        setViews([]);
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

  const sortedViews = useMemo(() => {
    const list = [...views];
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
  }, [views, display.sortBy, display.sortOrder]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceSlug || !projectId || !title.trim()) return;
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

  const formatDate = (value?: string) =>
    value
      ? new Date(value).toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
        })
      : "—";

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

  return (
    <>
      <div className="-mt-(--padding-page) -mr-(--padding-page) -mb-(--padding-page) flex min-h-0 flex-1 flex-col">
        {sortedViews.length === 0 ? (
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
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  Create your first view
                </Button>
              </div>
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
                    <p className="truncate text-sm font-medium text-(--txt-primary)">
                      {v.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-(--txt-secondary)">
                      {v.description || "Saved project view"}
                    </p>
                  </div>
                  <div className="shrink-0 text-xs text-(--txt-tertiary)">
                    Updated {formatDate(v.updated_at)}
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
              disabled={submitting || !title.trim()}
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
    </>
  );
}
