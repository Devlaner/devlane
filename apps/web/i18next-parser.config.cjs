/**
 * i18next-parser config. Scans the web source for t()/<Trans> usage and keeps
 * the locale JSON files in sync. Run with `npm run i18n:extract`.
 * English is the source of truth; missing keys are added to every locale.
 */
module.exports = {
  input: ['src/**/*.{ts,tsx}'],
  output: 'src/i18n/locales/$LOCALE/$NAMESPACE.json',
  locales: ['en', 'az'],
  defaultNamespace: 'translation',
  // Match the runtime config: flat, dotted keys.
  keySeparator: false,
  namespaceSeparator: false,
  // Keep files readable + diff-friendly, and don't silently drop keys.
  sort: true,
  keepRemoved: true,
  createOldCatalogs: false,
  // For a new/untranslated key, seed the value with the key's default (English
  // text passed as the second t() arg). az values are filled in by translators.
  defaultValue: (locale, _ns, key, value) => (locale === 'en' ? (value ?? key) : ''),
};
