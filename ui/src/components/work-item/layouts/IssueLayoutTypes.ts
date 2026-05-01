import type {
  GitHubIssueSummaryEntry,
  IssueApiResponse,
  LabelApiResponse,
  ProjectApiResponse,
  StateApiResponse,
  WorkspaceMemberApiResponse,
} from '../../../api/types';

/** Available layout keys. Mirrors Plane's EIssueLayoutTypes. */
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
}
