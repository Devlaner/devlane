import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en/translation.json';
import az from './locales/az/translation.json';
import './dynamicKeys'; // registers template-literal keys for the parser

/**
 * localStorage key holding the chosen UI language. Named to match the theme
 * key (`devlane-theme`) so client preferences stay consistent.
 */
export const LANGUAGE_STORAGE_KEY = 'devlane-language';

/** Languages the UI ships translations for. Add a language here + a JSON file. */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'az', label: 'Azərbaycanca', dir: 'ltr' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

const resources = {
  en: { translation: en },
  az: { translation: az },
} as const;

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    nonExplicitSupportedLngs: true, // treat "en-US" etc. as "en"
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false }, // React already escapes
    returnNull: false,
    // Keys are flat, dotted strings (e.g. "settings.preferences.language.title"),
    // not nested objects — keeps a large key set easy to grep and diff.
    keySeparator: false,
    nsSeparator: false,
  });

/** Reflect the active language on <html lang> (and dir, for future RTL locales). */
function applyHtmlLang(code: string) {
  if (typeof document === 'undefined') return;
  const meta = SUPPORTED_LANGUAGES.find((l) => l.code === code);
  document.documentElement.lang = code;
  document.documentElement.dir = meta?.dir ?? 'ltr';
}

applyHtmlLang(i18n.resolvedLanguage ?? 'en');
i18n.on('languageChanged', applyHtmlLang);

/** Change + persist the UI language (the detector caches it to localStorage). */
export function setLanguage(code: LanguageCode) {
  void i18n.changeLanguage(code);
}

export default i18n;
