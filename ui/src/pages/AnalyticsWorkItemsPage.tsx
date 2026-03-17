import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { workspaceService } from "../services/workspaceService";
import { projectService } from "../services/projectService";
import { issueService } from "../services/issueService";
import { stateService } from "../services/stateService";
import type {
  WorkspaceApiResponse,
  ProjectApiResponse,
  IssueApiResponse,
  StateApiResponse,
} from "../api/types";
const IconSearch = () => (
  <svg
    width="14"
    height="14"
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
const IconBriefcase = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
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
const IconSettings = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);
const IconDownload = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);
export function AnalyticsWorkItemsPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [issues, setIssues] = useState<IssueApiResponse[]>([]);
  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceSlug) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset loading when no slug (kept for future use)
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    workspaceService
      .getBySlug(workspaceSlug)
      .then((w) => {
        if (cancelled) return;
        setWorkspace(w);
        return projectService.list(workspaceSlug);
      })
      .then((projs) => {
        if (!cancelled && projs?.length) setProjects(projs);
        if (!cancelled && projs?.length) {
          return Promise.all([
            ...projs.map((p) =>
              issueService.list(workspaceSlug!, p.id, { limit: 200 }),
            ),
            ...projs.map((p) => stateService.list(workspaceSlug!, p.id)),
          ]);
        }
        return [];
      })
      .then((results) => {
        if (cancelled || !results?.length) return;
        const half = results.length / 2;
        const issueArrays = results.slice(0, half) as IssueApiResponse[][];
        const stateArrays = results.slice(half) as StateApiResponse[][];
        setIssues(issueArrays.flat());
        setStates(stateArrays.flat());
      })
      .catch(() => {
        if (!cancelled) setWorkspace(null);
        setProjects([]);
        setIssues([]);
        setStates([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  const getStateName = (stateId: string | null | undefined) =>
    stateId ? (states.find((s) => s.id === stateId)?.name ?? stateId) : "—";

  const backlogCount = issues.filter(
    (i) => getStateName(i.state_id) === "Backlog",
  ).length;
  const startedCount = issues.filter(
    (i) => getStateName(i.state_id) === "In Progress",
  ).length;
  const unstartedCount = issues.filter(
    (i) => getStateName(i.state_id) === "Todo",
  ).length;
  const completedCount = issues.filter(
    (i) => getStateName(i.state_id) === "Done",
  ).length;

  const priorityCounts = issues.reduce<Record<string, number>>((acc, i) => {
    const p =
      !i.priority || i.priority === "none"
        ? "None"
        : i.priority.charAt(0).toUpperCase() + i.priority.slice(1);
    acc[p] = (acc[p] ?? 0) + 1;
    return acc;
  }, {});
  const priorityRows = Object.entries(priorityCounts).map(
    ([priority, count]) => ({ priority, count }),
  );

  const doneStateIds = new Set(
    states.filter((s) => s.name === "Done").map((s) => s.id),
  );
  const createdByDate = issues.reduce<Record<string, number>>((acc, i) => {
    const d = i.created_at.slice(0, 10);
    acc[d] = (acc[d] ?? 0) + 1;
    return acc;
  }, {});
  const resolvedByDate = issues
    .filter((i) => i.state_id && doneStateIds.has(i.state_id))
    .reduce<Record<string, number>>((acc, i) => {
      const d = i.updated_at.slice(0, 10);
      acc[d] = (acc[d] ?? 0) + 1;
      return acc;
    }, {});
  const allDates = Array.from(
    new Set([...Object.keys(createdByDate), ...Object.keys(resolvedByDate)]),
  ).sort();
  const createdResolvedData =
    allDates.length > 0
      ? allDates.map((dateStr) => {
          const d = new Date(dateStr + "T12:00:00Z");
          const label = d.toLocaleDateString("en-US", {
            month: "short",
            day: "2-digit",
            year: "numeric",
          });
          return {
            date: label,
            dateKey: dateStr,
            created: createdByDate[dateStr] ?? 0,
            resolved: resolvedByDate[dateStr] ?? 0,
          };
        })
      : [
          {
            date: new Date().toLocaleDateString("en-US", {
              month: "short",
              day: "2-digit",
              year: "numeric",
            }),
            dateKey: new Date().toISOString().slice(0, 10),
            created: 0,
            resolved: 0,
          },
        ];

  const projectRows = projects.map((p) => {
    const projIssues = issues.filter((i) => i.project_id === p.id);
    return {
      project: p,
      backlog: projIssues.filter((i) => getStateName(i.state_id) === "Backlog")
        .length,
      started: projIssues.filter(
        (i) => getStateName(i.state_id) === "In Progress",
      ).length,
      unstarted: projIssues.filter((i) => getStateName(i.state_id) === "Todo")
        .length,
      completed: projIssues.filter((i) => getStateName(i.state_id) === "Done")
        .length,
      cancelled: 0,
    };
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-(--txt-tertiary)">
        Loading…
      </div>
    );
  }
  if (!workspace) {
    return (
      <div className="text-(--txt-secondary)">Workspace not found.</div>
    );
  }

  const baseUrl = `/${workspace.slug}/analytics`;

  return (
    <div className="space-y-6 pb-8">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-(--border-subtle)">
        <Link
          to={`${baseUrl}/overview`}
          className="border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-(--txt-secondary) no-underline hover:text-(--txt-primary)"
        >
          Overview
        </Link>
        <Link
          to={`${baseUrl}/work-items`}
          className="border-b-2 border-(--brand-default) px-4 py-2.5 text-sm font-medium text-(--txt-primary) no-underline"
        >
          Work items
        </Link>
      </div>

      <h2 className="text-lg font-semibold text-(--txt-primary)">
        Work items
      </h2>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-4 py-3">
          <p className="text-xs font-medium text-(--txt-tertiary)">
            Total Work items
          </p>
          <p className="mt-1 text-2xl font-semibold text-(--txt-primary)">
            {issues.length}
          </p>
        </div>
        <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-4 py-3">
          <p className="text-xs font-medium text-(--txt-tertiary)">
            Started Work items
          </p>
          <p className="mt-1 text-2xl font-semibold text-(--txt-primary)">
            {startedCount}
          </p>
        </div>
        <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-4 py-3">
          <p className="text-xs font-medium text-(--txt-tertiary)">
            Backlog Work items
          </p>
          <p className="mt-1 text-2xl font-semibold text-(--txt-primary)">
            {backlogCount}
          </p>
        </div>
        <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-4 py-3">
          <p className="text-xs font-medium text-(--txt-tertiary)">
            Unstarted Work items
          </p>
          <p className="mt-1 text-2xl font-semibold text-(--txt-primary)">
            {unstartedCount}
          </p>
        </div>
        <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-4 py-3">
          <p className="text-xs font-medium text-(--txt-tertiary)">
            Completed Work items
          </p>
          <p className="mt-1 text-2xl font-semibold text-(--txt-primary)">
            {completedCount}
          </p>
        </div>
      </div>

      {/* Created vs Resolved */}
      <section>
        <h3 className="mb-4 text-base font-semibold text-(--txt-primary)">
          Created vs Resolved
        </h3>
        <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-6">
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={createdResolvedData}
                margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border-subtle)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "var(--txt-secondary)", fontSize: 11 }}
                  tickLine={{ stroke: "var(--border-subtle)" }}
                  axisLine={{ stroke: "var(--border-subtle)" }}
                  label={{
                    value: "DATE",
                    position: "insideBottom",
                    offset: -4,
                    fill: "var(--txt-tertiary)",
                    fontSize: 11,
                  }}
                />
                <YAxis
                  tick={{ fill: "var(--txt-secondary)", fontSize: 11 }}
                  tickLine={{ stroke: "var(--border-subtle)" }}
                  axisLine={{ stroke: "var(--border-subtle)" }}
                  label={{
                    value: "NO. OF WORK ITEMS",
                    angle: -90,
                    position: "insideLeft",
                    fill: "var(--txt-tertiary)",
                    fontSize: 11,
                  }}
                  domain={[0, "auto"]}
                  allowDecimals={false}
                />
                <Legend
                  layout="horizontal"
                  align="left"
                  verticalAlign="bottom"
                  wrapperStyle={{ paddingTop: 8 }}
                  iconType="square"
                  iconSize={10}
                  formatter={(value) => (
                    <span className="text-xs text-(--txt-secondary)">
                      {value}
                    </span>
                  )}
                />
                <Line
                  type="monotone"
                  dataKey="resolved"
                  name="Resolved"
                  stroke="var(--txt-success-primary, #22c55e)"
                  strokeWidth={2}
                  dot={{ fill: "var(--txt-success-primary, #22c55e)", r: 4 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="created"
                  name="Created"
                  stroke="var(--brand-default)"
                  strokeWidth={2}
                  dot={{ fill: "var(--brand-default)", r: 4 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Customized Insights */}
      <section>
        <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-(--txt-primary)">
          <IconBriefcase />
          Customized Insights
        </h3>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
          >
            <IconBriefcase /> Work item <span className="opacity-60">∨</span>
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
          >
            <IconCalendar /> Priority <span className="opacity-60">∨</span>
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
          >
            <IconSettings /> Add Property <span className="opacity-60">∨</span>
          </button>
        </div>
        <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-6">
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={priorityRows}
                margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border-subtle)"
                  vertical={false}
                />
                <XAxis
                  dataKey="priority"
                  tick={{ fill: "var(--txt-secondary)", fontSize: 11 }}
                  tickLine={{ stroke: "var(--border-subtle)" }}
                  axisLine={{ stroke: "var(--border-subtle)" }}
                  label={{
                    value: "PRIORITY",
                    position: "insideBottom",
                    offset: -4,
                    fill: "var(--txt-tertiary)",
                    fontSize: 11,
                  }}
                />
                <YAxis
                  tick={{ fill: "var(--txt-secondary)", fontSize: 11 }}
                  tickLine={{ stroke: "var(--border-subtle)" }}
                  axisLine={{ stroke: "var(--border-subtle)" }}
                  label={{
                    value: "NO. OF WORK ITEM",
                    angle: -90,
                    position: "insideLeft",
                    fill: "var(--txt-tertiary)",
                    fontSize: 11,
                  }}
                  domain={[0, "auto"]}
                  allowDecimals={false}
                />
                <Bar
                  dataKey="count"
                  fill="var(--neutral-400, #9389a0)"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Priority table */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-(--txt-primary)">
              {priorityRows.length} Priority
              {priorityRows.length !== 1 ? "ies" : ""}
            </h3>
            <span className="flex size-8 items-center justify-center rounded-md border border-(--border-subtle) bg-(--bg-layer-2) text-(--txt-icon-tertiary)">
              <IconSearch />
            </span>
          </div>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
          >
            <IconDownload /> Export as csv
          </button>
        </div>
        <div className="overflow-x-auto rounded-md border border-(--border-subtle) bg-(--bg-surface-1)">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-(--border-subtle)">
                <th className="py-3 pr-4 font-medium text-(--txt-secondary)">
                  Priority
                </th>
                <th className="py-3 font-medium text-(--txt-secondary)">
                  Count
                </th>
              </tr>
            </thead>
            <tbody>
              {priorityRows.map(({ priority, count }) => (
                <tr
                  key={priority}
                  className="border-b border-(--border-subtle) last:border-0"
                >
                  <td className="py-3 pr-4 text-(--txt-primary)">
                    {priority}
                  </td>
                  <td className="py-3 text-(--txt-secondary)">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Projects table */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-(--txt-primary)">
              {projects.length} Projects
            </h3>
            <span className="flex size-8 items-center justify-center rounded-md border border-(--border-subtle) bg-(--bg-layer-2) text-(--txt-icon-tertiary)">
              <IconSearch />
            </span>
          </div>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
          >
            <IconDownload /> Export as csv
          </button>
        </div>
        <div className="overflow-x-auto rounded-md border border-(--border-subtle) bg-(--bg-surface-1)">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-(--border-subtle)">
                <th className="py-3 pr-4 font-medium text-(--txt-secondary)">
                  Project
                </th>
                <th className="py-3 pr-4 font-medium text-(--txt-secondary)">
                  Backlog
                </th>
                <th className="py-3 pr-4 font-medium text-(--txt-secondary)">
                  Started
                </th>
                <th className="py-3 pr-4 font-medium text-(--txt-secondary)">
                  Unstarted
                </th>
                <th className="py-3 pr-4 font-medium text-(--txt-secondary)">
                  Completed
                </th>
                <th className="py-3 font-medium text-(--txt-secondary)">
                  Cancelled
                </th>
              </tr>
            </thead>
            <tbody>
              {projectRows.map(
                ({
                  project,
                  backlog,
                  started,
                  unstarted,
                  completed,
                  cancelled,
                }) => (
                  <tr
                    key={project.id}
                    className="border-b border-(--border-subtle) last:border-0"
                  >
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="flex size-6 items-center justify-center rounded bg-(--bg-layer-2) text-[10px] font-medium text-(--txt-icon-secondary)">
                          <IconBriefcase />
                        </span>
                        <span className="text-(--txt-primary)">
                          {project.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-(--txt-secondary)">
                      {backlog}
                    </td>
                    <td className="py-3 pr-4 text-(--txt-secondary)">
                      {started}
                    </td>
                    <td className="py-3 pr-4 text-(--txt-secondary)">
                      {unstarted}
                    </td>
                    <td className="py-3 pr-4 text-(--txt-secondary)">
                      {completed}
                    </td>
                    <td className="py-3 text-(--txt-secondary)">
                      {cancelled}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
