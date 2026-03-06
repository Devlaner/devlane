/**
 * Environment and app config.
 * Centralizes env access so components don't depend on import.meta.env directly.
 */

const getEnv = (key: string): string => {
  if (typeof import.meta === 'undefined' || !import.meta.env) return '';
  const v = import.meta.env[key];
  return typeof v === 'string' ? v : '';
};

export const config = {
  /** Base URL for the API (e.g. '' for same origin or 'http://localhost:8080') */
  apiBaseUrl: getEnv('VITE_API_BASE_URL') ?? '',
} as const;
