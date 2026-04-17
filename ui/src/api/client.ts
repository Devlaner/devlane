import axios, { type AxiosError } from 'axios';

/**
 * Prefer env-driven API base (VITE_API_BASE_URL).
 * In local dev, fallback remains http://localhost:8080.
 * In production, empty string keeps requests relative (same-origin).
 */
export const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '');

export const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

/** Clears Bearer token set from OAuth URL fragment (dev / cross-origin); cookie sessions unaffected. */
export function clearApiBearerAuthHeader(): void {
  delete apiClient.defaults.headers.common['Authorization'];
}

// When sending FormData (e.g. file upload), omit Content-Type so the browser sets
// multipart/form-data with the correct boundary. Otherwise the server gets
// Content-Type: application/json and cannot parse the multipart form → 400.
apiClient.interceptors.request.use((config) => {
  if (config.data instanceof FormData && config.headers) {
    const h = config.headers as Record<string, unknown>;
    delete h['Content-Type'];
  }
  return config;
});

/** Shape of API error response body (backend may return { error: string }) */
export interface ApiErrorResponse {
  error?: string;
  detail?: string;
  message?: string;
}

/**
 * Extract a user-facing error message from an Axios error.
 */
export function getApiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<ApiErrorResponse>;
    const body = ax.response?.data;
    if (body?.error) return body.error;
    if (body?.detail) return body.detail;
    if (body?.message) return body.message;
    if (ax.response?.status) return `Request failed (${ax.response.status}).`;
  }
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred.';
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    const message = getApiErrorMessage(error);
    return Promise.reject(new Error(message));
  },
);
