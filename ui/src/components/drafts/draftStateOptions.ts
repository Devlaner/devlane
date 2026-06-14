import type { StateApiResponse } from '../../api/types';

const DRAFT_STATE_ORDER: Array<{ group: string; label: string }> = [
  { group: 'backlog', label: 'Backlog' },
  { group: 'unstarted', label: 'Todo' },
  { group: 'started', label: 'In Progress' },
  { group: 'completed', label: 'Done' },
  { group: 'canceled', label: 'Cancelled' },
];

export type DraftStateOption = { group: string; label: string; id: string | null };

function normalizeStateGroup(group: string | undefined): string {
  const g = (group ?? '').toLowerCase();
  if (g === 'cancelled') return 'canceled';
  return g;
}

/** Plane-style grouped state options for draft work items. */
export function buildDraftStateOptions(states: StateApiResponse[]): DraftStateOption[] {
  const byGroup = new Map<string, StateApiResponse>();
  for (const s of states) {
    const g = normalizeStateGroup(s.group);
    if (!g) continue;
    if (!byGroup.has(g)) byGroup.set(g, s);
  }
  return DRAFT_STATE_ORDER.map(({ group, label }) => {
    const st = byGroup.get(group);
    return { group, label, id: st?.id ?? null };
  });
}

export function draftStateDisplayLabel(
  stateId: string,
  states: StateApiResponse[],
  options: DraftStateOption[],
): string {
  const current = states.find((s) => s.id === stateId);
  if (current?.group) {
    const match = options.find((o) => o.group === normalizeStateGroup(current.group));
    if (match) return match.label;
  }
  return current?.name ?? 'Backlog';
}
