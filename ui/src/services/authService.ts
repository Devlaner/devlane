import { apiClient } from '../api/client';
import type {
  UserApiResponse,
  SignInRequest,
  SignUpRequest,
  EmailCheckResponse,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  AuthConfigResponse,
} from '../api/types';

export const authService = {
  async signIn(payload: SignInRequest): Promise<UserApiResponse> {
    const { data } = await apiClient.post<UserApiResponse>('/auth/sign-in/', payload);
    return data;
  },

  async signUp(payload: SignUpRequest): Promise<UserApiResponse> {
    const { data } = await apiClient.post<UserApiResponse>('/auth/sign-up/', payload);
    return data;
  },

  async signOut(): Promise<void> {
    await apiClient.post('/auth/sign-out/');
  },

  async getMe(): Promise<UserApiResponse | null> {
    try {
      const { data } = await apiClient.get<UserApiResponse>('/api/users/me/');
      return data;
    } catch {
      return null;
    }
  },

  async emailCheck(email: string): Promise<EmailCheckResponse> {
    const { data } = await apiClient.post<EmailCheckResponse>('/auth/email-check/', { email });
    return data;
  },

  async forgotPassword(payload: ForgotPasswordRequest): Promise<{ message: string }> {
    const { data } = await apiClient.post<{ message: string }>('/auth/forgot-password/', payload);
    return data;
  },

  async resetPassword(payload: ResetPasswordRequest): Promise<{ message: string }> {
    const { data } = await apiClient.post<{ message: string }>('/auth/reset-password/', payload);
    return data;
  },

  async getAuthConfig(): Promise<AuthConfigResponse> {
    const { data } = await apiClient.get<AuthConfigResponse>('/auth/config/');
    return data;
  },
};
