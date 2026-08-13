/**
 * v1 <-> v2 path mapping for the interface-version preference.
 *
 * Two mappers, used for two different purposes:
 *
 * - `mapPathToV2` powers passive gating (InterfaceGate): when the preference
 *   is 'v2', any v1 URL the user navigates to gets bounced to its v2
 *   equivalent. This direction only — v2 URLs stay reachable regardless of
 *   preference, which keeps /app-v2/... usable for preview/testing and is
 *   why server-generated links (password reset emails, invite links) and
 *   RootRedirect never needed to change: they keep pointing at the v1
 *   canonical path, and this mapping bounces the visiting browser onward if
 *   that browser has already opted into v2.
 *
 * - `mapPathToV1` is the reverse, used only for the explicit "switch
 *   interface" action in the preferences toggle: clicking Classic while
 *   sitting on a v2 page has to move you off it immediately, not just flip a
 *   stored preference that only affects *future* navigation. Passive gating
 *   is deliberately not bidirectional (see above), so this direction is
 *   click-triggered only — it does not run automatically on navigation.
 */

const STATIC_MAP: Record<string, string> = {
  '/login': '/login-v2',
  '/sign-up': '/sign-up-v2',
  '/forgot-password': '/forgot-password-v2',
  '/reset-password': '/reset-password-v2',
  '/accounts/set-password': '/accounts/set-password-v2',
  '/invite': '/invite-v2',
  '/invite/sign-up': '/invite-v2/sign-up',
  '/create-workspace': '/create-workspace-v2',
};

// First path segments that never have a v2 equivalent — instance admin and
// first-run setup are separate surfaces outside the workspace app entirely.
const NO_V2_TOP_SEGMENTS = new Set(['instance-admin', 'setup']);

const V2_STATIC_PREFIXES = [
  '/login-v2',
  '/sign-up-v2',
  '/forgot-password-v2',
  '/reset-password-v2',
  '/accounts/set-password-v2',
  '/invite-v2',
  '/create-workspace-v2',
];

function isAlreadyV2(pathname: string): boolean {
  if (V2_STATIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  return /^\/[^/]+\/app-v2(\/|$)/.test(pathname);
}

type WorkspaceRule = { pattern: RegExp; to: (m: RegExpMatchArray) => string };

const PROJECT_SUB_ROUTES = 'cycles|modules|views|pages|epics';

// Ordered most-specific first. `issues` renames to `work-items`; every other
// segment keeps its v1 name (see AGENTS.md / routes/index.tsx for the v2 tree).
const WORKSPACE_RULES: WorkspaceRule[] = [
  {
    pattern: /^\/([^/]+)\/projects\/([^/]+)\/issues\/([^/]+)\/?$/,
    to: (m) => `/${m[1]}/app-v2/projects/${m[2]}/work-items/${m[3]}`,
  },
  {
    pattern: /^\/([^/]+)\/projects\/([^/]+)\/issues\/?$/,
    to: (m) => `/${m[1]}/app-v2/projects/${m[2]}/work-items`,
  },
  {
    pattern: /^\/([^/]+)\/projects\/([^/]+)\/board\/?$/,
    to: (m) => `/${m[1]}/app-v2/projects/${m[2]}/board`,
  },
  {
    pattern: new RegExp(`^/([^/]+)/projects/([^/]+)/(${PROJECT_SUB_ROUTES})/([^/]+)/?$`),
    to: (m) => `/${m[1]}/app-v2/projects/${m[2]}/${m[3]}/${m[4]}`,
  },
  {
    pattern: new RegExp(`^/([^/]+)/projects/([^/]+)/(${PROJECT_SUB_ROUTES}|intake|settings)/?$`),
    to: (m) => `/${m[1]}/app-v2/projects/${m[2]}/${m[3]}`,
  },
  {
    pattern: /^\/([^/]+)\/projects\/([^/]+)\/?$/,
    to: (m) => `/${m[1]}/app-v2/projects/${m[2]}`,
  },
  {
    pattern: /^\/([^/]+)\/projects\/?$/,
    to: (m) => `/${m[1]}/app-v2/projects`,
  },
  {
    pattern: /^\/([^/]+)\/analytics\/(overview|work-items)\/?$/,
    to: (m) => `/${m[1]}/app-v2/analytics/${m[2]}`,
  },
  {
    pattern: /^\/([^/]+)\/analytics\/?$/,
    to: (m) => `/${m[1]}/app-v2/analytics`,
  },
  {
    pattern: /^\/([^/]+)\/views\/([^/]+)\/?$/,
    to: (m) => `/${m[1]}/app-v2/views/${m[2]}`,
  },
  {
    pattern: /^\/([^/]+)\/views\/?$/,
    to: (m) => `/${m[1]}/app-v2/views`,
  },
  {
    pattern: /^\/([^/]+)\/(drafts|archives|notifications)\/?$/,
    to: (m) => `/${m[1]}/app-v2/${m[2]}`,
  },
  {
    pattern: /^\/([^/]+)\/profile\/([^/]+)\/?$/,
    to: (m) => `/${m[1]}/app-v2/profile/${m[2]}`,
  },
  {
    pattern: /^\/([^/]+)\/settings\/projects\/([^/]+)\/?$/,
    to: (m) => `/${m[1]}/app-v2/settings/projects/${m[2]}`,
  },
  {
    pattern: /^\/([^/]+)\/settings\/(account|projects)\/?$/,
    to: (m) => `/${m[1]}/app-v2/settings/${m[2]}`,
  },
  {
    pattern: /^\/([^/]+)\/settings\/?$/,
    to: (m) => `/${m[1]}/app-v2/settings`,
  },
  // Workspace home. Deliberately last and only a single path segment, so it
  // never shadows a reserved top-level route matched above/excluded below.
  {
    pattern: /^\/([^/]+)\/?$/,
    to: (m) => `/${m[1]}/app-v2`,
  },
];

/**
 * Returns the v2 path (with the original search string reattached) for a v1
 * pathname, or null if the path is already v2, has no v2 equivalent, or
 * doesn't match a known v1 shape.
 */
export function mapPathToV2(pathname: string, search: string): string | null {
  if (isAlreadyV2(pathname)) return null;

  const staticTarget = STATIC_MAP[pathname];
  if (staticTarget) return staticTarget + search;

  const topSegment = pathname.split('/')[1];
  if (topSegment && NO_V2_TOP_SEGMENTS.has(topSegment)) return null;

  for (const rule of WORKSPACE_RULES) {
    const match = pathname.match(rule.pattern);
    if (match) return rule.to(match) + search;
  }

  return null;
}

const V1_STATIC_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(STATIC_MAP).map(([v1, v2]) => [v2, v1]),
);

// Mirrors WORKSPACE_RULES exactly, reading the v2 shape and producing v1.
const WORKSPACE_RULES_TO_V1: WorkspaceRule[] = [
  {
    pattern: /^\/([^/]+)\/app-v2\/projects\/([^/]+)\/work-items\/([^/]+)\/?$/,
    to: (m) => `/${m[1]}/projects/${m[2]}/issues/${m[3]}`,
  },
  {
    pattern: /^\/([^/]+)\/app-v2\/projects\/([^/]+)\/work-items\/?$/,
    to: (m) => `/${m[1]}/projects/${m[2]}/issues`,
  },
  {
    pattern: /^\/([^/]+)\/app-v2\/projects\/([^/]+)\/board\/?$/,
    to: (m) => `/${m[1]}/projects/${m[2]}/board`,
  },
  {
    pattern: new RegExp(`^/([^/]+)/app-v2/projects/([^/]+)/(${PROJECT_SUB_ROUTES})/([^/]+)/?$`),
    to: (m) => `/${m[1]}/projects/${m[2]}/${m[3]}/${m[4]}`,
  },
  {
    pattern: new RegExp(
      `^/([^/]+)/app-v2/projects/([^/]+)/(${PROJECT_SUB_ROUTES}|intake|settings)/?$`,
    ),
    to: (m) => `/${m[1]}/projects/${m[2]}/${m[3]}`,
  },
  {
    pattern: /^\/([^/]+)\/app-v2\/projects\/([^/]+)\/?$/,
    to: (m) => `/${m[1]}/projects/${m[2]}`,
  },
  {
    pattern: /^\/([^/]+)\/app-v2\/projects\/?$/,
    to: (m) => `/${m[1]}/projects`,
  },
  {
    pattern: /^\/([^/]+)\/app-v2\/analytics\/(overview|work-items)\/?$/,
    to: (m) => `/${m[1]}/analytics/${m[2]}`,
  },
  {
    pattern: /^\/([^/]+)\/app-v2\/analytics\/?$/,
    to: (m) => `/${m[1]}/analytics`,
  },
  {
    pattern: /^\/([^/]+)\/app-v2\/views\/([^/]+)\/?$/,
    to: (m) => `/${m[1]}/views/${m[2]}`,
  },
  {
    pattern: /^\/([^/]+)\/app-v2\/views\/?$/,
    to: (m) => `/${m[1]}/views`,
  },
  {
    pattern: /^\/([^/]+)\/app-v2\/(drafts|archives|notifications)\/?$/,
    to: (m) => `/${m[1]}/${m[2]}`,
  },
  {
    pattern: /^\/([^/]+)\/app-v2\/profile\/([^/]+)\/?$/,
    to: (m) => `/${m[1]}/profile/${m[2]}`,
  },
  {
    pattern: /^\/([^/]+)\/app-v2\/settings\/projects\/([^/]+)\/?$/,
    to: (m) => `/${m[1]}/settings/projects/${m[2]}`,
  },
  {
    pattern: /^\/([^/]+)\/app-v2\/settings\/(account|projects)\/?$/,
    to: (m) => `/${m[1]}/settings/${m[2]}`,
  },
  {
    pattern: /^\/([^/]+)\/app-v2\/settings\/?$/,
    to: (m) => `/${m[1]}/settings`,
  },
  {
    pattern: /^\/([^/]+)\/app-v2\/?$/,
    to: (m) => `/${m[1]}`,
  },
];

/**
 * Returns the v1 path for a v2 pathname (static or workspace-scoped), or
 * null if the path is already v1 or doesn't match a known v2 shape. Click-
 * triggered only — see the module doc comment.
 */
export function mapPathToV1(pathname: string, search: string): string | null {
  const staticTarget = V1_STATIC_MAP[pathname];
  if (staticTarget) return staticTarget + search;

  for (const rule of WORKSPACE_RULES_TO_V1) {
    const match = pathname.match(rule.pattern);
    if (match) return rule.to(match) + search;
  }

  return null;
}
