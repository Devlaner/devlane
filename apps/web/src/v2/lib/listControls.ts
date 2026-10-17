/**
 * Sort and filter state for the v2 project list pages.
 *
 * The state lives in the URL next to the `?q=` the shared toolbar already
 * writes, so a narrowed, sorted list survives a reload and can be pasted to
 * someone else — the shipped header keeps the same state in a context, which is
 * why its sort is lost on every navigation.
 */

export type SortOrder = 'asc' | 'desc';

export interface SortState<T extends string> {
  sortBy: T;
  sortOrder: SortOrder;
}

/** Reads `?sort=` / `?dir=`, falling back when the URL holds an unknown value. */
export function readSortState<T extends string>(
  params: URLSearchParams,
  allowed: readonly T[],
  fallbackBy: T,
  fallbackOrder: SortOrder = 'desc',
  keys: { sort: string; dir: string } = { sort: 'sort', dir: 'dir' },
): SortState<T> {
  const rawSort = params.get(keys.sort) ?? '';
  const rawDir = params.get(keys.dir) ?? '';
  return {
    sortBy: (allowed as readonly string[]).includes(rawSort) ? (rawSort as T) : fallbackBy,
    sortOrder: rawDir === 'asc' || rawDir === 'desc' ? rawDir : fallbackOrder,
  };
}

/** Writes a sort state back, dropping the params that match the fallback. */
export function writeSortState<T extends string>(
  params: URLSearchParams,
  next: SortState<T>,
  fallbackBy: T,
  fallbackOrder: SortOrder = 'desc',
  keys: { sort: string; dir: string } = { sort: 'sort', dir: 'dir' },
): URLSearchParams {
  const result = new URLSearchParams(params);
  if (next.sortBy === fallbackBy) result.delete(keys.sort);
  else result.set(keys.sort, next.sortBy);
  if (next.sortOrder === fallbackOrder) result.delete(keys.dir);
  else result.set(keys.dir, next.sortOrder);
  return result;
}

/** A multi-value filter, stored as one comma-separated param. */
export function readListParam(params: URLSearchParams, key: string): string[] {
  const raw = params.get(key);
  if (!raw) return [];
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function writeListParam(
  params: URLSearchParams,
  key: string,
  values: string[],
): URLSearchParams {
  const result = new URLSearchParams(params);
  if (values.length === 0) result.delete(key);
  else result.set(key, values.join(','));
  return result;
}

/** Adds or removes one value of a multi-value filter. */
export function toggleListParam(
  params: URLSearchParams,
  key: string,
  value: string,
): URLSearchParams {
  const current = readListParam(params, key);
  return writeListParam(
    params,
    key,
    current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value],
  );
}

/** An empty selection means "no filter", so every row passes. */
export function passesFilter(selected: string[], value: string | null | undefined): boolean {
  if (selected.length === 0) return true;
  return value != null && selected.includes(value);
}

/** Locale-aware, case-insensitive — names sort the way the reader reads them. */
export function compareText(a: string | null | undefined, b: string | null | undefined): number {
  return (a ?? '').localeCompare(b ?? '', undefined, { sensitivity: 'base' });
}

/** Missing dates sort last in ascending order rather than as the epoch. */
export function compareDates(a: string | null | undefined, b: string | null | undefined): number {
  const left = a ? Date.parse(a) : Number.NaN;
  const right = b ? Date.parse(b) : Number.NaN;
  const leftMissing = Number.isNaN(left);
  const rightMissing = Number.isNaN(right);
  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return 1;
  if (rightMissing) return -1;
  return left - right;
}

export function compareNumbers(a: number, b: number): number {
  return a - b;
}

/** Applies the order after the comparator has ranked the pair ascending. */
export function withOrder(comparison: number, order: SortOrder): number {
  return order === 'asc' ? comparison : -comparison;
}
