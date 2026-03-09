import { apiClient } from "../api/client";
import type { InviteByTokenResponse } from "../api/types";

/**
 * Public invitation APIs (no auth required).
 */
export const invitationService = {
  /**
   * Get invite details by token for the invite landing page.
   * GET /api/invitations/by-token/?token=...
   */
  async getByToken(token: string): Promise<InviteByTokenResponse> {
    const { data } = await apiClient.get<InviteByTokenResponse>(
      "/api/invitations/by-token/",
      { params: { token } },
    );
    return data;
  },

  /**
   * Decline (ignore) an invitation by token.
   * POST /api/invitations/decline/
   */
  async declineByToken(token: string): Promise<void> {
    await apiClient.post("/api/invitations/decline/", { token });
  },
};
