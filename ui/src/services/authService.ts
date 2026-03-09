import { apiClient } from "../api/client";
import type {
  UserApiResponse,
  SignInRequest,
  SignUpRequest,
} from "../api/types";

/**
 * Auth API: sign-in, sign-up, sign-out, current user.
 */
export const authService = {
  async signIn(payload: SignInRequest): Promise<UserApiResponse> {
    const { data } = await apiClient.post<UserApiResponse>(
      "/auth/sign-in/",
      payload,
    );
    return data;
  },

  /**
   * Sign up a new user. When instance has allow_public_signup off, invite_token is required.
   * POST /auth/sign-up/
   */
  async signUp(payload: SignUpRequest): Promise<UserApiResponse> {
    const { data } = await apiClient.post<UserApiResponse>(
      "/auth/sign-up/",
      payload,
    );
    return data;
  },

  async signOut(): Promise<void> {
    await apiClient.post("/auth/sign-out/");
  },

  async getMe(): Promise<UserApiResponse | null> {
    try {
      const { data } = await apiClient.get<UserApiResponse>("/api/users/me/");
      return data;
    } catch {
      return null;
    }
  },
};
