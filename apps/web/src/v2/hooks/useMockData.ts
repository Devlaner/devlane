/**
 * useMockData — returns mock fixtures instead of hitting the real API.
 *
 * Enabled when the Vite env flag VITE_MOCK_DATA is set to "true":
 *
 *   VITE_MOCK_DATA=true npm run dev          # one-time
 *   echo "VITE_MOCK_DATA=true" >> apps/web/.env.local  # permanent for local dev
 *
 * Each helper is an async façade whose signature mirrors the matching service
 * call, so switching a page to mock data is one line:
 *
 *   // real
 *   const issues = await issueService.list(workspaceSlug, projectId);
 *
 *   // mock-aware
 *   const mock = useMockData();
 *   const issues = mock.enabled
 *     ? await mock.listIssues(workspaceSlug, projectId)
 *     : await issueService.list(workspaceSlug, projectId);
 *
 * The flag is read once at module-evaluation time so Vite's tree-shaker can
 * eliminate the mock branch in production builds.
 */

import {
  MOCK,
  MOCK_WORKSPACE,
  MOCK_MEMBERS,
  MOCK_PROJECTS,
  MOCK_ALL_STATES,
  MOCK_LABELS,
  MOCK_CYCLES,
  MOCK_MODULES,
  MOCK_VIEWS,
  MOCK_PAGES,
  MOCK_NOTIFICATIONS,
  MOCK_QUICK_LINKS,
  MOCK_STICKIES,
  MOCK_RECENTS,
  MOCK_INTAKE_ITEMS,
  MOCK_CURRENT_USER,
  MOCK_USER_ACTIVITY,
  mockIssuesForProject,
  mockStatesForProject,
  mockCyclesForProject,
  mockModulesForProject,
  mockViewsForProject,
  mockPagesForProject,
} from '../lib/mockData';

export const MOCK_DATA_ENABLED =
  import.meta.env.VITE_MOCK_DATA === 'true' || import.meta.env.VITE_MOCK_DATA === true;

// ---------------------------------------------------------------------------
// Simulated network delay — keeps loading states visible during development
// ---------------------------------------------------------------------------

const MOCK_DELAY_MS = 300;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), MOCK_DELAY_MS));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns async data-fetching functions backed by the in-memory MOCK fixtures.
 * Every function resolves after a short simulated delay and accepts the same
 * arguments as the real service so call sites read naturally.
 */
export function useMockData() {
  return {
    /** Whether the mock layer is currently active. */
    enabled: MOCK_DATA_ENABLED,

    // -----------------------------------------------------------------------
    // Workspace
    // -----------------------------------------------------------------------

    /** Mirrors workspaceService.getBySlug() */
    getWorkspace(_slug?: string) {
      return delay(MOCK_WORKSPACE);
    },

    /** Mirrors workspaceService.listMembers() */
    listMembers(_slug?: string) {
      return delay(MOCK_MEMBERS);
    },

    // -----------------------------------------------------------------------
    // Projects
    // -----------------------------------------------------------------------

    /** Mirrors projectService.list() */
    listProjects(_slug?: string) {
      return delay(MOCK_PROJECTS);
    },

    /** Mirrors projectService.get() — falls back to first project if id unknown */
    getProject(_slug?: string, projectId?: string) {
      const project =
        MOCK_PROJECTS.find((p) => p.id === projectId) ?? MOCK_PROJECTS[0] ?? null;
      return delay(project);
    },

    /** Mirrors projectService.listMembers() */
    listProjectMembers(_slug?: string, _projectId?: string) {
      return delay(MOCK_MEMBERS);
    },

    // -----------------------------------------------------------------------
    // States
    // -----------------------------------------------------------------------

    /** Mirrors stateService.list() — project-scoped */
    listStates(_slug?: string, projectId?: string) {
      return delay(projectId ? mockStatesForProject(projectId) : MOCK_ALL_STATES);
    },

    // -----------------------------------------------------------------------
    // Labels
    // -----------------------------------------------------------------------

    /** Mirrors labelService.list() */
    listLabels(_slug?: string, _projectId?: string) {
      return delay(MOCK_LABELS);
    },

    // -----------------------------------------------------------------------
    // Issues
    // -----------------------------------------------------------------------

    /** Mirrors issueService.list() */
    listIssues(_slug?: string, projectId?: string) {
      return delay(projectId ? mockIssuesForProject(projectId) : MOCK.issues);
    },

    /** Mirrors issueService.get() */
    getIssue(_slug?: string, _projectId?: string, issueId?: string) {
      const issue = MOCK.issues.find((i) => i.id === issueId) ?? MOCK.issues[0] ?? null;
      return delay(issue);
    },

    /** Mirrors issueService.listWorkspaceDrafts() */
    listDrafts(_slug?: string) {
      return delay(MOCK.issues.filter((i) => i.is_draft === true));
    },

    /** Mirrors issueService.listWorkspaceArchived() */
    listArchived(_slug?: string) {
      return delay(MOCK.issues.filter((i) => Boolean(i.archived_at)));
    },

    // -----------------------------------------------------------------------
    // Cycles
    // -----------------------------------------------------------------------

    /** Mirrors cycleService.list() */
    listCycles(_slug?: string, projectId?: string) {
      return delay(projectId ? mockCyclesForProject(projectId) : MOCK_CYCLES);
    },

    /** Mirrors cycleService.get() */
    getCycle(_slug?: string, _projectId?: string, cycleId?: string) {
      const cycle = MOCK_CYCLES.find((c) => c.id === cycleId) ?? MOCK_CYCLES[0] ?? null;
      return delay(cycle);
    },

    // -----------------------------------------------------------------------
    // Modules
    // -----------------------------------------------------------------------

    /** Mirrors moduleService.list() */
    listModules(_slug?: string, projectId?: string) {
      return delay(projectId ? mockModulesForProject(projectId) : MOCK_MODULES);
    },

    /** Mirrors moduleService.get() */
    getModule(_slug?: string, _projectId?: string, moduleId?: string) {
      const module = MOCK_MODULES.find((m) => m.id === moduleId) ?? MOCK_MODULES[0] ?? null;
      return delay(module);
    },

    // -----------------------------------------------------------------------
    // Views (saved filters)
    // -----------------------------------------------------------------------

    /** Mirrors viewService.list() */
    listViews(_slug?: string, projectId?: string) {
      return delay(projectId ? mockViewsForProject(projectId) : MOCK_VIEWS);
    },

    /** Mirrors viewService.get() */
    getView(_slug?: string, _projectId?: string, viewId?: string) {
      const view = MOCK_VIEWS.find((v) => v.id === viewId) ?? MOCK_VIEWS[0] ?? null;
      return delay(view);
    },

    // -----------------------------------------------------------------------
    // Pages (wiki)
    // -----------------------------------------------------------------------

    /** Mirrors pageService.list() */
    listPages(_slug?: string, opts?: { archived?: boolean }) {
      return delay(mockPagesForProject('', opts?.archived ?? false));
    },

    /** Mirrors pageService.get() */
    getPage(_slug?: string, pageId?: string) {
      const page = MOCK_PAGES.find((p) => p.id === pageId) ?? MOCK_PAGES[0] ?? null;
      return delay(page);
    },

    // -----------------------------------------------------------------------
    // Notifications
    // -----------------------------------------------------------------------

    /** Mirrors notificationService.list() */
    listNotifications(
      _slug?: string,
      opts?: {
        unreadOnly?: boolean;
        mentionsOnly?: boolean;
        archived?: 'archived' | 'inbox';
      },
    ) {
      let items = MOCK_NOTIFICATIONS;
      if (opts?.unreadOnly) items = items.filter((n) => !n.read_at);
      if (opts?.mentionsOnly) items = items.filter((n) => n.sender === 'mentioned');
      if (opts?.archived === 'archived') items = items.filter((n) => Boolean(n.archived_at));
      else items = items.filter((n) => !n.archived_at);
      return delay(items);
    },

    // -----------------------------------------------------------------------
    // Workspace home widgets
    // -----------------------------------------------------------------------

    /** Mirrors quickLinksService.list() */
    listQuickLinks(_slug?: string) {
      return delay(MOCK_QUICK_LINKS);
    },

    /** Mirrors stickiesService.list() */
    listStickies(_slug?: string) {
      return delay(MOCK_STICKIES);
    },

    /** Mirrors recentsService.list() */
    listRecents(_slug?: string) {
      return delay(MOCK_RECENTS);
    },

    // -----------------------------------------------------------------------
    // Intake
    // -----------------------------------------------------------------------

    /** Mirrors intakeService.listItems() */
    listIntakeItems(_slug?: string, _projectId?: string) {
      return delay(MOCK_INTAKE_ITEMS);
    },

    // -----------------------------------------------------------------------
    // User / profile
    // -----------------------------------------------------------------------

    /** Mirrors userService.me() */
    getCurrentUser() {
      return delay(MOCK_CURRENT_USER);
    },

    /** Mirrors userService.activity() */
    getUserActivity(_userId?: string) {
      return delay(MOCK_USER_ACTIVITY);
    },

    // -----------------------------------------------------------------------
    // Raw bag — for one-off access when the helpers above are not enough
    // -----------------------------------------------------------------------
    raw: MOCK,
  } as const;
}
