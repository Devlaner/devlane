import type { AgentAutonomyLevel } from '../../api/types';

export const AUTONOMY_OPTIONS: Array<{
  value: AgentAutonomyLevel;
  label: string;
  description: string;
}> = [
  {
    value: 'suggest',
    label: 'Suggest only',
    description: 'Propose actions without changing data.',
  },
  { value: 'comment', label: 'Comment', description: 'Read work and post comments.' },
  {
    value: 'modify_issue',
    label: 'Modify work items',
    description: 'Update fields and create child work.',
  },
  {
    value: 'github_draft',
    label: 'Draft pull requests',
    description: 'Create branches and draft pull requests.',
  },
  {
    value: 'github_reviewed',
    label: 'Reviewed GitHub changes',
    description: 'Continue GitHub work after human approval.',
  },
];

export const TOOL_OPTIONS = [
  { value: 'issue.read', label: 'Read work items' },
  { value: 'issue.comment', label: 'Post comments' },
  { value: 'issue.update', label: 'Update work items' },
  { value: 'issue.create_child', label: 'Create child work items' },
  { value: 'project.read', label: 'Read project context' },
  { value: 'github.read', label: 'Read GitHub' },
  { value: 'github.comment', label: 'Comment on GitHub' },
  { value: 'github.draft_pr', label: 'Create draft pull requests' },
] as const;

export function autonomyLabel(level: AgentAutonomyLevel): string {
  return AUTONOMY_OPTIONS.find((option) => option.value === level)?.label ?? level;
}

export function toolLabel(tool: string): string {
  return TOOL_OPTIONS.find((option) => option.value === tool)?.label ?? tool;
}
