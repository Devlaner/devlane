import i18n from '../i18n';

// Locale-aware "x ago" using Intl.RelativeTimeFormat, keyed to the active UI
// language, so this reads correctly in every locale without a translation key
// per unit. "just now" is the one phrase Intl can't express, so it's a key.
export function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const s = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (s < 60) return i18n.t('common.time.justNow', 'just now');
  const rtf = new Intl.RelativeTimeFormat(i18n.resolvedLanguage || 'en', { numeric: 'always' });
  if (s < 3600) return rtf.format(-Math.floor(s / 60), 'minute');
  if (s < 86400) return rtf.format(-Math.floor(s / 3600), 'hour');
  if (s < 2592000) return rtf.format(-Math.floor(s / 86400), 'day');
  if (s < 31536000) return rtf.format(-Math.floor(s / 2592000), 'month');
  return rtf.format(-Math.floor(s / 31536000), 'year');
}

// Build timezone options: UTC offset + label (e.g. "UTC-07:00 America/Los_Angeles")
export function getTimezoneOptions(): { value: string; label: string }[] {
  try {
    const ids =
      typeof Intl !== 'undefined' &&
      typeof (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf ===
        'function'
        ? (Intl as { supportedValuesOf: (key: string) => string[] }).supportedValuesOf('timeZone')
        : [
            'UTC',
            'America/New_York',
            'America/Chicago',
            'America/Denver',
            'America/Los_Angeles',
            'Europe/London',
            'Europe/Paris',
            'Asia/Tokyo',
            'Asia/Kolkata',
            'Australia/Sydney',
          ];
    const now = new Date();
    return ids
      .map((value) => {
        try {
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: value,
            timeZoneName: 'longOffset',
          });
          const parts = formatter.formatToParts(now);
          const offsetPart = parts.find((p) => p.type === 'timeZoneName');
          const offset = offsetPart?.value ?? 'UTC';
          return { value, label: `${offset} ${value}` };
        } catch {
          return { value, label: value };
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  } catch {
    return [
      { value: 'UTC', label: 'UTC UTC' },
      { value: 'America/New_York', label: 'America/New York' },
    ];
  }
}
