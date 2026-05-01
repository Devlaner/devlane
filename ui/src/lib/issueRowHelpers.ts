import type { WorkspaceMemberApiResponse } from '../api/types';

export interface MemberLite {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

/** Translate workspace members + assignee ids into a list of MemberLite. */
export function membersFromAssigneeIds(
  members: WorkspaceMemberApiResponse[],
  assigneeIds?: string[],
): MemberLite[] {
  if (!assigneeIds?.length || !members.length) return [];
  const byId = new Map(members.map((m) => [m.member_id, m]));
  const out: MemberLite[] = [];
  for (const id of assigneeIds) {
    const m = byId.get(id);
    if (!m) continue;
    out.push({
      id,
      name: m.member_display_name || (m.member_email ?? 'Unknown'),
      avatarUrl: m.member_avatar ?? null,
    });
  }
  return out;
}
