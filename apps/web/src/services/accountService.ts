import { apiClient } from '../api/client';

/**
 * Self-service account actions: deactivation and the verified email-change flow.
 */
export const accountService = {
  /** Deactivate the current account and sign out everywhere. */
  async deactivate(): Promise<void> {
    await apiClient.post('/api/users/me/deactivate/');
  },

  /** Start an email change: emails a confirmation code to the new address. */
  async requestEmailChange(newEmail: string): Promise<void> {
    await apiClient.post('/api/users/me/change-email/', { new_email: newEmail });
  },

  /** Confirm a pending email change with the emailed code; returns the new email. */
  async verifyEmailChange(code: string): Promise<string> {
    const { data } = await apiClient.post<{ email: string }>('/api/users/me/change-email/verify/', {
      code,
    });
    return data.email;
  },
};
