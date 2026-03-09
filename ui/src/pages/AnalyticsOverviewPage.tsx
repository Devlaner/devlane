import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { workspaceService } from "../services/workspaceService";
import { projectService } from "../services/projectService";
import { issueService } from "../services/issueService";
import type {
  WorkspaceApiResponse,
  ProjectApiResponse,
  IssueApiResponse,
  WorkspaceMemberApiResponse,
} from "../api/types";

export function AnalyticsOverviewPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [issues, setIssues] = useState<IssueApiResponse[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
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
        return Promise.all([
          projectService.list(workspaceSlug),
          workspaceService.listMembers(workspaceSlug),
        ]);
      })
      .then((res) => {
        const [projs, mem] = res ?? [[], []];
        if (!cancelled) {
          setProjects(projs ?? []);
          setMembers(mem ?? []);
        }
        if (!cancelled && projs?.length) {
          return Promise.all(
            projs.map((p) =>
              issueService.list(workspaceSlug!, p.id, { limit: 200 }),
            ),
          );
        }
        return [];
      })
      .then((issueArrays) => {
        if (cancelled || !Array.isArray(issueArrays)) return;
        if (issueArrays.length > 0 && Array.isArray(issueArrays[0]))
          setIssues((issueArrays as IssueApiResponse[][]).flat());
      })
      .catch(() => {
        if (!cancelled) setWorkspace(null);
        setProjects([]);
        setIssues([]);
        setMembers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  const totalUsers = members.length;
  const totalAdmins = members.filter((m) => m.role >= 20).length;
  const totalMembers = members.filter((m) => m.role < 20).length;
  const totalGuests = 0;
  const totalWorkItems = issues.length;
  const cycles: unknown[] = [];
  const modules: unknown[] = [];
  const pages: unknown[] = [];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-[var(--txt-tertiary)]">
        Loading…
      </div>
    );
  }
  if (!workspace) {
    return (
      <div className="text-[var(--txt-secondary)]">Workspace not found.</div>
    );
  }

  const baseUrl = `/${workspace.slug}/analytics`;

  const summaryCards = [
    { label: "Total Users", value: totalUsers },
    { label: "Total Admins", value: totalAdmins },
    { label: "Total Members", value: totalMembers },
    { label: "Total Guests", value: totalGuests },
    { label: "Total Projects", value: projects.length },
    { label: "Total Work items", value: totalWorkItems },
    { label: "Total Cycles", value: cycles.length },
    { label: "Total Intake", value: 0 },
  ];

  const radarDimensions = [
    { name: "Work Items", value: totalWorkItems },
    { name: "Cycles", value: cycles.length },
    { name: "Modules", value: modules.length },
    { name: "Intake", value: 0 },
    { name: "Members", value: totalUsers },
    { name: "Pages", value: pages.length },
    { name: "Views", value: 1 },
  ];

  const radarMax = Math.max(...radarDimensions.map((d) => d.value), 1);
  const radarData = radarDimensions.map((d) => ({
    subject: d.name,
    value: d.value,
    fullMark: radarMax,
  }));

  return (
    <div className="space-y-6 pb-8">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border-subtle)]">
        <Link
          to={`${baseUrl}/overview`}
          className="border-b-2 border-[var(--brand-default)] px-4 py-2.5 text-sm font-medium text-[var(--txt-primary)] no-underline"
        >
          Overview
        </Link>
        <Link
          to={`${baseUrl}/work-items`}
          className="border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-[var(--txt-secondary)] no-underline hover:text-[var(--txt-primary)]"
        >
          Work items
        </Link>
      </div>

      <h2 className="text-lg font-semibold text-[var(--txt-primary)]">
        Overview
      </h2>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {summaryCards.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] px-4 py-3"
          >
            <p className="text-xs font-medium text-[var(--txt-tertiary)]">
              {label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-[var(--txt-primary)]">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Project Insights (with Work Items + Summary of Projects) | Active Projects - same row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Project Insights: contains Work Items and Summary of Projects (same row) */}
        <section className="min-w-0 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] p-6">
          <h3 className="mb-4 text-base font-semibold text-[var(--txt-primary)]">
            Project Insights
          </h3>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-[3fr_2fr]">
            {/* Work Items - radar chart */}
            <div className="min-w-0">
              <h4 className="mb-3 text-sm font-semibold text-[var(--txt-primary)]">
                Work Items
              </h4>
              <div className="rounded-md bg-[var(--bg-surface-1)] p-4">
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsRadarChart
                      data={radarData}
                      margin={{ top: 16, right: 16, bottom: 16, left: 16 }}
                    >
                      <PolarGrid stroke="var(--border-subtle)" />
                      <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fill: "var(--txt-secondary)", fontSize: 11 }}
                        tickLine={{ stroke: "var(--border-subtle)" }}
                      />
                      <PolarRadiusAxis
                        angle={90}
                        domain={[0, radarMax]}
                        tick={{ fill: "var(--txt-tertiary)", fontSize: 10 }}
                        tickLine={{ stroke: "var(--border-subtle)" }}
                      />
                      <Radar
                        name="Metrics"
                        dataKey="value"
                        stroke="var(--brand-default)"
                        fill="var(--brand-default)"
                        fillOpacity={0.3}
                        strokeWidth={1.5}
                      />
                    </RechartsRadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Summary of Projects */}
            <div className="min-w-0">
              <h4 className="mb-2 text-sm font-semibold text-[var(--txt-primary)]">
                Summary of Projects
              </h4>
              <p className="mb-1 text-sm font-semibold text-[var(--txt-primary)]">
                All Projects
              </p>
              <p className="mb-3 text-sm text-[var(--txt-tertiary)]">
                Trend on charts
              </p>
              <ul className="space-y-3 text-sm">
                {radarDimensions.map((d) => (
                  <li
                    key={d.name}
                    className="flex items-center justify-between gap-4 text-[var(--txt-secondary)]"
                  >
                    <span>{d.name}</span>
                    <span className="shrink-0 font-medium tabular-nums text-[var(--txt-primary)]">
                      {d.value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Active Projects */}
        <section className="min-w-0">
          <h3 className="mb-4 text-base font-semibold text-[var(--txt-primary)]">
            Active Projects
          </h3>
          <ul className="space-y-2">
            {projects.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] px-4 py-3"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[var(--bg-layer-2)] text-sm font-medium text-[var(--txt-icon-secondary)]">
                  {p.name.charAt(0)}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-[var(--txt-primary)]">
                  {p.name}
                </span>
                <span className="shrink-0 rounded bg-[var(--bg-danger-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--txt-danger-primary)]">
                  0%
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
