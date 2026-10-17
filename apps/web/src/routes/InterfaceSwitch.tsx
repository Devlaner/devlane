import { useTranslation } from 'react-i18next';
import { useInterfaceVersion, type InterfaceVersion } from '../v2/contexts/InterfaceContext';

/**
 * The one piece of v2 that reaches into the v1 interface: the control that
 * switches between them. It lives here, in the routes seam, rather than in
 * `pages/SettingsPage.tsx`, so the v1 page holds a single import and no v2
 * knowledge — and so the v1 lint boundary against `src/v2` stays intact.
 *
 * Styled with Devlane's own tokens, not shadcn: it renders inside v1 chrome.
 * Switching only writes the preference — both interfaces answer to the same
 * URLs, so the page re-renders in place with no navigation.
 */
export function InterfaceSwitch() {
  const { t } = useTranslation();
  const { interfaceVersion, setInterfaceVersion } = useInterfaceVersion();

  return (
    <div>
      <label className="block text-sm font-medium text-(--txt-primary)">
        {t('settings.preferences.interfaceVersion.title', 'Interface')}
      </label>
      <p className="mt-0.5 text-sm text-(--txt-secondary)">
        {t(
          'settings.preferences.interfaceVersion.help',
          'Choose which Devlane interface you want to use. Some admin-only pages still open in the classic interface either way.',
        )}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            ['v1', t('settings.preferences.interfaceVersion.v1', 'Classic')],
            ['v2', t('settings.preferences.interfaceVersion.v2', 'New (Beta)')],
          ] as [InterfaceVersion, string][]
        ).map(([value, label]) => {
          const selected = interfaceVersion === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setInterfaceVersion(value)}
              aria-pressed={selected}
              className={[
                'rounded-(--radius-md) border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-(--brand-default)',
                selected
                  ? 'border-(--brand-default) bg-(--bg-accent-subtle) text-(--txt-accent-primary)'
                  : 'border-(--border-subtle) text-(--txt-secondary) hover:border-(--border-strong-1)',
              ].join(' ')}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
