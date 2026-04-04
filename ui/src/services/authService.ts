import { apiClient } from '../api/client';
import type {
  UserApiResponse,
  SignInRequest,
  SignUpRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from '../api/types';

/**
 * Auth API: sign-in, sign-up, sign-out, forgot/reset password, current user.
 */
export const authService = {
  async signIn(payload: SignInRequest): Promise<UserApiResponse> {
    const { data } = await apiClient.post<UserApiResponse>('/auth/sign-in/', payload);
    return data;
  },

  /**
   * Sign up a new user. When instance has allow_public_signup off, invite_token is required.
   * POST /auth/sign-up/
   */
  async signUp(payload: SignUpRequest): Promise<UserApiResponse> {
    const { data } = await apiClient.post<UserApiResponse>('/auth/sign-up/', payload);
    return data;
  },

  async signOut(): Promise<void> {
    await apiClient.post('/auth/sign-out/');
  },

  /** POST /auth/forgot-password/ */
  async forgotPassword(payload: ForgotPasswordRequest): Promise<{ message: string }> {
    const { data } = await apiClient.post<{ message: string }>('/auth/forgot-password/', payload);
    return data;
  },

  /** POST /auth/reset-password/ */
  async resetPassword(payload: ResetPasswordRequest): Promise<{ message: string }> {
    const { data } = await apiClient.post<{ message: string }>('/auth/reset-password/', payload);
    return data;
  },

  async getMe(): Promise<UserApiResponse | null> {
    try {
      const { data } = await apiClient.get<UserApiResponse>('/api/users/me/');
      return data;
    } catch {
      return null;
    }
  },
};
