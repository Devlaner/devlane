import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { SetPasswordForm } from '@/components/shadcn/set-password-form';
import { AuthPageShellV2 } from '@/components/shadcn/auth-page-shell-v2';
import { isPasswordStrong } from '@/components/shadcn/password-field';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { getApiErrorMessage } from '../api/client';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function SetPasswordPageV2() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, setUserFromApi } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordsMatch = useMemo(
    () => confirmPassword.length > 0 && password === confirmPassword,
    [password, confirmPassword],
  );

  useDocumentTitle(t('auth.setPassword.documentTitle', 'Set password'));

  const isDisabled = !isPasswordStrong(password) || !passwordsMatch || isSubmitting;

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
        const updated = await authService.setPassword({ password });
        setUserFromApi(updated);
        navigate('/', { replace: true });
      } catch (err: unknown) {
        setError(
          getApiErrorMessage(err) ||
            t('common.genericError', 'Something went wrong. Please try again.'),
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [password, passwordsMatch, setUserFromApi, navigate, t],
  );

  return (
    <AuthPageShellV2>
      <SetPasswordForm
        email={user?.email ?? ''}
        password={password}
        onPasswordChange={setPassword}
        confirmPassword={confirmPassword}
        onConfirmPasswordChange={setConfirmPassword}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        error={error}
        isDisabled={isDisabled}
      />
    </AuthPageShellV2>
  );
}
