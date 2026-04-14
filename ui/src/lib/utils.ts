import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { WorkspaceMemberApiResponse } from '../api/types';

/**
 * Merges Tailwind classes with clsx, resolving conflicts via tailwind-merge.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Resolve image URL for display (relative API paths get base URL prepended). */
export function getImageUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const t = url.trim();
  if (t === '') return null;
  if (
    t.startsWith('http://') ||
    t.startsWith('https://') ||
    t.startsWith('data:') ||
    t.startsWith('blob:')
  ) {
    return t;
  }
  const path = t.startsWith('/') ? t : '/' + t;
  return path;
}

/** Normalize UUID strings for comparison (case + hyphen insensitive). */
export function normalizeUuidKey(v: string | null | undefined): string {
  if (v == null) return '';
  return String(v).trim().toLowerCase().replace(/-/g, '');
}

/** Match workspace member by user id (`member_id` = users.id). Also tries workspace member row `id` for older payloads. */
export function findWorkspaceMemberByUserId(
  members: WorkspaceMemberApiResponse[],
  userId: string | null | undefined,
): WorkspaceMemberApiResponse | undefined {
  if (userId == null) return undefined;
  const raw = String(userId).trim();
  if (raw === '') return undefined;
  const key = normalizeUuidKey(raw);
  if (key === '') return undefined;
  return members.find((m) => {
    const mid = normalizeUuidKey(m.member_id);
    const pk = normalizeUuidKey(m.id);
    return (mid !== '' && mid === key) || (pk !== '' && pk === key);
  });
}
