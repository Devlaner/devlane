import i18n from './index';

/** The active UI language, for Intl formatters. Falls back to English. */
function activeLocale(): string {
  return i18n.resolvedLanguage || i18n.language || 'en';
}

/** Format a date with Intl, keyed to the active UI language. */
export function formatDate(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(activeLocale(), options).format(d);
}

/** Format a number with Intl, keyed to the active UI language. */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(activeLocale(), options).format(value);
}
