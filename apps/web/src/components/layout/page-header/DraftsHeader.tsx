import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '../../ui';
import { IconPencil } from './icons';

export function DraftsHeader() {
  const { t } = useTranslation();
  return (
    <>
      <div className="flex items-center gap-2 text-sm font-medium text-(--txt-secondary)">
        <span className="flex size-5 items-center justify-center text-(--txt-icon-tertiary)">
          <IconPencil />
        </span>
        {t('header.drafts', 'Drafts')}
      </div>
      <div className="flex items-center gap-2">
        <Link to="?create=1" className="no-underline">
          <Button size="sm" className="gap-1.5 text-[13px] font-medium">
            {t('header.draftWorkItem', 'Draft a work item')}
          </Button>
        </Link>
      </div>
    </>
  );
}
