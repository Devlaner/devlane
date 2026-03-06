// ---------------------------------------------------------------------------
// Domain types (API-agnostic; used across UI and mock data)
// ---------------------------------------------------------------------------

export type Priority = 'urgent' | 'high' | 'medium' | 'low' | 'none';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  identifier: string;
  description?: string | null;
}

export interface State {
  id: string;
  projectId: string;
  name: string;
  sequence: number;
  color?: string | null;
}

export interface Label {
  id: string;
  projectId: string;
  name: string;
  color: string;
}

export interface Issue {
  id: string;
  projectId: string;
  stateId: string;
  title: string;
  description?: string | null;
  priority: Priority;
  assigneeId?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  sequence?: number;
  labelIds?: string[];
  cycleId?: string | null;
  moduleId?: string | null;
}

export interface Cycle {
  id: string;
  projectId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'current' | 'upcoming' | 'completed';
}

export interface Module {
  id: string;
  projectId: string;
  name: string;
  status: 'planned' | 'in-progress' | 'completed';
}

export interface Sticky {
  id: string;
  title: string;
  content?: string;
  color: string; // CSS color or Tailwind class for background
  createdAt: string;
  updatedAt: string;
}
