import { useTranslation } from 'react-i18next';
import { Button } from '../../ui';
import { dispatchOpenHomeWidgets } from '../../../lib/homeWidgetsEvents';
import { IconHome, IconGrid, IconGitHub } from './icons';

export function HomeHeader() {
  const { t } = useTranslation();
  return (
    <>
      <div className="flex items-center gap-2 text-sm font-medium text-(--txt-secondary)">
        <span className="flex size-5 items-center justify-center text-(--txt-icon-tertiary)">
          <IconHome />
        </span>
        {t('header.home', 'Home')}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-[13px] font-medium text-(--txt-secondary)"
          onClick={() => dispatchOpenHomeWidgets()}
        >
          <IconGrid />
          {t('header.manageWidgets', 'Manage widgets')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-[13px] font-medium text-(--txt-secondary)"
          onClick={() =>
            window.open('https://github.com/Devlaner/devlane', '_blank', 'noopener,noreferrer')
          }
        >
          <IconGitHub />
          {t('header.starOnGitHub', 'Star us on GitHub')}
        </Button>
      </div>
    </>
  );
}
