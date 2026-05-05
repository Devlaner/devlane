import type { CycleApiResponse } from '../api/types';
import { slugify } from './slug';

export function cyclePathSegment(cycle: Pick<CycleApiResponse, 'name'>): string {
  const s = slugify(cycle.name);
  return s || 'cycle';
}

export function cycleMatchesPathSegment(
  cycle: Pick<CycleApiResponse, 'id' | 'name'>,
  segment: string,
): boolean {
  const key = segment.trim().toLowerCase();
  if (!key) return false;
  return cycle.id.toLowerCase() === key || cyclePathSegment(cycle) === key;
}
