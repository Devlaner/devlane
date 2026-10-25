import { useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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
  Paperclip,
  MessageSquare,
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
 * Dispatches per-field activity rendering in a single function for compactness
 * — extend the switch below to add new field types.
 */
export function IssueActivityFeed({ activities, members, states, labels }: IssueActivityFeedProps) {
  const { t } = useTranslation();
  const stateById = useMemo(() => new Map(states.map((s) => [s.id, s])), [states]);
  const labelById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.member_id, m])), [members]);

  if (activities.length === 0) return null;

  return (
    <ul className="space-y-2.5">
      {activities.map((a) => {
        const actor = a.actor_id ? memberById.get(a.actor_id) : null;
        const actorName = memberLabel(actor, t);
        const { icon, sentence } = renderActivity(a, stateById, labelById, memberById, t);
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
  t: TFunction,
): { icon: React.ReactNode; sentence: React.ReactNode | null } {
  if (a.verb === 'created') {
    return {
      icon: <PlusCircle className="h-3.5 w-3.5" />,
      sentence: <>{t('workItem.activity.created', 'created this work item')}</>,
    };
  }
  switch (a.field ?? '') {
    case 'name':
      return {
        icon: <Pencil className="h-3.5 w-3.5" />,
        sentence: (
          <Trans
            i18nKey="workItem.activity.renamed"
            defaults="renamed the work item to <0>{{value}}</0>"
            values={{ value: a.new_value || '—' }}
            components={[<strong className="text-(--txt-primary)" />]}
          />
        ),
      };
    case 'state':
      return {
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        sentence: (
          <Trans
            i18nKey="workItem.activity.stateChanged"
            defaults="changed state from <0></0> to <1></1>"
            components={[
              <StateRef id={a.old_value} stateById={stateById} />,
              <StateRef id={a.new_value} stateById={stateById} />,
            ]}
          />
        ),
      };
    case 'priority':
      return {
        icon: <Flag className="h-3.5 w-3.5" />,
        sentence: (
          <Trans
            i18nKey="workItem.activity.prioritySet"
            defaults="set priority to <0>{{priority}}</0>"
            values={{ priority: a.new_value || 'none' }}
            components={[<span className="capitalize text-(--txt-primary)" />]}
          />
        ),
      };
    case 'start_date':
      return {
        icon: <Calendar className="h-3.5 w-3.5" />,
        sentence: a.new_value ? (
          <Trans
            i18nKey="workItem.activity.startDateSet"
            defaults="set start date to <0>{{date}}</0>"
            values={{ date: a.new_value }}
            components={[<span className="text-(--txt-primary)" />]}
          />
        ) : (
          <>{t('workItem.activity.startDateCleared', 'cleared the start date')}</>
        ),
      };
    case 'target_date':
      return {
        icon: <Calendar className="h-3.5 w-3.5" />,
        sentence: a.new_value ? (
          <Trans
            i18nKey="workItem.activity.dueDateSet"
            defaults="set due date to <0>{{date}}</0>"
            values={{ date: a.new_value }}
            components={[<span className="text-(--txt-primary)" />]}
          />
        ) : (
          <>{t('workItem.activity.dueDateCleared', 'cleared the due date')}</>
        ),
      };
    case 'parent':
      return {
        icon: <LinkIcon className="h-3.5 w-3.5" />,
        sentence: a.new_value ? (
          <>{t('workItem.activity.parentSet', 'set the parent work item')}</>
        ) : (
          <>{t('workItem.activity.parentRemoved', 'removed the parent work item')}</>
        ),
      };
    case 'assignees_added':
      return {
        icon: <UserPlus className="h-3.5 w-3.5" />,
        sentence: (
          <Trans
            i18nKey="workItem.activity.assigned"
            defaults="assigned <0></0>"
            components={[<MemberRef id={a.new_value} memberById={memberById} />]}
          />
        ),
      };
    case 'assignees_removed':
      return {
        icon: <UserMinus className="h-3.5 w-3.5" />,
        sentence: (
          <Trans
            i18nKey="workItem.activity.unassigned"
            defaults="unassigned <0></0>"
            components={[<MemberRef id={a.old_value} memberById={memberById} />]}
          />
        ),
      };
    case 'labels_added':
      return {
        icon: <Tag className="h-3.5 w-3.5" />,
        sentence: (
          <Trans
            i18nKey="workItem.activity.labelAdded"
            defaults="added label <0></0>"
            components={[<LabelRef id={a.new_value} labelById={labelById} />]}
          />
        ),
      };
    case 'labels_removed':
      return {
        icon: <Tag className="h-3.5 w-3.5" />,
        sentence: (
          <Trans
            i18nKey="workItem.activity.labelRemoved"
            defaults="removed label <0></0>"
            components={[<LabelRef id={a.old_value} labelById={labelById} />]}
          />
        ),
      };
    case 'link_added':
      return {
        icon: <LinkIcon className="h-3.5 w-3.5" />,
        sentence: (
          <>
            {t('workItem.activity.linkAdded', 'added a link')}{' '}
            {a.new_value ? <strong className="text-(--txt-primary)">{a.new_value}</strong> : null}
          </>
        ),
      };
    case 'link_updated':
      return {
        icon: <LinkIcon className="h-3.5 w-3.5" />,
        sentence: (
          <>
            {t('workItem.activity.linkUpdated', 'updated a link')}{' '}
            {a.new_value ? <strong className="text-(--txt-primary)">{a.new_value}</strong> : null}
          </>
        ),
      };
    case 'link_removed':
      return {
        icon: <LinkIcon className="h-3.5 w-3.5" />,
        sentence: (
          <>
            {t('workItem.activity.linkRemoved', 'removed a link')}{' '}
            {a.old_value ? <strong className="text-(--txt-primary)">{a.old_value}</strong> : null}
          </>
        ),
      };
    case 'relation_removed':
      return {
        icon: <LinkIcon className="h-3.5 w-3.5" />,
        sentence: <>{t('workItem.activity.relationRemoved', 'removed a relation')}</>,
      };
    case 'attachment_added':
      return {
        icon: <Paperclip className="h-3.5 w-3.5" />,
        sentence: (
          <>
            {t('workItem.activity.attached', 'attached')}{' '}
            {a.new_value ? (
              <strong className="text-(--txt-primary)">{a.new_value}</strong>
            ) : (
              t('workItem.activity.aFile', 'a file')
            )}
          </>
        ),
      };
    case 'attachment_removed':
      return {
        icon: <Paperclip className="h-3.5 w-3.5" />,
        sentence: (
          <>
            {t('workItem.activity.attachmentRemoved', 'removed attachment')}{' '}
            {a.old_value ? <strong className="text-(--txt-primary)">{a.old_value}</strong> : null}
          </>
        ),
      };
    case 'comment_added':
      return {
        icon: <MessageSquare className="h-3.5 w-3.5" />,
        sentence: <>{t('workItem.activity.commentAdded', 'added a comment')}</>,
      };
    case 'comment_updated':
      return {
        icon: <MessageSquare className="h-3.5 w-3.5" />,
        sentence: <>{t('workItem.activity.commentUpdated', 'edited a comment')}</>,
      };
    case 'comment_removed':
      return {
        icon: <MessageSquare className="h-3.5 w-3.5" />,
        sentence: <>{t('workItem.activity.commentRemoved', 'deleted a comment')}</>,
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
  const { t } = useTranslation();
  if (!id) return <span className="text-(--txt-primary)">{t('common.someone', 'someone')}</span>;
  const m = memberById.get(id);
  return <span className="text-(--txt-primary)">@{memberLabel(m, t)}</span>;
}

function memberLabel(m: WorkspaceMemberApiResponse | null | undefined, t: TFunction): string {
  if (!m) return t('common.someone', 'someone');
  const display = m.member_display_name?.trim();
  if (display) return display;
  const email = m.member_email?.split('@')[0]?.trim();
  if (email) return email;
  return t('common.someone', 'someone');
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
