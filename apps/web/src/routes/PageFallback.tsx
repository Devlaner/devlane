import { useTranslation } from 'react-i18next';

/** Suspense fallback for the lazily-loaded page components in the route tree. */
export function PageFallback() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center p-8 text-sm text-(--txt-tertiary)">
      {t('common.loading', 'Loading…')}
    </div>
  );
}
