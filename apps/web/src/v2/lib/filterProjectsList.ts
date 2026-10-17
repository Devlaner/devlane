import { parseISODateLocal } from '../../lib/dateOnly';
import type { ProjectsListSearchParamsState } from '../../lib/projectsListSearchParams';
import type { ProjectApiResponse } from '../../api/types';

export interface FilterProjectsListInput {
  projects: ProjectApiResponse[];
  state: ProjectsListSearchParamsState;
  /** Member ids per project id, for the member and "my projects" filters. */
  membersByProject: Record<string, string[]>;
  favoriteProjectIds: string[];
  currentUserId?: string;
}

/** True when the created_at of a project falls inside the selected range. */
function matchesCreatedDate(
  createdAtMs: number,
  filter: ProjectsListSearchParamsState['createdDateFilter'],
  createdAfter: string | null,
  createdBefore: string | null,
): boolean {
  if (!filter) return true;
  if (!Number.isFinite(createdAtMs)) return false;

  const now = new Date();

  if (filter === 'today') {
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    return createdAtMs >= startOfDay.getTime();
  }

  if (filter === 'custom') {
    const afterRaw = createdAfter?.trim() ?? '';
    const beforeRaw = createdBefore?.trim() ?? '';
    let afterMs: number | undefined;
    let beforeMs: number | undefined;

    if (afterRaw) {
      const parsed = parseISODateLocal(afterRaw).getTime();
      if (!Number.isFinite(parsed)) return false;
      afterMs = parsed;
    }
    if (beforeRaw) {
      const beforeDate = parseISODateLocal(beforeRaw);
      if (!Number.isFinite(beforeDate.getTime())) return false;
      // The "before" bound is a whole day, so it runs to the last millisecond.
      beforeMs = new Date(
        beforeDate.getFullYear(),
        beforeDate.getMonth(),
        beforeDate.getDate(),
        23,
        59,
        59,
        999,
      ).getTime();
    }

    if (afterMs === undefined && beforeMs === undefined) return true;
    if (afterMs !== undefined && createdAtMs < afterMs) return false;
    if (beforeMs !== undefined && createdAtMs > beforeMs) return false;
    return true;
  }

  const days = filter === 'last7' ? 7 : 30;
  return createdAtMs >= now.getTime() - days * 24 * 60 * 60 * 1000;
}

/**
 * Applies the search, filter and sort state from the URL to a project list.
 *
 * Extracted so the shipped projects page and the v2 preview derive their list
 * the same way rather than each carrying a copy of the rules.
 */
export function filterProjectsList({
  projects,
  state,
  membersByProject,
  favoriteProjectIds,
  currentUserId,
}: FilterProjectsListInput): ProjectApiResponse[] {
  const {
    searchQuery,
    favoritesOnly,
    accessFilters,
    leadFilters,
    memberFilters,
    myProjectsOnly,
    createdDateFilter,
    createdAfter,
    createdBefore,
    sortField,
    sortDir,
  } = state;

  // Manual sort falls back to the order the API returned.
  const orderById = new Map(projects.map((project, index) => [project.id, index]));

  const query = searchQuery.toLowerCase();

  const filtered = projects.filter((project) => {
    if (query) {
      const matches =
        project.name.toLowerCase().includes(query) ||
        project.identifier?.toLowerCase().includes(query) ||
        project.description?.toLowerCase().includes(query);
      if (!matches) return false;
    }

    if (favoritesOnly && !favoriteProjectIds.includes(project.id)) return false;

    if (accessFilters.length > 0) {
      const access: 'private' | 'public' = project.network === 0 ? 'private' : 'public';
      if (!accessFilters.includes(access)) return false;
    }

    if (leadFilters.length > 0) {
      if (!project.project_lead_id || !leadFilters.includes(project.project_lead_id)) return false;
    }

    /* Projects whose members have not loaded yet are kept rather than hidden,
       so the list does not flicker while the requests land. */
    const membersKnown = Object.prototype.hasOwnProperty.call(membersByProject, project.id);

    if (memberFilters.length > 0 && membersKnown) {
      const memberIds = membersByProject[project.id];
      const matches = memberFilters.some(
        (memberId) => memberIds.includes(memberId) || project.project_lead_id === memberId,
      );
      if (!matches) return false;
    }

    if (myProjectsOnly && currentUserId && membersKnown) {
      const memberIds = membersByProject[project.id];
      if (!memberIds.includes(currentUserId) && project.project_lead_id !== currentUserId) {
        return false;
      }
    }

    return matchesCreatedDate(
      Date.parse(project.created_at ?? ''),
      createdDateFilter,
      createdAfter,
      createdBefore,
    );
  });

  return filtered
    .map((project) => ({
      project,
      createdAtMs: Date.parse(project.created_at ?? '') || 0,
      membersCount: new Set([
        ...(membersByProject[project.id] ?? []),
        ...(project.project_lead_id ? [project.project_lead_id] : []),
      ]).size,
    }))
    .sort((a, b) => {
      let result = 0;
      switch (sortField) {
        case 'name':
          result = a.project.name.localeCompare(b.project.name);
          break;
        case 'member_count':
          result = a.membersCount - b.membersCount;
          break;
        case 'manual':
          result = (orderById.get(a.project.id) ?? 0) - (orderById.get(b.project.id) ?? 0);
          break;
        case 'created_date':
        default:
          result = a.createdAtMs - b.createdAtMs;
          break;
      }
      // Manual order is absolute; the direction toggle does not apply to it.
      if (sortField === 'manual') return result;
      return sortDir === 'desc' ? -result : result;
    })
    .map(({ project }) => project);
}
