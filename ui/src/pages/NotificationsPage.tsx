import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Avatar, Button, Card, CardContent } from "../components/ui";
import { workspaceService } from "../services/workspaceService";
import { projectService } from "../services/projectService";
import { issueService } from "../services/issueService";
import { notificationService } from "../services/notificationService";
import type {
  WorkspaceApiResponse,
  NotificationApiResponse,
  ProjectApiResponse,
  IssueApiResponse,
} from "../api/types";

function formatTimeAgo(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 0) return `${day} day${day === 1 ? "" : "s"} ago`;
  if (hr > 0) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  if (min > 0) return `${min} minute${min === 1 ? "" : "s"} ago`;
  if (sec > 0) return `${sec} second${sec === 1 ? "" : "s"} ago`;
  return "less than a minute ago";
}

export function NotificationsPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const [inboxTab, setInboxTab] = useState<"all" | "mentions">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [notifications, setNotifications] = useState<NotificationApiResponse[]>(
    [],
  );
  const [selectedProject, setSelectedProject] =
    useState<ProjectApiResponse | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<IssueApiResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceSlug) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset loading when no slug (kept for future use)
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      workspaceService.getBySlug(workspaceSlug),
      notificationService.list(workspaceSlug),
      projectService.list(workspaceSlug),
    ])
      .then(([w, list, projs]) => {
        if (cancelled) return;
        setWorkspace(w ?? null);
        setNotifications(list ?? []);
        setProjects(projs ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setWorkspace(null);
          setNotifications([]);
          setProjects([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  const items = useMemo(() => {
    const list = notifications.map((n) => ({
      id: n.id,
      projectId: n.project_id ?? null,
      issueId: n.entity_identifier ?? null,
      type: n.entity_name ?? "all",
      actorUserId: n.triggered_by_id ?? null,
      title: n.title,
      message: n.message,
      createdAt: n.created_at,
      readAt: n.read_at ?? null,
    }));
    if (inboxTab === "mentions")
      return list.filter((i) => i.type === "mention");
    return list;
  }, [notifications, inboxTab]);

  const selectedItem = selectedId
    ? (items.find((i) => i.id === selectedId) ?? null)
    : null;

  useEffect(() => {
    if (!workspaceSlug || !selectedItem) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: clear selection when route changes (kept for future use)
      setSelectedProject(null);
      setSelectedIssue(null);
      return;
    }
    let cancelled = false;

    const markReadIfNeeded = async () => {
      if (selectedItem.readAt) return;
      try {
        await notificationService.markRead(workspaceSlug, selectedItem.id);
        if (!cancelled) {
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === selectedItem.id
                ? { ...n, read_at: new Date().toISOString() }
                : n,
            ),
          );
        }
      } catch {
        // ignore
      }
    };

    const fetchLinked = async () => {
      setSelectedProject(null);
      setSelectedIssue(null);
      const projectId = selectedItem.projectId;
      const issueId = selectedItem.issueId;
      if (!projectId || !issueId) return;
      try {
        const [p, iss] = await Promise.all([
          projectService.get(workspaceSlug, projectId),
          issueService.get(workspaceSlug, projectId, issueId),
        ]);
        if (!cancelled) {
          setSelectedProject(p ?? null);
          setSelectedIssue(iss ?? null);
        }
      } catch {
        if (!cancelled) {
          setSelectedProject(null);
          setSelectedIssue(null);
        }
      }
    };

    void markReadIfNeeded();
    void fetchLinked();
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, selectedItem]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-(--txt-tertiary)">
        Loading…
      </div>
    );
  }
  if (!workspace) {
    return (
      <div className="p-4 text-(--txt-secondary)">
        Workspace not found.
      </div>
    );
  }

  const listWidth = "min(420px, 35%)";

  return (
    <div className="flex h-full min-h-0 w-full">
      <div
        className="flex shrink-0 flex-col border-r border-(--border-subtle) bg-(--bg-canvas)"
        style={{ width: listWidth }}
      >
        <div className="shrink-0 border-b border-(--border-subtle) px-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setInboxTab("all")}
                className={`border-b-2 px-4 py-2.5 text-sm font-medium ${
                  inboxTab === "all"
                    ? "border-(--brand-default) text-(--txt-primary)"
                    : "border-transparent text-(--txt-secondary) hover:text-(--txt-primary)"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setInboxTab("mentions")}
                className={`border-b-2 px-4 py-2.5 text-sm font-medium ${
                  inboxTab === "mentions"
                    ? "border-(--brand-default) text-(--txt-primary)"
                    : "border-transparent text-(--txt-secondary) hover:text-(--txt-primary)"
                }`}
              >
                Mentions
              </button>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                if (!workspaceSlug) return;
                await notificationService.markAllRead(workspaceSlug);
                const refreshed = await notificationService.list(workspaceSlug);
                setNotifications(refreshed ?? []);
              }}
            >
              Mark all read
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-4 text-sm text-(--txt-tertiary)">
              No notifications.
            </div>
          ) : (
            <ul className="divide-y divide-(--border-subtle)">
              {items.map((item) => {
                const actorName = item.actorUserId
                  ? item.actorUserId.slice(0, 8)
                  : "system";
                const project = item.projectId
                  ? (projects.find((p) => p.id === item.projectId) ?? null)
                  : null;
                const issueRef = item.issueId ? item.issueId.slice(-4) : "—";
                const isSelected = selectedId === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={`flex w-full gap-3 px-4 py-3 text-left transition-colors ${
                        isSelected
                          ? "bg-(--bg-layer-1)"
                          : "hover:bg-(--bg-layer-1-hover)"
                      }`}
                    >
                      <Avatar name={actorName} size="md" className="shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-(--txt-primary)">
                          <span className="font-medium">{actorName}</span>{" "}
                          <span className="text-(--txt-secondary)">
                            {item.type}
                          </span>{" "}
                          <span className="font-semibold">{item.title}</span>
                        </p>
                        <p className="mt-0.5 truncate text-sm text-(--txt-secondary)">
                          {project ? (project.identifier ?? project.name) : "—"}
                          -{issueRef}
                        </p>
                      </div>
                      <span className="shrink-0 text-right text-xs text-(--txt-tertiary)">
                        <span className="block">
                          {formatTimeAgo(item.createdAt)}
                        </span>
                        {!item.readAt && (
                          <span className="mt-1 inline-block rounded bg-(--brand-200) px-2 py-0.5 text-[10px] font-medium text-(--brand-default)">
                            New
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1 bg-(--bg-canvas)">
        {!selectedItem ? (
          <div className="flex h-full items-center justify-center p-8 text-sm text-(--txt-tertiary)">
            Select a notification to see details.
          </div>
        ) : (
          <div className="h-full overflow-y-auto px-(--padding-page) py-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-(--txt-primary)">
                  {selectedItem.title}
                </h2>
                <p className="mt-1 text-sm text-(--txt-secondary)">
                  {formatTimeAgo(selectedItem.createdAt)}
                </p>
              </div>
              <div className="shrink-0">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!!selectedItem.readAt}
                  onClick={async () => {
                    if (!workspaceSlug) return;
                    await notificationService.markRead(
                      workspaceSlug,
                      selectedItem.id,
                    );
                    const refreshed =
                      await notificationService.list(workspaceSlug);
                    setNotifications(refreshed ?? []);
                  }}
                >
                  {selectedItem.readAt ? "Read" : "Mark read"}
                </Button>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Card variant="outlined">
                <CardContent className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-(--txt-tertiary)">
                    Project
                  </p>
                  <p className="text-sm text-(--txt-primary)">
                    {selectedProject?.name ?? "—"}
                  </p>
                </CardContent>
              </Card>
              <Card variant="outlined">
                <CardContent className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-(--txt-tertiary)">
                    Issue
                  </p>
                  <p className="text-sm text-(--txt-primary)">
                    {selectedIssue?.name ?? "—"}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card variant="outlined" className="mt-4">
              <CardContent>
                <p className="text-xs font-medium uppercase tracking-wide text-(--txt-tertiary)">
                  Message
                </p>
                <pre className="mt-2 whitespace-pre-wrap break-words rounded border border-(--border-subtle) bg-(--bg-surface-1) p-3 text-xs text-(--txt-secondary)">
                  {selectedItem.message
                    ? JSON.stringify(selectedItem.message, null, 2)
                    : "—"}
                </pre>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
