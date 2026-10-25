import { Trans, useTranslation } from 'react-i18next';
import type { NotificationApiResponse } from '../../api/types';

interface Props {
  notification: NotificationApiResponse;
}

/**
 * Renders the prose body of a single notification using its server-built
 * `message` payload. The list page uses {@link NotificationContent} in the
 * detail pane; row summaries fall back to `notification.title` (also server-built)
 * so we never have to interpret message client-side just to draw a row.
 */
export function NotificationContent({ notification }: Props) {
  const { t } = useTranslation();
  const { message, sender, title } = notification;
  // Legacy / `system` rows may have no message, or a partial one without the
  // structured actor/issue fields. In that case fall back to the server-built
  // title — we never have to invent prose client-side.
  if (!message || !message.actor || !message.issue) {
    return <p className="text-sm text-(--txt-primary)">{title}</p>;
  }

  const { actor, issue, before, after, comment_preview, context } = message;
  const issueRef = `${issue.project_identifier}-${issue.sequence_id}`;

  switch (sender) {
    case 'assigned':
      return (
        <p className="text-sm text-(--txt-primary)">
          <Trans
            i18nKey="notifications.assigned"
            defaults="<b>{{actor}}</b> assigned you to <ref>{{issueRef}}</ref> — {{name}}"
            values={{ actor: actor.display_name, issueRef, name: issue.name }}
            components={{ b: <strong />, ref: <span className="font-medium" /> }}
          />
        </p>
      );

    case 'mentioned':
      return (
        <div className="space-y-2 text-sm text-(--txt-primary)">
          <p>
            <Trans
              i18nKey="notifications.mentioned"
              defaults="<b>{{actor}}</b> mentioned you in <ref>{{issueRef}}</ref> — {{name}}"
              values={{ actor: actor.display_name, issueRef, name: issue.name }}
              components={{ b: <strong />, ref: <span className="font-medium" /> }}
            />
            {context ? <span className="text-(--txt-tertiary)"> ({context})</span> : null}
          </p>
          {comment_preview ? (
            <p className="rounded border border-(--border-subtle) bg-(--bg-surface-1) p-3 text-(--txt-secondary)">
              {comment_preview}
            </p>
          ) : null}
        </div>
      );

    case 'commented':
      return (
        <div className="space-y-2 text-sm text-(--txt-primary)">
          <p>
            <Trans
              i18nKey="notifications.commented"
              defaults="<b>{{actor}}</b> commented on <ref>{{issueRef}}</ref> — {{name}}"
              values={{ actor: actor.display_name, issueRef, name: issue.name }}
              components={{ b: <strong />, ref: <span className="font-medium" /> }}
            />
          </p>
          {comment_preview ? (
            <p className="rounded border border-(--border-subtle) bg-(--bg-surface-1) p-3 text-(--txt-secondary)">
              {comment_preview}
            </p>
          ) : null}
        </div>
      );

    case 'state_changed':
      return (
        <p className="text-sm text-(--txt-primary)">
          <Trans
            i18nKey="notifications.stateChanged"
            defaults="<b>{{actor}}</b> moved <ref>{{issueRef}}</ref>"
            values={{ actor: actor.display_name, issueRef }}
            components={{ b: <strong />, ref: <span className="font-medium" /> }}
          />
          {before ? (
            <>
              {' '}
              {t('notifications.stateChangedFrom', 'from')}{' '}
              <span className="text-(--txt-secondary)">{before}</span>
            </>
          ) : null}
          {after ? (
            <>
              {' '}
              {t('notifications.stateChangedTo', 'to')} <span className="font-medium">{after}</span>
            </>
          ) : null}
        </p>
      );

    case 'subscribed':
      return (
        <p className="text-sm text-(--txt-primary)">
          <Trans
            i18nKey="notifications.subscribed"
            defaults="<b>{{actor}}</b> updated <ref>{{issueRef}}</ref>"
            values={{ actor: actor.display_name, issueRef }}
            components={{ b: <strong />, ref: <span className="font-medium" /> }}
          />
          {before && after ? (
            <>
              : {before} → {after}
            </>
          ) : after ? (
            <>: {after}</>
          ) : null}
        </p>
      );

    default:
      return <p className="text-sm text-(--txt-primary)">{title}</p>;
  }
}
