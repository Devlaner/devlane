import axios, { type AxiosError } from 'axios';
import { config } from '../config/env';

/**
 * Shared Axios instance for all API requests.
 * - baseURL from config
 * - credentials included for cookie-based auth
 * - consistent error handling
 */
export const apiClient = axios.create({
  baseURL: config.apiBaseUrl,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
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
  }
);
