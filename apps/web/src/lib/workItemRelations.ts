import { cycleService } from '../services/cycleService';
import { moduleService } from '../services/moduleService';

interface WorkItemRelations {
  cycleId?: string | null;
  moduleIds?: Array<string | null | undefined>;
}

/**
 * Attach the relationships that live outside the issue create payload.
 *
 * The issue already exists when these requests run, so relation failures are
 * reported as a partial success instead of rejecting and inviting a retry that
 * would create a duplicate issue.
 */
export async function attachWorkItemRelations(
  workspaceSlug: string,
  projectId: string,
  issueId: string,
  relations: WorkItemRelations,
): Promise<boolean> {
  const requests: Promise<unknown>[] = [];

  if (relations.cycleId) {
    requests.push(cycleService.addIssue(workspaceSlug, projectId, relations.cycleId, issueId));
  }

  const moduleIds = [...new Set((relations.moduleIds ?? []).filter(Boolean))] as string[];
  moduleIds.forEach((moduleId) => {
    requests.push(moduleService.addIssue(workspaceSlug, projectId, moduleId, issueId));
  });

  if (requests.length === 0) return true;
  const results = await Promise.allSettled(requests);
  return results.every((result) => result.status === 'fulfilled');
}
