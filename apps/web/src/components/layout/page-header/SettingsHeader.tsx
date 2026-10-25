import { useTranslation } from 'react-i18next';
import { IconSettings } from './icons';

export function SettingsHeader() {
  const { t } = useTranslation();
  return (
    <>
      <div className="flex items-center gap-2 text-sm font-medium text-(--txt-secondary)">
        <span className="flex size-5 items-center justify-center text-(--txt-icon-tertiary)">
          <IconSettings />
        </span>
        {t('header.settings', 'Settings')}
      </div>
      <div className="flex items-center gap-2" />
    </>
  );
}
