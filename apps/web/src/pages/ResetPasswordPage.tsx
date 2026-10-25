import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, Link } from 'react-router-dom';
import { Button, Input } from '../components/ui';
import { authService } from '../services/authService';
import { Eye, EyeOff, CircleAlert, CircleCheck } from 'lucide-react';
import { AuthPageShell } from '../components/auth/AuthPageShell';
import { getApiErrorMessage } from '../api/client';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

interface PasswordCriteria {
  minLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasDigit: boolean;
  hasSpecial: boolean;
}

function getPasswordCriteria(pw: string): PasswordCriteria {
  return {
    minLength: pw.length >= 8,
    hasUpper: /[A-Z]/.test(pw),
    hasLower: /[a-z]/.test(pw),
    hasDigit: /\d/.test(pw),
    hasSpecial: /[!@#$%^&*()\-_+=[\]{}|;:'",.<>?/]/.test(pw),
  };
}

function isPasswordStrong(pw: string): boolean {
  const c = getPasswordCriteria(pw);
  return c.minLength && c.hasUpper && c.hasLower && c.hasDigit && c.hasSpecial;
}

function PasswordStrengthIndicator({ password }: { password: string }) {
  const { t } = useTranslation();
  const criteria = getPasswordCriteria(password);
  if (!password) return null;

  const items: [string, boolean][] = [
    [t('auth.password.min8', 'At least 8 characters'), criteria.minLength],
    [t('auth.password.upper', 'Uppercase letter'), criteria.hasUpper],
    [t('auth.password.lower', 'Lowercase letter'), criteria.hasLower],
    [t('auth.password.number', 'Number'), criteria.hasDigit],
    [t('auth.password.special', 'Special character'), criteria.hasSpecial],
  ];

  return (
    <div className="mt-2 space-y-1">
      {items.map(([label, met]) => (
        <div key={label} className="flex items-center gap-1.5 text-xs">
          {met ? (
            <CircleCheck className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <CircleAlert className="h-3.5 w-3.5 text-(--txt-tertiary)" />
          )}
          <span className={met ? 'text-green-600' : 'text-(--txt-tertiary)'}>{label}</span>
        </div>
      ))}
    </div>
  );
}

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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
      <AuthPageShell mode="sign-in">
        <div className="w-full max-w-[22.5rem] text-center">
          <CircleAlert className="mx-auto mb-3 h-10 w-10 text-red-400" />
          <h1 className="mb-2 text-xl font-semibold text-(--txt-primary)">
            {t('auth.resetPassword.invalidTitle', 'Invalid reset link')}
          </h1>
          <p className="mb-4 text-sm text-(--txt-secondary)">
            {t(
              'auth.resetPassword.invalidBody',
              'This password reset link is invalid or has expired. Please request a new one.',
            )}
          </p>
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-(--txt-accent) hover:underline"
          >
            {t('auth.resetPassword.requestNew', 'Request new reset link')}
          </Link>
        </div>
      </AuthPageShell>
    );
  }

  if (success) {
    return (
      <AuthPageShell mode="sign-in">
        <div className="w-full max-w-[22.5rem] text-center">
          <CircleCheck className="mx-auto mb-3 h-10 w-10 text-green-500" />
          <h1 className="mb-2 text-xl font-semibold text-(--txt-primary)">
            {t('auth.resetPassword.successTitle', 'Password reset!')}
          </h1>
          <p className="mb-4 text-sm text-(--txt-secondary)">
            {t(
              'auth.resetPassword.successBody',
              'Your password has been reset successfully. You can now sign in with your new password.',
            )}
          </p>
          <Link to="/login" className="text-sm font-medium text-(--txt-accent) hover:underline">
            {t('common.goToSignIn', 'Go to sign in')}
          </Link>
        </div>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell mode="sign-in">
      <div className="w-full max-w-[22.5rem]">
        <h1 className="mb-1 text-2xl font-semibold text-(--txt-primary)">
          {t('auth.resetPassword.title', 'Set a new password')}
        </h1>
        <p className="mb-6 text-sm text-(--txt-secondary)">
          {t('auth.resetPassword.subtitle', 'Choose a strong password to secure your account.')}
        </p>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="relative">
            <Input
              label={t('auth.resetPassword.newPassword', 'New password')}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.resetPassword.newPasswordPlaceholder', 'Enter new password')}
              required
              autoComplete="new-password"
              autoFocus
            />
            <button
              type="button"
              className="absolute top-[2.1rem] right-3 text-(--txt-tertiary) hover:text-(--txt-primary)"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={
                showPassword
                  ? t('auth.resetPassword.hideNewPassword', 'Hide new password')
                  : t('auth.resetPassword.showNewPassword', 'Show new password')
              }
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <PasswordStrengthIndicator password={password} />

          <div className="relative">
            <Input
              label={t('auth.resetPassword.confirmNewPassword', 'Confirm new password')}
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t(
                'auth.resetPassword.confirmNewPasswordPlaceholder',
                'Re-enter new password',
              )}
              required
              autoComplete="new-password"
            />
            <button
              type="button"
              className="absolute top-[2.1rem] right-3 text-(--txt-tertiary) hover:text-(--txt-primary)"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={
                showConfirm
                  ? t('auth.resetPassword.hideConfirmNewPassword', 'Hide confirm new password')
                  : t('auth.resetPassword.showConfirmNewPassword', 'Show confirm new password')
              }
              aria-pressed={showConfirm}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            {confirmPassword && !passwordsMatch && (
              <p className="mt-1 text-xs text-red-500">
                {t('common.passwordsDoNotMatchInline', 'Passwords do not match')}
              </p>
            )}
            {passwordsMatch && (
              <p className="mt-1 flex items-center gap-1 text-xs text-green-600">
                <CircleCheck className="h-3 w-3" /> {t('common.passwordsMatch', 'Passwords match')}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting
              ? t('auth.resetPassword.resetting', 'Resetting…')
              : t('auth.resetPassword.submit', 'Reset password')}
          </Button>

          <p className="text-center text-sm text-(--txt-secondary)">
            {t('auth.resetPassword.rememberPassword', 'Remember your password?')}{' '}
            <Link to="/login" className="font-medium text-(--txt-accent) hover:underline">
              {t('common.signIn', 'Sign in')}
            </Link>
          </p>
        </form>
      </div>
    </AuthPageShell>
  );
}
