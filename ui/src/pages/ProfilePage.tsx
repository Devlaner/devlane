import { useParams, Link } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Avatar, Card, CardContent } from "../components/ui";
import { getImageUrl } from "../lib/utils";
import { workspaceService } from "../services/workspaceService";
import { projectService } from "../services/projectService";
import { issueService } from "../services/issueService";
import { stateService } from "../services/stateService";
import type {
  WorkspaceApiResponse,
  ProjectApiResponse,
  IssueApiResponse,
  StateApiResponse,
  WorkspaceMemberApiResponse,
} from "../api/types";
// import type { Issue } from "../types"; // reserved for future use

type TabId = "summary" | "assigned" | "created" | "subscribed" | "activity";

function formatTimeAgo(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const min = Math.floor(diffMs / 60000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 0) return `${day} day${day === 1 ? "" : "s"} ago`;
  if (hr > 0) return `about ${hr} hour${hr === 1 ? "" : "s"} ago`;
  if (min > 0) return `about ${min} minute${min === 1 ? "" : "s"} ago`;
  return "just now";
}

function formatJoinedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ProfilePage() {
  const { workspaceSlug, userId } = useParams<{
    workspaceSlug: string;
    userId: string;
  }>();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [issues, setIssues] = useState<IssueApiResponse[]>([]);
  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceSlug) {
      queueMicrotask(() => setLoading(false));
      return;
    }
    let cancelled = false;
    queueMicrotask(() => setLoading(true));
    workspaceService
      .getBySlug(workspaceSlug)
      .then((w) => {
        if (!cancelled) setWorkspace(w ?? null);
        return Promise.all([
          projectService.list(workspaceSlug),
          workspaceService.listMembers(workspaceSlug),
        ]);
      })
      .then((res) => {
        const [list, mem] = res ?? [[], []];
        if (!cancelled && list) setProjects(list);
        if (!cancelled) setMembers(mem ?? []);
        if (!cancelled && list?.length)
          return Promise.all([
            ...list.map((p) =>
              issueService.list(workspaceSlug!, p.id, { limit: 100 }),
            ),
            ...list.map((p) => stateService.list(workspaceSlug!, p.id)),
          ]);
        return [];
      })
      .then((results) => {
        if (cancelled || !results?.length) return;
        const half = results.length / 2;
        setIssues((results.slice(0, half) as IssueApiResponse[][]).flat());
        setStates((results.slice(half) as StateApiResponse[][]).flat());
      })
      .catch(() => {
        if (!cancelled) setWorkspace(null);
        setProjects([]);
        setIssues([]);
        setStates([]);
        setMembers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  const profileUser = useMemo(() => {
    if (userId && user?.id === userId) return user;
    return user ?? null; // Only current user supported until user-by-id API exists
  }, [userId, user]);

  const member = profileUser
    ? (members.find((m) => m.member_id === profileUser.id) ?? null)
    : null;
  const joinedAt = member?.created_at ?? new Date().toISOString();

  const issuesCreated = useMemo(
    () =>
      profileUser
        ? issues.filter((i) => i.created_by_id === profileUser.id)
        : [],
    [profileUser, issues],
  );
  const issuesAssigned = useMemo((): IssueApiResponse[] => {
    if (!profileUser?.id) return [];
    return issues.filter((i) =>
      (i.assignee_ids ?? []).includes(profileUser.id),
    );
  }, [profileUser, issues]);
  const issuesSubscribed = issuesAssigned.length;
  const issuesSubscribedList = issuesAssigned;

  const workloadByState = useMemo(() => {
    const byState: Record<string, number> = {};
    issuesAssigned.forEach((i) => {
      const sid = (i as { state_id?: string }).state_id;
      if (sid) byState[sid] = (byState[sid] ?? 0) + 1;
    });
    return byState;
  }, [issuesAssigned]);

  const workloadCategories = useMemo(() => {
    const backlog = states.filter((s) => s.name === "Backlog").map((s) => s.id);
    const notStarted = states.filter((s) => s.name === "Todo").map((s) => s.id);
    const workingOn = states
      .filter((s) => s.name === "In Progress")
      .map((s) => s.id);
    const completed = states.filter((s) => s.name === "Done").map((s) => s.id);
    const canceled: string[] = [];
    return [
      { id: "backlog", label: "Backlog", color: "#94a3b8", stateIds: backlog },
      {
        id: "not-started",
        label: "Not started",
        color: "#3b82f6",
        stateIds: notStarted,
      },
      {
        id: "working-on",
        label: "Working on",
        color: "#f59e0b",
        stateIds: workingOn,
      },
      {
        id: "completed",
        label: "Completed",
        color: "#22c55e",
        stateIds: completed,
      },
      {
        id: "canceled",
        label: "Canceled",
        color: "#ef4444",
        stateIds: canceled,
      },
    ];
  }, [states]);

  const priorityCounts = useMemo(() => {
    const counts: Record<string, number> = {
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
      none: 0,
    };
    issuesAssigned.forEach((i) => {
      const p = i.priority ?? "none";
      counts[p] = (counts[p] ?? 0) + 1;
    });
    return counts;
  }, [issuesAssigned]);

  const stateCountsForDonut = useMemo(() => {
    return workloadCategories.map((cat) => ({
      label: cat.label,
      color: cat.color,
      count: cat.stateIds.reduce(
        (sum, id) => sum + (workloadByState[id] ?? 0),
        0,
      ),
    }));
  }, [workloadCategories, workloadByState]);

  const recentActivity = useMemo((): Array<{
    id: string;
    projectId: string;
    issueId: string;
    type: string;
    createdAt: string;
    labelName?: string;
    cycleName?: string;
    assigneeName?: string;
  }> => {
    if (!profileUser) return [];
    const created = issuesCreated
      .map((i) => ({
        id: `created-${i.id}`,
        projectId: i.project_id,
        issueId: i.id,
        type: "created" as const,
        createdAt: i.created_at ?? i.updated_at ?? new Date().toISOString(),
      }))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 20);
    return created;
  }, [profileUser, issuesCreated]);

  const projectsWithProgress = useMemo(() => {
    return projects
      .filter((p) => p.workspace_id === workspace?.id)
      .map((p) => ({
        ...p,
        progress: 0,
      }));
  }, [workspace?.id, projects]);

  const projectStateBreakdown = useMemo(() => {
    return projectsWithProgress.map((p) => {
      const statesForProject = states.filter((s) => s.project_id === p.id);
      const stateCounts = statesForProject.map((s) => ({
        ...s,
        count: issues.filter(
          (i) => i.project_id === p.id && i.state_id === s.id,
        ).length,
      }));
      return { project: p, states: stateCounts };
    });
  }, [projectsWithProgress, states, issues]);

  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(
    new Set(),
  );

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-[var(--txt-tertiary)]">
        Loading…
      </div>
    );
  }
  if (!workspace) {
    return (
      <div className="p-4 text-[var(--txt-secondary)]">
        Workspace not found.
      </div>
    );
  }

  const baseUrl = `/${workspace.slug}`;
  const tabs: { id: TabId; label: string }[] = [
    { id: "summary", label: "Summary" },
    { id: "assigned", label: "Assigned" },
    { id: "created", label: "Created" },
    { id: "subscribed", label: "Subscribed" },
    { id: "activity", label: "Activity" },
  ];

  return (
    <div className="flex h-full min-h-0 gap-6">
      {/* Main content */}
      <div className="min-w-0 flex-1 space-y-6 pb-8">
        {/* Tabs */}
        <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface-1)]">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "border-[var(--brand-default)] text-[var(--txt-primary)]"
                    : "border-transparent text-[var(--txt-secondary)] hover:bg-[var(--bg-layer-transparent-hover)] hover:text-[var(--txt-primary)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "summary" && (
          <>
            {/* Overview */}
            <section>
              <h2 className="mb-3 text-sm font-semibold text-[var(--txt-primary)]">
                Overview
              </h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setActiveTab("created")}
                  className="w-full cursor-pointer rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] text-left transition-colors hover:bg-[var(--bg-layer-1-hover)] focus:outline-none"
                >
                  <Card
                    variant="outlined"
                    className="border-0 bg-transparent shadow-none"
                  >
                    <CardContent className="flex items-center gap-3 p-4">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--bg-layer-1)] text-[var(--txt-icon-secondary)]">
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="12" y1="18" x2="12" y2="12" />
                          <line x1="9" y1="15" x2="15" y2="15" />
                        </svg>
                      </span>
                      <div>
                        <p className="text-2xl font-semibold text-[var(--txt-primary)]">
                          {issuesCreated.length}
                        </p>
                        <p className="text-sm text-[var(--txt-secondary)]">
                          Work items created
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("assigned")}
                  className="w-full cursor-pointer rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] text-left transition-colors hover:bg-[var(--bg-layer-1-hover)] focus:outline-none"
                >
                  <Card
                    variant="outlined"
                    className="border-0 bg-transparent shadow-none"
                  >
                    <CardContent className="flex items-center gap-3 p-4">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--bg-layer-1)] text-[var(--txt-icon-secondary)]">
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                      </span>
                      <div>
                        <p className="text-2xl font-semibold text-[var(--txt-primary)]">
                          {issuesAssigned.length}
                        </p>
                        <p className="text-sm text-[var(--txt-secondary)]">
                          Work items assigned
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("subscribed")}
                  className="w-full cursor-pointer rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] text-left transition-colors hover:bg-[var(--bg-layer-1-hover)] focus:outline-none"
                >
                  <Card
                    variant="outlined"
                    className="border-0 bg-transparent shadow-none"
                  >
                    <CardContent className="flex items-center gap-3 p-4">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--bg-layer-1)] text-[var(--txt-icon-secondary)]">
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                        </svg>
                      </span>
                      <div>
                        <p className="text-2xl font-semibold text-[var(--txt-primary)]">
                          {issuesSubscribed}
                        </p>
                        <p className="text-sm text-[var(--txt-secondary)]">
                          Work items subscribed
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              </div>
            </section>

            {/* Workload */}
            <section>
              <h2 className="mb-3 text-sm font-semibold text-[var(--txt-primary)]">
                Workload
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {workloadCategories.map((cat) => {
                  const count = cat.stateIds.reduce(
                    (sum, id) => sum + (workloadByState[id] ?? 0),
                    0,
                  );
                  return (
                    <Card
                      key={cat.id}
                      variant="outlined"
                      className="border border-[var(--border-subtle)] bg-[var(--bg-surface-1)]"
                    >
                      <CardContent className="flex items-center gap-3 p-4">
                        <span
                          className="h-3 w-3 shrink-0 rounded-sm"
                          style={{ backgroundColor: cat.color }}
                          aria-hidden
                        />
                        <div>
                          <p className="text-2xl font-semibold text-[var(--txt-primary)]">
                            {count}
                          </p>
                          <p className="text-sm text-[var(--txt-secondary)]">
                            {cat.label}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
              <section>
                <h2 className="mb-3 text-sm font-semibold text-[var(--txt-primary)]">
                  Work items by Priority
                </h2>
                <Card
                  variant="outlined"
                  className="border border-[var(--border-subtle)] bg-[var(--bg-surface-1)]"
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-2">
                      {(
                        ["urgent", "high", "medium", "low", "none"] as const
                      ).map((p) => {
                        const count = priorityCounts[p] ?? 0;
                        const max = Math.max(
                          1,
                          ...Object.values(priorityCounts),
                        );
                        const width = max ? (count / max) * 100 : 0;
                        const barColor =
                          p === "urgent"
                            ? "#ef4444"
                            : p === "high"
                              ? "#f87171"
                              : p === "medium"
                                ? "#f59e0b"
                                : p === "low"
                                  ? "#60a5fa"
                                  : "#94a3b8";
                        return (
                          <div key={p} className="flex items-center gap-3">
                            <span className="w-16 shrink-0 capitalize text-sm text-[var(--txt-secondary)]">
                              {p}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="h-6 overflow-hidden rounded bg-[var(--bg-layer-1)]">
                                <div
                                  className="h-full rounded"
                                  style={{
                                    width: `${width}%`,
                                    minWidth: count ? 8 : 0,
                                    maxWidth: "100%",
                                    backgroundColor: barColor,
                                  }}
                                />
                              </div>
                            </div>
                            <span className="w-6 text-right text-sm text-[var(--txt-secondary)]">
                              {count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </section>
              <section>
                <h2 className="mb-3 text-sm font-semibold text-[var(--txt-primary)]">
                  Work items by state
                </h2>
                <Card
                  variant="outlined"
                  className="border border-[var(--border-subtle)] bg-[var(--bg-surface-1)]"
                >
                  <CardContent className="flex flex-wrap items-center gap-6 p-4">
                    <div className="relative h-32 w-32 shrink-0">
                      <DonutChart data={stateCountsForDonut} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {stateCountsForDonut.map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span
                            className="h-3 w-3 shrink-0 rounded-sm"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-[var(--txt-secondary)]">
                            {item.label}
                          </span>
                          <span className="text-[var(--txt-primary)]">
                            ({item.count})
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </section>
            </div>

            {/* Recent activity */}
            <section>
              <h2 className="mb-3 text-sm font-semibold text-[var(--txt-primary)]">
                Recent activity
              </h2>
              <Card
                variant="outlined"
                className="border border-[var(--border-subtle)] bg-[var(--bg-surface-1)]"
              >
                <CardContent className="p-0">
                  <ul className="divide-y divide-[var(--border-subtle)]">
                    {recentActivity.length === 0 ? (
                      <li className="px-4 py-6 text-center text-sm text-[var(--txt-tertiary)]">
                        No recent activity
                      </li>
                    ) : (
                      recentActivity.map((act) => {
                        const project = projects.find(
                          (p) => p.id === act.projectId,
                        );
                        const issue = issues.find(
                          (i) =>
                            i.id === act.issueId &&
                            i.project_id === act.projectId,
                        );
                        const issueRef =
                          project && issue
                            ? `${project.identifier ?? ""}-${issue.sequence_id ?? issue.id.slice(-4)}`
                            : "";
                        const issueTitle = issue?.name ?? "";
                        let text: React.ReactNode = "";
                        if (act.type === "label" && act.labelName) {
                          text = (
                            <>
                              You added a new label{" "}
                              <span className="rounded bg-[var(--bg-warning-subtle)] px-1.5 py-0.5 text-[var(--txt-warning-primary)]">
                                {act.labelName}
                              </span>{" "}
                              to {issueRef} {issueTitle}{" "}
                              {formatTimeAgo(act.createdAt)}
                            </>
                          );
                        } else if (act.type === "cycle" && act.cycleName) {
                          text = (
                            <>
                              You added {issueRef} {issueTitle} to the cycle{" "}
                              {act.cycleName} {formatTimeAgo(act.createdAt)}
                            </>
                          );
                        } else if (
                          act.type === "assignee" &&
                          act.assigneeName
                        ) {
                          text = (
                            <>
                              You added a new assignee {act.assigneeName} to{" "}
                              {issueRef} {formatTimeAgo(act.createdAt)}
                            </>
                          );
                        } else if (act.type === "created") {
                          text = (
                            <>
                              You created {issueRef} {issueTitle}{" "}
                              {formatTimeAgo(act.createdAt)}
                            </>
                          );
                        } else {
                          text = <>Activity {formatTimeAgo(act.createdAt)}</>;
                        }
                        return (
                          <li key={act.id} className="flex gap-3 px-4 py-3">
                            <Avatar
                              name={profileUser?.name ?? "?"}
                              src={
                                getImageUrl(profileUser?.avatarUrl) ?? undefined
                              }
                              size="sm"
                              className="shrink-0"
                            />
                            <p className="min-w-0 text-sm text-[var(--txt-secondary)]">
                              {text}
                            </p>
                          </li>
                        );
                      })
                    )}
                  </ul>
                </CardContent>
              </Card>
            </section>
          </>
        )}

        {activeTab === "assigned" && (
          <WorkItemsList
            issues={issuesAssigned}
            states={states}
            projects={projects}
            members={members}
            baseUrl={baseUrl}
            workspaceSlug={workspace.slug}
          />
        )}
        {activeTab === "created" && (
          <WorkItemsList
            issues={issuesCreated}
            states={states}
            projects={projects}
            members={members}
            baseUrl={baseUrl}
            workspaceSlug={workspace.slug}
          />
        )}
        {activeTab === "subscribed" && (
          <WorkItemsList
            issues={issuesSubscribedList}
            states={states}
            projects={projects}
            members={members}
            baseUrl={baseUrl}
            workspaceSlug={workspace.slug}
          />
        )}
        {activeTab === "activity" && (
          <ActivityTab
            activities={recentActivity}
            projects={projects}
            issues={issues}
            profileUser={profileUser}
            formatTimeAgo={formatTimeAgo}
          />
        )}
      </div>

      {/* Right sidebar: profile + projects */}
      <aside className="hidden w-72 shrink-0 lg:flex lg:flex-col">
        <Card
          variant="outlined"
          className="flex min-h-0 flex-1 flex-col overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface-1)]"
        >
          <div
            className="relative h-20 shrink-0 bg-gradient-to-br from-[var(--brand-default)] to-[#0ea5e9]"
            style={
              getImageUrl(profileUser?.coverImageUrl)
                ? {
                    backgroundImage: `url(${getImageUrl(profileUser?.coverImageUrl)})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : undefined
            }
          >
            <button
              type="button"
              className="absolute right-2 top-2 rounded p-1.5 text-white/80 hover:bg-white/20 hover:text-white"
              aria-label="Edit profile"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          </div>
          <div
            className="relative flex min-h-0 flex-1 flex-col px-4 pb-4"
            style={{ marginTop: "-28px" }}
          >
            <div className="mb-3 flex justify-center shrink-0">
              <Avatar
                name={profileUser?.name ?? "?"}
                src={getImageUrl(profileUser?.avatarUrl) ?? undefined}
                size="lg"
                className="h-14 w-14"
              />
            </div>
            <h3 className="text-center text-base font-semibold text-[var(--txt-primary)] shrink-0">
              {profileUser?.name ?? "—"}
            </h3>
            <p className="text-center text-sm text-[var(--txt-tertiary)] shrink-0">
              ({profileUser?.email?.split("@")[0] ?? "user"})
            </p>
            <p className="mt-2 text-center text-xs text-[var(--txt-secondary)] shrink-0">
              Joined on {formatJoinedDate(joinedAt)}
            </p>
            <p className="text-center text-xs text-[var(--txt-secondary)] shrink-0">
              Timezone 23:10 UTC
            </p>
            <div className="mt-4 flex min-h-0 flex-1 flex-col pt-4">
              <p className="mb-2 shrink-0 text-xs font-medium uppercase tracking-wide text-[var(--txt-tertiary)]">
                Projects
              </p>
              <ul className="min-h-0 flex-1 overflow-auto">
                {projectStateBreakdown.map(({ project: p, states }, index) => {
                  const expanded = expandedProjectIds.has(p.id);
                  const total = states.reduce((sum, s) => sum + s.count, 0);
                  const projectIcon = p.name
                    .toLowerCase()
                    .includes("logistics") ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="shrink-0 text-[var(--txt-icon-tertiary)]"
                    >
                      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
                      <path d="M15 18h2" />
                      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
                    </svg>
                  ) : (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="shrink-0 text-[var(--txt-icon-tertiary)]"
                    >
                      <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
                      <path d="M9 22v-4h6v4" />
                      <path d="M8 6h.01" />
                      <path d="M16 6h.01" />
                      <path d="M12 6h.01" />
                      <path d="M12 10h.01" />
                      <path d="M12 14h.01" />
                      <path d="M16 10h.01" />
                      <path d="M8 10h.01" />
                      <path d="M8 14h.01" />
                      <path d="M16 14h.01" />
                    </svg>
                  );
                  return (
                    <li
                      key={p.id}
                      className={
                        index > 0
                          ? "border-t border-[var(--border-subtle)]"
                          : undefined
                      }
                    >
                      <div className="py-1">
                        <button
                          type="button"
                          onClick={() => toggleProjectExpanded(p.id)}
                          className="flex w-full items-center justify-between gap-2 py-1.5 pr-1 text-left text-sm text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            {projectIcon}
                            <Link
                              to={`${baseUrl}/projects/${p.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="truncate hover:underline"
                            >
                              {p.name}
                            </Link>
                          </span>
                          {p.progress > 0 ? (
                            <span className="shrink-0 rounded px-1.5 py-0.5 text-xs text-[var(--txt-secondary)] bg-[var(--bg-layer-2)]">
                              {p.progress}%
                            </span>
                          ) : (
                            <span className="shrink-0 rounded px-1.5 py-0.5 text-xs text-[var(--txt-danger-primary)] bg-[var(--bg-danger-subtle)]">
                              0%
                            </span>
                          )}
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className={`shrink-0 text-[var(--txt-icon-tertiary)] transition-transform ${expanded ? "rotate-0" : "-rotate-90"}`}
                          >
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </button>
                        {expanded && (
                          <div className="ml-6 mr-1 pb-3">
                            <div className="mb-2 flex h-2 w-full overflow-hidden rounded-full bg-[var(--bg-layer-1)]">
                              {total > 0 ? (
                                states.map((s) => (
                                  <span
                                    key={s.id}
                                    className="h-full transition-all"
                                    style={{
                                      width: `${(s.count / total) * 100}%`,
                                      minWidth: s.count > 0 ? 4 : 0,
                                      backgroundColor: s.color ?? undefined,
                                    }}
                                    title={`${s.name}: ${s.count}`}
                                  />
                                ))
                              ) : (
                                <span className="h-full w-full bg-[var(--bg-layer-2)]" />
                              )}
                            </div>
                            <ul className="space-y-1">
                              {states.map((s) => (
                                <li
                                  key={s.id}
                                  className="flex items-center gap-2 text-xs"
                                >
                                  <span
                                    className="h-3 w-3 shrink-0 rounded-sm"
                                    style={{
                                      backgroundColor: s.color ?? undefined,
                                    }}
                                    aria-hidden
                                  />
                                  <span className="text-[var(--txt-secondary)]">
                                    {s.name}
                                  </span>
                                  <span className="text-[var(--txt-primary)]">
                                    — {s.count} Work item
                                    {s.count === 1 ? "" : "s"}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </Card>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Work items list (Assigned / Created / Subscribed tabs)
// ---------------------------------------------------------------------------

function WorkItemsList({
  issues,
  states: statesList,
  projects: projectsList,
  members: membersList = [],
  baseUrl,
  workspaceSlug,
}: {
  issues: Array<{
    id: string;
    project_id?: string;
    state_id?: string | null;
    name: string;
    sequence_id?: number;
    assignee_ids?: string[];
  }>;
  states: StateApiResponse[];
  projects: ProjectApiResponse[];
  members?: WorkspaceMemberApiResponse[];
  baseUrl: string;
  workspaceSlug: string;
}) {
  void workspaceSlug; // reserved for future use (e.g. links)
  const getStateName = (stateId: string) =>
    statesList.find((s) => s.id === stateId)?.name ?? stateId;
  const getUser = (
    userId: string | null,
  ): { name: string; avatarUrl?: string | null } | null => {
    if (!userId) return null;
    const m = membersList.find((x) => x.member_id === userId);
    const display = m?.member_display_name?.trim();
    const emailUser = m?.member_email?.split("@")[0]?.trim();
    const name = display || emailUser || "Member";
    const avatarUrl = m?.member_avatar ?? null;
    return { name, avatarUrl };
  };
  const getLabelNames = (labelIds: string[] = []) => {
    void labelIds; // reserved for future use
    return [] as string[];
  };
  const getCycle = (cycleId: string | null): { name: string } | null => {
    void cycleId; // reserved for future use
    return null;
  };

  return (
    <div className="space-y-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--txt-primary)]">
            All work items {issues.length}
          </span>
          <button
            type="button"
            className="rounded p-1.5 text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-1-hover)] hover:text-[var(--txt-icon-secondary)]"
            aria-label="Refresh"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-md text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-1-hover)]"
            aria-label="List view"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-md text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-1-hover)]"
            aria-label="Chart view"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] px-2.5 py-1.5 text-sm text-[var(--txt-secondary)] hover:bg-[var(--bg-layer-2-hover)]"
          >
            Filters
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] px-2.5 py-1.5 text-sm text-[var(--txt-secondary)] hover:bg-[var(--bg-layer-2-hover)]"
          >
            Display
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>
      <Card
        variant="outlined"
        className="overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface-1)]"
      >
        <CardContent className="p-0">
          {issues.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--txt-tertiary)]">
              No work items
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {issues.map((issue) => {
                const apiIssue = issue as {
                  id: string;
                  project_id?: string;
                  state_id?: string | null;
                  name: string;
                  sequence_id?: number;
                  assignee_ids?: string[];
                };
                const project = apiIssue.project_id
                  ? projectsList.find((p) => p.id === apiIssue.project_id)
                  : null;
                const issueRef = project
                  ? `${project.identifier ?? ""}-${apiIssue.sequence_id ?? issue.id.slice(-4)}`
                  : issue.id;
                const issueUrl = `${baseUrl}/projects/${apiIssue.project_id}/issues/${issue.id}`;
                const stateName = getStateName(apiIssue.state_id ?? "");
                const primaryAssigneeId = apiIssue.assignee_ids?.[0] ?? null;
                const assignee = getUser(primaryAssigneeId);
                const cycle = getCycle(null);
                const labelNames = getLabelNames([]);
                return (
                  <li key={issue.id}>
                    <Link
                      to={issueUrl}
                      className="flex flex-wrap items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--bg-layer-1-hover)]"
                    >
                      <span className="min-w-0 flex-1 font-medium text-[var(--txt-primary)]">
                        {issueRef} {apiIssue.name}
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-sm text-[var(--txt-secondary)]">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-[var(--border-strong)]" />
                        {stateName}
                      </span>
                      <span className="shrink-0 text-[var(--txt-icon-tertiary)]">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <line x1="18" y1="20" x2="18" y2="10" />
                          <line x1="12" y1="20" x2="12" y2="4" />
                          <line x1="6" y1="20" x2="6" y2="14" />
                        </svg>
                      </span>
                      <span className="shrink-0 text-[var(--txt-icon-tertiary)]">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                          <path d="M21 3v5h-5" />
                        </svg>
                      </span>
                      <span className="shrink-0 text-[var(--txt-icon-tertiary)]">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <rect
                            width="18"
                            height="18"
                            x="3"
                            y="4"
                            rx="2"
                            ry="2"
                          />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                      </span>
                      {assignee && (
                        <Avatar
                          name={assignee.name}
                          src={getImageUrl(assignee.avatarUrl) ?? undefined}
                          size="sm"
                          className="shrink-0"
                        />
                      )}
                      {cycle && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-layer-1)] px-2 py-0.5 text-xs text-[var(--txt-secondary)]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-default)]" />
                          {cycle.name}
                        </span>
                      )}
                      {labelNames.map((name) => (
                        <span
                          key={name}
                          className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-warning-subtle)] px-2 py-0.5 text-xs text-[var(--txt-warning-primary)]"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--txt-warning-primary)]" />
                          {name}
                        </span>
                      ))}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        className="shrink-0 rounded p-1 text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-1-hover)]"
                        aria-label="More options"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <circle cx="12" cy="5" r="1.5" />
                          <circle cx="12" cy="12" r="1.5" />
                          <circle cx="12" cy="19" r="1.5" />
                        </svg>
                      </button>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity tab: recent activity with download button and timeline icons
// ---------------------------------------------------------------------------

function ActivityTab({
  activities,
  projects: projectsList,
  issues: issuesList,
  profileUser,
  formatTimeAgo,
}: {
  activities: Array<{
    id: string;
    projectId: string;
    issueId: string;
    type: string;
    createdAt: string;
    labelName?: string;
    cycleName?: string;
    assigneeName?: string;
  }>;
  projects: ProjectApiResponse[];
  issues: IssueApiResponse[];
  profileUser: { name: string; avatarUrl?: string | null } | null;
  formatTimeAgo: (iso: string) => string;
}) {
  void profileUser; // reserved for future use
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[var(--txt-primary)]">
          Recent activity
        </h2>
        <button
          type="button"
          className="rounded-md bg-[var(--brand-default)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          Download today&apos;s activity
        </button>
      </div>
      <Card
        variant="outlined"
        className="border border-[var(--border-subtle)] bg-[var(--bg-surface-1)]"
      >
        <CardContent className="p-0">
          <ul className="divide-y divide-[var(--border-subtle)]">
            {activities.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-[var(--txt-tertiary)]">
                No recent activity
              </li>
            ) : (
              activities.map((act) => {
                const project = projectsList.find(
                  (p) => p.id === act.projectId,
                );
                const issue = issuesList.find(
                  (i) => i.id === act.issueId && i.project_id === act.projectId,
                );
                const issueRef =
                  project && issue
                    ? `${project.identifier ?? ""}-${issue.sequence_id ?? issue.id.slice(-4)}`
                    : "";
                const issueTitle = issue?.name ?? "";
                let icon = (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                );
                let text: React.ReactNode = "";
                if (act.type === "label" && act.labelName) {
                  icon = (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
                    </svg>
                  );
                  text = (
                    <>
                      You added a new label{" "}
                      <span className="inline-flex rounded bg-[var(--bg-warning-subtle)] px-1.5 py-0.5 text-[var(--txt-warning-primary)]">
                        {act.labelName}
                      </span>{" "}
                      to{" "}
                      <strong>
                        {issueRef} {issueTitle}
                      </strong>{" "}
                      {formatTimeAgo(act.createdAt)}.
                    </>
                  );
                } else if (act.type === "cycle" && act.cycleName) {
                  icon = (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                      <path d="M21 3v5h-5" />
                    </svg>
                  );
                  text = (
                    <>
                      You added{" "}
                      <strong>
                        {issueRef} {issueTitle}
                      </strong>{" "}
                      to the cycle <strong>{act.cycleName}</strong>{" "}
                      {formatTimeAgo(act.createdAt)}.
                    </>
                  );
                } else if (act.type === "assignee" && act.assigneeName) {
                  icon = (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  );
                  text = (
                    <>
                      You added a new assignee{" "}
                      <strong>{act.assigneeName}</strong> to{" "}
                      <strong>{issueRef}</strong> {formatTimeAgo(act.createdAt)}
                      .
                    </>
                  );
                } else if (act.type === "created") {
                  text = (
                    <>
                      You created{" "}
                      <strong>
                        {issueRef} {issueTitle}
                      </strong>{" "}
                      {formatTimeAgo(act.createdAt)}.
                    </>
                  );
                } else {
                  text = <>Activity {formatTimeAgo(act.createdAt)}.</>;
                }
                return (
                  <li key={act.id} className="flex gap-3 px-4 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-layer-1)] text-[var(--txt-icon-tertiary)]">
                      {icon}
                    </span>
                    <p className="min-w-0 text-sm text-[var(--txt-secondary)]">
                      {text}
                    </p>
                  </li>
                );
              })
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function DonutChart({
  data,
}: {
  data: { label: string; color: string; count: number }[];
}) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const parts = data.map((d, i) => {
    const start = data
      .slice(0, i)
      .reduce((s, x) => s + (x.count / total) * 100, 0);
    const end = start + (d.count / total) * 100;
    return `${d.color} ${start}% ${end}%`;
  });
  const conic = parts.length
    ? `conic-gradient(${parts.join(", ")})`
    : "var(--bg-layer-1)";
  return (
    <div
      className="absolute inset-0 rounded-full border-[8px] border-white"
      style={{ background: conic }}
      aria-hidden
    />
  );
}
