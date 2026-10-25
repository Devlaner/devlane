# Internationalization (i18n)

The web UI is translated with [`react-i18next`](https://react.i18next.com/).
`src/i18n/index.ts` initializes it once (imported from `main.tsx`); English
(`en`) is the source of truth and Azerbaijani (`az`) is a full translation.

## Using translations in a component

```tsx
import { useTranslation } from 'react-i18next';

function Example() {
  const { t } = useTranslation();
  return <h1>{t('settings.title', 'Settings')}</h1>;
}
```

- Always pass the English text as the **second argument** (`t('key', 'English')`).
  The `i18next-parser` reads it to fill `en/translation.json`.
- Interpolate values: `t('workItem.count', '{{count}} items', { count })`.
- For text with markup (links, bold), use the `<Trans>` component.
- Dates and numbers: use the helpers in `src/i18n/format.ts` so they follow the
  active language.

## Key naming

Keys are **flat, dotted strings** grouped by area, lowerCamelCase segments:

```
<area>.<subarea>.<name>
settings.preferences.language.title
workItem.new
```

Start a new area with the page/feature name (`settings.`, `workItem.`,
`project.`, `auth.`, `common.` for shared words).

## Adding / syncing keys

```
npm run i18n:extract
```

runs `i18next-parser`, which scans the code and writes any missing keys into
every locale file (English seeded from the `t()` default, other locales blank
for a translator to fill). Run it after wrapping strings.

## Adding a language

1. `cp src/i18n/locales/en/translation.json src/i18n/locales/<code>/translation.json`
   and translate the values.
2. Add `<code>` to `SUPPORTED_LANGUAGES` in `src/i18n/index.ts` (and `locales`
   in `i18next-parser.config.cjs`).

No component changes are needed.
