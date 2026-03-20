/**
 * Workspace-related pure helpers.
 * No API calls; used for validation and formatting in forms.
 */

/** Regex for valid workspace slug: lowercase, numbers, hyphens; optional single char */
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

/**
 * Derive a URL-safe slug from a display name.
 */
export function slugFromName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/**
 * Returns true if the slug is valid for the API.
 */
export function validateWorkspaceSlug(slug: string): boolean {
  return SLUG_REGEX.test(slug.trim().toLowerCase());
}
