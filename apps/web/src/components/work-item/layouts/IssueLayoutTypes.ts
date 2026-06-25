import type {
  GitHubIssueSummaryEntry,
  IssueApiResponse,
  LabelApiResponse,
  ProjectApiResponse,
  StateApiResponse,
  WorkspaceMemberApiResponse,
} from '../../../api/types';

/** Available layout keys. */
export const ISSUE_LAYOUTS = ['list', 'board', 'spreadsheet', 'calendar', 'gantt'] as const;
export type IssueLayout = (typeof ISSUE_LAYOUTS)[number];

export function parseIssueLayout(
  raw: string | null | undefined,
  fallback: IssueLayout = 'list',
): IssueLayout {
  if (!raw) return fallback;
  return (ISSUE_LAYOUTS as readonly string[]).includes(raw) ? (raw as IssueLayout) : fallback;
}

/**
 * Shared props every layout receives. Computed once in the parent page so
 * every layout sees consistent maps + the same "now" sample.
 */
export interface IssueLayoutProps {
  workspaceSlug: string;
  project: ProjectApiResponse;
  /** Filtered, ordered issues — what the current view should display. */
  issues: IssueApiResponse[];
  /** All visible states for the project (for column headers, pickers, etc.). */
  states: StateApiResponse[];
  /** Project labels indexed for quick chip rendering. */
  labels: LabelApiResponse[];
  /** Workspace members (for assignee avatars). */
  members: WorkspaceMemberApiResponse[];
  /** github_issue_syncs aggregate per issue id. */
  prSummary: Record<string, GitHubIssueSummaryEntry>;
  /** `${workspace}/projects/${project}` — used to build issue links. */
  baseUrl: string;
  /** `${baseUrl}/issues/${id}` href builder. */
  issueHref: (id: string) => string;
  /** Stable per-render "now" timestamp (ms) used by date cells. */
  now: number;
  /**
   * Optional map of project id -> project, used by workspace-wide views where
   * issues span multiple projects so each card can show its own project's
   * identifier. When omitted, the single `project` prop is used.
   */
  projectsById?: Record<string, ProjectApiResponse>;
}

/**
 * The human "DEV-42" identifier for an issue. In multi-project (workspace)
 * views the issue's own project is resolved from `projectsById`; otherwise the
 * single `project` is used.
 */
export function issueDisplayId(
  issue: Pick<IssueApiResponse, 'id' | 'project_id' | 'sequence_id'>,
  project: ProjectApiResponse,
  projectsById?: Record<string, ProjectApiResponse>,
): string {
  const p = projectsById?.[issue.project_id] ?? project;
  const prefix = p.identifier ?? p.id.slice(0, 8);
  return `${prefix}-${issue.sequence_id ?? issue.id.slice(-4)}`;
}
