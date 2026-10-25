import { useTranslation } from 'react-i18next';
import { IconInbox, IconCheck, IconArchive, IconFilter, IconMoreVertical } from './icons';

export function InboxHeader() {
  const { t } = useTranslation();
  return (
    <>
      <div className="flex items-center gap-2 text-sm font-medium text-(--txt-secondary)">
        <span className="flex size-5 items-center justify-center text-(--txt-icon-tertiary)">
          <IconInbox />
        </span>
        {t('header.inbox.title', 'Inbox')}
      </div>
      <div className="flex items-center gap-1">
        {/* Not implemented yet — disabled rather than rendered as inert-but-clickable. */}
        <button
          type="button"
          disabled
          className="flex size-8 items-center justify-center rounded-md text-(--txt-icon-tertiary) opacity-40 cursor-not-allowed"
          aria-label={t('header.inbox.markAsRead', 'Mark as read')}
          title={t('common.comingSoon', 'Coming soon')}
        >
          <IconCheck />
        </button>
        <button
          type="button"
          disabled
          className="flex size-8 items-center justify-center rounded-md text-(--txt-icon-tertiary) opacity-40 cursor-not-allowed"
          aria-label={t('common.archive', 'Archive')}
          title={t('common.comingSoon', 'Coming soon')}
        >
          <IconArchive />
        </button>
        <button
          type="button"
          disabled
          className="flex size-8 items-center justify-center rounded-md text-(--txt-icon-tertiary) opacity-40 cursor-not-allowed"
          aria-label={t('header.filters', 'Filters')}
          title={t('common.comingSoon', 'Coming soon')}
        >
          <IconFilter />
        </button>
        <button
          type="button"
          disabled
          className="flex size-8 items-center justify-center rounded-md text-(--txt-icon-tertiary) opacity-40 cursor-not-allowed"
          aria-label={t('common.moreOptions', 'More options')}
          title={t('common.comingSoon', 'Coming soon')}
        >
          <IconMoreVertical />
        </button>
      </div>
    </>
  );
}
