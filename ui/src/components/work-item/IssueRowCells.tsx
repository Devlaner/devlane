import { useMemo } from 'react';
import { AlertTriangle, Calendar, Minus, SignalHigh, SignalLow, SignalMedium } from 'lucide-react';
import { Avatar } from '../ui';
import { cn, getImageUrl } from '../../lib/utils';
import type { IssueApiResponse, LabelApiResponse, StateApiResponse } from '../../api/types';
import type { Priority } from '../../types';
import type { MemberLite } from '../../lib/issueRowHelpers';

export type { MemberLite };

// ---------------------------------------------------------------------------
// State pill — color dot + name. Color comes from the state's stored color
// (hex or CSS var). We dim the background to a 12% wash so the pill fits on
// any theme without clashing with the row hover.
// ---------------------------------------------------------------------------

interface StatePillProps {
  state?: StateApiResponse | null;
  size?: 'sm' | 'md';
}

export function StatePill({ state, size = 'sm' }: StatePillProps) {
  if (!state) {
    return (
      <span className="inline-flex h-5 items-center gap-1.5 rounded-(--radius-md) border border-(--border-subtle) px-1.5 text-[11px] text-(--txt-tertiary)">
        <span className="h-2 w-2 rounded-full bg-(--neutral-400)" />
        No state
      </span>
    );
  }
  const color = normalizeHex(state.color) || '#6b7280';
  const wash = withAlpha(color, 0.12);
  const padding = size === 'md' ? 'px-2' : 'px-1.5';
  const height = size === 'md' ? 'h-6' : 'h-5';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-(--radius-md) border text-[11px] font-medium',
        height,
        padding,
      )}
      style={{ borderColor: withAlpha(color, 0.4), backgroundColor: wash, color }}
      title={`${state.name}${state.group ? ` · ${state.group}` : ''}`}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="truncate">{state.name}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Priority icon — 5 levels with distinct icons. Linear-style: the icon itself
// carries the meaning; color reinforces it.
// ---------------------------------------------------------------------------

const PRIORITY_META: Record<
  Priority,
  { icon: React.ReactNode; color: string; label: string; bg: string }
> = {
  urgent: {
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    color: '#dc2626',
    label: 'Urgent',
    bg: 'rgba(220,38,38,0.12)',
  },
  high: {
    icon: <SignalHigh className="h-3.5 w-3.5" />,
    color: '#ea580c',
    label: 'High',
    bg: 'rgba(234,88,12,0.12)',
  },
  medium: {
    icon: <SignalMedium className="h-3.5 w-3.5" />,
    color: '#ca8a04',
    label: 'Medium',
    bg: 'rgba(202,138,4,0.12)',
  },
  low: {
    icon: <SignalLow className="h-3.5 w-3.5" />,
    color: '#2563eb',
    label: 'Low',
    bg: 'rgba(37,99,235,0.12)',
  },
  none: {
    icon: <Minus className="h-3.5 w-3.5" />,
    color: '#6b7280',
    label: 'No priority',
    bg: 'transparent',
  },
};

interface PriorityIconProps {
  priority?: Priority | string | null;
  /** "icon" = just the symbol; "pill" = symbol with background. */
  variant?: 'icon' | 'pill';
}

export function PriorityIcon({ priority, variant = 'pill' }: PriorityIconProps) {
  const key = (priority ?? 'none') as Priority;
  const meta = PRIORITY_META[key] ?? PRIORITY_META.none;
  if (variant === 'icon') {
    return (
      <span
        className="inline-flex h-5 w-5 items-center justify-center"
        style={{ color: meta.color }}
        title={meta.label}
        aria-label={meta.label}
      >
        {meta.icon}
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-(--radius-md) border"
      style={{
        color: meta.color,
        backgroundColor: meta.bg,
        borderColor: key === 'none' ? 'var(--border-subtle)' : withAlpha(meta.color, 0.3),
      }}
      title={meta.label}
      aria-label={meta.label}
    >
      {meta.icon}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Avatar group — overlapping stack with a +N overflow chip.
// ---------------------------------------------------------------------------

interface AvatarGroupProps {
  members: MemberLite[];
  max?: number;
}

export function WorkItemAvatarGroup({ members, max = 3 }: AvatarGroupProps) {
  if (members.length === 0) {
    return (
      <span
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-(--border-subtle) text-[10px] text-(--txt-icon-tertiary)"
        title="Unassigned"
        aria-label="Unassigned"
      >
        <UserDashedIcon />
      </span>
    );
  }
  const visible = members.slice(0, max);
  const overflow = members.length - visible.length;
  return (
    <span
      className="inline-flex shrink-0 items-center"
      title={members.map((m) => m.name).join(', ')}
    >
      {visible.map((m, i) => (
        <Avatar
          key={m.id}
          name={m.name}
          src={getImageUrl(m.avatarUrl) ?? undefined}
          size="sm"
          className={cn('h-6 w-6 text-[10px] ring-2 ring-(--bg-canvas)', i > 0 && '-ml-1.5')}
        />
      ))}
      {overflow > 0 && (
        <span
          className="-ml-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-(--bg-layer-1) text-[10px] font-medium text-(--txt-secondary) ring-2 ring-(--bg-canvas)"
          aria-label={`${overflow} more`}
        >
          +{overflow}
        </span>
      )}
    </span>
  );
}

const UserDashedIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    aria-hidden
  >
    <circle cx="12" cy="8" r="4" strokeDasharray="3 2" />
    <path d="M4 21a8 8 0 0 1 16 0" strokeDasharray="3 2" />
  </svg>
);

// ---------------------------------------------------------------------------
// Label chips — up to N visible with color dots + names; "+M" pill for overflow.
// ---------------------------------------------------------------------------

interface LabelChipsProps {
  labels: LabelApiResponse[];
  max?: number;
}

export function LabelChips({ labels, max = 2 }: LabelChipsProps) {
  if (labels.length === 0) {
    return null;
  }
  const visible = labels.slice(0, max);
  const overflow = labels.length - visible.length;
  return (
    <span className="inline-flex items-center gap-1">
      {visible.map((l) => (
        <span
          key={l.id}
          className="inline-flex h-5 max-w-[7rem] items-center gap-1 truncate rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-1.5 text-[11px] text-(--txt-secondary)"
          title={l.name}
        >
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: normalizeHex(l.color) || 'var(--neutral-500)' }}
            aria-hidden
          />
          <span className="truncate">{l.name}</span>
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="inline-flex h-5 items-center rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-layer-1) px-1.5 text-[11px] text-(--txt-tertiary)"
          title={labels
            .slice(max)
            .map((l) => l.name)
            .join(', ')}
        >
          +{overflow}
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Due-date cell — date next to icon, red when overdue (target < today and the
// issue isn't already in a completed/cancelled state).
// ---------------------------------------------------------------------------

interface DueDateCellProps {
  issue: Pick<IssueApiResponse, 'target_date' | 'state_id'>;
  state?: StateApiResponse | null;
  /**
   * Reference timestamp used to decide overdue. Hoisted to a prop so this
   * component is pure (the parent computes it once per render with `useNow()`).
   */
  now: number;
}

export function DueDateCell({ issue, state, now }: DueDateCellProps) {
  const overdue = useMemo(() => {
    if (!issue.target_date) return false;
    const t = Date.parse(issue.target_date);
    if (Number.isNaN(t)) return false;
    const stateGroup = state?.group ?? '';
    if (stateGroup === 'completed' || stateGroup === 'cancelled') return false;
    return t < now - 24 * 3600 * 1000;
  }, [issue.target_date, state?.group, now]);

  if (!issue.target_date) {
    return (
      <span
        className="inline-flex h-5 items-center gap-1 text-[11px] text-(--txt-tertiary)"
        title="No due date"
      >
        <Calendar className="h-3 w-3" />
        <span>—</span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1 text-[11px]',
        overdue ? 'text-(--txt-danger-primary)' : 'text-(--txt-secondary)',
      )}
      title={overdue ? `Overdue · ${issue.target_date}` : `Due ${issue.target_date}`}
    >
      <Calendar className="h-3 w-3" />
      <span>{formatShort(issue.target_date, now)}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Helpers (private)
// ---------------------------------------------------------------------------

function formatShort(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const d = new Date(t);
  // "Mar 5" — local short format, no year unless distant.
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

function normalizeHex(input?: string | null): string {
  if (!input) return '';
  const s = input.trim();
  if (s.startsWith('#') && (s.length === 4 || s.length === 7)) return s;
  if (/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(s)) return `#${s}`;
  return s; // fall through (CSS var, rgba, etc.)
}

function withAlpha(input: string, a: number): string {
  // Accepts only #rrggbb / #rgb hex; otherwise return input untouched.
  const s = input.trim();
  if (!s.startsWith('#')) return s;
  const hex = s.length === 4 ? expandShortHex(s) : s;
  if (hex.length !== 7) return s;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function expandShortHex(s: string): string {
  return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
}
