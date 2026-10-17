import { issueService } from '../../services/issueService';
import type { IssueApiResponse } from '../../api/types';

/** Fetch every page before cycle membership or progress is derived locally. */
export async function listAllProjectIssues(
  workspaceSlug: string,
  projectId: string,
): Promise<IssueApiResponse[]> {
  const limit = 100;
  const issues: IssueApiResponse[] = [];
  let offset = 0;
  while (true) {
    const page = await issueService.list(workspaceSlug, projectId, { limit, offset });
    issues.push(...page);
    if (page.length < limit) return issues;
    offset += page.length;
  }
}
