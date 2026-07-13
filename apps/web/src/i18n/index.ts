import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enAuth from './locales/en/auth.json';
import enCommon from './locales/en/common.json';
import esAuth from './locales/es/auth.json';
import esCommon from './locales/es/common.json';

/** localStorage key holding the user's chosen UI language. */
export const LANGUAGE_STORAGE_KEY = 'devlane.language';

/** Languages the UI currently ships translations for. */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

const resources = {
  en: { auth: enAuth, common: enCommon },
  es: { auth: esAuth, common: esCommon },
} as const;

function initialLanguage(): string {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored && SUPPORTED_LANGUAGES.some((l) => l.code === stored)) return stored;
  return 'en';
}

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage(),
  fallbackLng: 'en',
  ns: ['common', 'auth'],
  defaultNS: 'common',
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,
});

/** Persist and apply a language change. */
export function setLanguage(code: LanguageCode) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  }
  void i18n.changeLanguage(code);
}

export default i18n;
