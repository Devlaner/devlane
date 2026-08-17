import type {
  IssueApiResponse,
  StateApiResponse,
  WorkspaceMemberApiResponse,
} from '../../api/types';
import type { SortableColumn, SortOrder } from '../../types/workspaceViewDisplay';

/**
 * Orders work items by one of the table's sortable columns.
 *
 * The table header offers the sort; the page performs it. Both v2 pages that
 * render WorkItemsTable call this, so clicking "Priority" means the same order
 * on a cycle as it does on the workspace views page.
 */

/** Urgent first, none last — the order the priority column reads in. */
const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

export interface SortWorkItemsArgs {
  issues: IssueApiResponse[];
  sortBy: SortableColumn;
  sortOrder: SortOrder;
  states: StateApiResponse[];
  members: WorkspaceMemberApiResponse[];
}

export function sortWorkItems({
  issues,
  sortBy,
  sortOrder,
  states,
  members,
}: SortWorkItemsArgs): IssueApiResponse[] {
  const stateMap = new Map(states.map((state) => [state.id, state]));
  const memberMap = new Map(members.map((member) => [member.member_id, member]));

  const valueOf = (issue: IssueApiResponse): string | number => {
    switch (sortBy) {
      case 'name':
        return issue.name ?? '';
      case 'created_at':
        return issue.created_at ? new Date(issue.created_at).getTime() : 0;
      case 'updated_at':
        return issue.updated_at ? new Date(issue.updated_at).getTime() : 0;
      case 'priority':
        return PRIORITY_ORDER[issue.priority ?? 'none'] ?? 5;
      case 'state':
        return stateMap.get(issue.state_id ?? '')?.name ?? '—';
      case 'assignee': {
        const member = memberMap.get(issue.assignee_ids?.[0] ?? '');
        return member?.member_display_name ?? member?.member_email ?? '—';
      }
      case 'start_date':
        return issue.start_date ? new Date(issue.start_date).getTime() : 0;
      case 'due_date':
        return issue.target_date ? new Date(issue.target_date).getTime() : 0;
      default:
        return 0;
    }
  };

  return [...issues].sort((a, b) => {
    const left = valueOf(a);
    const right = valueOf(b);
    const cmp =
      typeof left === 'string' && typeof right === 'string'
        ? left.localeCompare(right, undefined, { sensitivity: 'base' })
        : Number(left) - Number(right);
    return sortOrder === 'asc' ? cmp : -cmp;
  });
}
