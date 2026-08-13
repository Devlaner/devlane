import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, Link } from 'react-router-dom';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { ResetPasswordForm } from '@/components/shadcn/reset-password-form';
import { AuthPageShellV2 } from '@/components/shadcn/auth-page-shell-v2';
import { isPasswordStrong } from '@/components/shadcn/password-field';
import { authService } from '../services/authService';
import { getApiErrorMessage } from '../api/client';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function ResetPasswordPageV2() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const invalidToken = !token;

  const passwordsMatch = useMemo(
    () => confirmPassword.length > 0 && password === confirmPassword,
    [password, confirmPassword],
  );

  useDocumentTitle(t('auth.resetPassword.documentTitle', 'Reset password'));

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');

      if (!isPasswordStrong(password)) {
        setError(t('auth.password.strengthError', 'Password does not meet strength requirements.'));
        return;
      }
      if (!passwordsMatch) {
        setError(t('auth.password.mismatch', 'Passwords do not match.'));
        return;
      }

      setIsSubmitting(true);
      try {
        await authService.resetPassword({ token, new_password: password });
        setSuccess(true);
      } catch (err: unknown) {
        setError(getApiErrorMessage(err));
      } finally {
        setIsSubmitting(false);
      }
    },
    [token, password, passwordsMatch, t],
  );

  if (invalidToken) {
    return (
      <AuthPageShellV2>
        <div className="text-center">
          <CircleAlert className="mx-auto mb-3 size-10 text-red-400" />
          <h1 className="mb-2 text-xl font-semibold">
            {t('auth.resetPassword.invalidTitle', 'Invalid reset link')}
          </h1>
          <p className="text-muted-foreground mb-4 text-sm">
            {t(
              'auth.resetPassword.invalidBody',
              'This password reset link is invalid or has expired. Please request a new one.',
            )}
          </p>
          <Link
            to="/forgot-password-v2"
            className="text-sm font-medium underline underline-offset-4"
          >
            {t('auth.resetPassword.requestNew', 'Request new reset link')}
          </Link>
        </div>
      </AuthPageShellV2>
    );
  }

  if (success) {
    return (
      <AuthPageShellV2>
        <div className="text-center">
          <CircleCheck className="mx-auto mb-3 size-10 text-green-500" />
          <h1 className="mb-2 text-xl font-semibold">
            {t('auth.resetPassword.successTitle', 'Password reset!')}
          </h1>
          <p className="text-muted-foreground mb-4 text-sm">
            {t(
              'auth.resetPassword.successBody',
              'Your password has been reset successfully. You can now sign in with your new password.',
            )}
          </p>
          <Link to="/login-v2" className="text-sm font-medium underline underline-offset-4">
            {t('common.goToSignIn', 'Go to sign in')}
          </Link>
        </div>
      </AuthPageShellV2>
    );
  }

  return (
    <AuthPageShellV2>
      <ResetPasswordForm
        password={password}
        onPasswordChange={setPassword}
        confirmPassword={confirmPassword}
        onConfirmPasswordChange={setConfirmPassword}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        error={error}
      />
    </AuthPageShellV2>
  );
}
