import { useState, useCallback, useEffect } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { Button, Input } from '../components/ui';
import { authService } from '../services/authService';
import { getApiErrorMessage } from '../api/client';
import { CircleAlert, CircleCheck, ArrowLeft } from 'lucide-react';
import { AuthPageShell } from '../components/auth/AuthPageShell';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const RESEND_COOLDOWN_SECONDS = 30;

export function ForgotPasswordPage() {
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
    <AuthPageShell mode="sign-in" enableSignup={true}>
      <div className="w-full max-w-[22.5rem]">
        <Link
          to="/login"
          className="mb-4 flex items-center gap-1 text-xs text-(--txt-tertiary) hover:text-(--txt-primary)"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('auth.forgotPassword.backToSignIn', 'Back to sign in')}
        </Link>

        <h1 className="mb-1 text-2xl font-semibold text-(--txt-primary)">
          {t('auth.forgotPassword.title', 'Reset your password')}
        </h1>
        <p className="mb-6 text-sm text-(--txt-secondary)">
          {t(
            'auth.forgotPassword.subtitle',
            "Enter your email and we'll send you a link to reset your password.",
          )}
        </p>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <Trans
                i18nKey="auth.forgotPassword.successMessage"
                defaults="If <b>{{email}}</b> is registered, you'll receive a reset link shortly. Check your inbox and spam folder."
                values={{ email }}
                components={{ b: <strong /> }}
              />
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label={t('common.email', 'Email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('common.emailPlaceholder', 'you@example.com')}
            required
            autoComplete="email"
            disabled={success && cooldown > 0}
            autoFocus
          />

          {!success ? (
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting
                ? t('auth.forgotPassword.sending', 'Sending…')
                : t('auth.forgotPassword.sendResetLink', 'Send reset link')}
            </Button>
          ) : (
            <Button
              type="button"
              className="w-full"
              disabled={cooldown > 0 || isSubmitting}
              onClick={handleResend}
            >
              {cooldown > 0
                ? t('auth.forgotPassword.resendIn', 'Resend in {{count}}s', { count: cooldown })
                : t('auth.forgotPassword.resendResetLink', 'Resend reset link')}
            </Button>
          )}
        </form>
      </div>
    </AuthPageShell>
  );
}
