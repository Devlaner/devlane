/* eslint-disable react-refresh/only-export-components -- Shared constants and icon maps for filter UI */
import type { ReactNode } from 'react';
import type { Priority, StateGroup, DatePreset } from '../../types/workspaceViewFilters';

const IconChevronUp = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="m18 15-6-6-6 6" />
  </svg>
);
const IconChevronDown = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);
const IconSearch = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);
const IconProject = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);
const IconFilter = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);
const IconUrgent = () => (
  <span className="flex size-4 items-center justify-center text-[10px] text-red-500">!</span>
);
const IconHigh = () => (
  <span className="inline-flex size-4 items-end justify-center gap-px text-amber-500">
    <span className="h-2.5 w-0.5 rounded-sm bg-current" />
    <span className="h-3.5 w-0.5 rounded-sm bg-current" />
  </span>
);
const IconMedium = () => (
  <span className="inline-flex size-4 items-end justify-center gap-px text-yellow-500">
    <span className="h-2 w-0.5 rounded-sm bg-current" />
    <span className="h-2.5 w-0.5 rounded-sm bg-current" />
  </span>
);
const IconLow = () => (
  <span className="inline-flex size-4 items-end justify-center gap-px text-blue-500">
    <span className="h-1.5 w-0.5 rounded-sm bg-current" />
    <span className="h-2 w-0.5 rounded-sm bg-current" />
  </span>
);
const IconNone = () => (
  <span className="flex size-4 items-center justify-center text-[10px] text-(--txt-icon-tertiary)">
    —
  </span>
);
const IconBacklog = () => (
  <span className="flex size-4 items-center justify-center rounded-full border border-(--border-subtle)" />
);
const IconUnstarted = () => (
  <span className="flex size-4 items-center justify-center rounded-full border-2 border-(--border-subtle)" />
);
const IconStarted = () => (
  <span className="flex size-4 items-center justify-center rounded-full border-2 border-amber-500 bg-amber-500/20" />
);
const IconCompleted = () => (
  <span className="flex size-4 items-center justify-center rounded-full bg-green-500 text-white text-[10px]">
    ✓
  </span>
);
const IconCanceled = () => (
  <span className="flex size-4 items-center justify-center rounded-full border border-(--border-subtle) text-[10px] text-(--txt-icon-tertiary)">
    ✕
  </span>
);

export const FILTER_ICONS = {
  search: IconSearch,
  project: IconProject,
  filter: IconFilter,
  chevronUp: IconChevronUp,
  chevronDown: IconChevronDown,
};

export const PRIORITY_ICONS: Record<Priority, ReactNode> = {
  urgent: <IconUrgent />,
  high: <IconHigh />,
  medium: <IconMedium />,
  low: <IconLow />,
  none: <IconNone />,
};

export const STATE_GROUP_ICONS: Record<StateGroup, ReactNode> = {
  backlog: <IconBacklog />,
  unstarted: <IconUnstarted />,
  started: <IconStarted />,
  completed: <IconCompleted />,
  canceled: <IconCanceled />,
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  none: 'None',
};

export const STATE_GROUP_LABELS: Record<StateGroup, string> = {
  backlog: 'Backlog',
  unstarted: 'Unstarted',
  started: 'Started',
  completed: 'Completed',
  canceled: 'Canceled',
};

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  '1_week': '1 week from now',
  '2_weeks': '2 weeks from now',
  '1_month': '1 month from now',
  '2_months': '2 months from now',
  custom: 'Custom',
};
