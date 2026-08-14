/**
 * Mock data for every v2 page.
 *
 * All IDs are stable UUIDs so cross-entity references (e.g. issue.state_id
 * points at a state in MOCK_STATES) resolve correctly.
 *
 * Usage:
 *   import { MOCK } from '@/v2/lib/mockData';
 *   const projects = MOCK.projects;
 */

import type {
  WorkspaceApiResponse,
  WorkspaceMemberApiResponse,
  ProjectApiResponse,
  StateApiResponse,
  LabelApiResponse,
  IssueApiResponse,
  CycleApiResponse,
  ModuleApiResponse,
  IssueViewApiResponse,
  PageApiResponse,
  NotificationApiResponse,
  QuickLinkApiResponse,
  StickyApiResponse,
  RecentVisitApiResponse,
  IntakeItemApiResponse,
  UserApiResponse,
  UserActivityItem,
} from '../../api/types';

// ---------------------------------------------------------------------------
// Timestamps (relative to a fixed "now" so snapshots stay stable)
// ---------------------------------------------------------------------------

const T = (daysAgo: number, hoursAgo = 0): string => {
  const d = new Date('2026-08-14T12:00:00Z');
  d.setDate(d.getDate() - daysAgo);
  d.setHours(d.getHours() - hoursAgo);
  return d.toISOString();
};

// ---------------------------------------------------------------------------
// IDs
// ---------------------------------------------------------------------------

const WS_ID = 'ws-0001-0000-0000-000000000001';
const WS_SLUG = 'acme';

const MEMBER_IDS = {
  alice: 'usr-0001-0000-0000-000000000001',
  bob: 'usr-0001-0000-0000-000000000002',
  carol: 'usr-0001-0000-0000-000000000003',
  dave: 'usr-0001-0000-0000-000000000004',
  eve: 'usr-0001-0000-0000-000000000005',
} as const;

const PROJECT_IDS = {
  frontend: 'prj-0001-0000-0000-000000000001',
  backend: 'prj-0001-0000-0000-000000000002',
  mobile: 'prj-0001-0000-0000-000000000003',
  infra: 'prj-0001-0000-0000-000000000004',
} as const;

// State IDs per project (each project gets its own state set, matching the API)
const mkStateIds = (prefix: string) => ({
  backlog: `sta-${prefix}-0000-0000-000000000001`,
  todo: `sta-${prefix}-0000-0000-000000000002`,
  inProgress: `sta-${prefix}-0000-0000-000000000003`,
  done: `sta-${prefix}-0000-0000-000000000004`,
  cancelled: `sta-${prefix}-0000-0000-000000000005`,
});

const STATE_IDS = {
  frontend: mkStateIds('fe01'),
  backend: mkStateIds('be01'),
  mobile: mkStateIds('mob1'),
  infra: mkStateIds('inf1'),
} as const;

const LABEL_IDS = {
  bug: 'lbl-0001-0000-0000-000000000001',
  feature: 'lbl-0001-0000-0000-000000000002',
  docs: 'lbl-0001-0000-0000-000000000003',
  perf: 'lbl-0001-0000-0000-000000000004',
  security: 'lbl-0001-0000-0000-000000000005',
} as const;

const CYCLE_IDS = {
  sprint1: 'cyc-0001-0000-0000-000000000001',
  sprint2: 'cyc-0001-0000-0000-000000000002',
  sprint3: 'cyc-0001-0000-0000-000000000003',
  sprint4: 'cyc-0001-0000-0000-000000000004',
} as const;

const MODULE_IDS = {
  auth: 'mod-0001-0000-0000-000000000001',
  dashboard: 'mod-0001-0000-0000-000000000002',
  payments: 'mod-0001-0000-0000-000000000003',
  notifications: 'mod-0001-0000-0000-000000000004',
} as const;

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

export const MOCK_WORKSPACE: WorkspaceApiResponse = {
  id: WS_ID,
  name: 'Acme Corp',
  slug: WS_SLUG,
  owner_id: MEMBER_IDS.alice,
  created_at: T(180),
  updated_at: T(2),
};

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export const MOCK_MEMBERS: WorkspaceMemberApiResponse[] = [
  {
    id: 'wm-0001-0000-0000-000000000001',
    workspace_id: WS_ID,
    member_id: MEMBER_IDS.alice,
    role: 20, // admin
    member_display_name: 'Alice Chen',
    member_email: 'alice@acme.dev',
    created_at: T(180),
    updated_at: T(30),
  },
  {
    id: 'wm-0001-0000-0000-000000000002',
    workspace_id: WS_ID,
    member_id: MEMBER_IDS.bob,
    role: 15, // member
    member_display_name: 'Bob Hartmann',
    member_email: 'bob@acme.dev',
    created_at: T(150),
    updated_at: T(10),
  },
  {
    id: 'wm-0001-0000-0000-000000000003',
    workspace_id: WS_ID,
    member_id: MEMBER_IDS.carol,
    role: 15,
    member_display_name: 'Carol Singh',
    member_email: 'carol@acme.dev',
    created_at: T(120),
    updated_at: T(5),
  },
  {
    id: 'wm-0001-0000-0000-000000000004',
    workspace_id: WS_ID,
    member_id: MEMBER_IDS.dave,
    role: 10, // viewer
    member_display_name: 'Dave Okonkwo',
    member_email: 'dave@acme.dev',
    created_at: T(90),
    updated_at: T(20),
  },
  {
    id: 'wm-0001-0000-0000-000000000005',
    workspace_id: WS_ID,
    member_id: MEMBER_IDS.eve,
    role: 15,
    member_display_name: 'Eve Nakamura',
    member_email: 'eve@acme.dev',
    created_at: T(60),
    updated_at: T(1),
  },
];

// ---------------------------------------------------------------------------
// Logged-in user (Alice is the owner)
// ---------------------------------------------------------------------------

export const MOCK_CURRENT_USER: UserApiResponse = {
  id: MEMBER_IDS.alice,
  email: 'alice@acme.dev',
  username: 'alice',
  first_name: 'Alice',
  last_name: 'Chen',
  display_name: 'Alice Chen',
  is_active: true,
  is_onboarded: true,
  is_password_autoset: false,
  date_joined: T(180),
  created_at: T(180),
  updated_at: T(2),
};

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const MOCK_PROJECTS: ProjectApiResponse[] = [
  {
    id: PROJECT_IDS.frontend,
    workspace_id: WS_ID,
    name: 'Frontend',
    description: 'React application — design system, new v2 interface, and performance work.',
    identifier: 'FE',
    network: 2, // public
    project_lead_id: MEMBER_IDS.alice,
    cycle_view: true,
    module_view: true,
    issue_views_view: true,
    page_view: true,
    intake_view: true,
    is_time_tracking_enabled: true,
    created_at: T(170),
    updated_at: T(1),
  },
  {
    id: PROJECT_IDS.backend,
    workspace_id: WS_ID,
    name: 'Backend API',
    description: 'Go REST API — authentication, data models, webhooks, and integrations.',
    identifier: 'API',
    network: 2,
    project_lead_id: MEMBER_IDS.bob,
    cycle_view: true,
    module_view: true,
    issue_views_view: true,
    page_view: true,
    intake_view: false,
    created_at: T(165),
    updated_at: T(3),
  },
  {
    id: PROJECT_IDS.mobile,
    workspace_id: WS_ID,
    name: 'Mobile App',
    description: 'React Native — iOS and Android.',
    identifier: 'MOB',
    network: 0, // private
    project_lead_id: MEMBER_IDS.carol,
    cycle_view: true,
    module_view: false,
    issue_views_view: true,
    page_view: false,
    intake_view: false,
    created_at: T(120),
    updated_at: T(7),
  },
  {
    id: PROJECT_IDS.infra,
    workspace_id: WS_ID,
    name: 'Infrastructure',
    description: 'Kubernetes, CI/CD pipelines, observability, and cloud cost.',
    identifier: 'INFRA',
    network: 0,
    project_lead_id: MEMBER_IDS.dave,
    cycle_view: false,
    module_view: true,
    issue_views_view: false,
    page_view: true,
    intake_view: false,
    created_at: T(100),
    updated_at: T(12),
  },
];

// ---------------------------------------------------------------------------
// States (one set per project so IDs are project-scoped, matching the API)
// ---------------------------------------------------------------------------

const mkStates = (
  projectId: string,
  ids: ReturnType<typeof mkStateIds>,
): StateApiResponse[] => [
  {
    id: ids.backlog,
    project_id: projectId,
    workspace_id: WS_ID,
    name: 'Backlog',
    color: '#9CA3AF',
    group: 'backlog',
    sequence: 1,
    default: true,
    created_at: T(170),
    updated_at: T(170),
  },
  {
    id: ids.todo,
    project_id: projectId,
    workspace_id: WS_ID,
    name: 'Todo',
    color: '#F59E0B',
    group: 'unstarted',
    sequence: 2,
    created_at: T(170),
    updated_at: T(170),
  },
  {
    id: ids.inProgress,
    project_id: projectId,
    workspace_id: WS_ID,
    name: 'In Progress',
    color: '#3B82F6',
    group: 'started',
    sequence: 3,
    created_at: T(170),
    updated_at: T(170),
  },
  {
    id: ids.done,
    project_id: projectId,
    workspace_id: WS_ID,
    name: 'Done',
    color: '#10B981',
    group: 'completed',
    sequence: 4,
    created_at: T(170),
    updated_at: T(170),
  },
  {
    id: ids.cancelled,
    project_id: projectId,
    workspace_id: WS_ID,
    name: 'Cancelled',
    color: '#EF4444',
    group: 'cancelled',
    sequence: 5,
    created_at: T(170),
    updated_at: T(170),
  },
];

export const MOCK_STATES: Record<keyof typeof PROJECT_IDS, StateApiResponse[]> = {
  frontend: mkStates(PROJECT_IDS.frontend, STATE_IDS.frontend),
  backend: mkStates(PROJECT_IDS.backend, STATE_IDS.backend),
  mobile: mkStates(PROJECT_IDS.mobile, STATE_IDS.mobile),
  infra: mkStates(PROJECT_IDS.infra, STATE_IDS.infra),
};

/** Flat array for pages that load states from all projects at once */
export const MOCK_ALL_STATES: StateApiResponse[] = Object.values(MOCK_STATES).flat();

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export const MOCK_LABELS: LabelApiResponse[] = [
  {
    id: LABEL_IDS.bug,
    workspace_id: WS_ID,
    name: 'Bug',
    color: '#EF4444',
    sort_order: 1,
    created_at: T(170),
    updated_at: T(170),
  },
  {
    id: LABEL_IDS.feature,
    workspace_id: WS_ID,
    name: 'Feature',
    color: '#3B82F6',
    sort_order: 2,
    created_at: T(170),
    updated_at: T(170),
  },
  {
    id: LABEL_IDS.docs,
    workspace_id: WS_ID,
    name: 'Documentation',
    color: '#8B5CF6',
    sort_order: 3,
    created_at: T(170),
    updated_at: T(170),
  },
  {
    id: LABEL_IDS.perf,
    workspace_id: WS_ID,
    name: 'Performance',
    color: '#F59E0B',
    sort_order: 4,
    created_at: T(170),
    updated_at: T(170),
  },
  {
    id: LABEL_IDS.security,
    workspace_id: WS_ID,
    name: 'Security',
    color: '#EC4899',
    sort_order: 5,
    created_at: T(170),
    updated_at: T(170),
  },
];

// ---------------------------------------------------------------------------
// Issues (work items)
// ---------------------------------------------------------------------------

export const MOCK_ISSUES: IssueApiResponse[] = [
  // --- Frontend issues ---
  {
    id: 'iss-fe-000000000001',
    project_id: PROJECT_IDS.frontend,
    workspace_id: WS_ID,
    name: 'Implement v2 design system token bridge',
    priority: 'urgent',
    state_id: STATE_IDS.frontend.inProgress,
    assignee_ids: [MEMBER_IDS.alice],
    label_ids: [LABEL_IDS.feature],
    cycle_ids: [CYCLE_IDS.sprint2],
    module_ids: [MODULE_IDS.dashboard],
    sequence_id: 1,
    sort_order: 1000,
    created_at: T(30),
    updated_at: T(1),
    target_date: T(-5),
  },
  {
    id: 'iss-fe-000000000002',
    project_id: PROJECT_IDS.frontend,
    workspace_id: WS_ID,
    name: 'Fix button focus ring disappearing in Safari',
    priority: 'high',
    state_id: STATE_IDS.frontend.todo,
    assignee_ids: [MEMBER_IDS.bob],
    label_ids: [LABEL_IDS.bug],
    cycle_ids: [CYCLE_IDS.sprint2],
    sequence_id: 2,
    sort_order: 2000,
    created_at: T(20),
    updated_at: T(2),
    target_date: T(-3),
  },
  {
    id: 'iss-fe-000000000003',
    project_id: PROJECT_IDS.frontend,
    workspace_id: WS_ID,
    name: 'Add skeleton loaders to all list pages',
    priority: 'medium',
    state_id: STATE_IDS.frontend.done,
    assignee_ids: [MEMBER_IDS.carol, MEMBER_IDS.alice],
    label_ids: [LABEL_IDS.feature],
    cycle_ids: [CYCLE_IDS.sprint1],
    sequence_id: 3,
    sort_order: 3000,
    created_at: T(45),
    updated_at: T(10),
  },
  {
    id: 'iss-fe-000000000004',
    project_id: PROJECT_IDS.frontend,
    workspace_id: WS_ID,
    name: 'Reduce initial JS bundle by 30%',
    priority: 'high',
    state_id: STATE_IDS.frontend.backlog,
    assignee_ids: [],
    label_ids: [LABEL_IDS.perf],
    sequence_id: 4,
    sort_order: 4000,
    created_at: T(60),
    updated_at: T(15),
  },
  {
    id: 'iss-fe-000000000005',
    project_id: PROJECT_IDS.frontend,
    workspace_id: WS_ID,
    name: 'Update i18n strings for new settings UI',
    priority: 'low',
    state_id: STATE_IDS.frontend.inProgress,
    assignee_ids: [MEMBER_IDS.eve],
    label_ids: [LABEL_IDS.docs],
    cycle_ids: [CYCLE_IDS.sprint2],
    sequence_id: 5,
    sort_order: 5000,
    created_at: T(18),
    updated_at: T(0, 3),
    start_date: T(10),
    target_date: T(-7),
  },
  {
    id: 'iss-fe-000000000006',
    project_id: PROJECT_IDS.frontend,
    workspace_id: WS_ID,
    name: 'CSP header breaks inline styles in chart tooltips',
    priority: 'urgent',
    state_id: STATE_IDS.frontend.todo,
    assignee_ids: [MEMBER_IDS.alice],
    label_ids: [LABEL_IDS.bug, LABEL_IDS.security],
    sequence_id: 6,
    sort_order: 6000,
    created_at: T(5),
    updated_at: T(0, 1),
  },
  {
    id: 'iss-fe-000000000007',
    project_id: PROJECT_IDS.frontend,
    workspace_id: WS_ID,
    name: 'Dark mode: card background bleeds on hover',
    priority: 'medium',
    state_id: STATE_IDS.frontend.cancelled,
    assignee_ids: [MEMBER_IDS.bob],
    label_ids: [LABEL_IDS.bug],
    sequence_id: 7,
    sort_order: 7000,
    created_at: T(55),
    updated_at: T(25),
  },
  // --- Backend issues ---
  {
    id: 'iss-be-000000000001',
    project_id: PROJECT_IDS.backend,
    workspace_id: WS_ID,
    name: 'Migrate auth tokens to short-lived JWTs',
    priority: 'urgent',
    state_id: STATE_IDS.backend.inProgress,
    assignee_ids: [MEMBER_IDS.bob],
    label_ids: [LABEL_IDS.security],
    cycle_ids: [CYCLE_IDS.sprint3],
    sequence_id: 1,
    sort_order: 1000,
    created_at: T(40),
    updated_at: T(2),
    target_date: T(-10),
  },
  {
    id: 'iss-be-000000000002',
    project_id: PROJECT_IDS.backend,
    workspace_id: WS_ID,
    name: 'Add rate limiting to public intake endpoint',
    priority: 'high',
    state_id: STATE_IDS.backend.todo,
    assignee_ids: [MEMBER_IDS.dave],
    label_ids: [LABEL_IDS.security, LABEL_IDS.feature],
    cycle_ids: [CYCLE_IDS.sprint3],
    sequence_id: 2,
    sort_order: 2000,
    created_at: T(35),
    updated_at: T(4),
  },
  {
    id: 'iss-be-000000000003',
    project_id: PROJECT_IDS.backend,
    workspace_id: WS_ID,
    name: 'Webhook delivery retry queue',
    priority: 'medium',
    state_id: STATE_IDS.backend.backlog,
    assignee_ids: [],
    label_ids: [LABEL_IDS.feature],
    sequence_id: 3,
    sort_order: 3000,
    created_at: T(60),
    updated_at: T(14),
  },
  {
    id: 'iss-be-000000000004',
    project_id: PROJECT_IDS.backend,
    workspace_id: WS_ID,
    name: 'Flaky test: workspace member list ordering',
    priority: 'medium',
    state_id: STATE_IDS.backend.done,
    assignee_ids: [MEMBER_IDS.bob],
    label_ids: [LABEL_IDS.bug],
    cycle_ids: [CYCLE_IDS.sprint2],
    sequence_id: 4,
    sort_order: 4000,
    created_at: T(22),
    updated_at: T(6),
  },
  {
    id: 'iss-be-000000000005',
    project_id: PROJECT_IDS.backend,
    workspace_id: WS_ID,
    name: 'Paginate /api/workspaces/:slug/issues/ for large workspaces',
    priority: 'high',
    state_id: STATE_IDS.backend.inProgress,
    assignee_ids: [MEMBER_IDS.carol],
    label_ids: [LABEL_IDS.perf],
    cycle_ids: [CYCLE_IDS.sprint3],
    module_ids: [MODULE_IDS.notifications],
    sequence_id: 5,
    sort_order: 5000,
    created_at: T(28),
    updated_at: T(1),
    start_date: T(14),
    target_date: T(-4),
  },
  // --- Mobile issues ---
  {
    id: 'iss-mob-00000000001',
    project_id: PROJECT_IDS.mobile,
    workspace_id: WS_ID,
    name: 'Push notifications not delivered on iOS 17.5',
    priority: 'urgent',
    state_id: STATE_IDS.mobile.inProgress,
    assignee_ids: [MEMBER_IDS.carol],
    label_ids: [LABEL_IDS.bug],
    cycle_ids: [CYCLE_IDS.sprint4],
    sequence_id: 1,
    sort_order: 1000,
    created_at: T(10),
    updated_at: T(0, 6),
  },
  {
    id: 'iss-mob-00000000002',
    project_id: PROJECT_IDS.mobile,
    workspace_id: WS_ID,
    name: 'Offline mode: queue mutations and sync on reconnect',
    priority: 'high',
    state_id: STATE_IDS.mobile.todo,
    assignee_ids: [MEMBER_IDS.eve],
    label_ids: [LABEL_IDS.feature],
    sequence_id: 2,
    sort_order: 2000,
    created_at: T(50),
    updated_at: T(8),
  },
  {
    id: 'iss-mob-00000000003',
    project_id: PROJECT_IDS.mobile,
    workspace_id: WS_ID,
    name: 'Android: camera permissions crash on first launch',
    priority: 'urgent',
    state_id: STATE_IDS.mobile.done,
    assignee_ids: [MEMBER_IDS.carol, MEMBER_IDS.dave],
    label_ids: [LABEL_IDS.bug],
    cycle_ids: [CYCLE_IDS.sprint3],
    sequence_id: 3,
    sort_order: 3000,
    created_at: T(30),
    updated_at: T(5),
  },
  // --- Infrastructure issues ---
  {
    id: 'iss-inf-00000000001',
    project_id: PROJECT_IDS.infra,
    workspace_id: WS_ID,
    name: 'Migrate staging cluster to Kubernetes 1.30',
    priority: 'high',
    state_id: STATE_IDS.infra.inProgress,
    assignee_ids: [MEMBER_IDS.dave],
    label_ids: [],
    sequence_id: 1,
    sort_order: 1000,
    created_at: T(25),
    updated_at: T(3),
    target_date: T(-14),
  },
  {
    id: 'iss-inf-00000000002',
    project_id: PROJECT_IDS.infra,
    workspace_id: WS_ID,
    name: 'Set up OpenTelemetry traces for API service',
    priority: 'medium',
    state_id: STATE_IDS.infra.todo,
    assignee_ids: [MEMBER_IDS.dave, MEMBER_IDS.bob],
    label_ids: [LABEL_IDS.feature],
    module_ids: [MODULE_IDS.notifications],
    sequence_id: 2,
    sort_order: 2000,
    created_at: T(40),
    updated_at: T(9),
  },
  {
    id: 'iss-inf-00000000003',
    project_id: PROJECT_IDS.infra,
    workspace_id: WS_ID,
    name: 'Reduce monthly cloud bill by 20%',
    priority: 'medium',
    state_id: STATE_IDS.infra.backlog,
    assignee_ids: [],
    label_ids: [LABEL_IDS.perf],
    sequence_id: 3,
    sort_order: 3000,
    created_at: T(70),
    updated_at: T(20),
  },
];

// ---------------------------------------------------------------------------
// Cycles
// ---------------------------------------------------------------------------

export const MOCK_CYCLES: CycleApiResponse[] = [
  {
    id: CYCLE_IDS.sprint1,
    name: 'Sprint 1 — Foundation',
    description: 'Set up design system, CI/CD, and initial page scaffolding.',
    start_date: T(60),
    end_date: T(46),
    status: 'completed',
    project_id: PROJECT_IDS.frontend,
    workspace_id: WS_ID,
    owned_by_id: MEMBER_IDS.alice,
    sort_order: 1,
    issue_count: 8,
    created_at: T(65),
    updated_at: T(46),
  },
  {
    id: CYCLE_IDS.sprint2,
    name: 'Sprint 2 — Core Features',
    description: 'Work item list, inline editing, and board layout.',
    start_date: T(14),
    end_date: T(0),
    status: 'current',
    project_id: PROJECT_IDS.frontend,
    workspace_id: WS_ID,
    owned_by_id: MEMBER_IDS.alice,
    sort_order: 2,
    issue_count: 12,
    created_at: T(16),
    updated_at: T(1),
  },
  {
    id: CYCLE_IDS.sprint3,
    name: 'Sprint 3 — Auth & Security',
    description: 'JWT migration, rate limiting, and CSP hardening.',
    start_date: T(-7),
    end_date: T(-21),
    status: 'upcoming',
    project_id: PROJECT_IDS.backend,
    workspace_id: WS_ID,
    owned_by_id: MEMBER_IDS.bob,
    sort_order: 1,
    issue_count: 6,
    created_at: T(10),
    updated_at: T(2),
  },
  {
    id: CYCLE_IDS.sprint4,
    name: 'Sprint 4 — Mobile Stability',
    description: 'Fix iOS push notifications, improve offline mode.',
    start_date: T(3),
    end_date: T(-11),
    status: 'current',
    project_id: PROJECT_IDS.mobile,
    workspace_id: WS_ID,
    owned_by_id: MEMBER_IDS.carol,
    sort_order: 1,
    issue_count: 5,
    created_at: T(5),
    updated_at: T(0, 2),
  },
];

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

export const MOCK_MODULES: ModuleApiResponse[] = [
  {
    id: MODULE_IDS.auth,
    name: 'Authentication',
    description: 'Magic-code login, OAuth providers, password reset, and session management.',
    start_date: T(90),
    target_date: T(30),
    status: 'completed',
    project_id: PROJECT_IDS.backend,
    workspace_id: WS_ID,
    lead_id: MEMBER_IDS.bob,
    member_ids: [MEMBER_IDS.bob, MEMBER_IDS.alice],
    sort_order: 1,
    issue_count: 11,
    created_at: T(95),
    updated_at: T(30),
  },
  {
    id: MODULE_IDS.dashboard,
    name: 'Dashboard & Analytics',
    description: 'Overview page, stat tiles, chart components, and project progress views.',
    start_date: T(45),
    target_date: T(-10),
    status: 'in_progress',
    project_id: PROJECT_IDS.frontend,
    workspace_id: WS_ID,
    lead_id: MEMBER_IDS.alice,
    member_ids: [MEMBER_IDS.alice, MEMBER_IDS.carol],
    sort_order: 2,
    issue_count: 9,
    created_at: T(50),
    updated_at: T(1),
  },
  {
    id: MODULE_IDS.payments,
    name: 'Billing & Payments',
    description: 'Stripe integration, subscription plans, and invoice generation.',
    start_date: T(-14),
    target_date: T(-42),
    status: 'backlog',
    project_id: PROJECT_IDS.backend,
    workspace_id: WS_ID,
    lead_id: MEMBER_IDS.bob,
    member_ids: [MEMBER_IDS.bob],
    sort_order: 3,
    issue_count: 0,
    created_at: T(20),
    updated_at: T(15),
  },
  {
    id: MODULE_IDS.notifications,
    name: 'Notification System',
    description: 'In-app inbox, email digests, push notifications, and snooze support.',
    start_date: T(30),
    target_date: T(-7),
    status: 'in_progress',
    project_id: PROJECT_IDS.backend,
    workspace_id: WS_ID,
    lead_id: MEMBER_IDS.carol,
    member_ids: [MEMBER_IDS.carol, MEMBER_IDS.eve, MEMBER_IDS.dave],
    sort_order: 4,
    issue_count: 7,
    created_at: T(35),
    updated_at: T(2),
  },
];

// ---------------------------------------------------------------------------
// Saved views
// ---------------------------------------------------------------------------

export const MOCK_VIEWS: IssueViewApiResponse[] = [
  {
    id: 'view-0001-0000-0000-000000000001',
    name: 'My open items',
    description: 'All unresolved work items assigned to me.',
    filters: { assignees: [MEMBER_IDS.alice], state_group: ['backlog', 'unstarted', 'started'] },
    display_filters: { order_by: '-created_at', group_by: 'state' },
    display_properties: { priority: true, due_date: true, assignee: true },
    access: 'private',
    is_favorite: true,
    owned_by_id: MEMBER_IDS.alice,
    workspace_id: WS_ID,
    project_id: PROJECT_IDS.frontend,
    created_at: T(50),
    updated_at: T(3),
  },
  {
    id: 'view-0001-0000-0000-000000000002',
    name: 'Urgent & High priority',
    description: 'Urgent and high-priority items across the whole project.',
    filters: { priority: ['urgent', 'high'] },
    display_filters: { order_by: '-updated_at' },
    display_properties: { state: true, priority: true, due_date: true },
    access: 'public',
    is_favorite: false,
    owned_by_id: MEMBER_IDS.bob,
    workspace_id: WS_ID,
    project_id: PROJECT_IDS.frontend,
    created_at: T(40),
    updated_at: T(10),
  },
  {
    id: 'view-0001-0000-0000-000000000003',
    name: 'Security items',
    description: 'All items labelled security across projects.',
    filters: { label: [LABEL_IDS.security] },
    display_filters: { order_by: '-priority' },
    display_properties: { state: true, priority: true, labels: true },
    access: 'public',
    is_favorite: true,
    owned_by_id: MEMBER_IDS.alice,
    workspace_id: WS_ID,
    project_id: null,
    created_at: T(25),
    updated_at: T(5),
  },
  {
    id: 'view-0001-0000-0000-000000000004',
    name: 'Completed this sprint',
    description: 'Work items closed during Sprint 2.',
    filters: { state_group: ['completed'], cycle: [CYCLE_IDS.sprint2] },
    display_filters: { order_by: '-updated_at' },
    display_properties: { state: true, assignee: true },
    access: 'public',
    is_favorite: false,
    owned_by_id: MEMBER_IDS.carol,
    workspace_id: WS_ID,
    project_id: PROJECT_IDS.frontend,
    created_at: T(15),
    updated_at: T(1),
  },
];

// ---------------------------------------------------------------------------
// Pages (wiki / notes)
// ---------------------------------------------------------------------------

export const MOCK_PAGES: PageApiResponse[] = [
  {
    id: 'pag-0001-0000-0000-000000000001',
    name: 'v2 Design System Guide',
    title: 'v2 Design System Guide',
    description_html:
      '<h1>Design System</h1><p>Token bridge, component usage, and accessibility notes for the v2 interface.</p>',
    owned_by_id: MEMBER_IDS.alice,
    workspace_id: WS_ID,
    access: 0,
    is_locked: false,
    archived_at: null,
    created_at: T(60),
    updated_at: T(4),
  },
  {
    id: 'pag-0001-0000-0000-000000000002',
    name: 'API Changelog',
    title: 'API Changelog',
    description_html:
      '<h1>API Changelog</h1><h2>v0.8</h2><p>Added pagination to issues endpoint. Rate limiting on public routes.</p>',
    owned_by_id: MEMBER_IDS.bob,
    workspace_id: WS_ID,
    access: 0,
    is_locked: false,
    archived_at: null,
    created_at: T(45),
    updated_at: T(2),
  },
  {
    id: 'pag-0001-0000-0000-000000000003',
    name: 'Sprint Planning Template',
    title: 'Sprint Planning Template',
    description_html:
      '<h1>Sprint Planning</h1><p>Goals, capacity, commitments, and retrospective notes.</p>',
    owned_by_id: MEMBER_IDS.alice,
    workspace_id: WS_ID,
    access: 0,
    is_locked: true,
    archived_at: null,
    created_at: T(90),
    updated_at: T(30),
  },
  {
    id: 'pag-0001-0000-0000-000000000004',
    name: 'Old Tech Radar 2025',
    title: 'Old Tech Radar 2025',
    description_html: '<p>Archived — superseded by 2026 edition.</p>',
    owned_by_id: MEMBER_IDS.carol,
    workspace_id: WS_ID,
    access: 0,
    is_locked: false,
    archived_at: T(30),
    created_at: T(180),
    updated_at: T(30),
  },
];

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const MOCK_NOTIFICATIONS: NotificationApiResponse[] = [
  {
    id: 'ntf-0001-0000-0000-000000000001',
    title: 'Bob Hartmann assigned you to FE-1',
    sender: 'assigned',
    receiver_id: MEMBER_IDS.alice,
    workspace_id: WS_ID,
    project_id: PROJECT_IDS.frontend,
    entity_identifier: 'iss-fe-000000000001',
    entity_name: 'issue',
    read_at: null,
    archived_at: null,
    created_at: T(0, 2),
    updated_at: T(0, 2),
    message: {
      actor: { id: MEMBER_IDS.bob, display_name: 'Bob Hartmann' },
      issue: {
        id: 'iss-fe-000000000001',
        name: 'Implement v2 design system token bridge',
        sequence_id: 1,
        project_identifier: 'FE',
      },
    },
  },
  {
    id: 'ntf-0001-0000-0000-000000000002',
    title: 'Carol Singh mentioned you in FE-5',
    sender: 'mentioned',
    receiver_id: MEMBER_IDS.alice,
    workspace_id: WS_ID,
    project_id: PROJECT_IDS.frontend,
    entity_identifier: 'iss-fe-000000000005',
    entity_name: 'issue',
    read_at: null,
    archived_at: null,
    created_at: T(0, 5),
    updated_at: T(0, 5),
    message: {
      actor: { id: MEMBER_IDS.carol, display_name: 'Carol Singh' },
      issue: {
        id: 'iss-fe-000000000005',
        name: 'Update i18n strings for new settings UI',
        sequence_id: 5,
        project_identifier: 'FE',
      },
      comment_preview: 'Alice, can you review the French translations before we ship?',
      context: 'comment',
    },
  },
  {
    id: 'ntf-0001-0000-0000-000000000003',
    title: 'Dave Okonkwo changed state of API-1 to In Progress',
    sender: 'state_changed',
    receiver_id: MEMBER_IDS.alice,
    workspace_id: WS_ID,
    project_id: PROJECT_IDS.backend,
    entity_identifier: 'iss-be-000000000001',
    entity_name: 'issue',
    read_at: T(1),
    archived_at: null,
    created_at: T(1),
    updated_at: T(1),
    message: {
      actor: { id: MEMBER_IDS.dave, display_name: 'Dave Okonkwo' },
      issue: {
        id: 'iss-be-000000000001',
        name: 'Migrate auth tokens to short-lived JWTs',
        sequence_id: 1,
        project_identifier: 'API',
      },
      field: 'state',
      before: 'Todo',
      after: 'In Progress',
    },
  },
  {
    id: 'ntf-0001-0000-0000-000000000004',
    title: 'Eve Nakamura commented on FE-2',
    sender: 'commented',
    receiver_id: MEMBER_IDS.alice,
    workspace_id: WS_ID,
    project_id: PROJECT_IDS.frontend,
    entity_identifier: 'iss-fe-000000000002',
    entity_name: 'issue',
    read_at: T(2),
    archived_at: null,
    created_at: T(2),
    updated_at: T(2),
    message: {
      actor: { id: MEMBER_IDS.eve, display_name: 'Eve Nakamura' },
      issue: {
        id: 'iss-fe-000000000002',
        name: 'Fix button focus ring disappearing in Safari',
        sequence_id: 2,
        project_identifier: 'FE',
      },
      comment_preview: 'Reproduced on Safari 17.4 and 17.5. The ring is removed by the UA sheet.',
    },
  },
  {
    id: 'ntf-0001-0000-0000-000000000005',
    title: 'Bob Hartmann set priority of API-2 to High',
    sender: 'state_changed',
    receiver_id: MEMBER_IDS.alice,
    workspace_id: WS_ID,
    project_id: PROJECT_IDS.backend,
    entity_identifier: 'iss-be-000000000002',
    entity_name: 'issue',
    read_at: T(3),
    archived_at: T(3),
    created_at: T(3),
    updated_at: T(3),
    message: {
      actor: { id: MEMBER_IDS.bob, display_name: 'Bob Hartmann' },
      issue: {
        id: 'iss-be-000000000002',
        name: 'Add rate limiting to public intake endpoint',
        sequence_id: 2,
        project_identifier: 'API',
      },
      field: 'priority',
      before: 'Medium',
      after: 'High',
    },
  },
];

// ---------------------------------------------------------------------------
// Quick links & Stickies (workspace home widgets)
// ---------------------------------------------------------------------------

export const MOCK_QUICK_LINKS: QuickLinkApiResponse[] = [
  {
    id: 'ql-0001-0000-0000-000000000001',
    title: 'Figma — v2 Designs',
    url: 'https://figma.com/file/example/v2-designs',
    owner_id: MEMBER_IDS.alice,
    workspace_id: WS_ID,
    created_at: T(40),
    updated_at: T(40),
  },
  {
    id: 'ql-0001-0000-0000-000000000002',
    title: 'shadcn/ui Docs',
    url: 'https://ui.shadcn.com/docs/components',
    owner_id: MEMBER_IDS.alice,
    workspace_id: WS_ID,
    created_at: T(35),
    updated_at: T(35),
  },
  {
    id: 'ql-0001-0000-0000-000000000003',
    title: 'Staging environment',
    url: 'https://staging.acme.dev',
    owner_id: MEMBER_IDS.alice,
    workspace_id: WS_ID,
    created_at: T(30),
    updated_at: T(2),
  },
];

export const MOCK_STICKIES: StickyApiResponse[] = [
  {
    id: 'stk-0001-0000-0000-000000000001',
    name: 'Sprint 2 goal',
    description: 'Ship v2 work item list with inline editing before Aug 21.',
    color: '#FEF08A',
    sort_order: 1,
    workspace_id: WS_ID,
    owner_id: MEMBER_IDS.alice,
    created_at: T(14),
    updated_at: T(14),
  },
  {
    id: 'stk-0001-0000-0000-000000000002',
    name: 'Reminder',
    description: 'Design review every Thursday at 15:00 UTC.',
    color: '#BBF7D0',
    sort_order: 2,
    workspace_id: WS_ID,
    owner_id: MEMBER_IDS.alice,
    created_at: T(20),
    updated_at: T(7),
  },
  {
    id: 'stk-0001-0000-0000-000000000003',
    name: 'API keys',
    description: 'Remember to rotate the staging Stripe key before the next pentest.',
    color: '#FECACA',
    sort_order: 3,
    workspace_id: WS_ID,
    owner_id: MEMBER_IDS.alice,
    created_at: T(10),
    updated_at: T(10),
  },
];

// ---------------------------------------------------------------------------
// Recent visits (workspace home)
// ---------------------------------------------------------------------------

export const MOCK_RECENTS: RecentVisitApiResponse[] = [
  {
    id: 'rv-0001-0000-0000-000000000001',
    workspace_id: WS_ID,
    project_id: PROJECT_IDS.frontend,
    user_id: MEMBER_IDS.alice,
    entity_identifier: 'iss-fe-000000000001',
    entity_name: 'issue',
    display_title: 'Implement v2 design system token bridge',
    display_identifier: 'FE-1',
    last_visited_at: T(0, 1),
    created_at: T(0, 1),
    updated_at: T(0, 1),
  },
  {
    id: 'rv-0001-0000-0000-000000000002',
    workspace_id: WS_ID,
    project_id: PROJECT_IDS.frontend,
    user_id: MEMBER_IDS.alice,
    entity_identifier: PROJECT_IDS.frontend,
    entity_name: 'project',
    display_title: 'Frontend',
    last_visited_at: T(0, 2),
    created_at: T(0, 2),
    updated_at: T(0, 2),
  },
  {
    id: 'rv-0001-0000-0000-000000000003',
    workspace_id: WS_ID,
    project_id: PROJECT_IDS.backend,
    user_id: MEMBER_IDS.alice,
    entity_identifier: 'iss-be-000000000001',
    entity_name: 'issue',
    display_title: 'Migrate auth tokens to short-lived JWTs',
    display_identifier: 'API-1',
    last_visited_at: T(0, 4),
    created_at: T(0, 4),
    updated_at: T(0, 4),
  },
  {
    id: 'rv-0001-0000-0000-000000000004',
    workspace_id: WS_ID,
    project_id: PROJECT_IDS.frontend,
    user_id: MEMBER_IDS.alice,
    entity_identifier: 'pag-0001-0000-0000-000000000001',
    entity_name: 'page',
    display_title: 'v2 Design System Guide',
    last_visited_at: T(1),
    created_at: T(1),
    updated_at: T(1),
  },
  {
    id: 'rv-0001-0000-0000-000000000005',
    workspace_id: WS_ID,
    project_id: PROJECT_IDS.mobile,
    user_id: MEMBER_IDS.alice,
    entity_identifier: PROJECT_IDS.mobile,
    entity_name: 'project',
    display_title: 'Mobile App',
    last_visited_at: T(1),
    created_at: T(1),
    updated_at: T(1),
  },
];

// ---------------------------------------------------------------------------
// Intake items
// ---------------------------------------------------------------------------

export const MOCK_INTAKE_ITEMS: IntakeItemApiResponse[] = [
  {
    id: 'iit-0001-0000-0000-000000000001',
    intake_id: 'int-0001-0000-0000-000000000001',
    issue_id: 'iss-fe-000000000101',
    status: -2, // pending
    source: 'email',
    source_email: 'customer@example.com',
    project_id: PROJECT_IDS.frontend,
    workspace_id: WS_ID,
    created_at: T(3),
    updated_at: T(3),
    issue: {
      id: 'iss-fe-000000000101',
      name: 'Date picker does not work on mobile',
      sequence_id: 101,
      priority: 'medium',
      created_at: T(3),
    },
  },
  {
    id: 'iit-0001-0000-0000-000000000002',
    intake_id: 'int-0001-0000-0000-000000000001',
    issue_id: 'iss-fe-000000000102',
    status: 1, // accepted
    source: 'in_app',
    project_id: PROJECT_IDS.frontend,
    workspace_id: WS_ID,
    created_at: T(7),
    updated_at: T(5),
    issue: {
      id: 'iss-fe-000000000102',
      name: 'Export to CSV should include all columns',
      sequence_id: 102,
      priority: 'low',
      created_at: T(7),
    },
  },
  {
    id: 'iit-0001-0000-0000-000000000003',
    intake_id: 'int-0001-0000-0000-000000000001',
    issue_id: 'iss-fe-000000000103',
    status: -1, // declined
    source: 'email',
    source_email: 'feedback@partner.io',
    project_id: PROJECT_IDS.frontend,
    workspace_id: WS_ID,
    created_at: T(12),
    updated_at: T(9),
    issue: {
      id: 'iss-fe-000000000103',
      name: 'Add a dark-mode toggle to every page header',
      sequence_id: 103,
      priority: 'none',
      created_at: T(12),
    },
  },
  {
    id: 'iit-0001-0000-0000-000000000004',
    intake_id: 'int-0001-0000-0000-000000000001',
    issue_id: 'iss-fe-000000000104',
    status: 0, // snoozed
    snoozed_till: T(-7),
    source: 'in_app',
    project_id: PROJECT_IDS.frontend,
    workspace_id: WS_ID,
    created_at: T(15),
    updated_at: T(15),
    issue: {
      id: 'iss-fe-000000000104',
      name: 'Allow bulk reassign from the board view',
      sequence_id: 104,
      priority: 'medium',
      created_at: T(15),
    },
  },
];

// ---------------------------------------------------------------------------
// User activity (profile page)
// ---------------------------------------------------------------------------

export const MOCK_USER_ACTIVITY: UserActivityItem[] = [
  {
    id: 'act-0001-0000-0000-000000000001',
    type: 'issue_activity',
    created_at: T(0, 1),
    description: 'created FE-1 · Implement v2 design system token bridge',
    verb: 'created',
    issue_id: 'iss-fe-000000000001',
    issue_name: 'Implement v2 design system token bridge',
    workspace_id: WS_ID,
    project_id: PROJECT_IDS.frontend,
  },
  {
    id: 'act-0001-0000-0000-000000000002',
    type: 'issue_activity',
    created_at: T(1),
    description: 'changed state of API-1 from Backlog to In Progress',
    verb: 'updated',
    field: 'state',
    old_value: 'Backlog',
    new_value: 'In Progress',
    issue_id: 'iss-be-000000000001',
    issue_name: 'Migrate auth tokens to short-lived JWTs',
    workspace_id: WS_ID,
    project_id: PROJECT_IDS.backend,
  },
  {
    id: 'act-0001-0000-0000-000000000003',
    type: 'issue_activity',
    created_at: T(2),
    description: 'changed priority of FE-2 from Medium to High',
    verb: 'updated',
    field: 'priority',
    old_value: 'medium',
    new_value: 'high',
    issue_id: 'iss-fe-000000000002',
    issue_name: 'Fix button focus ring disappearing in Safari',
    workspace_id: WS_ID,
    project_id: PROJECT_IDS.frontend,
  },
  {
    id: 'act-0001-0000-0000-000000000004',
    type: 'issue_activity',
    created_at: T(3),
    description: 'commented on FE-5',
    verb: 'updated',
    field: 'comment',
    issue_id: 'iss-fe-000000000005',
    issue_name: 'Update i18n strings for new settings UI',
    workspace_id: WS_ID,
    project_id: PROJECT_IDS.frontend,
  },
  {
    id: 'act-0001-0000-0000-000000000005',
    type: 'issue_activity',
    created_at: T(5),
    description: 'created MOB-1 · Push notifications not delivered on iOS 17.5',
    verb: 'created',
    issue_id: 'iss-mob-00000000001',
    issue_name: 'Push notifications not delivered on iOS 17.5',
    workspace_id: WS_ID,
    project_id: PROJECT_IDS.mobile,
  },
];

// ---------------------------------------------------------------------------
// Scoped helper functions
// ---------------------------------------------------------------------------

/** All issues scoped to a single project */
export function mockIssuesForProject(projectId: string): IssueApiResponse[] {
  return MOCK_ISSUES.filter((issue) => issue.project_id === projectId);
}

/** States scoped to a single project */
export function mockStatesForProject(projectId: string): StateApiResponse[] {
  return MOCK_ALL_STATES.filter((state) => state.project_id === projectId);
}

/** Cycles scoped to a single project */
export function mockCyclesForProject(projectId: string): CycleApiResponse[] {
  return MOCK_CYCLES.filter((cycle) => cycle.project_id === projectId);
}

/** Modules scoped to a single project */
export function mockModulesForProject(projectId: string): ModuleApiResponse[] {
  return MOCK_MODULES.filter((module) => module.project_id === projectId);
}

/** Views scoped to a single project (or workspace-level views) */
export function mockViewsForProject(
  projectId: string,
  includeWorkspaceLevel = true,
): IssueViewApiResponse[] {
  return MOCK_VIEWS.filter(
    (view) =>
      view.project_id === projectId || (includeWorkspaceLevel && view.project_id === null),
  );
}

/** Pages (non-archived by default) */
export function mockPagesForProject(_projectId: string, archived = false): PageApiResponse[] {
  return MOCK_PAGES.filter((page) =>
    archived ? page.archived_at !== null : page.archived_at === null,
  );
}

// ---------------------------------------------------------------------------
// Single consolidated export (the "MOCK" bag)
// ---------------------------------------------------------------------------

export const MOCK = {
  workspace: MOCK_WORKSPACE,
  members: MOCK_MEMBERS,
  currentUser: MOCK_CURRENT_USER,
  projects: MOCK_PROJECTS,
  states: MOCK_ALL_STATES,
  labels: MOCK_LABELS,
  issues: MOCK_ISSUES,
  cycles: MOCK_CYCLES,
  modules: MOCK_MODULES,
  views: MOCK_VIEWS,
  pages: MOCK_PAGES,
  notifications: MOCK_NOTIFICATIONS,
  quickLinks: MOCK_QUICK_LINKS,
  stickies: MOCK_STICKIES,
  recents: MOCK_RECENTS,
  intakeItems: MOCK_INTAKE_ITEMS,
  userActivity: MOCK_USER_ACTIVITY,

  issuesForProject: mockIssuesForProject,
  statesForProject: mockStatesForProject,
  cyclesForProject: mockCyclesForProject,
  modulesForProject: mockModulesForProject,
  viewsForProject: mockViewsForProject,
  pagesForProject: mockPagesForProject,

  /** Stable IDs for use in tests or stories without magic strings */
  ids: {
    workspace: WS_ID,
    workspaceSlug: WS_SLUG,
    members: MEMBER_IDS,
    projects: PROJECT_IDS,
    states: STATE_IDS,
    labels: LABEL_IDS,
    cycles: CYCLE_IDS,
    modules: MODULE_IDS,
  },
} as const;
