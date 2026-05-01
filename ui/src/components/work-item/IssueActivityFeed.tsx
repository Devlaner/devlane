import { useMemo } from 'react';
import {
  CheckCircle2,
  Calendar,
  Flag,
  Pencil,
  PlusCircle,
  Tag,
  UserPlus,
  UserMinus,
  Link as LinkIcon,
} from 'lucide-react';
import { Avatar } from '../ui';
import { getImageUrl } from '../../lib/utils';
import type {
  IssueActivityApiResponse,
  LabelApiResponse,
  StateApiResponse,
  WorkspaceMemberApiResponse,
} from '../../api/types';

interface IssueActivityFeedProps {
  activities: IssueActivityApiResponse[];
  members: WorkspaceMemberApiResponse[];
  states: StateApiResponse[];
  labels: LabelApiResponse[];
}

/**
 * Renders one row per IssueActivity. Each row is "icon + actor avatar + sentence + relative time".
 * Mirrors Plane's per-field activity component dispatch but kept in a single
 * function for compactness — extend the switch below to add new field types.
 */
export function IssueActivityFeed({ activities, members, states, labels }: IssueActivityFeedProps) {
  const stateById = useMemo(() => new Map(states.map((s) => [s.id, s])), [states]);
  const labelById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.member_id, m])), [members]);

  if (activities.length === 0) return null;

  return (
    <ul className="space-y-2.5">
      {activities.map((a) => {
        const actor = a.actor_id ? memberById.get(a.actor_id) : null;
        const actorName = memberLabel(actor);
        const { icon, sentence } = renderActivity(a, stateById, labelById, memberById);
        if (!sentence) return null;
        return (
          <li key={a.id} className="flex items-center gap-2 text-xs text-(--txt-secondary)">
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-(--txt-icon-tertiary)">
              {icon}
            </span>
            <Avatar
              name={actorName}
              src={getImageUrl(actor?.member_avatar) ?? undefined}
              size="sm"
              className="h-5 w-5 shrink-0 text-[9px]"
            />
            <span className="min-w-0 truncate">
              <span className="font-medium text-(--txt-primary)">{actorName}</span> {sentence}
            </span>
            <span
              className="ml-auto shrink-0 text-[11px] text-(--txt-tertiary)"
              title={new Date(a.created_at).toLocaleString()}
            >
              {formatRelative(a.created_at)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Per-field rendering — returns the icon + the descriptive sentence body.
// ---------------------------------------------------------------------------

function renderActivity(
  a: IssueActivityApiResponse,
  stateById: Map<string, StateApiResponse>,
  labelById: Map<string, LabelApiResponse>,
  memberById: Map<string, WorkspaceMemberApiResponse>,
): { icon: React.ReactNode; sentence: React.ReactNode | null } {
  if (a.verb === 'created') {
    return { icon: <PlusCircle className="h-3.5 w-3.5" />, sentence: <>created this work item</> };
  }
  switch (a.field ?? '') {
    case 'name':
      return {
        icon: <Pencil className="h-3.5 w-3.5" />,
        sentence: (
          <>
            renamed the work item to{' '}
            <strong className="text-(--txt-primary)">{a.new_value || '—'}</strong>
          </>
        ),
      };
    case 'state':
      return {
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        sentence: (
          <>
            changed state from <StateRef id={a.old_value} stateById={stateById} /> to{' '}
            <StateRef id={a.new_value} stateById={stateById} />
          </>
        ),
      };
    case 'priority':
      return {
        icon: <Flag className="h-3.5 w-3.5" />,
        sentence: (
          <>
            set priority to{' '}
            <span className="capitalize text-(--txt-primary)">{a.new_value || 'none'}</span>
          </>
        ),
      };
    case 'start_date':
      return {
        icon: <Calendar className="h-3.5 w-3.5" />,
        sentence: a.new_value ? (
          <>
            set start date to <span className="text-(--txt-primary)">{a.new_value}</span>
          </>
        ) : (
          <>cleared the start date</>
        ),
      };
    case 'target_date':
      return {
        icon: <Calendar className="h-3.5 w-3.5" />,
        sentence: a.new_value ? (
          <>
            set due date to <span className="text-(--txt-primary)">{a.new_value}</span>
          </>
        ) : (
          <>cleared the due date</>
        ),
      };
    case 'parent':
      return {
        icon: <LinkIcon className="h-3.5 w-3.5" />,
        sentence: a.new_value ? <>set the parent work item</> : <>removed the parent work item</>,
      };
    case 'assignees_added':
      return {
        icon: <UserPlus className="h-3.5 w-3.5" />,
        sentence: (
          <>
            assigned <MemberRef id={a.new_value} memberById={memberById} />
          </>
        ),
      };
    case 'assignees_removed':
      return {
        icon: <UserMinus className="h-3.5 w-3.5" />,
        sentence: (
          <>
            unassigned <MemberRef id={a.old_value} memberById={memberById} />
          </>
        ),
      };
    case 'labels_added':
      return {
        icon: <Tag className="h-3.5 w-3.5" />,
        sentence: (
          <>
            added label <LabelRef id={a.new_value} labelById={labelById} />
          </>
        ),
      };
    case 'labels_removed':
      return {
        icon: <Tag className="h-3.5 w-3.5" />,
        sentence: (
          <>
            removed label <LabelRef id={a.old_value} labelById={labelById} />
          </>
        ),
      };
    default:
      return { icon: <Pencil className="h-3.5 w-3.5" />, sentence: null };
  }
}

function StateRef({
  id,
  stateById,
}: {
  id?: string | null;
  stateById: Map<string, StateApiResponse>;
}) {
  if (!id) return <span className="text-(--txt-primary)">—</span>;
  const s = stateById.get(id);
  if (!s) return <span className="text-(--txt-primary)">{id.slice(0, 8)}</span>;
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: s.color || 'var(--neutral-500)' }}
        aria-hidden
      />
      <span className="text-(--txt-primary)">{s.name}</span>
    </span>
  );
}

function LabelRef({
  id,
  labelById,
}: {
  id?: string | null;
  labelById: Map<string, LabelApiResponse>;
}) {
  if (!id) return <span className="text-(--txt-primary)">—</span>;
  const l = labelById.get(id);
  if (!l) return <span className="text-(--txt-primary)">{id.slice(0, 8)}</span>;
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: l.color || 'var(--neutral-500)' }}
        aria-hidden
      />
      <span className="text-(--txt-primary)">{l.name}</span>
    </span>
  );
}

function MemberRef({
  id,
  memberById,
}: {
  id?: string | null;
  memberById: Map<string, WorkspaceMemberApiResponse>;
}) {
  if (!id) return <span className="text-(--txt-primary)">someone</span>;
  const m = memberById.get(id);
  return <span className="text-(--txt-primary)">@{memberLabel(m)}</span>;
}

function memberLabel(m: WorkspaceMemberApiResponse | null | undefined): string {
  if (!m) return 'someone';
  const display = m.member_display_name?.trim();
  if (display) return display;
  const email = m.member_email?.split('@')[0]?.trim();
  if (email) return email;
  return 'someone';
}

function formatRelative(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const now = Date.now();
  const seconds = Math.max(0, Math.floor((now - t) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}
