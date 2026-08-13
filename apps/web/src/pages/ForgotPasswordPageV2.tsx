import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { ForgotPasswordForm } from '@/components/shadcn/forgot-password-form';
import { AuthPageShellV2 } from '@/components/shadcn/auth-page-shell-v2';
import { authService } from '../services/authService';
import { getApiErrorMessage } from '../api/client';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const RESEND_COOLDOWN_SECONDS = 30;

export function ForgotPasswordPageV2() {
  const { t } = useTranslation();
  const location = useLocation();
  const prefilledEmail = (location.state as { email?: string } | null)?.email ?? '';

  const [email, setEmail] = useState(prefilledEmail);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useDocumentTitle(t('auth.forgotPassword.documentTitle', 'Forgot password'));

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setIsSubmitting(true);
      try {
        const normalized = email.trim().toLowerCase();
        await authService.forgotPassword({ email: normalized });
        setEmail(normalized);
        setSuccess(true);
        setCooldown(RESEND_COOLDOWN_SECONDS);
      } catch (err: unknown) {
        setError(
          getApiErrorMessage(err) ||
            t('common.genericError', 'Something went wrong. Please try again.'),
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [email, t],
  );

  const handleResend = useCallback(async () => {
    if (cooldown > 0) return;
    setError('');
    setIsSubmitting(true);
    try {
      const normalized = email.trim().toLowerCase();
      await authService.forgotPassword({ email: normalized });
      setEmail(normalized);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err: unknown) {
      setError(
        getApiErrorMessage(err) ||
          t('common.genericError', 'Something went wrong. Please try again.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [email, cooldown, t]);

  return (
    <AuthPageShellV2>
      <ForgotPasswordForm
        email={email}
        onEmailChange={setEmail}
        onSubmit={handleSubmit}
        onResend={() => void handleResend()}
        isSubmitting={isSubmitting}
        error={error}
        success={success}
        cooldown={cooldown}
      />
    </AuthPageShellV2>
  );
}
