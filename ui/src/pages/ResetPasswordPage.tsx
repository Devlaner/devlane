import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui';
import { IconEye, IconEyeOff } from '../components/ui/PasswordRevealIcons';
import { authService } from '../services/authService';

function getPasswordStrength(password: string) {
  const checks = {
    minLength: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  };
  const passed = Object.values(checks).filter(Boolean).length;
  return { checks, passed, valid: passed === 5 };
}

const IconCheckSmall = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

function PasswordStrengthIndicator({ password }: { password: string }) {
  const { checks, passed } = getPasswordStrength(password);
  if (!password) return null;

  const barColor =
    passed <= 1
      ? 'bg-red-500'
      : passed <= 2
        ? 'bg-orange-500'
        : passed <= 3
          ? 'bg-yellow-500'
          : passed <= 4
            ? 'bg-lime-500'
            : 'bg-green-500';

  const criteria = [
    { met: checks.minLength, label: 'Min 8 characters' },
    { met: checks.upper, label: 'Uppercase letter' },
    { met: checks.lower, label: 'Lowercase letter' },
    { met: checks.number, label: 'A number' },
    { met: checks.special, label: 'A special character' },
  ];

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i < passed ? barColor : 'bg-(--border-subtle)'}`}
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
        {criteria.map(({ met, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-(--txt-secondary)">
            <span
              className={`flex size-3.5 shrink-0 items-center justify-center rounded-full ${
                met
                  ? 'bg-green-500 text-white'
                  : 'border border-(--border-subtle) text-transparent'
              }`}
            >
              <IconCheckSmall />
            </span>
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  if (!token) {
    return (
      <div className="relative flex min-h-screen w-full flex-col items-center overflow-y-auto bg-(--bg-canvas) px-6 pt-16 pb-10">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-(--txt-primary)">Devlane</h1>
        </div>
        <div className="w-full max-w-[22.5rem] text-center">
          <h2 className="text-xl font-semibold text-(--txt-primary)">Invalid reset link</h2>
          <p className="mt-2 text-sm text-(--txt-secondary)">
            This password reset link is missing or invalid.
          </p>
          <Link
            to="/forgot-password"
            className="mt-4 inline-block text-sm font-medium text-(--txt-accent) hover:underline"
          >
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="relative flex min-h-screen w-full flex-col items-center overflow-y-auto bg-(--bg-canvas) px-6 pt-16 pb-10">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-(--txt-primary)">Devlane</h1>
        </div>
        <div className="w-full max-w-[22.5rem] text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/40">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-green-600"
              aria-hidden
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-(--txt-primary)">Password reset</h2>
          <p className="mt-2 text-sm text-(--txt-secondary)">
            Your password has been successfully reset. You can now sign in with your new password.
          </p>
          <Link
            to="/login"
            className="mt-4 inline-block text-sm font-medium text-(--txt-accent) hover:underline"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!strength.valid) {
      setError('Please meet all password requirements.');
      return;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    try {
      await authService.resetPassword({ token, new_password: password });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center overflow-y-auto bg-(--bg-canvas) px-6 pt-16 pb-10">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-(--txt-primary)">Devlane</h1>
      </div>

      <div className="w-full max-w-[22.5rem]">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-(--txt-primary)">Create a new password</h2>
          <p className="mt-1 text-sm text-(--txt-secondary)">
            Choose a strong password for your account.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-(--radius-md) border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="reset-password"
              className="mb-1 block text-sm font-medium text-(--txt-secondary)"
            >
              New password
            </label>
            <div className="relative">
              <input
                id="reset-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                required
                minLength={8}
                autoFocus
                autoComplete="new-password"
                className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) py-2 pl-3 pr-10 text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:border-(--border-strong) focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-(--txt-icon-tertiary) hover:text-(--txt-secondary)"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
            <PasswordStrengthIndicator password={password} />
          </div>

          <div>
            <label
              htmlFor="reset-confirm"
              className="mb-1 block text-sm font-medium text-(--txt-secondary)"
            >
              Confirm password
            </label>
            <div className="relative">
              <input
                id="reset-confirm"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                required
                autoComplete="new-password"
                className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) py-2 pl-3 pr-10 text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:border-(--border-strong) focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((p) => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-(--txt-icon-tertiary) hover:text-(--txt-secondary)"
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showConfirm ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
            {confirmPassword.length > 0 && (
              <p
                className={`mt-1 text-xs ${
                  passwordsMatch ? 'text-green-600' : 'text-(--txt-destructive)'
                }`}
              >
                {passwordsMatch ? 'Passwords match' : "Passwords don't match"}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || !strength.valid || !passwordsMatch}
          >
            {isSubmitting ? 'Resetting…' : 'Reset password'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm">
          <Link
            to="/login"
            className="font-medium text-(--txt-accent) hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
