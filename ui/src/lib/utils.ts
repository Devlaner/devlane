import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { config } from '../config/env';

/**
 * Merges Tailwind classes with clsx, resolving conflicts via tailwind-merge.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Resolve image URL for display (relative API paths get base URL prepended). */
export function getImageUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = (config.apiBaseUrl ?? '').replace(/\/+$/, '');
  const path = url.startsWith('/') ? url : '/' + url;
  return base + path;
}
