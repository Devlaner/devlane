import type {
  User,
  Workspace,
  Project,
  State,
  Label,
  Issue,
  Cycle,
  Module,
  Sticky,
} from '../types';

// ---------------------------------------------------------------------------
// Mock users
// ---------------------------------------------------------------------------

export const mockUsers: User[] = [
  {
    id: 'u1',
    email: 'alice@example.com',
    name: 'Alice Smith',
    avatarUrl: null,
  },
  { id: 'u2', email: 'bob@example.com', name: 'Bob Jones', avatarUrl: null },
  { id: 'u3', email: 'carol@example.com', name: 'Carol Lee', avatarUrl: null },
];

// ---------------------------------------------------------------------------
// Mock workspaces
// ---------------------------------------------------------------------------

export const mockWorkspaces: Workspace[] = [
  { id: 'w1', name: 'Acme Corp', slug: 'acme', ownerId: 'u1' },
  { id: 'w2', name: 'Side Project', slug: 'side-project', ownerId: 'u1' },
];

// ---------------------------------------------------------------------------
// Mock projects (under w1)
// ---------------------------------------------------------------------------

export const mockProjects: Project[] = [
  {
    id: 'p1',
    workspaceId: 'w1',
    name: 'Web App',
    identifier: 'WEB',
    description: 'Main web application',
  },
  {
    id: 'p2',
    workspaceId: 'w1',
    name: 'Mobile',
    identifier: 'MOB',
    description: 'Mobile app',
  },
];

// ---------------------------------------------------------------------------
// Mock states (project p1)
// ---------------------------------------------------------------------------

export const mockStates: State[] = [
  { id: 's1', projectId: 'p1', name: 'Backlog', sequence: 0, color: '#94a3b8' },
  { id: 's2', projectId: 'p1', name: 'Todo', sequence: 1, color: '#3b82f6' },
  {
    id: 's3',
    projectId: 'p1',
    name: 'In Progress',
    sequence: 2,
    color: '#f59e0b',
  },
  { id: 's4', projectId: 'p1', name: 'Done', sequence: 3, color: '#22c55e' },
  { id: 's5', projectId: 'p2', name: 'Backlog', sequence: 0, color: '#94a3b8' },
  { id: 's6', projectId: 'p2', name: 'Todo', sequence: 1, color: '#3b82f6' },
  {
    id: 's7',
    projectId: 'p2',
    name: 'In Progress',
    sequence: 2,
    color: '#f59e0b',
  },
  { id: 's8', projectId: 'p2', name: 'Done', sequence: 3, color: '#22c55e' },
];

// ---------------------------------------------------------------------------
// Mock labels (project p1)
// ---------------------------------------------------------------------------

export const mockLabels: Label[] = [
  { id: 'l1', projectId: 'p1', name: 'bug', color: '#ef4444' },
  { id: 'l2', projectId: 'p1', name: 'feature', color: '#22c55e' },
  { id: 'l3', projectId: 'p1', name: 'docs', color: '#6366f1' },
];

// ---------------------------------------------------------------------------
// Mock issues (project p1)
// ---------------------------------------------------------------------------

export const mockIssues: Issue[] = [
  {
    id: 'i1',
    projectId: 'p1',
    stateId: 's2',
    title: 'Implement login page',
    description: 'Add email/password login with validation.',
    priority: 'high',
    assigneeId: 'u1',
    createdBy: 'u1',
    createdAt: '2025-02-01T10:00:00Z',
    updatedAt: '2025-02-10T14:00:00Z',
    sequence: 1,
    labelIds: ['l2'],
    cycleId: 'c1',
  },
  {
    id: 'i2',
    projectId: 'p1',
    stateId: 's3',
    title: 'Fix header overflow on mobile',
    description: 'Header wraps incorrectly on small screens.',
    priority: 'medium',
    assigneeId: 'u2',
    createdBy: 'u1',
    createdAt: '2025-02-05T09:00:00Z',
    updatedAt: '2025-02-11T11:00:00Z',
    sequence: 2,
    labelIds: ['l1'],
  },
  {
    id: 'i3',
    projectId: 'p1',
    stateId: 's1',
    title: 'Write API documentation',
    description: 'Document REST endpoints for frontend team.',
    priority: 'low',
    assigneeId: null,
    createdBy: 'u2',
    createdAt: '2025-02-08T16:00:00Z',
    updatedAt: '2025-02-08T16:00:00Z',
    sequence: 3,
    labelIds: ['l3'],
  },
  {
    id: 'i4',
    projectId: 'p1',
    stateId: 's4',
    title: 'Setup CI pipeline',
    description: 'GitHub Actions for lint, test, build.',
    priority: 'high',
    assigneeId: 'u1',
    createdBy: 'u1',
    createdAt: '2025-01-28T08:00:00Z',
    updatedAt: '2025-02-09T17:00:00Z',
    sequence: 0,
    labelIds: ['l2'],
  },
];

// ---------------------------------------------------------------------------
// Mock cycles (project p1)
// ---------------------------------------------------------------------------

export const mockCycles: Cycle[] = [
  {
    id: 'c1',
    projectId: 'p1',
    name: 'Sprint 1',
    startDate: '2025-02-01',
    endDate: '2025-02-14',
    status: 'current',
  },
  {
    id: 'c2',
    projectId: 'p1',
    name: 'Sprint 2',
    startDate: '2025-02-15',
    endDate: '2025-02-28',
    status: 'upcoming',
  },
];

// ---------------------------------------------------------------------------
// Mock modules (project p1)
// ---------------------------------------------------------------------------

export const mockModules: Module[] = [
  { id: 'm1', projectId: 'p1', name: 'Auth', status: 'in-progress' },
  { id: 'm2', projectId: 'p1', name: 'Dashboard', status: 'planned' },
];

// ---------------------------------------------------------------------------
// Mock project pages (project docs/wiki)
// ---------------------------------------------------------------------------

export interface ProjectPage {
  id: string;
  projectId: string;
  title: string;
  visibility: 'public' | 'private' | 'archived';
  updatedBy: string | null;
  updatedAt: string;
  hasWarning?: boolean;
}

export const mockProjectPages: ProjectPage[] = [
  {
    id: 'pg1',
    projectId: 'p1',
    title: 'Dev Guides',
    visibility: 'public',
    updatedBy: 'u1',
    updatedAt: '2025-02-10T14:00:00Z',
    hasWarning: true,
  },
  {
    id: 'pg2',
    projectId: 'p1',
    title: 'API Reference',
    visibility: 'public',
    updatedBy: 'u2',
    updatedAt: '2025-02-09T10:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Mock home page: quicklinks (recent project/page links)
// ---------------------------------------------------------------------------

export interface MockQuicklink {
  id: string;
  label: string;
  projectId: string;
  lastAccessedAt: string; // ISO
}

export const mockQuicklinks: MockQuicklink[] = [
  {
    id: 'ql1',
    label: 'Web App',
    projectId: 'p1',
    lastAccessedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  },
];

// ---------------------------------------------------------------------------
// Mock stickies (home page)
// ---------------------------------------------------------------------------

export const mockStickies: Sticky[] = [
  {
    id: 's1',
    title: 'dfgsdfgdsgdsfgdfsgdsgfdgd',
    color: '#fef3c7',
    createdAt: '2025-02-10T10:00:00Z',
    updatedAt: '2025-02-10T10:00:00Z',
  },
  {
    id: 's2',
    title: 'dsfgsdfgdsfg',
    color: '#d1fae5',
    createdAt: '2025-02-10T11:00:00Z',
    updatedAt: '2025-02-10T11:00:00Z',
  },
  {
    id: 's3',
    title: 'sdfgdsfgdsfgdsf',
    color: '#dbeafe',
    createdAt: '2025-02-10T12:00:00Z',
    updatedAt: '2025-02-10T12:00:00Z',
  },
  {
    id: 's4',
    title: 'dsfgsdfg',
    content: 'dfsgsdfgdsf',
    color: '#d1fae5',
    createdAt: '2025-02-10T13:00:00Z',
    updatedAt: '2025-02-10T13:00:00Z',
  },
  {
    id: 's5',
    title: 'dsgdfsgd',
    content: 'gsdfgsdfgdsf',
    color: '#fce7f3',
    createdAt: '2025-02-10T14:00:00Z',
    updatedAt: '2025-02-10T14:00:00Z',
  },
  {
    id: 's6',
    title: 'Hello what is this',
    content: 'gsdfgsdfg',
    color: '#ffffff',
    createdAt: '2025-02-10T15:00:00Z',
    updatedAt: '2025-02-10T15:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Mock workspace members (settings)
// ---------------------------------------------------------------------------

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  fullName: string;
  displayName: string;
  email: string;
  role: 'admin' | 'member';
  authMethod: 'magic-code' | 'email';
  joinedAt: string; // ISO
}

export const mockWorkspaceMembers: WorkspaceMember[] = [
  {
    id: 'wm1',
    workspaceId: 'w1',
    userId: 'u1',
    fullName: 'Alice Smith',
    displayName: 'alice',
    email: 'alice@example.com',
    role: 'admin',
    authMethod: 'magic-code',
    joinedAt: '2026-02-09T10:00:00Z',
  },
  {
    id: 'wm2',
    workspaceId: 'w1',
    userId: 'u2',
    fullName: 'Bob Jones',
    displayName: 'bob',
    email: 'bob@example.com',
    role: 'admin',
    authMethod: 'email',
    joinedAt: '2026-02-09T11:00:00Z',
  },
  {
    id: 'wm3',
    workspaceId: 'w1',
    userId: 'u3',
    fullName: 'Carol Lee',
    displayName: 'carol',
    email: 'carol@example.com',
    role: 'member',
    authMethod: 'magic-code',
    joinedAt: '2026-02-10T09:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Mock project members (settings > projects > members)
// ---------------------------------------------------------------------------

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  fullName: string;
  displayName: string;
  role: 'admin' | 'member';
  joinedAt: string; // ISO
}

export const mockProjectMembers: ProjectMember[] = [
  {
    id: 'pm1',
    projectId: 'p1',
    userId: 'u1',
    fullName: 'Alice Smith',
    displayName: 'alice',
    role: 'admin',
    joinedAt: '2026-02-09T10:00:00Z',
  },
  {
    id: 'pm2',
    projectId: 'p1',
    userId: 'u2',
    fullName: 'Bob Jones',
    displayName: 'bob',
    role: 'member',
    joinedAt: '2026-02-10T09:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Mock workspace pending invites (settings > workspace > members)
// ---------------------------------------------------------------------------

export interface WorkspacePendingInvite {
  id: string;
  workspaceId: string;
  email: string;
  role: 'admin' | 'member';
  status: 'pending';
  invitedAt: string; // ISO
}

export const mockWorkspacePendingInvites: WorkspacePendingInvite[] = [
  {
    id: 'wpi1',
    workspaceId: 'w1',
    email: 'boraleyli@gmail.com',
    role: 'member',
    status: 'pending',
    invitedAt: '2025-02-10T12:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Mock account activity (settings > account > activity)
// ---------------------------------------------------------------------------

export interface AccountActivityItem {
  id: string;
  userId: string;
  type: 'comment' | 'label' | 'cycle' | 'assignee' | 'created';
  description: string;
  createdAt: string; // ISO
}

export const mockAccountActivity: AccountActivityItem[] = [
  {
    id: 'a1',
    userId: 'u1',
    type: 'comment',
    description: 'Commented about 2 hours ago',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'a2',
    userId: 'u1',
    type: 'label',
    description: 'You added a new label Improvement to WEB-1 Implement login about 2 hours ago.',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'a3',
    userId: 'u1',
    type: 'cycle',
    description: 'You added WEB-1 Implement login to the cycle Sprint 1 about 2 hours ago.',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'a4',
    userId: 'u1',
    type: 'assignee',
    description: 'You added a new assignee alice to WEB-1 Implement login 3 days ago.',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'a5',
    userId: 'u1',
    type: 'created',
    description: 'You created WEB-1 Implement login 3 days ago.',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// ---------------------------------------------------------------------------
// Mock inbox items (notifications / Inbox page)
// ---------------------------------------------------------------------------

export type InboxItemType = 'comment' | 'mention';

export interface InboxItem {
  id: string;
  type: InboxItemType;
  workspaceId: string;
  projectId: string;
  issueId: string;
  actorUserId: string;
  /** Short snippet, e.g. "have a look." */
  body: string;
  createdAt: string; // ISO
}

export const mockInboxItems: InboxItem[] = [
  {
    id: 'in1',
    type: 'comment',
    workspaceId: 'w1',
    projectId: 'p1',
    issueId: 'i1',
    actorUserId: 'u2',
    body: 'have a look.',
    createdAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
  },
  {
    id: 'in2',
    type: 'mention',
    workspaceId: 'w1',
    projectId: 'p1',
    issueId: 'i2',
    actorUserId: 'u1',
    body: 'Can you review the header fix?',
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    id: 'in3',
    type: 'comment',
    workspaceId: 'w1',
    projectId: 'p1',
    issueId: 'i3',
    actorUserId: 'u3',
    body: 'I added the API overview section.',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'in4',
    type: 'comment',
    workspaceId: 'w1',
    projectId: 'p1',
    issueId: 'i1',
    actorUserId: 'u1',
    body: 'Login flow is ready for QA.',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
];

// ---------------------------------------------------------------------------
// Mock personal access tokens (settings > account > tokens)
// ---------------------------------------------------------------------------

export interface PersonalAccessToken {
  id: string;
  name: string;
  status: 'active' | 'expired';
  expiresAt: string | null; // ISO or null for no expiry
}

export const mockPersonalAccessTokens: PersonalAccessToken[] = [
  { id: 'pat1', name: 'ertert', status: 'active', expiresAt: null },
  {
    id: 'pat2',
    name: 'erterte',
    status: 'active',
    expiresAt: '2026-02-19T21:23:00Z',
  },
];

// ---------------------------------------------------------------------------
// Your Work page: recent activity feed (rich entries for dashboard)
// ---------------------------------------------------------------------------

export type YourWorkActivityType = 'label' | 'cycle' | 'assignee' | 'created' | 'state';

export interface YourWorkActivityItem {
  id: string;
  userId: string;
  type: YourWorkActivityType;
  projectId: string;
  issueId: string;
  /** e.g. "Improvement" */
  labelName?: string;
  /** e.g. "First Cycle" */
  cycleName?: string;
  /** e.g. "Fuadelizade6" */
  assigneeName?: string;
  /** e.g. "Todo" */
  stateName?: string;
  createdAt: string; // ISO
}

export const mockYourWorkActivity: YourWorkActivityItem[] = [
  {
    id: 'yw1',
    userId: 'u1',
    type: 'label',
    projectId: 'p1',
    issueId: 'i1',
    labelName: 'Improvement',
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'yw2',
    userId: 'u1',
    type: 'cycle',
    projectId: 'p1',
    issueId: 'i1',
    cycleName: 'First Cycle',
    createdAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'yw3',
    userId: 'u1',
    type: 'assignee',
    projectId: 'p1',
    issueId: 'i1',
    assigneeName: 'Fuadelizade6',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'yw4',
    userId: 'u1',
    type: 'created',
    projectId: 'p1',
    issueId: 'i1',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// Project progress for Your Work sidebar (percentage 0–100)
export interface ProjectProgress {
  projectId: string;
  progressPercent: number;
}

export const mockProjectProgress: ProjectProgress[] = [
  { projectId: 'p1', progressPercent: 0 },
  { projectId: 'p2', progressPercent: 25 },
];
