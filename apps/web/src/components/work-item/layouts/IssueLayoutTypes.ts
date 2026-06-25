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
  /**
   * Board layout only: group columns by canonical state group (Backlog / Todo /
   * In Progress / Done / Cancelled) instead of by individual state. Used by
   * workspace-wide views where states differ per project but share groups.
   */
  groupByStateGroup?: boolean;
  /**
   * Board layout only: called when a card is dragged into another column to move
   * the work item to that column's state. `targetStateId` is already resolved to
   * a concrete state (in the card's own project when grouping by state group).
   * When omitted, the board is not draggable.
   */
  onCardMove?: (issueId: string, targetStateId: string) => void;
}

/** Canonical state groups, in board column order. */
export const STATE_GROUP_ORDER = [
  'backlog',
  'unstarted',
  'started',
  'completed',
  'cancelled',
] as const;

/** Display labels for the canonical state groups. */
export const STATE_GROUP_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  unstarted: 'Todo',
  started: 'In Progress',
  completed: 'Done',
  cancelled: 'Cancelled',
};

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
