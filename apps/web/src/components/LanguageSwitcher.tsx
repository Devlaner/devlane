import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, setLanguage, type LanguageCode } from '../i18n';
import { cn } from '../lib/utils';

interface LanguageSwitcherProps {
  className?: string;
}

/**
 * Compact UI-language selector (issue #32). Persists the choice to localStorage
 * via setLanguage so it survives reloads and applies app-wide immediately.
 */
export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation('common');
  const current = i18n.resolvedLanguage ?? i18n.language;

  return (
    <label className={cn('inline-flex items-center gap-2 text-sm', className)}>
      <span className="text-(--txt-tertiary)">{t('language')}</span>
      <select
        aria-label={t('language')}
        value={current}
        onChange={(e) => setLanguage(e.target.value as LanguageCode)}
        className="rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-2 py-1 text-sm text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
      >
        {SUPPORTED_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
